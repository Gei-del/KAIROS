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

// Everything that travels over a Portal channel lives in `content`.
// `type` discriminates the payload.
export type Msg =
  | { type: "join"; player: Player; at: number }
  | { type: "phase"; value: "lobby" | "question" | "reveal" | "ended"; at: number }
  | {
      type: "question";
      question: Question;
      index: number;
      total: number;
      duration: number; // seconds
      startedAt: number; // epoch ms
      hostLine: string;
    }
  | {
      type: "answer";
      userId: string;
      name: string;
      questionId: string;
      choice: number;
      correct: boolean;
      ms: number;
    }
  | {
      type: "reveal";
      questionId: string;
      correct: number;
      tallies: number[]; // votes per option
      hostLine: string;
    }
  | { type: "leaderboard"; scores: ScoreRow[]; at: number }
  | {
      type: "chat";
      userId: string;
      name: string;
      avatar: string;
      text: string;
      at: number;
    };

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
