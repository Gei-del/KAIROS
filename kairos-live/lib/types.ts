export type Difficulty = "facil" | "media" | "dificil";

export interface Question {
  id: string;
  prompt: string;
  options: string[]; // exactly 4
  correct: number; // index 0-3
  reference: string; // e.g. "Génesis 6:14" — never invented, from the seeded bank
  difficulty: Difficulty;
}

export interface Player {
  id: string;
  name: string;
  avatar: string; // emoji
}

export interface ScoreRow {
  userId: string;
  name: string;
  avatar: string;
  points: number;
}

export interface RoundSummary {
  correctRate: number; // 0..1 for the last round
  playerCount: number;
  askedIds: string[];
  lastDifficulty: Difficulty | null;
  recentRates?: number[]; // accuracy of the last few questions, oldest→newest
}
