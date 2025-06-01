import express from 'express';
import fs, { read } from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { Client, GatewayIntentBits } from 'discord.js';

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'discord', 'config.json'), 'utf8'));

const DATA_FILE = path.join(__dirname, 'src', 'data', 'games.json');
// --- LOGIQUE DE REPONSE DU JOUR ET GESTION DES IDS ---
const ANSWERS_FILE = path.join(__dirname, 'src', 'data', 'answers.json');

const modes = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'modes.json'), 'utf8'));

const vjlData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'vjl.json'), 'utf8'));

app.use(cors());
app.use(express.json());

// --- FLAG CRON READY ---
let cronReady = true; // true au démarrage, false pendant le cron

// Route pour exposer l'état du cron
app.get('/api/cron-ready', (req, res) => {
  res.json({ ready: cronReady });
});

// Helper: get today's gameId (Europe/Paris)
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
  return vjlData.find(p => p.id === id);
}

function getGameIdForToday() {
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

function getAnswerForDay(mode, date, vjlData) {
  let answers = readAnswers();
  const id = getOrCreateAnswerNumericId(date);
  if (!answers[id]) {
    answers[id] = { date, modes: {} };
  }
  if (!answers[id].modes[mode]) {
    function getSeededRandom(seed) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      return () => {
        h += 0x6D2B79F5;
        let t = Math.imul(h ^ h >>> 15, 1 | h);
        t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    // 1. Exclure la réponse du jour précédent (tous modes)
    // Calcul du jour précédent en Europe/Paris
    const dateParis = getParisDateObj(new Date(date + 'T00:00:00'));
    const prevParis = new Date(dateParis);
    prevParis.setDate(prevParis.getDate() - 1);
    const prevGameId = `${prevParis.getFullYear()}-${(prevParis.getMonth()+1).toString().padStart(2,'0')}-${prevParis.getDate().toString().padStart(2,'0')}`;
    let prevAnswer = null;
    for (const prevId in answers) {
      if (answers[prevId] && answers[prevId].date === prevGameId && answers[prevId].modes && answers[prevId].modes[mode]) {
        prevAnswer = answers[prevId].modes[mode].answer;
        break;
      }
    }
    // 2. Exclure les réponses déjà attribuées aux autres modes du jour
    const usedToday = Object.values(answers[id].modes).map(m => m.answer);
    // 3. Générer une réponse qui n'est ni la réponse du mode la veille ni déjà attribuée aujourd'hui
    const rand = getSeededRandom(date + '-' + mode);
    let pool = vjlData.map(p => p.id).filter(pid => pid !== prevAnswer && !usedToday.includes(pid));
    if (pool.length === 0) pool = vjlData.map(p => p.id); // fallback extrême
    let idx = Math.floor(rand() * pool.length);
    answers[id].modes[mode] = { answer: pool[idx] };
    writeAnswers(answers);
  }
  return { id: answers[id].modes[mode].answer, gameId: Number(id) };
}

// GET /api/answer/:mode/:date
app.get('/api/answer/:mode/:date', (req, res) => {
  const { mode, date } = req.params;
  // getAnswerForDay retourne maintenant { id, gameId }
  const { id, gameId } = getAnswerForDay(mode, date, vjlData);
  res.json({ id, gameId });
});

// GET /api/game-count/:mode
app.get('/api/game-count/:mode', (req, res) => {
  const { mode } = req.params;
  const games = readGames();
  const today = getGameIdForToday();
  // Récupère la bonne réponse du jour pour ce mode
  const answers = readAnswers();
  let todayAnswerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today && answers[id].modes && answers[id].modes[mode]) {
      todayAnswerId = answers[id].modes[mode].answer;
      break;
    }
  }
  let count = 0;
  if (todayAnswerId !== null) {
    // On récupère le bon id numérique de answers pour aujourd'hui
    let todayNumericId = null;
    for (const ansId in answers) {
      if (answers[ansId] && answers[ansId].date === today) {
        todayNumericId = Number(ansId);
        break;
      }
    }
    for (const userId in games) {
      const user = games[userId];
      const state = user[mode];
      if (
        state &&
        state.gameId === todayNumericId &&
        state.hasWon &&
        Array.isArray(state.guesses) &&
        state.guesses.length > 0 &&
        state.guesses[state.guesses.length - 1] === todayAnswerId
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
  const today = getGameIdForToday();
  // S'assure que la réponse du jour est bien générée et stockée
  const { gameId } = getAnswerForDay(mode, today, vjlData);
  let user = games[userId] || {};
  let state = user[mode] || null;
  if (!state || typeof state !== 'object') {
    state = { guesses: [], hasWon: false, gameId };
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
  const today = getGameIdForToday();
  const { gameId } = getAnswerForDay(mode, today, vjlData);
  if (!games[userId]) games[userId] = {};
  let state = games[userId][mode] || null;
  if (!state || typeof state !== 'object') {
    state = { guesses, hasWon, gameId };
  } else {
    state.guesses = guesses;
    state.hasWon = hasWon;
    state.gameId = gameId;
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
        other.gameId === gameId &&
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
  res.json({ today: getGameIdForToday() });
});

// GET /api/guess-counts/:mode
// Renvoie pour la partie du jour un objet { [personId]: count } où count = nombre de joueurs ayant tenté ce membre en guess (au moins une fois)
app.get('/api/guess-counts/:mode', (req, res) => {
  const { mode } = req.params;
  const games = readGames();
  const today = getGameIdForToday();
  // Récupère la bonne réponse du jour pour ce mode
  const answers = readAnswers();
  let todayNumericId = null;
  for (const ansId in answers) {
    if (answers[ansId] && answers[ansId].date === today) {
      todayNumericId = Number(ansId);
      break;
    }
  }
  const counts = {};
  if (todayNumericId !== null) {
    for (const userId in games) {
      const user = games[userId];
      const state = user[mode];
      if (state && state.gameId === todayNumericId && Array.isArray(state.guesses)) {
        for (const pid of state.guesses) {
          counts[pid] = (counts[pid] || 0) + 1;
        }
      }
    }
  }
  res.json(counts);
});

// GET /api/citation-of-the-day/:discordUserId
app.get('/api/citation-of-the-day/:discordUserId', (req, res) => {
  const { discordUserId } = req.params;
  const answers = readAnswers();
  const today = getGameIdForToday();
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId || !answers[answerId].modes['citation']) {
    return res.json(null);
  }
  // Si la citation du jour n'est pas encore générée, on la génère
  if (answers[answerId].modes['citation'].citationIdx === undefined) {
    generateCitationOfTheDay(today, discordUserId);
    // Recharge après génération
    const refreshed = readAnswers();
    const refreshedAnswer = refreshed[answerId];
    if (!refreshedAnswer || !refreshedAnswer.modes['citation'] || refreshedAnswer.modes['citation'].citationIdx === undefined) {
      return res.json(null);
    }
    // On lit la citation du jour pour ce userId
    const citationsPath = path.join(__dirname, 'discord', 'citations.json');
    let citations = [];
    try {
      citations = JSON.parse(fs.readFileSync(citationsPath, 'utf8'));
    } catch {
      return res.json(null);
    }
    const userCitations = citations.filter(c => c.userId === discordUserId && Array.isArray(c.messages) && c.messages.length > 0);
    if (!userCitations.length) return res.json(null);
    const allMessages = userCitations.flatMap(c => c.messages.filter(m => m.content && m.content.trim().length > 0));
    if (!allMessages.length) return res.json(null);
    const idx = refreshedAnswer.modes['citation'].citationIdx;
    if (idx >= allMessages.length) return res.json(null);
    // Trouver la citation d'origine contenant ce message
    const citation = userCitations.find(c => c.messages.some((m, i) => m.content && m.content.trim().length > 0 && allMessages[idx] === m));
    if (!citation) return res.json(null);
    // Retourner tous les contents de cette citation, séparés par \n
    return res.json(citation.messages.map(m => m.content).join('\n'));
  }
  // Sinon, on lit la citation du jour pour ce userId
  const citationsPath = path.join(__dirname, 'discord', 'citations.json');
  let citations = [];
  try {
    citations = JSON.parse(fs.readFileSync(citationsPath, 'utf8'));
  } catch {
    return res.json(null);
  }
  const userCitations = citations.filter(c => c.userId === discordUserId && Array.isArray(c.messages) && c.messages.length > 0);
  if (!userCitations.length) return res.json(null);
  const allMessages = userCitations.flatMap(c => c.messages.filter(m => m.content && m.content.trim().length > 0));
  if (!allMessages.length) return res.json(null);
  const idx = answers[answerId].modes['citation'].citationIdx;
  if (idx >= allMessages.length) return res.json(null);
  // Trouver la citation d'origine contenant ce message
  const citation = userCitations.find(c => c.messages.some((m, i) => m.content && m.content.trim().length > 0 && allMessages[idx] === m));
  if (!citation) return res.json(null);
  // Retourner tous les contents de cette citation, séparés par \n
  return res.json(citation.messages.map(m => m.content).join('\n'));
});

// GET /api/image-of-the-day/:discordUserId
app.get('/api/image-of-the-day/:discordUserId', async (req, res) => {
  const { discordUserId } = req.params;

  const answers = readAnswers();
  const today = getGameIdForToday();
  
  let answerId = null;
  for (const id in answers) {
    if (answers[id] && answers[id].date === today) {
      answerId = id;
      break;
    }
  }
  if (!answerId || !answers[answerId].modes['image']) {
    return res.json(null);
  }

  // Si l'image du jour n'est pas encore générée, on la génère
  if (!answers[answerId].modes['image'].imageUrl || !answers[answerId].modes['image'].url) {
    await generateImageOfTheDay(today, discordUserId);
    // Recharge après génération
    const refreshed = readAnswers();
    const refreshedAnswer = refreshed[answerId];
    if (!refreshedAnswer || !refreshedAnswer.modes['image'] || !refreshedAnswer.modes['image'].imageUrl || !refreshedAnswer.modes['image'].url) {
      return res.json(null);
    }
    // On renvoie l'image générée
    return res.json({ imageUrl: refreshedAnswer.modes['image'].imageUrl, url: refreshedAnswer.modes['image'].url });
  } else {
    return res.json({ imageUrl: answers[answerId].modes['image'].imageUrl, url: answers[answerId].modes['image'].url });
  }
});

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
    return;
  }
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const userAttachments = attachments.filter(a => a.userId === discordUserId && a.attachmentsCount > 0);
  if (!userAttachments.length) return;
  const randomAttachment = userAttachments[Math.floor(Math.random() * userAttachments.length)];
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  let imageUrl = null;
  let url = null;
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
      client.login(config.token);
    });
  } catch {
    return;
  }
  if (!imageUrl || !url) return;
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
  answers[answerId].modes['image'].imageUrl = imageUrl;
  answers[answerId].modes['image'].url = url;
  writeAnswers(answers);
}

// Planifie une purge quotidienne à minuit Europe/Paris
cron.schedule('0 0 * * *', async () => {
  cronReady = false; // Le cron commence
  const today = getGameIdForToday();
  writeGames({});
  // Utilise la liste centralisée des modes
  for (const modeObj of modes) {
    getAnswerForDay(modeObj.key, today, vjlData);
  }
  const answers = readAnswers();
  const todayAnswer = answers[Object.keys(answers).find(id => answers[id].date === today)];
  generateCitationOfTheDay(today, getPersonById(todayAnswer.modes['citation'].answer).discordUserId);
  await generateImageOfTheDay(today, getPersonById(todayAnswer.modes['image'].answer).discordUserId);
  cronReady = true; // Le cron est fini, tout est prêt
  console.log(`[CRON] Purge quotidienne effectuée pour la date ${today} (games.json vidé, answers du jour générées)`);
}, {
  timezone: 'Europe/Paris'
});

app.use(express.static('dist'));

app.listen(PORT, () => {
  console.log(`ValoJundle backend running on port ${PORT}`);
});
