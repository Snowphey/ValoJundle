// src/types/VJLPerson.ts
export interface VJLPerson {
  id: number;
  pfp: string;
  prenom: string;
  aliases?: string[];
  gender: string;
  mainRoles: string[];
  hairColor: string;
  eyeColors: string[];
  height: number;
  option: string;
  birthRegion: string;
  birthDate: string;
  discordUserId: string;
}
