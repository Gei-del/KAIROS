import { NextRequest, NextResponse } from "next/server";
import { QUESTIONS, byDifficulty } from "@/lib/questions";
import { fallbackDifficulty, fallbackHostLine } from "@/lib/game";
import type { Difficulty, Question, RoundSummary } from "@/lib/types";

export const runtime = "edge";

function pickQuestion(diff: Difficulty, askedIds: string[]): Question | null {
  const pool = byDifficulty(diff).filter((q) => !askedIds.includes(q.id));
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  // widen the search if that difficulty is exhausted
  const any = QUESTIONS.filter((q) => !askedIds.includes(q.id));
  if (any.length) return any[Math.floor(Math.random() * any.length)];
  return null; // all questions used -> caller ends the game
}

async function narrateWithLLM(
  summary: RoundSummary,
): Promise<{ difficulty: Difficulty; hostLine: string } | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const first = summary.lastDifficulty === null;
  const prompt = first
    ? `Eres el anfitrión de una vigilia bíblica en vivo llamada KAIROS LIVE. Va a empezar el juego con ${summary.playerCount} participante(s). En UNA sola frase cálida y con energía (máx 90 caracteres, en español), da la bienvenida y anuncia que empezamos suave. Devuelve SOLO un JSON: {"difficulty":"facil","hostLine":"..."}`
    : `Eres el anfitrión de una vigilia bíblica en vivo (KAIROS LIVE). En la última ronda, ${Math.round(
        summary.correctRate * 100,
      )}% de ${summary.playerCount} participante(s) acertó. La dificultad anterior fue "${summary.lastDifficulty}". Elige la dificultad de la siguiente pregunta (facil, media o dificil) adaptándote: si les fue bien sube, si les costó baja. Escribe UNA frase de anfitrión (máx 90 caracteres, español) que reaccione al resultado. Devuelve SOLO un JSON: {"difficulty":"...","hostLine":"..."}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string =
      data?.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const diff = ["facil", "media", "dificil"].includes(parsed.difficulty)
      ? (parsed.difficulty as Difficulty)
      : fallbackDifficulty(summary.correctRate, summary.lastDifficulty);
    const hostLine =
      typeof parsed.hostLine === "string" && parsed.hostLine.length
        ? parsed.hostLine.slice(0, 120)
        : fallbackHostLine(first ? null : summary.correctRate);
    return { difficulty: diff, hostLine };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const summary = (await req.json()) as RoundSummary;

  const llm = await narrateWithLLM(summary);
  const difficulty =
    llm?.difficulty ??
    fallbackDifficulty(summary.correctRate, summary.lastDifficulty);
  const hostLine =
    llm?.hostLine ??
    fallbackHostLine(summary.lastDifficulty === null ? null : summary.correctRate);

  const question = pickQuestion(difficulty, summary.askedIds);
  if (!question) {
    return NextResponse.json({ done: true, hostLine: "¡Fin de la vigilia! Que la Palabra quede en el corazón. 🕊️" });
  }

  return NextResponse.json({
    done: false,
    question,
    difficulty,
    hostLine,
    source: llm ? "ai" : "fallback",
  });
}
