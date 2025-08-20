import express from 'express';
import fs, { read } from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { Client, GatewayIntentBits } from 'discord.js';
import { exec, spawn } from 'child_process';
// Télécharge une image depuis une URL et la sauvegarde localement
import https from 'https';
import http from 'http';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'discord', 'config.json'), 'utf8'));

const DATA_FILE = path.join(__dirname, 'src', 'data', 'games.json');
// --- LOGIQUE DE REPONSE DU JOUR ET GESTION DES IDS ---
const ANSWERS_FILE = path.join(__dirname, 'src', 'data', 'answers.json');

var modes = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'modes.json'), 'utf8'));
modes = modes.filter(m => m.key !== 'hardcore'); // On retire hardcore car géré différemment

app.use(cors());
app.use(express.json());

// --- FLAG CRON READY ---
let cronReady = true; // true au démarrage, false pendant le cron

// --- Purge et génération du jour si besoin au démarrage ---
async function ensureDailyPurgeAndGeneration() {
   // 0. Met à jour les avatars Discord
  await updateAllDiscordAvatars();

  // 1. Fetch nouveaux messages du jour
  let scrapOk = true;
  try {
    await new Promise((resolve) => {
      const child = spawn('node', ['./discord/scrap-messages.js'], { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code !== 0) {
          console.error('[INIT] Erreur scrap-messages: code', code);
          scrapOk = false;
        }
        console.log('[INIT] scrap-messages terminé');
        resolve();
      });
    });
  } catch (e) {
    console.error('[INIT] Exception scrap-messages:', e);
    scrapOk = false;
  }

  // 2. Exécute filtrageData.js seulement si scrap-messages a réussi
  if (scrapOk) {
    try {
      await new Promise((resolve) => {
        const child = spawn('node', ['./discord/filtrageData.js'], { stdio: 'inherit' });
        child.on('close', (code) => {
          if (code !== 0) {
            console.error('[INIT] Erreur filtrageData: code', code);
          }
          console.log('[INIT] filtrageData terminé');
          resolve();
        });
      });
    } catch (e) {
      console.error('[INIT] Exception filtrageData:', e);
    }
  } else {
    console.error('[INIT] filtrageData non lancé car scrap-messages a échoué');
  }

  const today = getAnswerDateForToday();
  const answers = readAnswers();
  const hasToday = Object.values(answers).some(a => a && a.date === today);
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));
  if (!hasToday) {
    cronReady = false;
    writeGames({});
    for (const modeObj of modes) {
      getAnswerForDay(modeObj.key, today, vjlData);
    }
    const refreshed = readAnswers();
    const todayAnswer = refreshed[Object.keys(refreshed).find(id => refreshed[id].date === today)];
    if (todayAnswer 
      && todayAnswer.modes['citation'] 
      && todayAnswer.modes['image']
      && todayAnswer.modes['emoji']
      && todayAnswer.modes['splash']) {
      generateCitationOfTheDay(today, getPersonById(todayAnswer.modes['citation'].personId).discordUserId);
      await generateImageOfTheDay(today, getPersonById(todayAnswer.modes['image'].personId).discordUserId);
      generateEmojisOfTheDay(today, getPersonById(todayAnswer.modes['emoji'].personId).discordUserId);
      generateSplashOfTheDay(today, getPersonById(todayAnswer.modes['splash'].personId).discordUserId);
    }
    cronReady = true;
    console.log(`[INIT] Purge et génération effectuées pour la date ${today} (games.json vidé, answers du jour générées)`);
  }
}

// Appel au démarrage
await ensureDailyPurgeAndGeneration();

// Middleware pour bloquer toutes les requêtes tant que le cron n'est pas prêt
app.use((req, res, next) => {
  if (!cronReady && req.path !== '/api/cron-ready') {
    return res.status(503).json({ error: 'cron_not_ready' });
  }
  next();
});

// Route pour exposer l'état du cron
app.get('/api/cron-ready', (req, res) => {
  res.json({ ready: cronReady });
});

// GET /api/vjl : retourne le contenu du fichier vjl.json à chaque requête
app.get('/api/vjl', async (req, res) => {
  const vjlPath = path.join(__dirname, 'src', 'data', 'vjl.json');
  try {
    const vjlData = JSON.parse(fs.readFileSync(vjlPath, 'utf8'));
    res.json(vjlData);
  } catch (e) {
    res.status(500).json({ error: 'Erreur lecture vjl.json' });
  }
});

// Helper: get today's answerDate (Europe/Paris)
function getParisDateObj(date = new Date()) {
  // Retourne un objet Date à l'heure Europe/Paris correspondant à la date passée (ou maintenant)
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  const second = parts.find(p => p.type === 'second')?.value;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

function getPersonById(id) {
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));
  return vjlData.find(p => p.id === id);
}

function getAnswerDateForToday() {
  const nowParis = getParisDateObj();
  const year = nowParis.getFullYear();
  const month = (nowParis.getMonth() + 1).toString().padStart(2, '0');
  const day = nowParis.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: read/write JSON file
function readGames() {
  if (!fs.existsSync(DATA_FILE) || fs.statSync(DATA_FILE).size === 0) {
    fs.writeFileSync(DATA_FILE, '{}', 'utf8');
    return {};
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeGames(games) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf8');
}
function readAnswers() {
  if (!fs.existsSync(ANSWERS_FILE) || fs.statSync(ANSWERS_FILE).size === 0) {
    fs.writeFileSync(ANSWERS_FILE, '{}', 'utf8');
    return {};
  }
  return JSON.parse(fs.readFileSync(ANSWERS_FILE, 'utf8'));
}
function writeAnswers(answers) {
  fs.writeFileSync(ANSWERS_FILE, JSON.stringify(answers, null, 2), 'utf8');
}

function getOrCreateAnswerNumericId(date) {
  let answers = readAnswers();
  // 1. Si une entrée a déjà la bonne date (peu importe les modes), on la réutilise
  for (const id in answers) {
    if (answers[id] && answers[id].date === date) {
      return Number(id);
    }
  }
  // 2. Sinon, on crée un nouvel ID
  const nextId = Object.keys(answers).map(Number).filter(n => !isNaN(n)).reduce((max, n) => Math.max(max, n), 0) + 1;
  return nextId;
}

function getAnswerForDay(mode, date, vjlData, createIfMissing = true) {
  let answers = readAnswers();
  const id = getOrCreateAnswerNumericId(date);
  if (!answers[id]) {
    if (!createIfMissing) return null;
    answers[id] = { date, modes: {} };
  }
  if (!answers[id].modes[mode]) {
    if (!createIfMissing) return null;
    // Choisir n'importe qui dans vjlData, sans restriction
    let pool = vjlData.map(p => p.id);
    let candidate = pool[Math.floor(Math.random() * pool.length)];
    answers[id].modes[mode] = { personId: candidate };
    writeAnswers(answers);
  }
  return { personId: answers[id].modes[mode].personId, answerId: Number(id) };
}

// GET /api/answer/:mode/:date
app.get('/api/answer/:mode/:date', (req, res) => {
  const { mode, date } = req.params;
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));
  const { personId, answerId } = getAnswerForDay(mode, date, vjlData);
  res.json({ personId, answerId });
});

// Nouvelle route pour obtenir la réponse SANS création automatique
app.get('/api/answer-if-exists/:mode/:date', (req, res) => {
  const { mode, date } = req.params;
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));
  const result = getAnswerForDay(mode, date, vjlData, false);
  if (!result) return res.json(null);
  res.json(result);
});

// GET /api/game-count/:mode
app.get('/api/game-count/:mode', (req, res) => {
  const { mode } = req.params;
  const games = readGames();
  const today = getAnswerDateForToday();
  // Récupère la bonne réponse du jour pour ce mode
  const answers = readAnswers();
  let todayPersonId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today && answers[id].modes && answers[id].modes[mode]) {
      todayPersonId = answers[id].modes[mode].personId;
      break;
    }
  }
  let count = 0;
  if (todayPersonId !== null) {
    // On récupère le bon id numérique de answers pour aujourd'hui
    let todayAnswerId = null;
    for (const ansId in answers) {
      if (answers[ansId] && answers[ansId].date === today) {
        todayAnswerId = Number(ansId);
        break;
      }
    }
    for (const userId in games) {
      const user = games[userId];
      const state = user[mode];
      if (
        state &&
        state.answerId === todayAnswerId &&
        state.hasWon &&
        Array.isArray(state.guesses) &&
        state.guesses.length > 0 &&
        state.guesses[state.guesses.length - 1] === todayPersonId
      ) {
        count++;
      }
    }
  }
  res.json({ count });
});

// GET /api/game/:userId/:mode
app.get('/api/game/:userId/:mode', (req, res) => {
  const { userId, mode } = req.params;
  const games = readGames();
  const today = getAnswerDateForToday();
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));
  // S'assure que la réponse du jour est bien générée et stockée
  const { answerId } = getAnswerForDay(mode, today, vjlData);
  let user = games[userId] || {};
  let state = user[mode] || null;
  if (!state || typeof state !== 'object') {
    state = { guesses: [], hasWon: false, answerId };
    user[mode] = state;
    games[userId] = user;
    writeGames(games);
  }
  res.json(state);
});

// POST /api/game/:userId/:mode
app.post('/api/game/:userId/:mode', (req, res) => {
  const { userId, mode } = req.params;
  const { guesses, hasWon } = req.body;
  const games = readGames();
  const today = getAnswerDateForToday();
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));
  const { answerId } = getAnswerForDay(mode, today, vjlData);
  if (!games[userId]) games[userId] = {};
  let state = games[userId][mode] || null;
  if (!state || typeof state !== 'object') {
    state = { guesses, hasWon, answerId };
  } else {
    state.guesses = guesses;
    state.hasWon = hasWon;
    state.answerId = answerId;
  }
  // Ajout : si victoire, on enregistre le rang (combientième)
  if (hasWon && !state.rank) {
    // On compte le nombre de joueurs ayant déjà gagné aujourd'hui sur ce mode
    let rank = 1;
    for (const otherUserId in games) {
      if (otherUserId === userId) continue;
      const other = games[otherUserId][mode];
      if (
        other &&
        other.answerId === answerId &&
        other.hasWon &&
        Array.isArray(other.guesses) &&
        other.guesses.length > 0 &&
        other.guesses[other.guesses.length - 1] === state.guesses[state.guesses.length - 1]
      ) {
        rank++;
      }
    }
    state.rank = rank;
  }
  games[userId][mode] = state;
  writeGames(games);
  res.json({ ok: true });
});

// Ajout d'une route pour exposer la date du jour (Europe/Paris) au frontend
app.get('/api/today', (req, res) => {
  res.json({ today: getAnswerDateForToday() });
});

// GET /api/guess-counts/:mode
// Renvoie pour la partie du jour un objet { [personId]: count } où count = nombre de joueurs ayant tenté ce membre en guess (au moins une fois)
app.get('/api/guess-counts/:mode', (req, res) => {
  const { mode } = req.params;
  const games = readGames();
  const today = getAnswerDateForToday();
  // Récupère la bonne réponse du jour pour ce mode
  const answers = readAnswers();
  let todayAnswerId = null;
  for (const ansId in answers) {
    if (answers[ansId] && answers[ansId].date === today) {
      todayAnswerId = Number(ansId);
      break;
    }
  }
  const counts = {};
  if (todayAnswerId !== null) {
    for (const userId in games) {
      const user = games[userId];
      const state = user[mode];
      if (state && state.answerId === todayAnswerId && Array.isArray(state.guesses)) {
        for (const pid of state.guesses) {
          counts[pid] = (counts[pid] || 0) + 1;
        }
      }
    }
  }
  res.json(counts);
});

// Utilitaire pour récupérer la citation du jour formatée pour un utilisateur Discord
function getFormattedCitationOfTheDay(discordUserId, citationIdx) {
  const citationsPath = path.join(__dirname, 'discord', 'citations.json');
  let citations = [];
  try {
    citations = JSON.parse(fs.readFileSync(citationsPath, 'utf8'));
  } catch {
    return null;
  }
  const userCitations = citations.filter(c => c.userId === discordUserId && Array.isArray(c.messages) && c.messages.length > 0);
  if (!userCitations.length) return null;
  const allMessages = userCitations.flatMap(c => c.messages.filter(m => m.content && m.content.trim().length > 0));
  if (!allMessages.length) return null;
  if (citationIdx === undefined || citationIdx >= allMessages.length) return null;
  // Trouver la citation d'origine contenant ce message
  const citation = userCitations.find(c => c.messages.some((m, i) => m.content && m.content.trim().length > 0 && allMessages[citationIdx] === m));
  if (!citation) return null;
  // Trouver l'URL du message avec la timestamp la plus ancienne (premier message du pavé)
  let firstMsg = citation.messages
    .filter(m => m.content && m.content.trim().length > 0 && m.url && m.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
  // Correction : trier les messages par timestamp croissant avant de les afficher
  const sortedMessages = citation.messages
    .filter(m => m.content && m.content.trim().length > 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return {
    content: sortedMessages.map(m => m.content).join('\n'),
    url: firstMsg ? firstMsg.url : null
  };
}

// GET /api/citation-of-the-day/:discordUserId
app.get('/api/citation-of-the-day/:discordUserId', (req, res) => {
  const { discordUserId } = req.params;
  const answers = readAnswers();
  const today = getAnswerDateForToday();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId || !answers[answerId].modes['citation']) {
    return res.status(404).json({ error: 'citation_not_found' });
  }
  // Si la citation du jour n'est pas encore générée, on la génère
  if (answers[answerId].modes['citation'].citationIdx === undefined) {
    generateCitationOfTheDay(today, discordUserId);
    // Recharge après génération
    const refreshed = readAnswers();
    const refreshedAnswer = refreshed[answerId];
    if (!refreshedAnswer || !refreshedAnswer.modes['citation'] || refreshedAnswer.modes['citation'].citationIdx === undefined) {
      return res.status(500).json({ error: 'citation_generation_failed' });
    }
    const result = getFormattedCitationOfTheDay(discordUserId, refreshedAnswer.modes['citation'].citationIdx);
    if (!result) return res.status(404).json({ error: 'citation_not_found' });
    return res.json(result);
  }
  // Sinon, on lit la citation du jour pour ce userId
  const result = getFormattedCitationOfTheDay(discordUserId, answers[answerId].modes['citation'].citationIdx);
  if (!result) return res.status(404).json({ error: 'citation_not_found' });
  return res.json(result);
});

// GET /api/image-of-the-day/:discordUserId
app.get('/api/image-of-the-day/:discordUserId', async (req, res) => {
  const { discordUserId } = req.params;
  const answers = readAnswers();
  const today = getAnswerDateForToday();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId || !answers[answerId].modes['image']) {
    return res.status(404).json({ error: 'image_not_found' });
  }
  // Si l'image du jour n'est pas encore générée, on la génère
  if (!answers[answerId].modes['image'].url) {
    const result = await generateImageOfTheDay(today, discordUserId);
    if (result !== 'ok') {
      // Erreur technique lors de la génération (ex: Discord down)
      return res.status(500).json({ error: result });
    }
    // Recharge après génération
    const refreshed = readAnswers();
    const refreshedAnswer = refreshed[answerId];
    if (!refreshedAnswer || !refreshedAnswer.modes['image'] ||!refreshedAnswer.modes['image'].url || !refreshedAnswer.modes['image'].localPath) {
      return res.status(500).json({ error: 'image_generation_failed' });
    }
    // On renvoie l'image générée
    return res.json({ 
      url: refreshedAnswer.modes['image'].url,
      localPath: refreshedAnswer.modes['image'].localPath || null
    });
  } else {
    return res.json({ 
      url: answers[answerId].modes['image'].url,
      localPath: answers[answerId].modes['image'].localPath || null
    });
  }
});

// GET /api/emojis-of-the-day/:discordUserId
app.get('/api/emojis-of-the-day/:discordUserId', (req, res) => {
  const { discordUserId } = req.params;
  const answers = readAnswers();
  const today = getAnswerDateForToday();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId || !answers[answerId].modes['emoji']) {
    return res.status(404).json({ error: 'emoji_not_found' });
  }
  // Si les émojis du jour n'est pas encore généré, on les génère
  if (!answers[answerId].modes['emoji'].emojis) {
    generateEmojisOfTheDay(today, discordUserId);
    // Recharge après génération
    const refreshed = readAnswers();
    const refreshedAnswer = refreshed[answerId];
    if (!refreshedAnswer || !refreshedAnswer.modes['emoji'] || !refreshedAnswer.modes['emoji'].emojis) {
      return res.status(500).json({ error: 'emoji_generation_failed' });
    }
    return res.json({
      emojis: refreshedAnswer.modes['emoji'].emojis
    });
  }
  // Sinon, on lit les émojis du jour pour ce userId
  return res.json({
    emojis: answers[answerId].modes['emoji'].emojis
  });
});

function shuffleArray(array) {
  // Mélange de Fisher-Yates
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- Génération emoji du jour ---
function generateEmojisOfTheDay(today, discordUserId) {
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));

  const person = getPersonById(
    vjlData.find(p => p.discordUserId === discordUserId)?.id
  );
  if (!person || !Array.isArray(person.emojis) || person.emojis.length === 0) return;
  // Mélange aléatoire des emojis
  const emojis = shuffleArray(person.emojis.slice());

  // Écriture dans answers.json
  let answers = readAnswers();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId) {
    answerId = Object.keys(answers).map(Number).filter(n => !isNaN(n)).reduce((max, n) => Math.max(max, n), 0) + 1;
    answers[answerId] = { date: today, modes: {} };
  }
  if (!answers[answerId].modes) answers[answerId].modes = {};
  if (!answers[answerId].modes['emoji']) answers[answerId].modes['emoji'] = {};
  answers[answerId].modes['emoji'].emojis = emojis; // Stocke les emojis mélangés
  writeAnswers(answers);
}

// --- Génération citation du jour ---
function generateCitationOfTheDay(today, discordUserId) {
  const citationsPath = path.join(__dirname, 'discord', 'citations.json');
  let citations = [];
  try {
    citations = JSON.parse(fs.readFileSync(citationsPath, 'utf8'));
  } catch {
    return;
  }
  const userCitations = citations.filter(c => c.userId === discordUserId && Array.isArray(c.messages) && c.messages.length > 0);
  if (!userCitations.length) return;
  const allMessages = userCitations.flatMap(c => c.messages.filter(m => m.content && m.content.trim().length > 0));
  if (!allMessages.length) return;
  const idx = Math.floor(Math.random() * allMessages.length);
  // Écriture manuelle dans answers.json
  let answers = readAnswers();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId) {
    answerId = Object.keys(answers).map(Number).filter(n => !isNaN(n)).reduce((max, n) => Math.max(max, n), 0) + 1;
    answers[answerId] = { date: today, modes: {} };
  }
  if (!answers[answerId].modes) answers[answerId].modes = {};
  if (!answers[answerId].modes['citation']) answers[answerId].modes['citation'] = {};
  answers[answerId].modes['citation'].citationIdx = idx;
  writeAnswers(answers);
}

// --- Génération image du jour ---
async function generateImageOfTheDay(today, discordUserId) {
  const attachmentsPath = path.join(__dirname, 'discord', 'attachments.json');
  let attachments = [];
  try {
    attachments = JSON.parse(fs.readFileSync(attachmentsPath, 'utf8'));
  } catch {
    return 'attachments_read_error';
  }
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const userAttachments = attachments.filter(a => a.userId === discordUserId && a.attachmentsCount > 0);
  if (!userAttachments.length) return 'no_attachments';
  const randomAttachment = userAttachments[Math.floor(Math.random() * userAttachments.length)];
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  let imageUrl = null;
  let url = null;
  let loginFailed = false;
  try {
    await new Promise((resolve, reject) => {
      client.once('ready', async () => {
        try {
          const channel = await client.channels.fetch(randomAttachment.channelId);
          if (!channel || !channel.isTextBased()) throw new Error('Not a text channel');
          const message = await channel.messages.fetch(randomAttachment.messageId);
          if (message.attachments && message.attachments.size > 0) {
            const arr = Array.from(message.attachments.values()).filter(att => allowedTypes.includes(att.contentType));
            if (arr.length > 0) {
              const chosen = arr[Math.floor(Math.random() * arr.length)];
              imageUrl = chosen.url;
              url = message.url;
            }
          }
        } catch (err) {}
        client.destroy();
        resolve();
      });
      client.login(config.token).catch(err => {
        loginFailed = true;
        client.destroy();
        resolve();
      });
    });
  } catch {
    client.destroy();
    return 'discord_error';
  }
  if (loginFailed) return 'discord_error';
  if (!imageUrl || !url) return 'no_image_found';
  // Écriture manuelle dans answers.json
  let answers = readAnswers();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId) {
    answerId = Object.keys(answers).map(Number).filter(n => !isNaN(n)).reduce((max, n) => Math.max(max, n), 0) + 1;
    answers[answerId] = { date: today, modes: {} };
  }
  if (!answers[answerId].modes) answers[answerId].modes = {};
  if (!answers[answerId].modes['image']) answers[answerId].modes['image'] = {};
  answers[answerId].modes['image'].url = url;

  // Nouvelle fonctionnalité : téléchargement local de l'image du jour
  try {
    // Avant de sauvegarder la nouvelle image, supprime tout le dossier (pour éviter les images fantômes)
    const localDir = path.join(__dirname, 'public', 'images-of-the-day');
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      for (const file of files) {
        try { 
          fs.unlinkSync(path.join(localDir, file));
          console.log(`[IMAGE-OF-THE-DAY] Ancienne image /images-of-the-day/${file} supprimée.`);
         } catch {}
      }
    }
    // Ensuite, télécharge l'image du jour
    const ext = imageUrl.split('.').pop().split('?')[0].split('#')[0];
    const localFileName = `${today}.${ext}`;
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    const localPath = path.join(localDir, localFileName);
    await downloadImageToLocal(imageUrl, localPath);
    answers[answerId].modes['image'].localPath = `/images-of-the-day/${localFileName}`;
    console.log(`[IMAGE-OF-THE-DAY] Image du jour téléchargée localement à /images-of-the-day/${localFileName}`);
  } catch (e) {
    console.error('[IMAGE-OF-THE-DAY] Erreur lors du téléchargement local de l\'image:', e);
  }

  writeAnswers(answers);
  return 'ok';
}

async function downloadImageToLocal(url, localPath) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error('Failed to get image: ' + response.statusCode));
        return;
      }
      const fileStream = fs.createWriteStream(localPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(resolve);
      });
      fileStream.on('error', (err) => {
        fs.unlink(localPath, () => reject(err));
      });
    }).on('error', reject);
  });
}



// GET /api/splash-of-the-day/:discordUserId
app.get('/api/splash-of-the-day/:discordUserId', (req, res) => {
  const { discordUserId } = req.params;
  const today = getAnswerDateForToday();
  let answers = readAnswers();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId || !answers[answerId].modes['splash']) {
    return res.status(404).json({ error: 'splash_not_found' });
  }
  if (!answers[answerId].modes['splash'].startCoords) {
    generateSplashOfTheDay(today, discordUserId);
    // Recharge après génération
    const refreshed = readAnswers();
    const refreshedAnswer = refreshed[answerId];
    if (!refreshedAnswer || !refreshedAnswer.modes['splash']) {
      return res.status(500).json({ error: 'splash_generation_failed' });
    }
    const person = getPersonById(refreshedAnswer.modes['splash'].personId);
    const startCoords = refreshedAnswer.modes['splash'].startCoords;
    if (!person || !person.avatarUrl) return res.status(404).json({ error: 'no_avatar' });
    return res.json({
      person,
      startCoords
    });
  }
  // Sinon, on lit le splash du jour pour ce userId
  const person = getPersonById(answers[answerId].modes['splash'].personId);
  const startCoords = answers[answerId].modes['splash'].startCoords;
  if (!person || !person.avatarUrl) return res.status(404).json({ error: 'no_avatar' });
  return res.json({
    person,
    startCoords
  });
});

// --- Génération splash du jour ---
function generateSplashOfTheDay(today, discordUserId) {
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));

  // On prend le membre correspondant à discordUserId avec avatar
  const found = vjlData.find(p => p.discordUserId === discordUserId && p.avatarUrl && p.avatarUrl.length > 0);
  if (!found) return;
  // Génère des coordonnées de départ aléatoires (x, y entre 0 et 1, zoom initial entre 3 et 3.5)
  const startCoords = {
    x: Math.random(),
    y: Math.random(),
    zoom: 10 + Math.random() * 0.5
  };
  let answers = readAnswers();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId) {
    answerId = Object.keys(answers).map(Number).filter(n => !isNaN(n)).reduce((max, n) => Math.max(max, n), 0) + 1;
    answers[answerId] = { date: today, modes: {} };
  }
  if (!answers[answerId].modes) answers[answerId].modes = {};
  answers[answerId].modes['splash'] = { personId: found.id, startCoords };
  writeAnswers(answers);
}

// Met à jour les avatarUrl de chaque membre dans vjl.json via l'API Discord
async function updateAllDiscordAvatars() {
  const vjlPath = path.join(__dirname, 'src', 'data', 'vjl.json');
  let vjl = JSON.parse(fs.readFileSync(vjlPath, 'utf8'));
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let loginFailed = false;
  try {
    await new Promise((resolve) => {
      client.once('ready', async () => {
        try {
          for (const member of vjl) {
            if (member.discordUserId) {
              try {
                const user = await client.users.fetch(member.discordUserId);
                member.avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512 });
              } catch (e) {
                member.avatarUrl = member.avatarUrl || '';
              }
            }
          }
        } catch (e) {
          console.error('[AVATAR] Erreur lors de la mise à jour des avatars:', e);
        }
        client.destroy();
        resolve();
      });
      client.login(config.token).catch(err => {
        loginFailed = true;
        client.destroy();
        resolve();
      });
    });
  } catch {
    client.destroy();
    return 'discord_error';
  }
  if (loginFailed) return 'discord_error';
  // Écriture des changements dans vjl.json
  fs.writeFileSync(vjlPath, JSON.stringify(vjl, null, 2), 'utf8');
  console.log("Mise à jour des avatars terminée.");
}

// Planifie une purge quotidienne à minuit Europe/Paris
cron.schedule('0 0 * * *', async () => {
  cronReady = false; // Le cron commence

  // 1. Fetch nouveaux messages du jour
  let scrapOk = true;
  try {
    await new Promise((resolve) => {
      const child = spawn('node', ['./discord/scrap-messages.js'], { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code !== 0) {
          console.error('[CRON] Erreur scrap-messages: code', code);
          scrapOk = false;
        }
        console.log('[CRON] scrap-messages terminé');
        resolve();
      });
    });
  } catch (e) {
    console.error('[CRON] Exception scrap-messages:', e);
    scrapOk = false;
  }

  // 2. Exécute filtrageData.js seulement si scrap-messages a réussi
  if (scrapOk) {
    try {
      await new Promise((resolve) => {
        const child = spawn('node', ['./discord/filtrageData.js'], { stdio: 'inherit' });
        child.on('close', (code) => {
          if (code !== 0) {
            console.error('[CRON] Erreur filtrageData: code', code);
          }
          console.log('[CRON] filtrageData terminé');
          resolve();
        });
      });
    } catch (e) {
      console.error('[CRON] Exception filtrageData:', e);
    }
  } else {
    console.error('[CRON] filtrageData non lancé car scrap-messages a échoué');
  }

  const today = getAnswerDateForToday();
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));

  writeGames({});
  // Utilise la liste centralisée des modes
  for (const modeObj of modes) {
    getAnswerForDay(modeObj.key, today, vjlData);
  }
  const answers = readAnswers();
  const todayAnswer = answers[Object.keys(answers).find(id => answers[id].date === today)];
  generateCitationOfTheDay(today, getPersonById(todayAnswer.modes['citation'].personId).discordUserId);
  await generateImageOfTheDay(today, getPersonById(todayAnswer.modes['image'].personId).discordUserId);
  generateEmojisOfTheDay(today, getPersonById(todayAnswer.modes['emoji'].personId).discordUserId);
  generateSplashOfTheDay(today, getPersonById(todayAnswer.modes['splash'].personId).discordUserId);
  cronReady = true; // Le cron est fini, tout est prêt
  console.log(`[CRON] Purge quotidienne effectuée pour la date ${today} (games.json vidé, answers du jour générées)`);
}, {
  timezone: 'Europe/Paris'
});

app.use(express.static('public'));
app.use(express.static('dist'));

const server = app.listen(PORT, () => {
  console.log(`ValoJundle backend running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  debug('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    debug('HTTP server closed');
  });
});

// --- MODE HARDCORE : API RANDOM ---


// GET /api/random-citation
app.get('/api/random-citation', (req, res) => {
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));

  const citationsPath = path.join(__dirname, 'discord', 'citations.json');
  let citations = [];
  try {
    citations = JSON.parse(fs.readFileSync(citationsPath, 'utf8'));
  } catch {
    return res.status(500).json({ error: 'citations_read_error' });
  }
  // On récupère toutes les citations valides (avec messages)
  const all = citations.filter(c => Array.isArray(c.messages) && c.messages.length > 0);
  const pool = all;
  if (!pool.length) return res.status(404).json({ error: 'no_random_citation' });
  const citationObj = pool[Math.floor(Math.random() * pool.length)];
  let person = vjlData.find(p => p.discordUserId === citationObj.userId);
  if (!person) {
    return res.status(404).json({ error: 'no_person_for_userId', userId: citationObj.userId });
  }
  // Trier les messages par timestamp croissant
  const sortedMessages = citationObj.messages
    .filter(m => m.content && m.content.trim().length > 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const content = sortedMessages.map(m => m.content).join('\n');
  const url = sortedMessages[0]?.url || null;
  res.json({
    person,
    message: { content, url }
  });
});

// GET /api/random-image
app.get('/api/random-image', async (req, res) => {
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));

  const attachmentsPath = path.join(__dirname, 'discord', 'attachments.json');
  let attachments = [];
  try {
    attachments = JSON.parse(fs.readFileSync(attachmentsPath, 'utf8'));
  } catch {
    return res.status(500).json({ error: 'attachments_read_error' });
  }
  const pool = attachments;
  if (!pool.length) return res.status(404).json({ error: 'no_random_image' });
  const random = pool[Math.floor(Math.random() * pool.length)];
  // Correction : mapping userId Discord -> VJLPerson
  let person = vjlData.find(p => p.discordUserId === random.userId);
  if (!person) {
    // fallback: undefined person
    return res.status(404).json({ error: 'no_person_for_userId', userId: random.userId });
  }

  // Aller chercher l'URL de l'image via l'API Discord
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  let imageUrl = null;
  let url = null;
  let loginFailed = false;
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  try {
    await new Promise((resolve) => {
      client.once('ready', async () => {
        try {
          const channel = await client.channels.fetch(random.channelId);
          if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(random.messageId);
            if (message.attachments && message.attachments.size > 0) {
              const arr = Array.from(message.attachments.values()).filter(att => allowedTypes.includes(att.contentType));
              if (arr.length > 0) {
                const chosen = arr[Math.floor(Math.random() * arr.length)];
                imageUrl = chosen.url;
                url = message.url;
              }
            }
          }
        } catch (err) {}
        client.destroy();
        resolve();
      });
      client.login(config.token).catch(err => {
        loginFailed = true;
        client.destroy();
        resolve();
      });
    });
  } catch {
    client.destroy();
    return res.status(500).json({ error: 'discord_error' });
  }
  if (loginFailed) return res.status(500).json({ error: 'discord_error' });
  if (!imageUrl) return res.status(404).json({ error: 'no_image_found' });
  
  res.json({
    person,
    image: { displayUrl: imageUrl, url }
  });
});

// GET /api/random-emoji
app.get('/api/random-emoji', (req, res) => {
  const answers = readAnswers();
  const today = getAnswerDateForToday();
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));

  // On prend un membre au hasard qui a des emojis
  const pool = vjlData.filter(p => Array.isArray(p.emojis) && p.emojis.length > 0);
  if (!pool.length) return res.status(404).json({ error: 'no_random_emoji' });
  let randomPerson = pool[Math.floor(Math.random() * pool.length)];
  // Mélange les emojis
  const emojis = shuffleArray(randomPerson.emojis.slice());
  res.json({
    person: randomPerson,
    emojis
  });
});

// GET /api/random-splash
app.get('/api/random-splash', (req, res) => {
  const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));

  // Tire un membre au hasard avec avatar
  const pool = vjlData.filter(p => p.avatarUrl && p.avatarUrl.length > 0);
  if (!pool.length) return res.status(404).json({ error: 'no_avatar' });
  const randomPerson = pool[Math.floor(Math.random() * pool.length)];
  // Génère des coordonnées de départ aléatoires (x, y entre 0 et 1, zoom initial entre 10 et 10.5)
  const startCoords = {
    x: Math.random(),
    y: Math.random(),
    zoom: 10 + Math.random() * 0.5
  };
  // Réponse au même format que les autres randoms, mais avec startCoords
  res.json({
    person: randomPerson,
    startCoords
  });
});

// --- HARDCORE LEADERBOARD ---
const HARDCORE_FILE = path.join(__dirname, 'src', 'data', 'hardcore_leaderboard.json');

function readHardcoreScores() {
  if (!fs.existsSync(HARDCORE_FILE)) return [];
  const data = fs.readFileSync(HARDCORE_FILE, 'utf-8');
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeHardcoreScores(scores) {
  fs.writeFileSync(HARDCORE_FILE, JSON.stringify(scores, null, 2));
}

// GET leaderboard
app.get('/api/hardcore-leaderboard', (req, res) => {
  const scores = readHardcoreScores();
  scores.sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date));
  res.json(scores);
});

// POST new score
app.post('/api/hardcore-leaderboard', (req, res) => {
  const { name, score } = req.body;
  if (!name || typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const entry = { name, score, date: new Date().toISOString() };
  const scores = readHardcoreScores();
  scores.push(entry);
  writeHardcoreScores(scores);
  res.status(201).json(entry);
});