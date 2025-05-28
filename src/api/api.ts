// src/api/api.ts
// Fusion frontend pour tous les appels HTTP (React)
import type { VJLPerson } from '../types/VJLPerson.ts';
import vjlData from '../data/vjl.json';
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

export async function loadGame(mode: string) {
  const userId = getOrCreateUserId();
  const res = await fetch(`${API_URL}/game/${userId}/${mode}`);
  if (!res.ok) throw new Error('Erreur chargement partie');
  return await res.json();
}

export async function saveGame(mode: string, guesses: number[], hasWon: boolean) {
  const userId = getOrCreateUserId();
  await fetch(`${API_URL}/game/${userId}/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guesses, hasWon })
  });
}

export async function fetchAnswerId(mode: string, date: string): Promise<number> {
  const res = await fetch(`${API_URL}/answer/${mode}/${date}`);
  if (!res.ok) throw new Error('Erreur chargement réponse du jour');
  const data = await res.json();
  return data.id;
}

export async function fetchAnswerIdAndGameId(mode: string, date: string): Promise<{ id: number, gameId: number }> {
  const res = await fetch(`${API_URL}/answer/${mode}/${date}`);
  if (!res.ok) throw new Error('Erreur chargement réponse du jour');
  const data = await res.json();
  return { id: data.id, gameId: data.gameId };
}

export async function fetchWinnersCount(mode: string): Promise<number> {
  const res = await fetch(`${API_URL}/game-count/${mode}`);
  if (!res.ok) throw new Error('Erreur chargement compteur');
  const data = await res.json();
  return data.count;
}

export function getPersonById(id: number): VJLPerson | undefined {
  return vjlData.find(p => p.id === id);
}

export function getUserId() {
  return getOrCreateUserId();
}
