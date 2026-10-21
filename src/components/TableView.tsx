"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";
import { PlayingCard } from "@/components/PlayingCard";
import type { PublicRoom, Street } from "@/lib/types";

const SEAT_POS = [
  { top: "88%", left: "50%" },
  { top: "78%", left: "82%" },
  { top: "50%", left: "94%" },
  { top: "22%", left: "82%" },
  { top: "10%", left: "50%" },
  { top: "22%", left: "18%" },
  { top: "50%", left: "6%" },
  { top: "78%", left: "18%" },
  { top: "92%", left: "68%" },
  { top: "92%", left: "32%" },
];

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
  const { data: session, status } = useSession();
  const playerId = session?.user?.id ?? "";
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
  const wasMyTurn = useRef(false);
  const joinStarted = useRef(false);

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
      // Stop “Entrando na mesa…” loop — send user home with context
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
    if (!playerId || joinStarted.current || fatal) return;
    joinStarted.current = true;
    const nick = session?.user?.name?.slice(0, 16) || "Jogador";
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
        setFatal(true);
        setError(data.error ?? "Falha ao entrar na sala");
        return;
      }
      applyRoom(data.room as PublicRoom);
    })();
  }, [playerId, code, session?.user?.name, fatal, leaveMissingRoom, applyRoom]);

  const myTurn =
    !!room &&
    room.status === "playing" &&
    room.actingSeat !== null &&
    room.players.find((p) => p.id === playerId)?.seat === room.actingSeat;

  useEffect(() => {
    if (!playerId || fatal || !room) return;
    const ms = myTurn ? 700 : 1200;
    const t = setInterval(refresh, ms);
    return () => clearInterval(t);
  }, [playerId, refresh, myTurn, fatal, room]);

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

  const timer = useMemo(() => {
    if (!room?.turnDeadline || room.status !== "playing") {
      return { left: 0, pct: 0, total: room?.turnSeconds ?? 18 };
    }
    const serverAligned = now - clockSkew;
    const leftMs = Math.max(0, room.turnDeadline - serverAligned);
    const total = room.turnSeconds || 18;
    return {
      left: Math.ceil(leftMs / 1000),
      pct: Math.min(100, (leftMs / (total * 1000)) * 100),
      total,
    };
  }, [room, now, clockSkew]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-amber-100/70">
        Entrando na mesa…
      </div>
    );
  }

  if (fatal || (!room && error)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-rose-300">{error ?? "Não foi possível abrir a sala."}</p>
        <a href="/" className="bg-amber-500 px-5 py-2.5 text-emerald-950 hover:bg-amber-400">
          Voltar ao início
        </a>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center text-amber-100/70">
        Entrando na mesa…
      </div>
    );
  }

  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const toCall = me ? Math.max(0, room.currentBet - me.bet) : 0;
  const minRaiseTo =
    room.currentBet === 0 ? room.bigBlind : room.currentBet + room.minRaise;
  const pot = room.pot;
  const halfPot = Math.max(minRaiseTo, Math.floor(pot / 2) || room.bigBlind);
  const potBet = Math.max(minRaiseTo, pot || room.bigBlind * 2);
  const allInTo = me ? me.bet + me.chips : 0;
  const seatedCount = room.players.filter((p) => p.seat !== null).length;
  const actingName =
    room.players.find((p) => p.seat === room.actingSeat)?.nickname ?? "…";
  const streetLabel = room.street ? STREET_LABEL[room.street] : null;
  const canBet = myTurn && room.status === "playing" && !me?.allIn && (me?.chips ?? 0) > 0;

  return (
    <div className="relative flex min-h-screen flex-col text-amber-50">
      {showToast && myTurn && (
        <div className="sua-vez-toast pointer-events-none fixed left-1/2 top-20 z-50 rounded bg-amber-500 px-5 py-2 font-[family-name:var(--font-display)] text-lg text-emerald-950 shadow-lg">
          Sua vez!
        </div>
      )}

      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div>
          <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-amber-300 sm:text-2xl">
            Poker Friends
          </p>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-emerald-200/50">
            Sala {room.code}
            {streetLabel ? ` · ${streetLabel}` : ""}
            {room.handNumber > 0 ? ` · #${room.handNumber}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right text-xs text-emerald-100/60 sm:text-sm">
          <AuthBar />
          <p>
            Blinds {room.smallBlind}/{room.bigBlind} · timer {room.turnSeconds}s
          </p>
          {room.lastAction && (
            <p className="max-w-[14rem] truncate text-amber-200/80 sm:max-w-xs">
              {room.lastAction}
            </p>
          )}
        </div>
      </header>

      {/* turn bar */}
      {room.status === "playing" && room.actingSeat !== null && (
        <div className="relative z-20 mx-auto w-full max-w-4xl px-4 sm:px-8">
          <div className="mb-1 flex items-center justify-between text-xs text-emerald-100/70">
            <span>
              Vez de <strong className="text-amber-200">{actingName}</strong>
              {myTurn ? " (você)" : ""}
            </span>
            <span className={timer.left <= 5 ? "text-rose-300" : "text-amber-200"}>
              {timer.left}s
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-emerald-950/80">
            <div
              className={`h-full transition-[width] duration-200 ease-linear ${
                timer.left <= 5 ? "bg-rose-400" : "bg-amber-400"
              }`}
              style={{ width: `${timer.pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="relative mx-auto w-full max-w-4xl flex-1 px-2 pb-44 pt-2 sm:px-6">
        <div className="relative mx-auto aspect-[4/3] w-full max-h-[62vh] min-h-[300px]">
          <div className="absolute inset-[6%] rounded-[50%] border-[10px] border-[#3d2a14] bg-[radial-gradient(ellipse_at_center,#1a5c3a_0%,#0d3d28_45%,#062018_100%)] shadow-[inset_0_0_80px_rgba(0,0,0,0.45),0_20px_60px_rgba(0,0,0,0.5)] sm:inset-[8%]">
            <div className="absolute inset-[5%] rounded-[50%] border border-emerald-400/15" />
          </div>

          <div className="absolute left-1/2 top-[42%] z-10 flex w-[90%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 sm:top-1/2">
            {streetLabel && (
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-emerald-200/55">
                {streetLabel}
              </p>
            )}
            <p
              key={potBump}
              className={`pot-bump rounded-full bg-black/45 px-4 py-1.5 text-base font-semibold tracking-wide text-amber-200 sm:text-lg ${
                potBump ? "" : ""
              }`}
            >
              Pote {formatChips(room.pot)}
            </p>
            <div className="flex min-h-[3rem] gap-1 sm:gap-1.5">
              {room.community.map((c, i) => (
                <PlayingCard key={`${room.handNumber}-${i}`} card={c} compact dealDelayMs={i * 70} />
              ))}
            </div>
            {room.status === "showdown" && room.winners && (
              <div className="mt-1 max-w-xs rounded bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-200">
                {room.winners.map((w) => {
                  const p = room.players.find((x) => x.seat === w.seat);
                  return (
                    <p key={w.seat}>
                      {p?.nickname ?? "?"} +{w.amount}
                      <span className="text-emerald-100/60"> · {w.handName}</span>
                    </p>
                  );
                })}
                {room.autoStartNext && room.showdownUntil && (
                  <p className="mt-1 text-[0.65rem] text-emerald-100/50">
                    Próxima mão em breve…
                  </p>
                )}
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
                disabled={!!p || room.status === "playing" || pending}
                onClick={() => api("sit", { seat })}
                style={{ top: pos.top, left: pos.left }}
                className={`absolute z-20 w-[5.5rem] -translate-x-1/2 -translate-y-1/2 sm:w-28 ${
                  empty ? "cursor-pointer opacity-70 hover:opacity-100" : "cursor-default"
                }`}
              >
                <div
                  className={`rounded-lg px-1.5 py-1.5 text-center transition sm:px-2 sm:py-2 ${
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
                    <span className="text-[0.65rem] sm:text-xs">Assento {seat + 1}</span>
                  ) : (
                    <>
                      <p className="truncate text-[0.65rem] font-medium sm:text-xs">
                        {p.nickname}
                        {p.isBot ? " · bot" : ""}
                        {isMe ? " · você" : ""}
                      </p>
                      <p className="text-[0.7rem] font-semibold tabular-nums text-amber-200 sm:text-sm">
                        {formatChips(p.chips)}
                      </p>
                      {p.bet > 0 && !p.folded && (
                        <p className="text-[0.6rem] text-amber-100/90">
                          aposta {formatChips(p.bet)}
                        </p>
                      )}
                      {p.folded && <p className="text-[0.6rem]">fold</p>}
                      {p.allIn && !p.folded && <p className="text-[0.6rem]">all-in</p>}
                      {p.holeCount > 0 && (
                        <div className="mt-1 flex justify-center gap-0.5">
                          {p.hole ? (
                            p.hole.map((c, i) => (
                              <PlayingCard
                                key={i}
                                card={c}
                                compact
                                dealDelayMs={isMe ? i * 80 : 0}
                              />
                            ))
                          ) : (
                            <>
                              <PlayingCard hidden compact />
                              <PlayingCard hidden compact />
                            </>
                          )}
                        </div>
                      )}
                      {lastHere && room.lastSeatAction && (
                        <p className="mt-0.5 truncate text-[0.6rem] font-medium text-amber-300/90">
                          {room.lastSeatAction.label}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="absolute -right-1 -top-1 flex gap-0.5">
                  {isDealer && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[0.55rem] font-bold text-emerald-950">
                      D
                    </span>
                  )}
                  {isSb && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-[0.5rem] font-bold text-emerald-950">
                      SB
                    </span>
                  )}
                  {isBb && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-200 text-[0.5rem] font-bold text-emerald-950">
                      BB
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-emerald-800/50 bg-[#04150f]/95 px-3 py-3 backdrop-blur-md sm:px-8 sm:py-4">
        {error && <p className="mb-2 text-sm text-rose-300">{error}</p>}
        <div className="mx-auto flex max-w-4xl flex-col gap-2">
          {isHost && room.status !== "playing" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending || seatedCount >= 10}
                onClick={() => api("bots", { action: "add" })}
                className="border border-amber-200/40 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10 disabled:opacity-40"
              >
                Adicionar bot
              </button>
              {room.players
                .filter((p) => p.isBot)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={pending}
                    onClick={() => api("bots", { action: "remove", botId: b.id })}
                    className="border border-rose-400/30 px-2 py-2 text-xs text-rose-200/90 hover:bg-rose-500/10"
                  >
                    Remover {b.nickname}
                  </button>
                ))}
              <label className="flex items-center gap-1.5 text-xs text-emerald-100/60">
                Timer
                <select
                  className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                  value={room.turnSeconds}
                  disabled={pending}
                  onChange={(e) =>
                    api("settings", { turnSeconds: Number(e.target.value) })
                  }
                >
                  {[12, 18, 25, 30].map((s) => (
                    <option key={s} value={s}>
                      {s}s
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-emerald-100/60">
                <input
                  type="checkbox"
                  checked={room.autoStartNext}
                  disabled={pending}
                  onChange={(e) =>
                    api("settings", { autoStartNext: e.target.checked })
                  }
                />
                Auto próxima mão
              </label>
              <button
                type="button"
                disabled={pending || seatedCount < 2}
                onClick={() => api("start", {})}
                className="bg-amber-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-amber-400 disabled:opacity-40"
              >
                {room.status === "showdown" ? "Próxima mão" : "Iniciar mão"}
              </button>
            </div>
          )}

          {canBet && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => api("action", { action: "fold" })}
                  className="min-w-[4.5rem] border border-rose-400/50 bg-rose-950/30 px-3 py-3 text-sm font-medium text-rose-100 active:scale-[0.98]"
                >
                  Fold
                </button>
                {toCall === 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => api("action", { action: "check" })}
                    className="min-w-[5.5rem] flex-1 border border-emerald-400/40 bg-emerald-900/40 px-3 py-3 text-sm font-medium active:scale-[0.98]"
                  >
                    Check
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => api("action", { action: "call" })}
                    className="min-w-[5.5rem] flex-1 border border-emerald-400/40 bg-emerald-900/40 px-3 py-3 text-sm font-medium active:scale-[0.98]"
                  >
                    Call {formatChips(Math.min(toCall, me?.chips ?? toCall))}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: "½ pote", amount: Math.min(allInTo, halfPot) },
                  { label: "Pote", amount: Math.min(allInTo, potBet) },
                  { label: "All-in", amount: allInTo },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={
                      pending ||
                      (preset.amount < minRaiseTo && preset.amount < allInTo)
                    }
                    onClick={() => {
                      setBetInput(String(preset.amount));
                      api("action", {
                        action: room.currentBet === 0 ? "bet" : "raise",
                        amount: preset.amount,
                      });
                    }}
                    className="border border-amber-200/25 px-2.5 py-1.5 text-xs text-amber-100/90 hover:bg-amber-500/10 disabled:opacity-30"
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
                  className="w-20 border border-amber-200/30 bg-emerald-950/60 px-2 py-1.5 text-sm outline-none"
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
                  className="bg-amber-500/95 px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-amber-400"
                >
                  {room.currentBet === 0 ? "Bet" : "Raise"}
                </button>
              </div>
            </>
          )}

          {!myTurn && room.status === "playing" && (
            <p className="text-sm text-emerald-100/50">
              Aguardando {actingName}
              {timer.left > 0 ? ` · ${timer.left}s` : ""}…
            </p>
          )}

          {room.status === "lobby" && !me?.seat && (
            <p className="text-sm text-emerald-100/60">
              Toque em um assento livre para sentar.
            </p>
          )}

          {room.status !== "playing" &&
            me?.seat !== null &&
            me?.seat !== undefined &&
            !isHost && (
              <p className="text-sm text-emerald-100/60">
                Aguardando o anfitrião…
              </p>
            )}
        </div>
      </footer>
    </div>
  );
}
