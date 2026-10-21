"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";
import { HostMenu } from "@/components/HostMenu";
import { PlayingCard } from "@/components/PlayingCard";
import { usePlayer } from "@/components/PlayerProvider";
import { TableChat } from "@/components/TableChat";
import { feltCss } from "@/lib/felt";
import type { BotDifficulty, FeltAccent, PublicRoom, Street } from "@/lib/types";

const SEAT_POS = [
  { top: "88%", left: "50%" },
  { top: "74%", left: "88%" },
  { top: "48%", left: "96%" },
  { top: "22%", left: "88%" },
  { top: "8%", left: "50%" },
  { top: "22%", left: "12%" },
  { top: "48%", left: "4%" },
  { top: "74%", left: "12%" },
  { top: "92%", left: "74%" },
  { top: "92%", left: "26%" },
];

const BOT_SHORT: Record<BotDifficulty, string> = {
  easy: "Ini",
  medium: "Méd",
  hard: "Dif",
};

const STREET_LABEL: Record<Street, string> = {
  preflop: "Pré-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

function formatChips(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

export function TableView({ code }: { code: string }) {
  const router = useRouter();
  const player = usePlayer();
  const playerId = player.id;
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [betInput, setBetInput] = useState("");
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [showToast, setShowToast] = useState(false);
  const [clockSkew, setClockSkew] = useState(0);
  const prevPot = useRef(0);
  const [potBump, setPotBump] = useState(0);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const [feltAccent, setFeltAccent] = useState<FeltAccent>("olive");
  const [hostOpen, setHostOpen] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const wasMyTurn = useRef(false);
  const joinStarted = useRef(false);

  useEffect(() => {
    if (player.guest?.feltAccent) {
      setFeltAccent(player.guest.feltAccent);
      return;
    }
    if (player.mode !== "google") return;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile?.feltAccent) setFeltAccent(d.profile.feltAccent);
      })
      .catch(() => {});
  }, [player.guest?.feltAccent, player.mode]);

  const applyRoom = useCallback((r: PublicRoom) => {
    if (typeof r.serverNow === "number") {
      setClockSkew(Date.now() - r.serverNow);
    }
    if (r.pot !== prevPot.current) {
      prevPot.current = r.pot;
      setPotBump((x) => x + 1);
    }
    setRoom(r);
    setError(null);
    setFatal(false);
  }, []);

  const leaveMissingRoom = useCallback(
    (msg: string) => {
      setFatal(true);
      setError(msg);
      setRoom(null);
      router.replace(`/?erro=sala&code=${encodeURIComponent(code)}`);
    },
    [router, code],
  );

  const refresh = useCallback(async () => {
    if (!playerId || fatal || player.mode === "loading" || player.mode === "none") return;
    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) {
      if (res.status === 404) {
        leaveMissingRoom("Sala encerrada ou não encontrada.");
        return;
      }
      if (res.status === 401) {
        setError("Sessão expirada — faça login de novo na home.");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao atualizar");
      return;
    }
    const data = await res.json();
    applyRoom(data.room as PublicRoom);
  }, [code, playerId, fatal, player.mode, leaveMissingRoom, applyRoom]);

  useEffect(() => {
    if (
      !playerId ||
      player.mode === "loading" ||
      player.mode === "none" ||
      joinStarted.current ||
      fatal
    ) {
      return;
    }
    joinStarted.current = true;
    const nick = player.name.slice(0, 16) || "Jogador";
    (async () => {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nick }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          leaveMissingRoom(data.error ?? "Sala não encontrada.");
          return;
        }
        if (res.status === 401) {
          joinStarted.current = false;
          setError("Faça login ou continue como convidado.");
          return;
        }
        setFatal(true);
        setError(data.error ?? "Falha ao entrar na sala");
        return;
      }
      if (player.isGuest && data.buyIn > 0) player.noteGuestBuyIn();
      applyRoom(data.room as PublicRoom);
    })();
  }, [
    playerId,
    player.mode,
    player.name,
    player.isGuest,
    player.noteGuestBuyIn,
    code,
    fatal,
    leaveMissingRoom,
    applyRoom,
  ]);

  const myTurn =
    !!room &&
    room.status === "playing" &&
    room.actingSeat !== null &&
    room.players.find((p) => p.id === playerId)?.seat === room.actingSeat;

  const botActing =
    !!room &&
    room.status === "playing" &&
    !!room.players.find((p) => p.seat === room.actingSeat)?.isBot;

  useEffect(() => {
    if (!playerId || fatal || !room || player.mode === "none") return;
    const ms = myTurn || botActing ? 500 : 1200;
    const t = setInterval(refresh, ms);
    return () => clearInterval(t);
  }, [playerId, refresh, myTurn, botActing, fatal, room, player.mode]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (myTurn && !wasMyTurn.current) {
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 1800);
      wasMyTurn.current = true;
      return () => clearTimeout(t);
    }
    if (!myTurn) {
      wasMyTurn.current = false;
      setRaiseOpen(false);
    }
  }, [myTurn]);

  function api(path: string, body: Record<string, unknown>) {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/rooms/${code}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro");
        return;
      }
      if (data.room) setRoom(data.room);
    });
  }

  function leaveTable() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/rooms/${code}/leave`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não deu pra sair");
        return;
      }
      if (player.isGuest && typeof data.chipsReturned === "number") {
        player.noteGuestReturn(data.chipsReturned);
      } else {
        await player.refreshBank();
      }
      router.replace("/");
    });
  }

  function closeRoom() {
    start(async () => {
      const res = await fetch(`/api/rooms/${code}/close`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não deu pra encerrar");
        return;
      }
      router.replace("/");
    });
  }

  const timer = useMemo(() => {
    if (!room?.turnDeadline || room.status !== "playing") {
      return { left: 0, pct: 0, thinking: false };
    }
    const serverAligned = now - clockSkew;
    const leftMs = Math.max(0, room.turnDeadline - serverAligned);
    const actorBot = !!room.players.find((p) => p.seat === room.actingSeat)?.isBot;
    const total = actorBot ? 3 : room.turnSeconds || 18;
    return {
      left: Math.ceil(leftMs / 1000),
      pct: Math.min(100, (leftMs / (total * 1000)) * 100),
      thinking: actorBot,
    };
  }, [room, now, clockSkew]);

  if (player.mode === "loading") {
    return (
      <div className="flex h-dvh items-center justify-center text-amber-100/70">
        Entrando na mesa…
      </div>
    );
  }

  if (player.mode === "none") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-amber-100/80">Pra entrar na mesa:</p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="bg-amber-500 px-6 py-3 text-[#1a1208] hover:bg-amber-400"
        >
          Entrar com Google
        </button>
        <button
          type="button"
          onClick={() => void player.continueAsGuest("Convidado")}
          className="border border-amber-200/40 px-6 py-3 text-amber-100"
        >
          Continuar como convidado
        </button>
        <a href="/" className="text-sm text-amber-200/50 hover:text-amber-200">
          ← Voltar
        </a>
      </div>
    );
  }

  if (fatal || (!room && error)) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-rose-300">{error ?? "Não foi possível abrir a sala."}</p>
        <a href="/" className="bg-amber-500 px-5 py-2.5 text-emerald-950 hover:bg-amber-400">
          Voltar ao início
        </a>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 text-amber-100/70">
        <p>Entrando na mesa…</p>
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    );
  }

  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId || player.isAdmin;
  const isSpectator = !!me && (me.busted || (me.chips <= 0 && me.seat === null));
  const canSit =
    !!me && !me.busted && me.chips > 0 && me.seat === null && room.status !== "playing";
  const toCall = me ? Math.max(0, room.currentBet - me.bet) : 0;
  const minRaiseTo =
    room.currentBet === 0 ? room.bigBlind : room.currentBet + room.minRaise;
  const pot = room.pot;
  const halfPot = Math.max(minRaiseTo, Math.floor(pot / 2) || room.bigBlind);
  const potBet = Math.max(minRaiseTo, pot || room.bigBlind * 2);
  const allInTo = me ? me.bet + me.chips : 0;
  const actingName =
    room.players.find((p) => p.seat === room.actingSeat)?.nickname ?? "…";
  const streetLabel = room.street ? STREET_LABEL[room.street] : null;
  const canBet =
    myTurn &&
    room.status === "playing" &&
    !me?.allIn &&
    !me?.busted &&
    (me?.chips ?? 0) > 0;
  const sched = room.blindSchedule;
  const champ = room.championId
    ? room.players.find((p) => p.id === room.championId)
    : null;
  const felt = feltCss(feltAccent);

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden text-amber-50">
      {showToast && myTurn && (
        <div className="sua-vez-toast pointer-events-none fixed left-1/2 top-14 z-50 -translate-x-1/2 rounded bg-amber-500 px-4 py-1.5 font-[family-name:var(--font-display)] text-base text-[#1a1208] shadow-lg">
          Sua vez! 🃏
        </div>
      )}

      <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 sm:px-4">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-base tracking-tight text-amber-300 sm:text-lg">
            Poker Friends
          </p>
          <p className="truncate text-[0.55rem] uppercase tracking-[0.16em] text-amber-200/45">
            {room.code}
            {streetLabel ? ` · ${streetLabel}` : ""}
            {room.handNumber > 0 ? ` · #${room.handNumber}` : ""}
            {" · "}
            {room.smallBlind}/{room.bigBlind}
            {sched?.enabled && room.blindsProgress ? ` ↑${room.blindsProgress}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={leaveTable}
            title="Sai só você — a sala continua pros outros"
            className="border border-rose-400/35 px-2 py-1 text-[0.6rem] text-rose-100/90 hover:bg-rose-500/10"
          >
            Sair
          </button>
          <AuthBar compact />
        </div>
      </header>

      {(isSpectator && !room.tableEnded) || room.tableEnded ? (
        <p className="shrink-0 px-3 py-1 text-center text-[0.7rem] text-amber-100/80">
          {room.tableEnded
            ? `🏆 Mesa conquistada${champ ? `: ${champ.nickname}` : ""}. Pode sentar de novo.`
            : "Você faliu — só assiste até alguém conquistar a mesa."}
        </p>
      ) : null}

      {room.status === "playing" && room.actingSeat !== null && (
        <div className="relative z-20 mx-auto w-full max-w-3xl shrink-0 px-3">
          <div className="mb-0.5 flex justify-between text-[0.65rem] text-amber-100/70">
            <span>
              {timer.thinking ? "🤔 " : ""}
              {actingName}
              {myTurn ? " (você)" : ""}
              {room.myHandHint && !me?.folded ? ` · ${room.myHandHint}` : ""}
            </span>
            <span className={timer.left <= 5 ? "text-rose-300" : ""}>{timer.left}s</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-emerald-950/80">
            <div
              className={`h-full transition-[width] duration-200 ${
                timer.left <= 5 ? "bg-rose-400" : "bg-amber-400"
              }`}
              style={{ width: `${timer.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Table fills remaining viewport */}
      <div className="relative mx-auto flex min-h-0 w-full flex-1 items-center justify-center px-0 pb-2 pt-1">
        <div className="relative h-full max-h-full w-full max-w-[1000px] aspect-[5/4] sm:aspect-[4/3]">
          <div
            className="absolute inset-[1%] rounded-[48%] border-[8px] shadow-[inset_0_0_60px_rgba(0,0,0,0.45)] sm:inset-[2%] sm:border-[10px]"
            style={{
              borderColor: felt.rim,
              background: `radial-gradient(ellipse_at_center,${felt.feltLit} 0%,${felt.felt} 40%,#0f2418 100%)`,
            }}
          >
            <div className="absolute inset-[3%] rounded-[48%] border border-amber-400/15" />
          </div>

          <div className="absolute left-1/2 top-[42%] z-10 flex w-[94%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 sm:top-[46%]">
            <p className="text-[0.6rem] uppercase tracking-[0.25em] text-emerald-200/55">
              {streetLabel ?? "Mesa"}
            </p>
            <p
              key={potBump}
              className="pot-bump rounded-full bg-black/50 px-3 py-1 text-base font-semibold text-amber-200 sm:text-lg"
            >
              Pote {formatChips(room.pot)}
            </p>
            <div className="flex min-h-[4.5rem] items-center justify-center gap-1 sm:min-h-28 sm:gap-2">
              {room.community.map((c, i) => (
                <PlayingCard
                  key={`${room.handNumber}-${i}`}
                  card={c}
                  size="board"
                  dealDelayMs={i * 70}
                />
              ))}
            </div>
            {room.status === "showdown" && room.winners && (
              <div className="rounded bg-amber-500/15 px-2 py-1 text-center text-xs text-amber-200">
                {room.winners.map((w) => {
                  const p = room.players.find((x) => x.seat === w.seat);
                  return (
                    <p key={w.seat}>
                      {p?.nickname ?? "?"} +{w.amount}
                      <span className="text-emerald-100/60"> · {w.handName}</span>
                    </p>
                  );
                })}
              </div>
            )}
            {room.lastAction && (
              <p className="max-w-[90%] truncate text-[0.65rem] text-amber-100/50">
                {room.lastAction}
              </p>
            )}
          </div>

          {SEAT_POS.map((pos, seat) => {
            const p = room.players.find((x) => x.seat === seat);
            const isDealer = room.dealerSeat === seat && room.status !== "lobby";
            const isSb = room.sbSeat === seat && room.status === "playing";
            const isBb = room.bbSeat === seat && room.status === "playing";
            const isActing = room.actingSeat === seat && room.status === "playing";
            const isMe = p?.id === playerId;
            const empty = !p;
            const lastHere = room.lastSeatAction?.seat === seat;
            return (
              <button
                key={seat}
                type="button"
                disabled={!empty || !canSit || pending}
                onClick={() => api("sit", { seat })}
                style={{ top: pos.top, left: pos.left }}
                className={`absolute z-20 w-[5.5rem] -translate-x-1/2 -translate-y-1/2 sm:w-32 ${
                  empty && canSit ? "cursor-pointer opacity-80 hover:opacity-100" : "cursor-default"
                }`}
              >
                <div
                  className={`rounded-lg px-1 py-1 text-center sm:px-2 sm:py-1.5 ${
                    isActing
                      ? `bg-amber-500/95 text-emerald-950 ring-2 ring-amber-100 ${isMe ? "seat-your-turn" : ""}`
                      : empty
                        ? "border border-dashed border-emerald-300/25 bg-emerald-950/40 text-emerald-100/50"
                        : p?.folded
                          ? "bg-emerald-950/50 text-emerald-100/40"
                          : "bg-emerald-950/90 text-amber-50"
                  }`}
                >
                  {empty ? (
                    <span className="text-[0.6rem]">{canSit ? `+ ${seat + 1}` : "—"}</span>
                  ) : (
                    <>
                      <p className="truncate text-[0.6rem] font-medium sm:text-xs">
                        <span className="mr-0.5">{p.emoji || "🙏"}</span>
                        {p.nickname}
                        {p.isBot && p.botDifficulty
                          ? ` · ${BOT_SHORT[p.botDifficulty]}`
                          : ""}
                        {isMe ? " · você" : ""}
                      </p>
                      <p
                        className="text-[0.7rem] font-semibold tabular-nums sm:text-sm"
                        style={{ color: p.chipColor || "#f0b429" }}
                      >
                        {formatChips(p.chips)}
                      </p>
                      {p.bet > 0 && !p.folded && (
                        <p className="text-[0.55rem]">aposta {formatChips(p.bet)}</p>
                      )}
                      {p.folded && <p className="text-[0.55rem]">fold</p>}
                      {p.allIn && !p.folded && <p className="text-[0.55rem]">all-in</p>}
                      {p.holeCount > 0 && (
                        <div className="mt-0.5 flex justify-center gap-0.5 sm:gap-1">
                          {p.hole ? (
                            p.hole.map((c, i) => (
                              <PlayingCard
                                key={i}
                                card={c}
                                size={isMe ? "hero" : "seat"}
                                dealDelayMs={isMe ? i * 80 : 0}
                              />
                            ))
                          ) : (
                            <>
                              <PlayingCard hidden size="seat" />
                              <PlayingCard hidden size="seat" />
                            </>
                          )}
                        </div>
                      )}
                      {lastHere && room.lastSeatAction && (
                        <p className="mt-0.5 truncate text-[0.55rem] text-amber-300/90">
                          {room.lastSeatAction.label}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="absolute -right-1 -top-1 flex gap-0.5">
                  {isDealer && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[0.5rem] font-bold text-emerald-950">
                      D
                    </span>
                  )}
                  {isSb && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-[0.45rem] font-bold text-emerald-950">
                      SB
                    </span>
                  )}
                  {isBb && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-200 text-[0.45rem] font-bold text-emerald-950">
                      BB
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded bg-rose-950/90 px-3 py-1 text-xs text-rose-100">
          {error}
        </p>
      )}

      {/* Floating player actions — no fat footer strip */}
      {canBet && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-3">
          {raiseOpen && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-amber-900/40 bg-[#1a1208]/95 px-3 py-2 shadow-xl backdrop-blur-md">
              {[
                { label: "½ pote", amount: Math.min(allInTo, halfPot) },
                { label: "Pote", amount: Math.min(allInTo, potBet) },
                { label: "All-in", amount: allInTo },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={
                    pending || (preset.amount < minRaiseTo && preset.amount < allInTo)
                  }
                  onClick={() => {
                    setBetInput(String(preset.amount));
                    api("action", {
                      action: room.currentBet === 0 ? "bet" : "raise",
                      amount: preset.amount,
                    });
                    setRaiseOpen(false);
                  }}
                  className="border border-amber-200/30 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15 disabled:opacity-30"
                >
                  {preset.label}
                </button>
              ))}
              <input
                type="number"
                min={minRaiseTo}
                max={allInTo}
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                placeholder={`${minRaiseTo}+`}
                className="w-16 border border-amber-200/30 bg-emerald-950/60 px-2 py-1.5 text-sm outline-none"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const amount = Number(betInput) || minRaiseTo;
                  api("action", {
                    action: room.currentBet === 0 ? "bet" : "raise",
                    amount: Math.min(allInTo, Math.max(minRaiseTo, amount)),
                  });
                  setRaiseOpen(false);
                }}
                className="bg-amber-500 px-3 py-1.5 text-sm font-medium text-emerald-950"
              >
                OK
              </button>
            </div>
          )}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => api("action", { action: "fold" })}
              className="h-14 min-w-[4.5rem] rounded-2xl border border-rose-400/50 bg-rose-950/85 px-4 text-sm font-semibold text-rose-50 shadow-lg active:scale-95"
            >
              Fold
            </button>
            {toCall === 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => api("action", { action: "check" })}
                className="h-14 min-w-[5.5rem] rounded-2xl border border-emerald-400/40 bg-emerald-900/90 px-5 text-sm font-semibold shadow-lg active:scale-95"
              >
                Check
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => api("action", { action: "call" })}
                className="h-14 min-w-[5.5rem] rounded-2xl border border-emerald-400/40 bg-emerald-900/90 px-5 text-sm font-semibold shadow-lg active:scale-95"
              >
                Call {formatChips(Math.min(toCall, me?.chips ?? toCall))}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => setRaiseOpen((v) => !v)}
              className="h-14 min-w-[4.5rem] rounded-2xl bg-amber-500 px-4 text-sm font-semibold text-emerald-950 shadow-lg active:scale-95"
            >
              {room.currentBet === 0 ? "Bet" : "Raise"}
            </button>
          </div>
        </div>
      )}

      {!myTurn && room.status === "playing" && !isSpectator && (
        <p className="pointer-events-none fixed bottom-4 left-1/2 z-30 -translate-x-1/2 text-xs text-emerald-100/45">
          Aguardando {actingName}…
        </p>
      )}

      {room.status === "lobby" && canSit && (
        <p className="pointer-events-none fixed bottom-4 left-1/2 z-30 -translate-x-1/2 text-xs text-emerald-100/55">
          Toque num assento livre
        </p>
      )}

      {room.status !== "playing" &&
        me?.seat != null &&
        !isHost && (
          <p className="pointer-events-none fixed bottom-4 left-1/2 z-30 -translate-x-1/2 text-xs text-emerald-100/55">
            Aguardando o anfitrião…
          </p>
        )}

      {/* Host FAB — left; chat stays bottom-right */}
      {isHost && (
        <button
          type="button"
          onClick={() => setHostOpen(true)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#2a1c0a] text-lg text-amber-300 shadow-lg ring-2 ring-amber-600/40 sm:left-5"
          aria-label="Menu da mesa"
          title="Menu anfitrião"
        >
          ⚙️
        </button>
      )}

      {isHost && (
        <HostMenu
          open={hostOpen}
          onClose={() => setHostOpen(false)}
          room={room}
          pending={pending}
          botDifficulty={botDifficulty}
          onBotDifficulty={setBotDifficulty}
          onApi={api}
          onCloseRoom={closeRoom}
        />
      )}

      <TableChat code={code} room={room} onRoom={setRoom} />
    </div>
  );
}
