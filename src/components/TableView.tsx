"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";
import { ChipStack, formatChips, seatBetOffset } from "@/components/ChipStack";
import { CompactSeat } from "@/components/CompactSeat";
import { HostMenu } from "@/components/HostMenu";
import { PlayingCard } from "@/components/PlayingCard";
import { usePlayer } from "@/components/PlayerProvider";
import { TableChat } from "@/components/TableChat";
import { feltCss } from "@/lib/felt";
import { seatRingPositions } from "@/lib/poker/seat-layout";
import { shareRoom } from "@/lib/share-room";
import type { BotDifficulty, FeltAccent, PublicRoom, Street } from "@/lib/types";

const STREET_LABEL: Record<Street, string> = {
  preflop: "Pré-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

type PreAction = "check" | "fold_check" | "call_any";

/** Seat speech bubble lifetime (ms). */
const CHAT_BUBBLE_MS = 4500;

export function TableView({ code }: { code: string }) {
  const router = useRouter();
  const player = usePlayer();
  const playerId = player.id;
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [showToast, setShowToast] = useState(false);
  const [clockSkew, setClockSkew] = useState(0);
  const prevPot = useRef(0);
  const [potBump, setPotBump] = useState(0);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const [feltAccent, setFeltAccent] = useState<FeltAccent>("olive");
  const [hostOpen, setHostOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState("Compartilhar");
  const [preAction, setPreAction] = useState<PreAction | null>(null);
  const [medals, setMedals] = useState<Map<string, 1 | 2 | 3>>(() => new Map());
  const wasMyTurn = useRef(false);
  const preFired = useRef(false);
  const streetRef = useRef<Street | null>(null);
  const joinStarted = useRef(false);
  const raiseKey = useRef("");

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/stats");
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as {
        chipsWon?: { id?: string }[];
        handsWon?: { id?: string }[];
        tablesWon?: { id?: string }[];
      } | null;
      if (!data || cancelled) return;
      const next = new Map<string, 1 | 2 | 3>();
      for (const rows of [data.chipsWon, data.handsWon, data.tablesWon]) {
        rows?.slice(0, 3).forEach((row, i) => {
          if (!row?.id) return;
          const place = (i + 1) as 1 | 2 | 3;
          const cur = next.get(row.id);
          if (cur == null || place < cur) next.set(row.id, place);
        });
      }
      if (!cancelled) setMedals(next);
    }
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

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
      preFired.current = false;
    }
  }, [myTurn]);

  useEffect(() => {
    if (!myTurn || !room) {
      if (!myTurn) raiseKey.current = "";
      return;
    }
    const key = `${room.handNumber}:${room.street}:${room.actingSeat}`;
    if (raiseKey.current === key) return;
    raiseKey.current = key;
    const min = room.currentBet === 0 ? room.bigBlind : room.currentBet + room.minRaise;
    setRaiseTo(min);
  }, [myTurn, room]);

  // Clear pre-actions on street change
  useEffect(() => {
    const s = room?.street ?? null;
    if (streetRef.current !== null && streetRef.current !== s) {
      setPreAction(null);
      preFired.current = false;
    }
    streetRef.current = s;
  }, [room?.street]);

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

  // Apply pre-action when turn starts (works with polling)
  useEffect(() => {
    if (!myTurn || !room || !preAction || preFired.current || pending) return;
    const self = room.players.find((p) => p.id === playerId);
    if (!self || self.folded || self.allIn) {
      setPreAction(null);
      return;
    }
    const callAmt = Math.max(0, room.currentBet - self.bet);
    preFired.current = true;
    const chosen = preAction;
    setPreAction(null);
    if (chosen === "check") {
      if (callAmt === 0) api("action", { action: "check" });
      return;
    }
    if (chosen === "fold_check") {
      api("action", { action: callAmt > 0 ? "fold" : "check" });
      return;
    }
    if (chosen === "call_any") {
      api("action", { action: callAmt > 0 ? "call" : "check" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, preAction, room?.currentBet, room?.actingSeat, pending]);

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
      <div className="pf-gate">
        <p className="pf-note">Entrando na mesa…</p>
      </div>
    );
  }

  if (player.mode === "none") {
    return (
      <div className="pf-gate">
        <p>Pra entrar na mesa:</p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="pf-btn pf-btn--wax pf-btn--lg"
        >
          Entrar com Google
        </button>
        <button
          type="button"
          onClick={() => void player.continueAsGuest("Convidado")}
          className="pf-btn pf-btn--ghost pf-btn--lg"
        >
          Continuar como convidado
        </button>
        <Link href="/" className="pf-navlink">
          ← Voltar
        </Link>
      </div>
    );
  }

  if (fatal || (!room && error)) {
    return (
      <div className="pf-gate">
        <p className="pf-error">{error ?? "Não foi possível abrir a sala."}</p>
        <Link href="/" className="pf-btn pf-btn--wax">
          Voltar ao início
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="pf-gate">
        <p className="pf-note">Entrando na mesa…</p>
        {error && <p className="pf-error">{error}</p>}
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
  const heroSeat = me?.seat ?? null;
  const seatSlots = seatRingPositions(maxSeats, heroSeat);
  const raiseMax = Math.max(0, allInTo);
  const raiseMin = Math.min(raiseMax, minRaiseTo);
  const shownRaise = Math.min(raiseMax, Math.max(raiseMin, raiseTo || raiseMin));
  const showPreActions =
    !!me &&
    me.seat !== null &&
    !me.busted &&
    !me.folded &&
    !me.allIn &&
    room.status === "playing" &&
    !myTurn;

  function togglePre(next: PreAction) {
    setPreAction((cur) => (cur === next ? null : next));
  }

  return (
    <div
      className="table-shell relative flex h-dvh max-h-dvh w-full max-w-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_center,#163528_0%,#0c1612_42%,#070a08_100%)] text-amber-50"
      style={{
        ["--table-fab" as string]: "8.5rem",
        ["--felt" as string]: felt.felt,
        ["--felt-lit" as string]: felt.feltLit,
      }}
    >
      {showToast && myTurn && (
        <div className="sua-vez-toast pf-toast">Sua vez!</div>
      )}

      <header className="relative z-30 flex shrink-0 items-center gap-2 overflow-hidden px-3 py-1.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-display)] text-base leading-tight tracking-tight text-[var(--fc-wax)] sm:text-lg">
            Poker Friends
          </p>
          <p className="truncate text-[0.62rem] tracking-wide text-[var(--fc-ink-mute)]">
            <span className="pf-code" style={{ fontSize: "0.62rem" }}>{room.code}</span>
            {streetLabel ? ` · ${streetLabel}` : ""}
            {room.handNumber > 0 ? ` · #${room.handNumber}` : ""}
            {" · "}
            {room.smallBlind}/{room.bigBlind}
            {sched?.enabled && room.blindsProgress ? ` · ↑ ${room.blindsProgress}` : ""}
            {!myTurn && room.status === "playing" ? ` · ${actingName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void shareRoom(room.code).then((result) => {
                if (result !== "copied") return;
                setShareLabel("Copiado");
                window.setTimeout(() => setShareLabel("Compartilhar"), 1600);
              });
            }}
            title="Qualquer um na mesa pode mandar o link. Quem abrir entra direto."
            className="action-pill rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] text-[var(--fc-wax)] backdrop-blur-sm"
          >
            {shareLabel}
          </button>
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
        <p className="pf-banner shrink-0">
          Você faliu — só assiste até alguém conquistar a mesa.
        </p>
      ) : null}

      {room.tableEnded && (
        <div className="pointer-events-none fixed inset-0 z-[45] flex items-end justify-center bg-black/45 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-24 sm:items-center sm:pb-8">
          <div className="pf-modal pointer-events-auto text-center">
            <p className="pf-kicker">Mesa conquistada</p>
            <p className="pf-title pf-title--page">
              {champ ? `${champ.emoji || "🏆"} ${champ.nickname}` : "Fim de mesa"}
            </p>
            <p className="pf-lead" style={{ marginInline: "auto" }}>
              A paz do Senhor! Jogar de novo reseata todo mundo (e os bots) com
              fichas novas na sala <span className="pf-code">{room.code}</span>.
            </p>
            {isHost ? (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => api("rematch", {})}
                  className="pf-btn pf-btn--wax pf-btn--lg pf-btn--block"
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
                  className="pf-btn pf-btn--danger pf-btn--block"
                >
                  Encerrar mesa
                </button>
                <p className="pf-note">
                  De novo = mesma sala, sentados de novo. Encerrar apaga pra todo
                  mundo.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <p className="pf-empty">
                  Aguardando o anfitrião dar o <span className="pf-code" style={{ letterSpacing: 0 }}>Jogar de novo</span>.
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={leaveTable}
                  className="pf-btn pf-btn--ghost pf-btn--block"
                >
                  Voltar ao lobby
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {room.lastAction && (
        <p className="mx-auto w-full max-w-[920px] shrink-0 truncate px-3 text-center text-[0.7rem] leading-tight text-amber-100/75">
          {room.lastAction}
        </p>
      )}

      {/* Table stage — hero sits at the bottom, above the action band */}
      <div className="table-play relative mx-auto min-h-0 w-full max-w-[920px] flex-1 px-1.5 sm:px-3">
        <div className="table-stage absolute inset-0">
          <div className="table-oval" style={{ ["--felt" as string]: felt.felt, ["--felt-lit" as string]: felt.feltLit }} />

          <div className="table-center">
            <div className="table-pot pot-bump" key={potBump}>
              {room.pot > 0 ? (
                <ChipStack
                  amount={room.pot}
                  size="md"
                  layout="pot"
                  label={`Pote ${formatChips(room.pot)}`}
                />
              ) : (
                <span className="table-pot__empty">Pote 0</span>
              )}
            </div>
            {(room.status === "playing" || room.status === "showdown") && (
              <div className="board-row">
                {Array.from({ length: 5 }, (_, i) => {
                  const c = room.community[i];
                  return c ? (
                    <PlayingCard
                      key={`${room.handNumber}-${i}`}
                      card={c}
                      size="board"
                      dealDelayMs={i * 70}
                    />
                  ) : (
                    <div key={`slot-${i}`} className="board-slot" />
                  );
                })}
              </div>
            )}
            {room.status === "showdown" && room.winners && (
              <div className="table-winners">
                {room.winners.map((w) => {
                  const p = room.players.find((x) => x.seat === w.seat);
                  return (
                    <p key={w.seat}>
                      {p?.nickname ?? "?"} +{formatChips(w.amount)}
                      <span className="text-emerald-100/70"> · {w.handName}</span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>


          {room.players.map((p) => {
            if (p.seat === null || p.bet <= 0 || p.folded) return null;
            const off = seatBetOffset(p.seat, maxSeats, heroSeat);
            return (
              <div
                key={`bet-${p.id}`}
                className="bet-slot"
                style={{ top: off.top, left: off.left }}
              >
                <ChipStack amount={p.bet} size="sm" layout="bet" />
              </div>
            );
          })}

          {seatSlots.map((pos, seat) => {
            const p = room.players.find((x) => x.seat === seat);
            const isActing =
              room.actingSeat === seat && room.status === "playing" && !p?.folded;
            const isMe = p?.id === playerId;
            const folded = !!p?.folded && room.status !== "lobby";
            const showCards = !!p && p.holeCount > 0 && !(isMe && p.hole);
            return (
              <CompactSeat
                key={seat}
                player={p}
                empty={!p}
                canSit={canSit}
                pending={pending}
                isMe={isMe}
                isActing={isActing}
                folded={folded}
                isDealer={room.dealerSeat === seat && room.status !== "lobby"}
                isSb={room.sbSeat === seat && room.status === "playing"}
                isBb={room.bbSeat === seat && room.status === "playing"}
                timerLeft={isActing ? timer.left : undefined}
                timerPct={isActing ? timer.pct : undefined}
                medal={p ? medals.get(p.id) : undefined}
                bubble={seatBubbles.get(seat) ?? null}
                showCards={showCards}
                onSit={() => api("sit", { seat })}
                style={{ top: pos.top, left: pos.left }}
              />
            );
          })}
        </div>
      </div>

      {error && (
        <p className="pf-toast pf-toast--danger">
          {error}
        </p>
      )}

      <div className="table-dock">
        {room.myHandHint && myTurn && !me?.folded && (
          <p className="table-dock__hint">{room.myHandHint}</p>
        )}
        <div className="table-dock__row">
          {me?.hole &&
            me.hole.length > 0 &&
            (room.status === "playing" || room.status === "showdown") && (
              <div className={`hero-holes ${me.folded ? "seat-folded" : ""}`}>
                {me.hole.map((c, i) => (
                  <PlayingCard key={i} card={c} size="hero" dealDelayMs={i * 80} />
                ))}
              </div>
            )}
          <div className="table-dock__actions">
            {canBet && (
              <>
                <div className="flex w-full items-center gap-1.5">
                  {[
                    { label: "½ pote", amount: Math.min(allInTo, halfPot) },
                    { label: "Pote", amount: Math.min(allInTo, potBet) },
                    { label: "All-in", amount: allInTo },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={pending || raiseMax <= 0}
                      onClick={() =>
                        setRaiseTo(Math.min(raiseMax, Math.max(raiseMin, preset.amount)))
                      }
                      className="action-pill rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.68rem] text-amber-50 hover:bg-white/10 disabled:opacity-30"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <span className="ml-auto min-w-[3.2rem] text-right text-sm font-bold tabular-nums text-amber-200">
                    {formatChips(shownRaise)}
                  </span>
                </div>
                <input
                  type="range"
                  className="table-raise"
                  min={raiseMin}
                  max={Math.max(raiseMin, raiseMax)}
                  step={Math.max(1, room.bigBlind)}
                  value={shownRaise}
                  aria-label="Valor do raise"
                  disabled={pending || raiseMax <= raiseMin}
                  onChange={(e) => setRaiseTo(Number(e.target.value))}
                />
                <div className="flex w-full items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => api("action", { action: "fold" })}
                    className="action-pill h-10 min-w-0 flex-1 rounded-full bg-rose-950/80 px-3 text-sm font-semibold text-rose-50 ring-1 ring-rose-400/35"
                  >
                    Fold
                  </button>
                  {toCall === 0 ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => api("action", { action: "check" })}
                      className="action-pill h-10 min-w-0 flex-1 rounded-full bg-emerald-800/90 px-3 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-400/30"
                    >
                      Check
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => api("action", { action: "call" })}
                      className="action-pill h-10 min-w-0 flex-1 rounded-full bg-emerald-800/90 px-3 text-sm font-semibold text-emerald-50 ring-1 ring-emerald-400/30"
                    >
                      Call {formatChips(Math.min(toCall, me?.chips ?? toCall))}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending || raiseMax <= 0}
                    onClick={() =>
                      api("action", {
                        action: room.currentBet === 0 ? "bet" : "raise",
                        amount: shownRaise,
                      })
                    }
                    className="action-pill h-10 min-w-0 flex-1 rounded-full bg-amber-400 px-3 text-sm font-semibold text-[#1a1208]"
                  >
                    {room.currentBet === 0 ? "Bet" : "Raise"}
                  </button>
                </div>
              </>
            )}

            {showPreActions && (
              <div
                className="flex w-full flex-wrap items-center justify-center gap-1.5"
                role="group"
                aria-label="Pré-ações"
              >
                {(
                  [
                    { id: "check" as const, label: "Check se ninguém apostar" },
                    { id: "fold_check" as const, label: "Fold/Check" },
                    { id: "call_any" as const, label: "Cobrir qualquer" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => togglePre(opt.id)}
                    aria-pressed={preAction === opt.id}
                    className={`rounded-full px-2.5 py-1 text-[0.65rem] transition sm:text-xs ${
                      preAction === opt.id
                        ? "bg-amber-400 font-semibold text-[#1a1208]"
                        : "border border-white/15 bg-white/5 text-amber-100/70 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {room.status === "lobby" && canSit && (
              <p className="text-[0.65rem] text-emerald-100/50">Toque num assento livre</p>
            )}
            {room.status !== "playing" && me?.seat != null && !isHost && !room.tableEnded && (
              <p className="text-[0.65rem] text-emerald-100/50">Aguardando o anfitrião…</p>
            )}
          </div>
        </div>
      </div>

      {isHost && (
        <button
          type="button"
          onClick={() => setHostOpen(true)}
          className="action-pill fixed bottom-[calc(var(--table-fab,8.5rem)+env(safe-area-inset-bottom))] left-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#1a140c]/90 text-base text-amber-300 shadow-xl sm:left-5"
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
