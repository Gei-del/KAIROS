"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { makeRoomCode, makeUserId, randomAvatar } from "@/lib/game";
import { ensureAnonymousSession, getSupabase } from "@/lib/supabase";

const AVATARS = ["🕊️", "✝️", "🔥", "⭐", "🌿", "👑", "📖", "🎺", "🛡️", "🌅", "🍞", "🕯️"];

function saveMe(name: string, avatar: string) {
  const me = { id: makeUserId(), name: name.trim().slice(0, 18) || "Invitado", avatar };
  sessionStorage.setItem("kairos_me", JSON.stringify(me));
  return me;
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"idle" | "join">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const invited = new URLSearchParams(window.location.search).get("join")?.toUpperCase() ?? "";
    if (invited) { setJoinCode(invited); setMode("join"); }
  }, []);

  async function create() {
    if (busy) return;
    setBusy(true); setError("");
    const me = saveMe(name, avatar);
    const code = makeRoomCode();
    try {
      await ensureAnonymousSession();
      const { data, error: rpcError } = await getSupabase().rpc("create_room", {
        room_code: code, player_name: me.name, player_avatar: me.avatar,
      });
      if (rpcError) throw rpcError;
      sessionStorage.setItem("kairos_room_id", data);
      router.push(`/room/${code}?host=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos crear la sala.");
      setBusy(false);
    }
  }
  async function join() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    if (busy) return;
    setBusy(true); setError("");
    const me = saveMe(name, avatar);
    try {
      await ensureAnonymousSession();
      const { data, error: rpcError } = await getSupabase().rpc("join_room", {
        room_code: code, player_name: me.name, player_avatar: me.avatar,
      });
      if (rpcError) throw rpcError;
      sessionStorage.setItem("kairos_room_id", data);
      router.push(`/room/${code}`);
    } catch {
      setError("No encontramos esa sala o la partida ya comenzó.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <header className="mb-10 text-center">
        <div className="mb-3 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-candle/80">
          <span className="candle-glow inline-block h-2 w-2 rounded-full bg-candle shadow-halo" />
          Vigilia en vivo
        </div>
        <h1 className="font-display text-6xl font-extrabold leading-none tracking-tight">
          KAIROS
          <span className="block bg-gradient-to-r from-candle via-parchment to-candle bg-clip-text text-transparent">
            LIVE
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xs text-sm text-lilac">
          El momento señalado. Una sala, un anfitrión de IA, y toda la comunidad
          respondiendo a la vez.
        </p>
      </header>

      <section className="rise rounded-3xl border border-white/10 bg-night-2/70 p-6 backdrop-blur">
        {error && <p role="alert" className="mb-4 rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm">{error}</p>}
        <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-lilac">
          Tu nombre
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="¿Cómo te llamas?"
          maxLength={18}
          className="w-full rounded-xl border border-white/10 bg-night px-4 py-3 text-parchment outline-none placeholder:text-lilac/40 focus:border-candle/60"
        />

        <div className="mb-1 mt-5 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-widest text-lilac">
            Tu símbolo
          </span>
          <button
            onClick={() => setAvatar(randomAvatar())}
            className="font-mono text-[11px] text-candle/80 hover:text-candle"
          >
            aleatorio
          </button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={`aspect-square rounded-xl text-2xl transition ${
                avatar === a
                  ? "bg-candle/20 ring-2 ring-candle shadow-halo"
                  : "bg-night hover:bg-white/5"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {mode === "idle" ? (
          <div className="mt-7 space-y-3">
            <button
              onClick={create}
              disabled={busy}
              className="pop w-full rounded-xl bg-candle py-4 font-display text-lg font-bold text-night shadow-halo-lg transition hover:brightness-105"
            >
              {busy ? "Preparando sala…" : "Crear sala"}
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full rounded-xl border border-white/15 py-3.5 font-display font-semibold text-parchment transition hover:bg-white/5"
            >
              Unirme con un código
            </button>
          </div>
        ) : (
          <div className="mt-7 space-y-3">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              maxLength={4}
              className="w-full rounded-xl border border-white/10 bg-night px-4 py-4 text-center font-mono text-3xl tracking-[0.4em] text-candle outline-none placeholder:text-lilac/30 focus:border-candle/60"
            />
            <button
              onClick={join}
              disabled={busy}
              className="pop w-full rounded-xl bg-candle py-4 font-display text-lg font-bold text-night shadow-halo-lg transition hover:brightness-105"
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
            <button
              onClick={() => setMode("idle")}
              className="w-full py-2 font-mono text-xs uppercase tracking-widest text-lilac hover:text-parchment"
            >
              volver
            </button>
          </div>
        )}
      </section>

      <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-lilac/50">
        Multijugador con Supabase · Biblia RV1909
      </p>
    </main>
  );
}
