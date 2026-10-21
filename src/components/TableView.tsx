"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";
import { PlayingCard } from "@/components/PlayingCard";
import { usePlayer } from "@/components/PlayerProvider";
import { TableChat } from "@/components/TableChat";
import { feltCss } from "@/lib/felt";
import type { BotDifficulty, FeltAccent, PublicRoom, Street } from "@/lib/types";

/** Tighter oval — seats closer to the felt, less empty ring. */
const SEAT_POS = [
  { top: "86%", left: "50%" },
  { top: "72%", left: "86%" },
  { top: "48%", left: "94%" },
  { top: "24%", left: "86%" },
  { top: "12%", left: "50%" },
  { top: "24%", left: "14%" },
  { top: "48%", left: "6%" },
  { top: "72%", left: "14%" },
  { top: "90%", left: "72%" },
  { top: "90%", left: "28%" },
];

const BOT_LEVELS: { value: BotDifficulty; label: string }[] = [
  { value: "easy", label: "Iniciante" },
  { value: "medium", label: "Médio" },
  { value: "hard", label: "Difícil" },
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
  const wasMyTurn = useRef(false);
  const joinStarted = useRef(false);

  useEffect(() => {
    if (player.guest?.feltAccent) {
      setFeltAccent(player.guest.feltAccent);
      return;
    }
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile?.feltAccent) setFeltAccent(d.profile.feltAccent);
      })
      .catch(() => {});
  }, [player.guest?.feltAccent]);

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
    if (!playerId || fatal) return;
    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) {
      if (res.status === 404) {
        leaveMissingRoom("Sala não encontrada (pode ter expirado ou o Redis não persistiu).");
        return;
      }
      if (res.status === 401) {
        setFatal(true);
        setError("Faça login com Google");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao atualizar a sala");
      return;
    }
    const data = await res.json();
    applyRoom(data.room as PublicRoom);
  }, [code, playerId, fatal, leaveMissingRoom, applyRoom]);

  useEffect(() => {
    if (!playerId || player.mode === "loading" || player.mode === "none" || joinStarted.current || fatal)
      return;
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
          leaveMissingRoom(
            data.error ??
              "Sala não encontrada. Crie de novo — na Vercel o Redis precisa estar configurado.",
          );
          return;
        }
        if (res.status === 401) {
          setFatal(true);
          setError("Faça login ou continue como convidado");
          router.replace("/?login=1");
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
    router,
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
    if (!playerId || fatal || !room) return;
    const ms = myTurn || botActing ? 500 : 1200;
    const t = setInterval(refresh, ms);
    return () => clearInterval(t);
  }, [playerId, refresh, myTurn, botActing, fatal, room]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (myTurn && !wasMyTurn.current) {
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 2200);
      wasMyTurn.current = true;
      return () => clearTimeout(t);
    }
    if (!myTurn) wasMyTurn.current = false;
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
      setRoom(data.room);
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

  const timer = useMemo(() => {
    if (!room?.turnDeadline || room.status !== "playing") {
      return { left: 0, pct: 0, total: room?.turnSeconds ?? 18, thinking: false };
    }
    const serverAligned = now - clockSkew;
    const leftMs = Math.max(0, room.turnDeadline - serverAligned);
    const actorBot = !!room.players.find((p) => p.seat === room.actingSeat)?.isBot;
    const total = actorBot ? 3 : room.turnSeconds || 18;
    return {
      left: Math.ceil(leftMs / 1000),
      pct: Math.min(100, (leftMs / (total * 1000)) * 100),
      total,
      thinking: actorBot,
    };
  }, [room, now, clockSkew]);

  if (player.mode === "loading" || player.mode === "none") {
    return (
      <div className="flex h-dvh items-center justify-center text-amber-100/70">
        {player.mode === "none" ? "Faça login ou continue como convidado…" : "Entrando na mesa…"}
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
      <div className="flex h-dvh items-center justify-center text-amber-100/70">
        Entrando na mesa…
      </div>
    );
  }

  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const isSpectator = !!me && (me.busted || (me.chips <= 0 && me.seat === null));
  const canSit = !!me && !me.busted && me.chips > 0 && me.seat === null && room.status !== "playing";
  const toCall = me ? Math.max(0, room.currentBet - me.bet) : 0;
  const minRaiseTo =
    room.currentBet === 0 ? room.bigBlind : room.currentBet + room.minRaise;
  const pot = room.pot;
  const halfPot = Math.max(minRaiseTo, Math.floor(pot / 2) || room.bigBlind);
  const potBet = Math.max(minRaiseTo, pot || room.bigBlind * 2);
  const allInTo = me ? me.bet + me.chips : 0;
  const seatedCount = room.players.filter((p) => p.seat !== null && p.chips > 0).length;
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
        <div className="sua-vez-toast pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded bg-amber-500 px-5 py-2 font-[family-name:var(--font-display)] text-lg text-[#1a1208] shadow-lg">
          Sua vez, irmão! 🃏
        </div>
      )}

      <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-lg tracking-tight text-amber-300 sm:text-2xl">
            Poker Friends
          </p>
          <p className="truncate text-[0.6rem] uppercase tracking-[0.18em] text-amber-200/45 sm:text-[0.65rem] sm:tracking-[0.22em]">
            Sala {room.code}
            {streetLabel ? ` · ${streetLabel}` : ""}
            {room.handNumber > 0 ? ` · #${room.handNumber}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-[0.65rem] text-amber-100/55 sm:text-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={leaveTable}
              title="No meio da mão: fold automático e sai"
              className="border border-rose-400/35 px-2 py-1 text-[0.65rem] text-rose-100/90 hover:bg-rose-500/10 disabled:opacity-40 sm:text-xs"
            >
              Sair da mesa
            </button>
            <AuthBar />
          </div>
          <p className="tabular-nums">
            Blinds {room.smallBlind}/{room.bigBlind}
            {sched?.enabled && room.blindsProgress ? ` · ↑ ${room.blindsProgress}` : ""}
          </p>
          <p className="hidden text-[0.6rem] text-amber-100/35 sm:block">
            Sair no meio da mão = fold e sai
          </p>
        </div>
      </header>

      {isSpectator && !room.tableEnded && (
        <p className="relative z-20 shrink-0 bg-rose-950/50 px-3 py-1.5 text-center text-xs text-rose-100 sm:text-sm">
          Você faliu — só assiste até alguém conquistar a mesa. Sem rebuy no meio.
        </p>
      )}

      {room.tableEnded && (
        <p className="relative z-20 shrink-0 bg-amber-500/20 px-3 py-1.5 text-center text-xs text-amber-100 sm:text-sm">
          🏆 Mesa encerrada
          {champ ? `: ${champ.nickname} conquistou!` : "."} Pode sentar de novo.
        </p>
      )}

      {room.myHandHint && room.status === "playing" && !me?.folded && me?.seat !== null && (
        <p className="relative z-20 mx-auto w-full max-w-4xl shrink-0 px-3 text-center text-xs text-amber-100/90 sm:text-sm">
          Você tem: <strong className="text-amber-300">{room.myHandHint}</strong>
        </p>
      )}

      {room.status === "playing" && room.actingSeat !== null && (
        <div className="relative z-20 mx-auto w-full max-w-4xl shrink-0 px-3 sm:px-6">
          <div className="mb-0.5 flex items-center justify-between text-[0.65rem] text-amber-100/70 sm:text-xs">
            <span>
              {timer.thinking ? "🤔 " : ""}
              Vez de <strong className="text-amber-200">{actingName}</strong>
              {myTurn ? " (você)" : timer.thinking ? " — pensando…" : ""}
            </span>
            <span className={!timer.thinking && timer.left <= 5 ? "text-rose-300" : "text-amber-200"}>
              {timer.left}s
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-emerald-950/80">
            <div
              className={`h-full transition-[width] duration-200 ease-linear ${
                timer.left <= 5 ? "bg-rose-400" : "bg-amber-400"
              }`}
              style={{ width: `${timer.pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center px-0 sm:px-2">
        <div className="relative aspect-[5/4] h-[min(100%,72dvh)] w-full max-w-[min(100%,calc(72dvh*5/4))] sm:aspect-[4/3] sm:h-[min(100%,68dvh)]">
          <div
            className="absolute inset-[2%] rounded-[48%] border-[8px] shadow-[inset_0_0_80px_rgba(0,0,0,0.4),0_20px_60px_rgba(0,0,0,0.45)] sm:inset-[3%] sm:border-[10px]"
            style={{
              borderColor: felt.rim,
              background: `radial-gradient(ellipse_at_center,${felt.feltLit} 0%,${felt.felt} 40%,#0f2418 100%)`,
            }}
          >
            <div className="absolute inset-[4%] rounded-[48%] border border-amber-400/15" />
          </div>

          <div className="absolute left-1/2 top-[40%] z-10 flex w-[94%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 sm:top-[46%] sm:gap-1.5">
            <p className="text-[0.6rem] uppercase tracking-[0.25em] text-emerald-200/55 sm:text-[0.65rem]">
              {streetLabel ?? "Mesa"}
            </p>
            <p className="rounded-full bg-black/45 px-2.5 py-0.5 text-[0.7rem] tabular-nums text-amber-100/90 sm:px-3 sm:py-1 sm:text-sm">
              Blinds {room.smallBlind}/{room.bigBlind}
              {sched?.enabled ? (
                <span className="text-amber-200/70">
                  {" "}
                  · ↑ {room.nextSmallBlind}/{room.nextBigBlind}
                  {room.blindsProgress ? ` (${room.blindsProgress})` : ""}
                </span>
              ) : null}
            </p>
            <p
              key={potBump}
              className="pot-bump rounded-full bg-black/45 px-3 py-1 text-base font-semibold tracking-wide text-amber-200 sm:px-4 sm:py-1.5 sm:text-lg"
            >
              Pote {formatChips(room.pot)}
            </p>
            <div className="flex min-h-[4.25rem] items-center justify-center gap-1 sm:min-h-24 sm:gap-2">
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
              <div className="mt-0.5 max-w-xs rounded bg-amber-500/15 px-2 py-1.5 text-center text-xs text-amber-200 sm:text-sm">
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
                className={`absolute z-20 w-[5.25rem] -translate-x-1/2 -translate-y-1/2 sm:w-[7.25rem] ${
                  empty && canSit ? "cursor-pointer opacity-70 hover:opacity-100" : "cursor-default"
                }`}
              >
                <div
                  className={`rounded-lg px-1 py-1 text-center transition sm:px-2 sm:py-1.5 ${
                    isActing
                      ? `bg-amber-500/95 text-emerald-950 ring-2 ring-amber-100 ${isMe ? "seat-your-turn" : ""}`
                      : empty
                        ? "border border-dashed border-emerald-300/25 bg-emerald-950/40 text-emerald-100/50"
                        : p?.folded
                          ? "bg-emerald-950/50 text-emerald-100/40"
                          : "bg-emerald-950/85 text-amber-50"
                  }`}
                >
                  {empty ? (
                    <span className="text-[0.6rem] sm:text-xs">
                      {canSit ? `Assento ${seat + 1}` : "—"}
                    </span>
                  ) : (
                    <>
                      <p className="truncate text-[0.6rem] font-medium sm:text-xs">
                        <span className="mr-0.5">{p.emoji || "🙏"}</span>
                        {p.nickname}
                        {p.isBot && p.botDifficulty
                          ? ` · ${BOT_SHORT[p.botDifficulty]}`
                          : p.isBot
                            ? " · bot"
                            : ""}
                        {isMe ? " · você" : ""}
                      </p>
                      <p
                        className="inline-flex items-center gap-1 text-[0.7rem] font-semibold tabular-nums sm:text-sm"
                        style={{ color: p.chipColor || "#f0b429" }}
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full ring-1 ring-black/30"
                          style={{ background: p.chipColor || "#f0b429" }}
                        />
                        {formatChips(p.chips)}
                      </p>
                      {p.bet > 0 && !p.folded && (
                        <p className="text-[0.55rem] text-amber-100/90 sm:text-[0.6rem]">
                          aposta {formatChips(p.bet)}
                        </p>
                      )}
                      {p.folded && <p className="text-[0.55rem]">fold</p>}
                      {p.allIn && !p.folded && <p className="text-[0.55rem]">all-in</p>}
                      {p.holeCount > 0 && (
                        <div className="mt-0.5 flex justify-center gap-0.5 sm:mt-1 sm:gap-1">
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
                        <p className="mt-0.5 truncate text-[0.55rem] font-medium text-amber-300/90">
                          {room.lastSeatAction.label}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="absolute -right-1 -top-1 flex gap-0.5">
                  {isDealer && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[0.5rem] font-bold text-emerald-950 sm:h-5 sm:w-5 sm:text-[0.55rem]">
                      D
                    </span>
                  )}
                  {isSb && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-[0.45rem] font-bold text-emerald-950 sm:h-5 sm:w-5 sm:text-[0.5rem]">
                      SB
                    </span>
                  )}
                  {isBb && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-200 text-[0.45rem] font-bold text-emerald-950 sm:h-5 sm:w-5 sm:text-[0.5rem]">
                      BB
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <TableChat code={code} room={room} onRoom={setRoom} />

      <footer className="relative z-30 shrink-0 border-t border-amber-900/40 bg-[#1a1208]/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6 sm:py-3">
        {error && <p className="mb-1 text-xs text-rose-300 sm:text-sm">{error}</p>}
        {room.lastAction && (
          <p className="mb-1 truncate text-[0.65rem] text-amber-200/70 sm:text-xs">
            {room.lastAction}
          </p>
        )}
        <div className="mx-auto flex max-w-5xl flex-col gap-1.5 pr-16 sm:gap-2 sm:pr-20">
          {isHost && room.status !== "playing" && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <label className="flex items-center gap-1 text-[0.65rem] text-emerald-100/60 sm:text-xs">
                Nível
                <select
                  className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                  value={botDifficulty}
                  disabled={pending}
                  onChange={(e) => setBotDifficulty(e.target.value as BotDifficulty)}
                >
                  {BOT_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pending || seatedCount >= 10}
                onClick={() =>
                  api("bots", { action: "add", difficulty: botDifficulty })
                }
                className="border border-amber-200/40 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10 disabled:opacity-40 sm:px-3 sm:py-2 sm:text-sm"
              >
                Chamar bot
              </button>
              {room.players
                .filter((p) => p.isBot)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={pending}
                    onClick={() => api("bots", { action: "remove", botId: b.id })}
                    className="border border-rose-400/30 px-2 py-1.5 text-[0.65rem] text-rose-200/90 hover:bg-rose-500/10 sm:text-xs"
                  >
                    Remover {b.nickname}
                  </button>
                ))}
              <label className="flex items-center gap-1 text-[0.65rem] text-emerald-100/60 sm:text-xs">
                Timer
                <select
                  className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                  value={room.turnSeconds}
                  disabled={pending}
                  onChange={(e) => api("settings", { turnSeconds: Number(e.target.value) })}
                >
                  {[12, 18, 25, 30].map((s) => (
                    <option key={s} value={s}>
                      {s}s
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[0.65rem] text-emerald-100/60 sm:text-xs">
                SB
                <select
                  className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                  value={room.smallBlind}
                  disabled={pending}
                  onChange={(e) => api("settings", { smallBlind: Number(e.target.value) })}
                >
                  {[5, 10, 25, 50, 100].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[0.65rem] text-emerald-100/60 sm:text-xs">
                <input
                  type="checkbox"
                  checked={!!sched?.enabled}
                  disabled={pending}
                  onChange={(e) =>
                    api("settings", {
                      blindSchedule: {
                        enabled: e.target.checked,
                        mode: sched?.mode ?? "hands",
                        every: sched?.every ?? 4,
                        multiplier: sched?.multiplier ?? 2,
                      },
                    })
                  }
                />
                Blinds sobem
              </label>
              {sched?.enabled && (
                <>
                  <select
                    className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-[0.65rem] text-amber-100 sm:text-xs"
                    value={sched.mode}
                    disabled={pending}
                    onChange={(e) =>
                      api("settings", {
                        blindSchedule: {
                          enabled: true,
                          mode: e.target.value as "time" | "hands",
                          every: sched.every,
                          multiplier: sched.multiplier,
                        },
                      })
                    }
                  >
                    <option value="hands">por mãos</option>
                    <option value="time">por tempo</option>
                  </select>
                  <label className="flex items-center gap-1 text-[0.65rem] text-emerald-100/60 sm:text-xs">
                    a cada
                    <select
                      className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                      value={sched.every}
                      disabled={pending}
                      onChange={(e) =>
                        api("settings", {
                          blindSchedule: {
                            enabled: true,
                            mode: sched.mode,
                            every: Number(e.target.value),
                            multiplier: sched.multiplier,
                          },
                        })
                      }
                    >
                      {(sched.mode === "time" ? [3, 5, 8, 10, 15] : [2, 3, 4, 5, 8, 10]).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n}
                            {sched.mode === "time" ? " min" : " mãos"}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-[0.65rem] text-emerald-100/60 sm:text-xs">
                    ×
                    <select
                      className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                      value={sched.multiplier}
                      disabled={pending}
                      onChange={(e) =>
                        api("settings", {
                          blindSchedule: {
                            enabled: true,
                            mode: sched.mode,
                            every: sched.every,
                            multiplier: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[1.5, 2, 3].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label className="flex items-center gap-1 text-[0.65rem] text-emerald-100/60 sm:text-xs">
                <input
                  type="checkbox"
                  checked={room.autoStartNext}
                  disabled={pending || room.tableEnded}
                  onChange={(e) => api("settings", { autoStartNext: e.target.checked })}
                />
                Auto mão
              </label>
              <button
                type="button"
                disabled={pending || seatedCount < 2}
                onClick={() => api("start", {})}
                className="bg-amber-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-amber-400 disabled:opacity-40 sm:px-4 sm:py-2 sm:text-sm"
              >
                {room.tableEnded
                  ? "Nova mesa"
                  : room.status === "showdown"
                    ? "Próxima mão"
                    : "Iniciar mão"}
              </button>
            </div>
          )}

          {canBet && (
            <>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => api("action", { action: "fold" })}
                  className="min-w-[4rem] border border-rose-400/50 bg-rose-950/30 px-3 py-2.5 text-sm font-medium text-rose-100 active:scale-[0.98] sm:py-3"
                >
                  Fold
                </button>
                {toCall === 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => api("action", { action: "check" })}
                    className="min-w-[5rem] flex-1 border border-emerald-400/40 bg-emerald-900/40 px-3 py-2.5 text-sm font-medium active:scale-[0.98] sm:py-3"
                  >
                    Check
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => api("action", { action: "call" })}
                    className="min-w-[5rem] flex-1 border border-emerald-400/40 bg-emerald-900/40 px-3 py-2.5 text-sm font-medium active:scale-[0.98] sm:py-3"
                  >
                    Call {formatChips(Math.min(toCall, me?.chips ?? toCall))}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
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
                    }}
                    className="border border-amber-200/25 px-2 py-1 text-[0.65rem] text-amber-100/90 hover:bg-amber-500/10 disabled:opacity-30 sm:px-2.5 sm:py-1.5 sm:text-xs"
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
                  className="w-16 border border-amber-200/30 bg-emerald-950/60 px-2 py-1 text-sm outline-none sm:w-20 sm:py-1.5"
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
                  }}
                  className="bg-amber-500/95 px-3 py-1 text-sm font-medium text-emerald-950 hover:bg-amber-400 sm:py-1.5"
                >
                  {room.currentBet === 0 ? "Bet" : "Raise"}
                </button>
              </div>
            </>
          )}

          {!myTurn && room.status === "playing" && !isSpectator && (
            <p className="text-xs text-emerald-100/50 sm:text-sm">
              Aguardando {actingName}
              {timer.left > 0 ? ` · ${timer.left}s` : ""}…
            </p>
          )}

          {room.status === "lobby" && canSit && (
            <p className="text-xs text-emerald-100/60 sm:text-sm">
              Toque em um assento livre para sentar.
            </p>
          )}

          {room.status !== "playing" &&
            me?.seat !== null &&
            me?.seat !== undefined &&
            !isHost && (
              <p className="text-xs text-emerald-100/60 sm:text-sm">
                Aguardando o anfitrião…
              </p>
            )}
        </div>
      </footer>
    </div>
  );
}
