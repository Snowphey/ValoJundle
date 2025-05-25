import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import vjlData from './src/data/vjl.json' assert { type: 'json' };

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'src', 'data', 'games.json');
// --- LOGIQUE DE REPONSE DU JOUR ET GESTION DES IDS ---
const ANSWERS_FILE = path.join(__dirname, 'src', 'data', 'answers.json');

app.use(cors());
app.use(express.json());

// Helper: get today's gameId (UTC)
function getGameIdForToday() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${now.getUTCDate().toString().padStart(2, '0')}`;
}

// Helper: read/write JSON file
function readGames() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '{}', 'utf8');
    return {};
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeGames(games) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf8');
}
function readAnswers() {
  if (!fs.existsSync(ANSWERS_FILE)) {
    fs.writeFileSync(ANSWERS_FILE, '{}', 'utf8');
    return {};
  }
  return JSON.parse(fs.readFileSync(ANSWERS_FILE, 'utf8'));
}
function writeAnswers(answers) {
  fs.writeFileSync(ANSWERS_FILE, JSON.stringify(answers, null, 2), 'utf8');
}

function getOrCreateGameNumericId(mode, date) {
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
  const id = getOrCreateGameNumericId(mode, date);
  if (!answers[id]) {
    answers[id] = { date, modes: {} };
  }
  // Génère une réponse unique par mode, différente du jour précédent ET des autres modes du jour
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
    const prevDate = new Date(date);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevGameId = `${prevDate.getUTCFullYear()}-${(prevDate.getUTCMonth()+1).toString().padStart(2,'0')}-${prevDate.getUTCDate().toString().padStart(2,'0')}`;
    let prevAnswers = [];
    for (const prevId in answers) {
      if (answers[prevId] && answers[prevId].date === prevGameId) {
        prevAnswers = Object.values(answers[prevId].modes).map(m => m.answer);
        break;
      }
    }
    // 2. Exclure les réponses déjà attribuées aux autres modes du jour
    const usedToday = Object.values(answers[id].modes).map(m => m.answer);
    // 3. Générer une réponse qui n'est ni dans prevAnswers ni dans usedToday
    const rand = getSeededRandom(date + '-' + mode);
    let pool = vjlData.map(p => p.id).filter(pid => !prevAnswers.includes(pid) && !usedToday.includes(pid));
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
    for (const userId in games) {
      const user = games[userId];
      const state = user[mode];
      if (state && state.gameId && state.hasWon && Array.isArray(state.guesses) && state.guesses.length > 0) {
        // On vérifie que la partie correspond bien à la game du jour (gameId du jour)
        // On récupère le bon id numérique de answers pour aujourd'hui
        let todayNumericId = null;
        for (const ansId in answers) {
          if (answers[ansId] && answers[ansId].date === today) {
            todayNumericId = Number(ansId);
            break;
          }
        }
        if (state.gameId === todayNumericId && state.guesses[state.guesses.length - 1] === todayAnswerId) {
          count++;
        }
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
  // Reset if not today's game
  if (!state || state.gameId !== gameId) {
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
  games[userId][mode] = { guesses, hasWon, gameId };
  writeGames(games);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`ValoJundle backend running on port ${PORT}`);
});
