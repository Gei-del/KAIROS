"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useChannel } from "@portalsdk/react";
import { roomChannelId } from "@/lib/portal";
import { scoreFor } from "@/lib/game";
import type { Msg, Player, Question, ScoreRow, RoundSummary } from "@/lib/types";

const DURATION = 12; // seconds per question

type Me = Player;

function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("kairos_me");
    if (raw) setMe(JSON.parse(raw));
  }, []);
  return me;
}

export default function Room() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const code = (params.code || "").toUpperCase();
  const isHost = search.get("host") === "1";
  const me = useMe();

  const { messages, send } = useChannel<Msg>({ channelId: roomChannelId(code) });

  // announce myself once
  const announced = useRef(false);
  useEffect(() => {
    if (!me || announced.current) return;
    announced.current = true;
    send({ content: { type: "join", player: me, at: Date.now() } });
  }, [me, send]);

  // ---- derive state from the Portal message log ----
  const contents = useMemo(
    () => messages.map((m) => m.content).filter(Boolean) as Msg[],
    [messages],
  );

  const roster: Player[] = useMemo(() => {
    const map = new Map<string, Player>();
    for (const c of contents) if (c.type === "join") map.set(c.player.id, c.player);
    if (me) map.set(me.id, me);
    return [...map.values()];
  }, [contents, me]);

  const currentQuestion = useMemo(() => {
    for (let i = contents.length - 1; i >= 0; i--) {
      const c = contents[i];
      if (c.type === "question") return c;
    }
    return null;
  }, [contents]);

  const phase = useMemo(() => {
    for (let i = contents.length - 1; i >= 0; i--) {
      const c = contents[i];
      if (c.type === "phase") return c.value;
    }
    return "lobby" as const;
  }, [contents]);

  const reveal = useMemo(() => {
    if (!currentQuestion) return null;
    for (let i = contents.length - 1; i >= 0; i--) {
      const c = contents[i];
      if (c.type === "reveal" && c.questionId === currentQuestion.question.id) return c;
    }
    return null;
  }, [contents, currentQuestion]);

  const leaderboard: ScoreRow[] = useMemo(() => {
    for (let i = contents.length - 1; i >= 0; i--) {
      const c = contents[i];
      if (c.type === "leaderboard") return c.scores;
    }
    return [];
  }, [contents]);

  // my answer for the current question
  const myAnswer = useMemo(() => {
    if (!me || !currentQuestion) return null;
    for (let i = contents.length - 1; i >= 0; i--) {
      const c = contents[i];
      if (
        c.type === "answer" &&
        c.userId === me.id &&
        c.questionId === currentQuestion.question.id
      )
        return c.choice;
    }
    return null;
  }, [contents, me, currentQuestion]);

  // ---- host: run the game loop ----
  const durationById = useRef(new Map<string, number>());
  useEffect(() => {
    for (const c of contents)
      if (c.type === "question") durationById.current.set(c.question.id, c.duration);
  }, [contents]);

  function computeLeaderboard(): ScoreRow[] {
    const totals = new Map<string, number>();
    for (const c of contents) {
      if (c.type === "answer") {
        const dur = durationById.current.get(c.questionId) ?? DURATION;
        const pts = scoreFor(c.correct, c.ms, dur);
        totals.set(c.userId, (totals.get(c.userId) ?? 0) + pts);
      }
    }
    return roster
      .map((p) => ({
        userId: p.id,
        name: p.name,
        avatar: p.avatar,
        points: totals.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points);
  }

  const [loading, setLoading] = useState(false);
  const askedIds = useMemo(
    () =>
      contents.filter((c) => c.type === "question").map((c) => (c as Extract<Msg, { type: "question" }>).question.id),
    [contents],
  );

  async function nextRound() {
    setLoading(true);
    // summarize the round that just finished (if any)
    let summary: RoundSummary;
    if (!currentQuestion) {
      summary = {
        correctRate: 0,
        playerCount: roster.length,
        askedIds: [],
        lastDifficulty: null,
      };
    } else {
      const ans = contents.filter(
        (c) => c.type === "answer" && c.questionId === currentQuestion.question.id,
      ) as Extract<Msg, { type: "answer" }>[];
      const correct = ans.filter((a) => a.correct).length;
      summary = {
        correctRate: ans.length ? correct / ans.length : 0,
        playerCount: roster.length,
        askedIds,
        lastDifficulty: currentQuestion.question.difficulty,
      };
    }

    try {
      const res = await fetch("/api/host", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      });
      const data = await res.json();
      if (data.done) {
        send({ content: { type: "phase", value: "ended", at: Date.now() } });
        send({ content: { type: "leaderboard", scores: computeLeaderboard(), at: Date.now() } });
        setLoading(false);
        return;
      }
      const q: Question = data.question;
      const total = askedIds.length + 1;
      send({
        content: {
          type: "question",
          question: q,
          index: total,
          total,
          duration: DURATION,
          startedAt: Date.now(),
          hostLine: data.hostLine,
        },
      });
      send({ content: { type: "phase", value: "question", at: Date.now() } });
    } finally {
      setLoading(false);
    }
  }

  // host closes the round when the timer ends
  const revealedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isHost || !currentQuestion || phase !== "question") return;
    const qid = currentQuestion.question.id;
    if (revealedRef.current.has(qid)) return;
    const elapsed = Date.now() - currentQuestion.startedAt;
    const remaining = Math.max(0, currentQuestion.duration * 1000 - elapsed);
    const t = setTimeout(() => {
      if (revealedRef.current.has(qid)) return;
      revealedRef.current.add(qid);
      const ans = contents.filter(
        (c) => c.type === "answer" && c.questionId === qid,
      ) as Extract<Msg, { type: "answer" }>[];
      const tallies = [0, 0, 0, 0];
      for (const a of ans) if (a.choice >= 0 && a.choice < 4) tallies[a.choice]++;
      send({
        content: {
          type: "reveal",
          questionId: qid,
          correct: currentQuestion.question.correct,
          tallies,
          hostLine: "",
        },
      });
      send({ content: { type: "phase", value: "reveal", at: Date.now() } });
      send({ content: { type: "leaderboard", scores: computeLeaderboard(), at: Date.now() } });
    }, remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, currentQuestion, phase, contents]);

  function answer(choice: number) {
    if (!me || !currentQuestion || myAnswer !== null || phase !== "question") return;
    const ms = Date.now() - currentQuestion.startedAt;
    send({
      content: {
        type: "answer",
        userId: me.id,
        name: me.name,
        questionId: currentQuestion.question.id,
        choice,
        correct: choice === currentQuestion.question.correct,
        ms,
      },
    });
  }

  if (!me) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <p className="mb-4 text-lilac">Primero elige tu nombre y símbolo.</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-xl bg-candle px-6 py-3 font-display font-bold text-night"
          >
            Ir al inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-6">
      <TopBar code={code} count={roster.length} />

      {phase === "lobby" && (
        <Lobby roster={roster} isHost={isHost} loading={loading} onStart={nextRound} code={code} />
      )}

      {(phase === "question" || phase === "reveal") && currentQuestion && (
        <Play
          q={currentQuestion.question}
          index={currentQuestion.index}
          hostLine={currentQuestion.hostLine}
          startedAt={currentQuestion.startedAt}
          duration={currentQuestion.duration}
          phase={phase}
          reveal={reveal}
          myAnswer={myAnswer}
          onAnswer={answer}
          leaderboard={leaderboard}
          isHost={isHost}
          loading={loading}
          onNext={nextRound}
        />
      )}

      {phase === "ended" && <Ended leaderboard={leaderboard} isHost={isHost} onRestart={nextRound} />}
    </main>
  );
}

/* ---------------- components ---------------- */

function TopBar({ code, count }: { code: string; count: number }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-lilac">Sala</div>
        <div className="font-mono text-2xl font-bold tracking-[0.35em] text-candle">{code}</div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-night-2/70 px-3 py-1.5">
        <span className="candle-glow h-2 w-2 rounded-full bg-ember" />
        <span className="font-mono text-xs text-parchment">{count} en vivo</span>
      </div>
    </div>
  );
}

function AIHost({ line }: { line: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-candle/20 bg-gradient-to-br from-candle/10 to-transparent p-4">
      <div className="candle-glow mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-candle text-night shadow-halo">
        <span className="text-lg">✦</span>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-candle/80">
          Anfitrión IA
        </div>
        <p className="mt-0.5 text-sm text-parchment">{line || "…"}</p>
      </div>
    </div>
  );
}

function Lobby({
  roster,
  isHost,
  loading,
  onStart,
  code,
}: {
  roster: Player[];
  isHost: boolean;
  loading: boolean;
  onStart: () => void;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  function share() {
    const url = `${location.origin}/room/${code}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="rise">
      <div className="mb-6 rounded-3xl border border-white/10 bg-night-2/70 p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-lilac">
          Comparte el código
        </p>
        <p className="my-2 font-mono text-5xl font-bold tracking-[0.4em] text-candle">{code}</p>
        <button
          onClick={share}
          className="mt-1 rounded-lg border border-white/15 px-4 py-2 font-mono text-xs text-parchment hover:bg-white/5"
        >
          {copied ? "¡Enlace copiado!" : "Copiar enlace de la sala"}
        </button>
      </div>

      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-lilac">
        En la sala · {roster.length}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {roster.map((p) => (
          <div
            key={p.id}
            className="pop flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-night-2/50 py-4"
          >
            <span className="text-3xl">{p.avatar}</span>
            <span className="max-w-full truncate px-1 text-xs text-parchment">{p.name}</span>
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={loading}
          className="pop mt-8 w-full rounded-xl bg-candle py-4 font-display text-lg font-bold text-night shadow-halo-lg transition hover:brightness-105 disabled:opacity-60"
        >
          {loading ? "El anfitrión prepara…" : "Comenzar vigilia"}
        </button>
      ) : (
        <p className="mt-8 text-center text-sm text-lilac">
          Esperando a que el anfitrión comience… 🕯️
        </p>
      )}
    </div>
  );
}

function useCountdown(startedAt: number, duration: number, active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, [active]);
  const remaining = Math.max(0, duration - (now - startedAt) / 1000);
  return remaining;
}

function Play({
  q,
  index,
  hostLine,
  startedAt,
  duration,
  phase,
  reveal,
  myAnswer,
  onAnswer,
  leaderboard,
  isHost,
  loading,
  onNext,
}: {
  q: Question;
  index: number;
  hostLine: string;
  startedAt: number;
  duration: number;
  phase: "question" | "reveal";
  reveal: Extract<Msg, { type: "reveal" }> | null;
  myAnswer: number | null;
  onAnswer: (i: number) => void;
  leaderboard: ScoreRow[];
  isHost: boolean;
  loading: boolean;
  onNext: () => void;
}) {
  const remaining = useCountdown(startedAt, duration, phase === "question");
  const pct = Math.max(0, Math.min(100, (remaining / duration) * 100));
  const revealed = phase === "reveal" && reveal;
  const colors = ["#7B6CF6", "#FF6B5E", "#F5C451", "#5EC6A8"];
  const totalVotes = revealed ? reveal!.tallies.reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="rise">
      <AIHost line={hostLine} />

      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-lilac">
          Pregunta {index}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-candle">
          {q.reference}
        </span>
      </div>

      {/* timer */}
      {phase === "question" && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="tick h-full rounded-full bg-candle" style={{ width: `${pct}%` }} />
        </div>
      )}

      <h2 className="mb-5 font-display text-2xl font-bold leading-snug">{q.prompt}</h2>

      <div className="grid gap-3">
        {q.options.map((opt, i) => {
          const chosen = myAnswer === i;
          const isCorrect = revealed && i === reveal!.correct;
          const isWrongPick = revealed && chosen && i !== reveal!.correct;
          const votes = revealed ? reveal!.tallies[i] : 0;
          const votePct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              disabled={phase !== "question" || myAnswer !== null}
              className={`relative overflow-hidden rounded-2xl border px-4 py-4 text-left transition ${
                isCorrect
                  ? "border-[#5EC6A8] bg-[#5EC6A8]/15"
                  : isWrongPick
                    ? "border-ember bg-ember/10"
                    : chosen
                      ? "border-candle bg-candle/10"
                      : "border-white/10 bg-night-2/60 hover:border-white/25"
              } ${phase !== "question" || myAnswer !== null ? "cursor-default" : ""}`}
            >
              {revealed && (
                <span
                  className="absolute inset-y-0 left-0 -z-0 opacity-25"
                  style={{ width: `${votePct}%`, background: colors[i] }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-sm font-bold text-night"
                  style={{ background: colors[i] }}
                >
                  {["A", "B", "C", "D"][i]}
                </span>
                <span className="flex-1 text-parchment">{opt}</span>
                {revealed && <span className="font-mono text-xs text-lilac">{votePct}%</span>}
                {isCorrect && <span>✓</span>}
              </span>
            </button>
          );
        })}
      </div>

      {phase === "question" && myAnswer !== null && (
        <p className="mt-4 text-center text-sm text-lilac">
          Respuesta enviada. Espera al resto… ⏳
        </p>
      )}

      {revealed && (
        <div className="mt-6">
          <MiniBoard leaderboard={leaderboard} />
          {isHost && (
            <button
              onClick={onNext}
              disabled={loading}
              className="pop mt-4 w-full rounded-xl bg-candle py-4 font-display text-lg font-bold text-night shadow-halo-lg disabled:opacity-60"
            >
              {loading ? "Preparando…" : "Siguiente pregunta"}
            </button>
          )}
          {!isHost && (
            <p className="mt-4 text-center text-sm text-lilac">
              El anfitrión elegirá la siguiente… ✦
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MiniBoard({ leaderboard }: { leaderboard: ScoreRow[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-night-2/60 p-4">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-candle">
        Marcador
      </p>
      <div className="space-y-2">
        {leaderboard.slice(0, 5).map((r, i) => (
          <div key={r.userId} className="flex items-center gap-3">
            <span className="w-5 font-mono text-sm text-lilac">{i + 1}</span>
            <span className="text-xl">{r.avatar}</span>
            <span className="flex-1 truncate text-sm text-parchment">{r.name}</span>
            <span className="font-mono text-sm font-bold text-candle">{r.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ended({
  leaderboard,
  isHost,
  onRestart,
}: {
  leaderboard: ScoreRow[];
  isHost: boolean;
  onRestart: () => void;
}) {
  const winner = leaderboard[0];
  return (
    <div className="rise text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-lilac">
        Fin de la vigilia
      </p>
      {winner && (
        <div className="my-6">
          <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-candle/15 text-5xl shadow-halo-lg">
            {winner.avatar}
          </div>
          <p className="font-display text-3xl font-extrabold text-candle">{winner.name}</p>
          <p className="font-mono text-sm text-lilac">{winner.points} puntos</p>
        </div>
      )}
      <MiniBoard leaderboard={leaderboard} />
      {isHost && (
        <button
          onClick={onRestart}
          className="mt-6 w-full rounded-xl border border-white/15 py-3.5 font-display font-semibold text-parchment hover:bg-white/5"
        >
          Otra ronda
        </button>
      )}
    </div>
  );
}
