import type { Difficulty } from "./types";

// Kahoot-style scoring: correct answers earn a base plus a speed bonus.
export function scoreFor(correct: boolean, ms: number, duration: number): number {
  if (!correct) return 0;
  const base = 100;
  const window = duration * 1000;
  const speed = Math.max(0, 1 - ms / window); // 1.0 instant -> 0 at timeout
  return Math.round(base + speed * 100);
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusing chars
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function makeUserId(): string {
  return "u_" + Math.random().toString(36).slice(2, 10);
}

const AVATARS = ["🕊️", "✝️", "🔥", "⭐", "🌿", "👑", "📖", "🎺", "🛡️", "🌅", "🍞", "🕯️"];
export function randomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

// Deterministic fallback the AI Host uses when no LLM key is configured,
// so the demo never breaks: adapt difficulty by how the room performed.
export function fallbackDifficulty(
  correctRate: number,
  last: Difficulty | null,
): Difficulty {
  if (last === null) return "facil";
  if (correctRate >= 0.7) {
    if (last === "facil") return "media";
    return "dificil";
  }
  if (correctRate <= 0.3) {
    if (last === "dificil") return "media";
    return "facil";
  }
  return last;
}

export function fallbackHostLine(correctRate: number | null): string {
  if (correctRate === null) return "¡Bienvenidos a la vigilia! Empezamos suave.";
  const pct = Math.round(correctRate * 100);
  if (correctRate >= 0.7) return `¡${pct}% acertó! Subimos el nivel. 🔥`;
  if (correctRate <= 0.3) return `Solo ${pct}% acertó. Respiremos y vamos con una más amable.`;
  return `${pct}% acertó. Mantengamos el ritmo.`;
}
