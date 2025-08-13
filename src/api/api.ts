// src/api/api.ts
// Fusion frontend pour tous les appels HTTP (React)
import type { VJLPerson } from '../types/VJLPerson.ts';
import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL + '/api';

function getOrCreateUserId() {
  let userId = localStorage.getItem('valojundle-userid');
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem('valojundle-userid', userId);
  }
  return userId;
}

class ResponseError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function loadGame(mode: string) {
  const userId = getOrCreateUserId();
  const res = await fetch(`${API_URL}/game/${userId}/${mode}`);
  if (!res.ok) throw new ResponseError('Erreur chargement partie', res.status);
  return await res.json();
}

export async function saveGame(mode: string, guesses: number[], hasWon: boolean, rank?: number | null) {
  const userId = getOrCreateUserId();
  const res = await fetch(`${API_URL}/game/${userId}/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guesses, hasWon, rank })
  });
  if (!res.ok) throw new ResponseError('Erreur sauvegarde partie', res.status);
}

export async function fetchAnswer(mode: string, date: string): Promise<{ personId: number, answerId: number }> {
  const res = await fetch(`${API_URL}/answer/${mode}/${date}`);
  if (!res.ok) throw new ResponseError('Erreur chargement réponse du jour', res.status);
  const data = await res.json();
  return data;
}

// Récupère la réponse d'un jour passé SANS création automatique (pour l'affichage de la réponse d'hier)
export async function fetchAnswerIfExists(mode: string, date: string): Promise<{ personId: number, answerId: number } | null> {
  const res = await fetch(`${API_URL}/answer-if-exists/${mode}/${date}`);
  if (!res.ok) throw new ResponseError('Erreur chargement réponse du jour (if-exists)', res.status);
  const data = await res.json();
  if (!data || typeof data.personId === 'undefined') return null;
  return data;
}

export async function fetchWinnersCount(mode: string): Promise<number> {
  const res = await fetch(`${API_URL}/game-count/${mode}`);
  if (!res.ok) throw new ResponseError('Erreur chargement compteur', res.status);
  const data = await res.json();
  return data.count;
}

export async function fetchVJLData(): Promise<VJLPerson[]> {
  const res = await fetch(`${API_URL}/vjl`);
  if (!res.ok) throw new ResponseError('Erreur chargement vjl.json', res.status);
  return await res.json();
}


export function getUserId() {
  return getOrCreateUserId();
}

export async function fetchTodayFromBackend(): Promise<string> {
  const res = await fetch(`${API_URL}/today`);
  if (!res.ok) throw new ResponseError('Erreur récupération date du jour', res.status);
  const data = await res.json();
  return data.today;
}

export async function fetchCronReadyFromBackend(): Promise<boolean> {
  const res = await fetch(`${API_URL}/cron-ready`);
  if (!res.ok) throw new ResponseError('Erreur récupération état cron', res.status);
  const data = await res.json();
  return !!data.ready;
}

// Nombre de guesses pour chaque id (Citation ou Classic ou Image)
export async function fetchGuessCounts(mode: string): Promise<Record<number, number>> {
  const res = await fetch(`${API_URL}/guess-counts/${mode}`);
  if (!res.ok) throw new ResponseError('Erreur récupération compteur de guesses', res.status);
  return await res.json();
}

// Citation du jour (déterministe)
export async function fetchCitationOfTheDay(discordUserId: string) {
  const res = await fetch(`${API_URL}/citation-of-the-day/${discordUserId}`);
  if (!res.ok) throw new ResponseError('Erreur récupération citation du jour', res.status);
  return await res.json();
}

// Image du jour (déterministe)
export async function fetchImageOfTheDay(discordUserId: string) {
  const res = await fetch(`${API_URL}/image-of-the-day/${discordUserId}`);
  if (!res.ok) throw new ResponseError('Erreur récupération image du jour', res.status);
  const data = await res.json();
  // On retourne aussi le chemin local si dispo
  return {
    ...data,
    displayUrl: data.localPath
  };
}

// Emojis du jour (déterministe)
export async function fetchEmojisOfTheDay(discordUserId: string): Promise<{ emojis: string[] }> {
  const res = await fetch(`${API_URL}/emojis-of-the-day/${discordUserId}`);
  if (!res.ok) throw new ResponseError('Erreur récupération emojis du jour', res.status);
  return await res.json();
}

// Splash du jour (déterministe)
export async function fetchSplashOfTheDay(discordUserId: string): Promise<{ person: VJLPerson, startCoords: { x: number, y: number, zoom: number } }> {
  const res = await fetch(`${API_URL}/splash-of-the-day/${discordUserId}`);
  if (!res.ok) throw new ResponseError('Erreur récupération splash du jour', res.status);
  return await res.json();
}

// Citation aléatoire (pour le mode hardcore)
export async function fetchRandomCitation(): Promise<any> {
  const res = await fetch(`${API_URL}/random-citation`);
  if (!res.ok) throw new ResponseError('Erreur récupération citation aléatoire', res.status);
  return await res.json();
}

// Image aléatoire (pour le mode hardcore)
export async function fetchRandomImage(): Promise<any> {
  const res = await fetch(`${API_URL}/random-image`);
  if (!res.ok) throw new ResponseError('Erreur récupération image aléatoire', res.status);
  return await res.json();
}

// Emojis aléatoires (pour le mode hardcore)
export async function fetchRandomEmojis(): Promise<{ emojis: string[], person: VJLPerson }> {
  const res = await fetch(`${API_URL}/random-emoji`);
  if (!res.ok) throw new ResponseError('Erreur récupération emojis aléatoires', res.status);
  return await res.json();
}

// Splash aléatoire (pour le mode hardcore, version backend)
export async function fetchRandomSplash(): Promise<{ person: VJLPerson, startCoords: { x: number, y: number, zoom: number } }> {
  const res = await fetch(`${API_URL}/random-splash`);
  if (!res.ok) throw new ResponseError('Erreur récupération splash aléatoire', res.status);
  const data = await res.json();
  return data;
}

export type HardcoreScore = {
  name: string;
  score: number;
  date: string;
};

export async function fetchHardcoreLeaderboard(): Promise<HardcoreScore[]> {
  try {
    const res = await fetch(`${API_URL}/hardcore-leaderboard`);
    if (!res.ok) throw new ResponseError('Erreur leaderboard', res.status);
    return await res.json();
  } catch {
    return [];
  }
}

export async function submitHardcoreScore(name: string, score: number) {
  await fetch(`${API_URL}/hardcore-leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score }),
  });
}
