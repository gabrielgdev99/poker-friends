"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";
import { ChipStack, seatBetOffset } from "@/components/ChipStack";
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

/** Seat speech bubble lifetime (ms). */
const CHAT_BUBBLE_MS = 4500;

function formatChips(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

function SeatAvatar({
  emoji,
  avatarUrl,
  chipColor,
  acting,
  folded,
}: {
  emoji: string;
  avatarUrl: string | null;
  chipColor: string;
  acting?: boolean;
  folded?: boolean;
}) {
  return (
    <div
      className={`relative mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-[#0c1a12]/90 shadow-md sm:h-10 sm:w-10 ${
        folded
          ? "border-stone-500/40 grayscale"
          : acting
            ? "border-amber-200/90 ring-2 ring-amber-300/50"
            : "border-white/10"
      }`}
      style={folded ? undefined : { boxShadow: `0 0 0 1.5px ${chipColor}66` }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className={`h-full w-full object-cover ${folded ? "opacity-45" : ""}`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className={`text-lg leading-none sm:text-xl ${folded ? "opacity-40" : ""}`}
          aria-hidden
        >
          {emoji || "🙏"}
        </span>
      )}
    </div>
  );
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

  /** Latest chat per seat — auto-hides after CHAT_BUBBLE_MS. */
  const seatBubbles = useMemo(() => {
    const map = new Map<number, { text: string; kind: "text" | "emoji"; id: string }>();
    if (!room) return map;
    const serverApprox = now - clockSkew;
    for (const msg of room.chat ?? []) {
      if (serverApprox - msg.at > CHAT_BUBBLE_MS) continue;
      const p = room.players.find((x) => x.id === msg.playerId);
      if (p?.seat == null) continue;
      map.set(p.seat, { text: msg.text, kind: msg.kind, id: msg.id });
    }
    return map;
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
    !!me &&
    !me.busted &&
    me.chips > 0 &&
    me.seat === null &&
    (room.status !== "playing" || room.tableEnded);
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
  const maxSeats = Math.min(10, Math.max(2, room.maxSeats ?? 10));

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#1a2e22_0%,#0a100c_55%,#070a08_100%)] text-amber-50">
      {showToast && myTurn && (
        <div className="sua-vez-toast pointer-events-none fixed left-1/2 top-14 z-50 -translate-x-1/2 rounded-full bg-amber-400 px-5 py-1.5 font-[family-name:var(--font-display)] text-base text-[#1a1208] shadow-lg shadow-amber-900/40">
          Sua vez!
        </div>
      )}

      <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-lg tracking-tight text-amber-300 sm:text-xl">
            Poker Friends
          </p>
          <p className="truncate text-[0.6rem] tracking-wide text-amber-200/40">
            <span className="font-mono tracking-widest text-amber-200/55">{room.code}</span>
            {streetLabel ? ` · ${streetLabel}` : ""}
            {room.handNumber > 0 ? ` · #${room.handNumber}` : ""}
            {" · "}
            {room.smallBlind}/{room.bigBlind}
            {` · ${maxSeats} lugares`}
            {sched?.enabled && room.blindsProgress ? ` · ↑ ${room.blindsProgress}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={leaveTable}
            title="Sai só você — a sala continua pros outros"
            className="action-pill rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] text-rose-100/85 backdrop-blur-sm hover:bg-rose-500/15"
          >
            Sair
          </button>
          <AuthBar compact />
        </div>
      </header>

      {isSpectator && !room.tableEnded ? (
        <p className="mx-3 shrink-0 rounded-full bg-amber-500/10 px-3 py-1.5 text-center text-[0.7rem] text-amber-100/85">
          Você faliu — só assiste até alguém conquistar a mesa.
        </p>
      ) : null}

      {room.tableEnded && (
        <div className="pointer-events-none fixed inset-0 z-[45] flex items-end justify-center bg-black/45 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-24 sm:items-center sm:pb-8">
          <div className="pointer-events-auto w-full max-w-sm rounded-3xl border border-white/10 bg-[#14100a]/95 p-5 text-center shadow-2xl backdrop-blur-md">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-amber-200/50">
              Mesa conquistada
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-amber-300">
              {champ ? `${champ.emoji || "🏆"} ${champ.nickname}` : "Fim de mesa"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-amber-100/65">
              A paz do Senhor! Quem faliu pode sentar de novo. Mesma sala{" "}
              <span className="font-mono tracking-widest text-amber-200/80">
                {room.code}
              </span>
              .
            </p>
            {isHost ? (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => api("rematch", {})}
                  className="action-pill w-full rounded-full bg-amber-400 py-3 font-[family-name:var(--font-display)] text-lg font-semibold text-[#1a1208] hover:bg-amber-300 disabled:opacity-50"
                >
                  Jogar de novo
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      !window.confirm(
                        "Encerrar mesa pra todo mundo? A sala some — não é só sair.",
                      )
                    ) {
                      return;
                    }
                    closeRoom();
                  }}
                  className="action-pill w-full rounded-full border border-rose-400/45 bg-rose-950/50 py-2.5 text-sm font-medium text-rose-100 hover:bg-rose-900/50 disabled:opacity-50"
                >
                  Encerrar mesa
                </button>
                <p className="text-[0.65rem] text-amber-100/40">
                  Jogar de novo mantém a sala. Encerrar apaga pra todo mundo.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <p className="rounded-full bg-white/5 px-3 py-2 text-xs text-amber-100/55">
                  Aguardando o anfitrião dar o{" "}
                  <span className="text-amber-200">Jogar de novo</span>
                  {canSit ? " — toque num assento livre" : ""}.
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={leaveTable}
                  className="action-pill w-full rounded-full border border-white/15 bg-white/5 py-2.5 text-sm text-amber-100/85 hover:bg-white/10 disabled:opacity-50"
                >
                  Voltar ao lobby
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {room.status === "playing" && room.actingSeat !== null && (
        <div className="relative z-20 mx-auto w-full max-w-lg shrink-0 px-4">
          <div className="mb-1 flex justify-between text-[0.65rem] text-amber-100/65">
            <span className="truncate">
              {timer.thinking ? "… " : ""}
              {actingName}
              {myTurn ? " · você" : ""}
              {room.myHandHint && !me?.folded ? ` · ${room.myHandHint}` : ""}
              {me?.folded ? " · fold" : ""}
            </span>
            <span className={`tabular-nums ${timer.left <= 5 ? "text-rose-300" : ""}`}>
              {timer.left}s
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-black/35">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${
                timer.left <= 5 ? "bg-rose-400" : "bg-gradient-to-r from-amber-500 to-amber-300"
              }`}
              style={{ width: `${timer.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Table fills remaining viewport — leave room at bottom for hero cards + FABs */}
      <div
        className={`relative mx-auto flex min-h-0 w-full flex-1 items-center justify-center px-0 pt-1 ${
          canBet || (me?.hole && me.hole.length > 0)
            ? "pb-[7.5rem] sm:pb-32"
            : "pb-2"
        }`}
      >
        <div className="relative h-full max-h-full w-full max-w-[1000px] aspect-[5/4] sm:aspect-[4/3]">
          <div
            className="absolute inset-[1%] rounded-[48%] border-[6px] shadow-[inset_0_0_70px_rgba(0,0,0,0.5),0_8px_40px_rgba(0,0,0,0.35)] sm:inset-[2%] sm:border-[8px]"
            style={{
              borderColor: felt.rim,
              background: `radial-gradient(ellipse_at_center,${felt.feltLit} 0%,${felt.felt} 42%,#0c1f16 100%)`,
            }}
          >
            <div className="absolute inset-[3.5%] rounded-[48%] border border-amber-300/10" />
          </div>

          <div className="absolute left-1/2 top-[40%] z-10 flex w-[94%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 sm:top-[44%]">
            <p className="rounded-full bg-black/25 px-2.5 py-0.5 text-[0.55rem] uppercase tracking-[0.22em] text-emerald-100/50 backdrop-blur-[2px]">
              {streetLabel ?? "Mesa"}
            </p>
            <div key={potBump} className="pot-bump">
              {room.pot > 0 ? (
                <ChipStack amount={room.pot} size="lg" label={`Pote ${formatChips(room.pot)}`} />
              ) : (
                <span className="rounded-full bg-black/40 px-3 py-1 text-sm text-amber-200/60 backdrop-blur-sm">
                  Pote 0
                </span>
              )}
            </div>
            <div className="flex min-h-[3.8rem] items-center justify-center gap-1 sm:min-h-[5.25rem] sm:gap-1.5">
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
              <div className="rounded-2xl bg-amber-500/15 px-3 py-1.5 text-center text-xs text-amber-100 backdrop-blur-sm">
                {room.winners.map((w) => {
                  const p = room.players.find((x) => x.seat === w.seat);
                  return (
                    <p key={w.seat}>
                      {p?.nickname ?? "?"} +{w.amount}
                      <span className="text-emerald-100/55"> · {w.handName}</span>
                    </p>
                  );
                })}
              </div>
            )}
            {room.lastAction && (
              <p className="max-w-[88%] truncate rounded-full bg-black/20 px-2.5 py-0.5 text-[0.65rem] text-amber-100/45">
                {room.lastAction}
              </p>
            )}
          </div>

          {/* Street bets — chip stacks toward center */}
          {room.players.map((p) => {
            if (p.seat === null || p.bet <= 0 || p.folded) return null;
            const off = seatBetOffset(p.seat);
            return (
              <div
                key={`bet-${p.id}`}
                className="pointer-events-none absolute z-[15] -translate-x-1/2 -translate-y-1/2"
                style={{ top: off.top, left: off.left }}
              >
                <ChipStack amount={p.bet} size="md" />
              </div>
            );
          })}

          {SEAT_POS.slice(0, maxSeats).map((pos, seat) => {
            const p = room.players.find((x) => x.seat === seat);
            const isDealer = room.dealerSeat === seat && room.status !== "lobby";
            const isSb = room.sbSeat === seat && room.status === "playing";
            const isBb = room.bbSeat === seat && room.status === "playing";
            const isActing = room.actingSeat === seat && room.status === "playing" && !p?.folded;
            const isMe = p?.id === playerId;
            const empty = !p;
            const folded = !!p?.folded && room.status !== "lobby";
            const lastHere = room.lastSeatAction?.seat === seat;
            const bubble = seatBubbles.get(seat);
            // Hero hole cards live in the bottom tray — keep seat compact
            const showSeatCards = !!p && p.holeCount > 0 && !(isMe && p.hole);
            return (
              <button
                key={seat}
                type="button"
                disabled={!empty || !canSit || pending}
                onClick={() => api("sit", { seat })}
                style={{ top: pos.top, left: pos.left }}
                className={`absolute z-20 w-[5.5rem] -translate-x-1/2 -translate-y-1/2 sm:w-[7.25rem] ${
                  empty && canSit ? "cursor-pointer opacity-80 hover:opacity-100" : "cursor-default"
                }`}
              >
                {!empty && (
                  <div className={`relative mb-0.5 ${folded ? "seat-folded" : ""}`}>
                    {bubble && !folded && (
                      <div
                        key={bubble.id}
                        className="seat-chat-bubble pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 max-w-[7.5rem] -translate-x-1/2"
                      >
                        <div
                          className={`rounded-2xl bg-[#f7f3ea] px-2.5 py-1 text-[#1a1208] shadow-lg ${
                            bubble.kind === "emoji"
                              ? "text-center text-xl leading-none"
                              : "text-[0.65rem] leading-snug"
                          }`}
                        >
                          <span className="line-clamp-2 break-words">{bubble.text}</span>
                        </div>
                        <div className="mx-auto h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#f7f3ea]" />
                      </div>
                    )}
                    <SeatAvatar
                      emoji={p.emoji || "🙏"}
                      avatarUrl={p.avatarUrl}
                      chipColor={p.chipColor || "#f0b429"}
                      acting={isActing}
                      folded={folded}
                    />
                  </div>
                )}
                <div
                  className={`px-1.5 py-1 text-center sm:px-2.5 sm:py-1.5 ${
                    empty
                      ? "rounded-full border border-dashed border-emerald-300/20 bg-black/20 text-emerald-100/40"
                      : folded
                        ? "seat-folded rounded-2xl bg-black/25 text-stone-300"
                        : isActing
                          ? `rounded-2xl bg-amber-400/95 text-emerald-950 shadow-md shadow-amber-900/30 ${isMe ? "seat-your-turn" : ""}`
                          : "rounded-2xl bg-black/40 text-amber-50 backdrop-blur-md"
                  }`}
                >
                  {empty ? (
                    <span className="text-[0.6rem]">{canSit ? `+ ${seat + 1}` : "—"}</span>
                  ) : (
                    <>
                      <p
                        className={`truncate text-[0.6rem] font-medium sm:text-xs ${
                          folded ? "text-stone-400" : ""
                        }`}
                      >
                        {p.nickname}
                        {p.isBot && p.botDifficulty
                          ? ` · ${BOT_SHORT[p.botDifficulty]}`
                          : ""}
                        {isMe ? " · você" : ""}
                      </p>
                      <p
                        className={`text-[0.7rem] font-semibold tabular-nums sm:text-sm ${
                          folded ? "text-stone-500" : ""
                        }`}
                        style={folded ? undefined : { color: p.chipColor || "#f0b429" }}
                      >
                        {formatChips(p.chips)}
                      </p>
                      {folded && (
                        <p className="mt-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-stone-400">
                          Fold
                        </p>
                      )}
                      {p.allIn && !folded && (
                        <p className="text-[0.55rem] font-medium text-amber-200/90">all-in</p>
                      )}
                      {showSeatCards && (
                        <div
                          className={`mt-0.5 flex justify-center gap-0.5 ${
                            folded ? "opacity-50 grayscale" : ""
                          }`}
                        >
                          {p.hole ? (
                            p.hole.map((c, i) => (
                              <PlayingCard key={i} card={c} size="seat" />
                            ))
                          ) : (
                            <>
                              <PlayingCard hidden size="seat" />
                              <PlayingCard hidden size="seat" />
                            </>
                          )}
                        </div>
                      )}
                      {isMe && p.holeCount > 0 && !p.hole && (
                        <div
                          className={`mt-0.5 flex justify-center gap-0.5 ${
                            folded ? "opacity-50 grayscale" : ""
                          }`}
                        >
                          <PlayingCard hidden size="seat" />
                          <PlayingCard hidden size="seat" />
                        </div>
                      )}
                      {lastHere && room.lastSeatAction && !folded && (
                        <p className="mt-0.5 truncate text-[0.55rem] text-amber-200/80">
                          {room.lastSeatAction.label}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="absolute -right-0.5 top-8 flex flex-col gap-0.5 sm:top-9">
                  {isDealer && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100/95 text-[0.5rem] font-bold text-emerald-950 shadow">
                      D
                    </span>
                  )}
                  {isSb && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-200/95 text-[0.45rem] font-bold text-emerald-950 shadow">
                      SB
                    </span>
                  )}
                  {isBb && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-200/95 text-[0.45rem] font-bold text-emerald-950 shadow">
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
        <p className="pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-rose-950/90 px-4 py-1.5 text-xs text-rose-100 shadow-lg">
          {error}
        </p>
      )}

      {/* Hero hole cards — above FABs, never covered */}
      {me?.hole && me.hole.length > 0 && (room.status === "playing" || room.status === "showdown") && (
        <div
          className="pointer-events-none fixed left-1/2 z-[38] flex -translate-x-1/2 flex-col items-center gap-1"
          style={{
            bottom: canBet
              ? "calc(5.5rem + env(safe-area-inset-bottom))"
              : "calc(1.25rem + env(safe-area-inset-bottom))",
          }}
        >
          <div
            className={`flex gap-1.5 rounded-2xl border border-white/10 bg-[#120e08]/75 px-3 py-2 shadow-2xl backdrop-blur-md ${
              me.folded ? "seat-folded" : ""
            }`}
          >
            {me.hole.map((c, i) => (
              <PlayingCard key={i} card={c} size="hero" dealDelayMs={i * 80} />
            ))}
          </div>
          {me.folded && (
            <span className="rounded-full bg-stone-800/80 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-stone-300">
              Fold
            </span>
          )}
        </div>
      )}

      {/* Floating actions — below hero tray */}
      {canBet && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(0.65rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-3">
          {raiseOpen && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[#14100a]/90 px-2.5 py-1.5 shadow-2xl backdrop-blur-md">
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
                  className="action-pill rounded-full px-3 py-1.5 text-xs text-amber-100/90 hover:bg-white/10 disabled:opacity-30"
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
                className="w-16 rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-center text-sm outline-none focus:border-amber-400/40"
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
                className="action-pill rounded-full bg-amber-400 px-3.5 py-1.5 text-sm font-semibold text-[#1a1208]"
              >
                OK
              </button>
            </div>
          )}
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#120e08]/70 p-1.5 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              disabled={pending}
              onClick={() => api("action", { action: "fold" })}
              className="action-pill h-11 min-w-[4rem] rounded-full bg-rose-950/80 px-4 text-sm font-semibold text-rose-50 ring-1 ring-rose-400/35 sm:h-12"
            >
              Fold
            </button>
            {toCall === 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => api("action", { action: "check" })}
                className="action-pill h-11 min-w-[5rem] rounded-full bg-emerald-800/90 px-5 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-400/30 sm:h-12"
              >
                Check
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => api("action", { action: "call" })}
                className="action-pill h-11 min-w-[5rem] rounded-full bg-emerald-800/90 px-5 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-400/30 sm:h-12"
              >
                Call {formatChips(Math.min(toCall, me?.chips ?? toCall))}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => setRaiseOpen((v) => !v)}
              className="action-pill h-11 min-w-[4rem] rounded-full bg-amber-400 px-4 text-sm font-semibold text-[#1a1208] shadow-md shadow-amber-900/40 sm:h-12"
            >
              {room.currentBet === 0 ? "Bet" : "Raise"}
            </button>
          </div>
        </div>
      )}

      {!myTurn && room.status === "playing" && !isSpectator && !me?.hole && (
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

      {/* Host FAB — left; above chat */}
      {isHost && (
        <button
          type="button"
          onClick={() => setHostOpen(true)}
          className="action-pill fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#1a140c]/85 text-lg text-amber-300 shadow-xl backdrop-blur-md sm:left-5"
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
