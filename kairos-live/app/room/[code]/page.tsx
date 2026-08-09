"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useChannel } from "@portalsdk/react";
import { roomChannelId } from "@/lib/portal";
import { scoreFor } from "@/lib/game";
import type { Msg, Player, Question, ScoreRow, RoundSummary } from "@/lib/types";

const DURATION = 12; // seconds per question

// lightweight telemetry: proves realtime activity in the console for the jury
function ev(name: string, data?: unknown) {
  try {
    // eslint-disable-next-line no-console
    console.log(`[KAIROS] ${name}`, data ?? "");
  } catch {}
}

// keep only the FIRST answer per (user, question) — protects against
// double-clicks, retries, reconnections and duplicated realtime events
function firstAnswers(
  cs: Msg[],
): Extract<Msg, { type: "answer" }>[] {
  const seen = new Set<string>();
  const out: Extract<Msg, { type: "answer" }>[] = [];
  for (const c of cs) {
    if (c.type !== "answer") continue;
    const key = `${c.userId}:${c.questionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

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

  const { messages, send, status } = useChannel<Msg>({ channelId: roomChannelId(code) });
  const [error, setError] = useState<string | null>(null);

  // announce myself once the channel is actually connected (so presence is reliable)
  const announced = useRef(false);
  useEffect(() => {
    if (!me || status !== "ready" || announced.current) return;
    announced.current = true;
    ev("PLAYER_JOINED", { id: me.id, name: me.name });
    send({ content: { type: "join", player: me, at: Date.now() } });
  }, [me, status, send]);

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

  const myAnswer = useMemo(() => {
    if (!me || !currentQuestion) return null;
    for (let i = contents.length - 1; i >= 0; i--) {
      const c = contents[i];
      if (c.type === "answer" && c.userId === me.id && c.questionId === currentQuestion.question.id)
        return c.choice;
    }
    return null;
  }, [contents, me, currentQuestion]);

  // chat feed
  const chat = useMemo(
    () => contents.filter((c) => c.type === "chat") as Extract<Msg, { type: "chat" }>[],
    [contents],
  );

  const askedIds = useMemo(
    () =>
      contents
        .filter((c) => c.type === "question")
        .map((c) => (c as Extract<Msg, { type: "question" }>).question.id),
    [contents],
  );

  // keep a live ref so the reveal logic always reads the freshest data
  const durationById = useRef(new Map<string, number>());
  useEffect(() => {
    for (const c of contents)
      if (c.type === "question") durationById.current.set(c.question.id, c.duration);
  }, [contents]);

  const live = useRef({ contents, roster });
  live.current = { contents, roster };

  function computeLeaderboard(cs: Msg[], rs: Player[]): ScoreRow[] {
    const totals = new Map<string, number>();
    for (const c of firstAnswers(cs)) {
      const dur = durationById.current.get(c.questionId) ?? DURATION;
      totals.set(c.userId, (totals.get(c.userId) ?? 0) + scoreFor(c.correct, c.ms, dur));
    }
    return rs
      .map((p) => ({ userId: p.id, name: p.name, avatar: p.avatar, points: totals.get(p.id) ?? 0 }))
      .sort((a, b) => b.points - a.points);
  }

  // ---- BULLETPROOF REVEAL ----
  // idempotent close of a round, safe to call from timer, "all answered", or button
  const revealedRef = useRef<Set<string>>(new Set());
  const doReveal = useCallback(
    (qid: string, correct: number) => {
      if (revealedRef.current.has(qid)) return;
      revealedRef.current.add(qid);
      const cs = live.current.contents;
      const rs = live.current.roster;
      const ans = firstAnswers(cs).filter((c) => c.questionId === qid);
      const tallies = [0, 0, 0, 0];
      for (const a of ans) if (a.choice >= 0 && a.choice < 4) tallies[a.choice]++;
      ev("REVEAL", { qid, tallies });
      send({ content: { type: "reveal", questionId: qid, correct, tallies, hostLine: "" } });
      send({ content: { type: "phase", value: "reveal", at: Date.now() } });
      send({ content: { type: "leaderboard", scores: computeLeaderboard(cs, rs), at: Date.now() } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send],
  );

  // self-healing watchdog: every 500ms the host checks whether the round should close.
  // Fires on timeout OR when everyone has answered — never depends on a single setTimeout.
  useEffect(() => {
    if (!isHost) return;
    const i = setInterval(() => {
      const cs = live.current.contents;
      const rs = live.current.roster;
      // find latest question + whether it's still open
      let q: Extract<Msg, { type: "question" }> | null = null;
      let ph: string = "lobby";
      for (let k = cs.length - 1; k >= 0; k--) {
        if (!q && cs[k].type === "question") q = cs[k] as Extract<Msg, { type: "question" }>;
        if (ph === "lobby" && cs[k].type === "phase") ph = (cs[k] as Extract<Msg, { type: "phase" }>).value;
        if (q && ph !== "lobby") break;
      }
      if (!q || ph !== "question") return;
      const qid = q.question.id;
      if (revealedRef.current.has(qid)) return;
      const answered = new Set(
        cs.filter((c) => c.type === "answer" && c.questionId === qid).map((c) => (c as Extract<Msg, { type: "answer" }>).userId),
      );
      const timeUp = Date.now() - q.startedAt >= q.duration * 1000;
      const everyoneAnswered = rs.length > 0 && answered.size >= rs.length;
      if (timeUp || everyoneAnswered) doReveal(qid, q.question.correct);
    }, 500);
    return () => clearInterval(i);
  }, [isHost, doReveal]);

  // ---- host game loop ----
  const [loading, setLoading] = useState(false);

  async function nextRound() {
    if (loading) return; // guard: no double "Comenzar"/"Siguiente"
    setLoading(true);
    // per-question accuracy across the game so far (deduped), oldest→newest
    const deduped = firstAnswers(contents);
    const recentRates = askedIds
      .map((qid) => {
        const a = deduped.filter((x) => x.questionId === qid);
        return a.length ? a.filter((x) => x.correct).length / a.length : 0;
      })
      .slice(-3);

    let summary: RoundSummary;
    if (!currentQuestion) {
      summary = { correctRate: 0, playerCount: roster.length, askedIds: [], lastDifficulty: null, recentRates: [] };
    } else {
      const ans = deduped.filter((c) => c.questionId === currentQuestion.question.id);
      const correct = ans.filter((a) => a.correct).length;
      summary = {
        correctRate: ans.length ? correct / ans.length : 0,
        playerCount: roster.length,
        askedIds,
        lastDifficulty: currentQuestion.question.difficulty,
        recentRates,
      };
    }
    try {
      setError(null);
      const res = await fetch("/api/host", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(summary),
      });
      if (!res.ok) {
        setError(`El anfitrión IA respondió ${res.status}. Revisa las variables de entorno.`);
        return;
      }
      const data = await res.json();
      ev(data.source === "ai" ? "AI_SUCCESS" : "AI_FALLBACK", { difficulty: data.difficulty });
      if (data.done) {
        send({ content: { type: "phase", value: "ended", at: Date.now() } });
        send({ content: { type: "leaderboard", scores: computeLeaderboard(contents, roster), at: Date.now() } });
        ev("GAME_FINISHED");
        return;
      }
      const q: Question = data.question;
      const total = askedIds.length + 1;
      ev("QUESTION_PUBLISHED", { index: total, difficulty: q.difficulty });
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
    } catch {
      setError("No se pudo contactar al anfitrión IA. ¿Está bien la ruta /api/host?");
    } finally {
      setLoading(false);
    }
  }

  function answer(choice: number) {
    if (!me || !currentQuestion || myAnswer !== null || phase !== "question") return;
    const ms = Date.now() - currentQuestion.startedAt;
    ev("ANSWER_RECEIVED", { q: currentQuestion.question.id, choice });
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

  const lastChatAt = useRef(0);
  function sendChat(text: string) {
    if (!me || !text.trim()) return;
    const now = Date.now();
    if (now - lastChatAt.current < 1000) return; // anti-spam: 1 msg/sec
    lastChatAt.current = now;
    send({
      content: { type: "chat", userId: me.id, name: me.name, avatar: me.avatar, text: text.slice(0, 200), at: now },
    });
  }

  if (!me) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <p className="mb-4 text-lilac">Primero elige tu nombre y símbolo.</p>
          <button onClick={() => router.push("/")} className="rounded-xl bg-candle px-6 py-3 font-display font-bold text-night">
            Ir al inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-6">
      <TopBar code={code} count={roster.length} status={status} />

      {error && (
        <div className="mb-4 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-parchment">{error}</div>
      )}

      {phase === "lobby" && <Lobby roster={roster} isHost={isHost} loading={loading} onStart={nextRound} code={code} />}

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
          onRevealNow={() => doReveal(currentQuestion.question.id, currentQuestion.question.correct)}
        />
      )}

      {phase === "ended" && <Ended leaderboard={leaderboard} isHost={isHost} onRestart={() => router.push("/")} />}

      <Chat chat={chat} meId={me.id} onSend={sendChat} />
    </main>
  );
}

/* ---------------- components ---------------- */

function TopBar({ code, count, status }: { code: string; count: number; status?: string }) {
  const connected = status === "ready";
  const label = connected
    ? `${count} en vivo`
    : status === "reconnecting"
      ? "reconectando…"
      : status === "connecting" || status === "idle"
        ? "conectando…"
        : status
          ? `Portal: ${status}`
          : "conectando…";
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-lilac">Sala</div>
        <div className="font-mono text-2xl font-bold tracking-[0.35em] text-candle">{code}</div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-night-2/70 px-3 py-1.5">
        <span className={`h-2 w-2 rounded-full ${connected ? "candle-glow bg-ember" : "bg-lilac/50"}`} title={`estado: ${status ?? "?"}`} />
        <span className="font-mono text-xs text-parchment">{label}</span>
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
        <div className="font-mono text-[10px] uppercase tracking-widest text-candle/80">Anfitrión IA</div>
        <p className="mt-0.5 text-sm text-parchment">{line || "…"}</p>
      </div>
    </div>
  );
}

function Lobby({ roster, isHost, loading, onStart, code }: { roster: Player[]; isHost: boolean; loading: boolean; onStart: () => void; code: string }) {
  const [copied, setCopied] = useState(false);
  function share() {
    navigator.clipboard?.writeText(`${location.origin}/room/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="rise">
      <div className="mb-6 rounded-3xl border border-white/10 bg-night-2/70 p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-lilac">Comparte el código</p>
        <p className="my-2 font-mono text-5xl font-bold tracking-[0.4em] text-candle">{code}</p>
        <button onClick={share} className="mt-1 rounded-lg border border-white/15 px-4 py-2 font-mono text-xs text-parchment hover:bg-white/5">
          {copied ? "¡Enlace copiado!" : "Copiar enlace de la sala"}
        </button>
      </div>
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-lilac">En la sala · {roster.length}</p>
      <div className="grid grid-cols-3 gap-2">
        {roster.map((p) => (
          <div key={p.id} className="pop flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-night-2/50 py-4">
            <span className="text-3xl">{p.avatar}</span>
            <span className="max-w-full truncate px-1 text-xs text-parchment">{p.name}</span>
          </div>
        ))}
      </div>
      {isHost ? (
        <button onClick={onStart} disabled={loading} className="pop mt-8 w-full rounded-xl bg-candle py-4 font-display text-lg font-bold text-night shadow-halo-lg transition hover:brightness-105 disabled:opacity-60">
          {loading ? "El anfitrión prepara…" : "Comenzar vigilia"}
        </button>
      ) : (
        <p className="mt-8 text-center text-sm text-lilac">Esperando a que el anfitrión comience… 🕯️</p>
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
  return Math.max(0, duration - (now - startedAt) / 1000);
}

function Play({
  q, index, hostLine, startedAt, duration, phase, reveal, myAnswer, onAnswer, leaderboard, isHost, loading, onNext, onRevealNow,
}: {
  q: Question; index: number; hostLine: string; startedAt: number; duration: number;
  phase: "question" | "reveal"; reveal: Extract<Msg, { type: "reveal" }> | null; myAnswer: number | null;
  onAnswer: (i: number) => void; leaderboard: ScoreRow[]; isHost: boolean; loading: boolean; onNext: () => void; onRevealNow: () => void;
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
        <span className="font-mono text-[11px] uppercase tracking-widest text-lilac">Pregunta {index}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-candle">{q.reference}</span>
      </div>
      {phase === "question" && (
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="tick h-full rounded-full bg-candle" style={{ width: `${pct}%` }} />
        </div>
      )}
      {phase === "question" && (
        <div className="mb-4 text-right font-mono text-xs text-lilac">{Math.ceil(remaining)}s</div>
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
                isCorrect ? "border-[#5EC6A8] bg-[#5EC6A8]/15"
                : isWrongPick ? "border-ember bg-ember/10"
                : chosen ? "border-candle bg-candle/10"
                : "border-white/10 bg-night-2/60 hover:border-white/25"
              } ${phase !== "question" || myAnswer !== null ? "cursor-default" : ""}`}
            >
              {revealed && <span className="absolute inset-y-0 left-0 -z-0 opacity-25" style={{ width: `${votePct}%`, background: colors[i] }} />}
              <span className="relative z-10 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-sm font-bold text-night" style={{ background: colors[i] }}>
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
        <p className="mt-4 text-center text-sm text-lilac">Respuesta enviada. Espera al resto… ⏳</p>
      )}
      {phase === "question" && isHost && (
        <button onClick={onRevealNow} className="mt-4 w-full rounded-xl border border-white/15 py-2.5 font-mono text-xs uppercase tracking-widest text-lilac hover:bg-white/5">
          Revelar ahora
        </button>
      )}

      {revealed && (
        <div className="mt-6">
          <MiniBoard leaderboard={leaderboard} />
          {isHost ? (
            <button onClick={onNext} disabled={loading} className="pop mt-4 w-full rounded-xl bg-candle py-4 font-display text-lg font-bold text-night shadow-halo-lg disabled:opacity-60">
              {loading ? "Preparando…" : "Siguiente pregunta"}
            </button>
          ) : (
            <p className="mt-4 text-center text-sm text-lilac">El anfitrión elegirá la siguiente… ✦</p>
          )}
        </div>
      )}
    </div>
  );
}

function MiniBoard({ leaderboard }: { leaderboard: ScoreRow[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-night-2/60 p-4">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-candle">Marcador</p>
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

function Ended({ leaderboard, isHost, onRestart }: { leaderboard: ScoreRow[]; isHost: boolean; onRestart: () => void }) {
  const winner = leaderboard[0];
  return (
    <div className="rise text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-lilac">Fin de la vigilia</p>
      {winner && (
        <div className="my-6">
          <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-candle/15 text-5xl shadow-halo-lg">{winner.avatar}</div>
          <p className="font-display text-3xl font-extrabold text-candle">{winner.name}</p>
          <p className="font-mono text-sm text-lilac">{winner.points} puntos</p>
        </div>
      )}
      <MiniBoard leaderboard={leaderboard} />
      {isHost && (
        <button onClick={onRestart} className="mt-6 w-full rounded-xl border border-white/15 py-3.5 font-display font-semibold text-parchment hover:bg-white/5">
          Nueva sala
        </button>
      )}
    </div>
  );
}

function Chat({ chat, meId, onSend }: { chat: Extract<Msg, { type: "chat" }>[]; meId: string; onSend: (t: string) => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, open]);

  function submit() {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-night-2/60">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-candle">
          Chat de la sala {chat.length ? `· ${chat.length}` : ""}
        </span>
        <span className="font-mono text-xs text-lilac">{open ? "ocultar" : "mostrar"}</span>
      </button>
      {open && (
        <>
          <div className="max-h-56 space-y-2 overflow-y-auto px-4 pb-2">
            {chat.length === 0 && (
              <p className="py-4 text-center text-xs text-lilac/60">Aún no hay mensajes. ¡Saluda a la sala! 🕊️</p>
            )}
            {chat.map((c, i) => {
              const mine = c.userId === meId;
              return (
                <div key={i} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  <span className="text-lg">{c.avatar}</span>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-candle text-night" : "bg-night text-parchment"}`}>
                    {!mine && <span className="mb-0.5 block font-mono text-[10px] uppercase tracking-wide text-lilac">{c.name}</span>}
                    {c.text}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Escribe un mensaje…"
              maxLength={200}
              className="flex-1 rounded-xl border border-white/10 bg-night px-3 py-2.5 text-sm text-parchment outline-none placeholder:text-lilac/40 focus:border-candle/60"
            />
            <button onClick={submit} className="rounded-xl bg-candle px-4 py-2.5 font-display text-sm font-bold text-night">
              Enviar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
