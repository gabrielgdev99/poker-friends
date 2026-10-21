"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AuthBar } from "@/components/AuthBar";
import { PlayingCard } from "@/components/PlayingCard";
import type { PublicRoom } from "@/lib/types";

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

export function TableView({ code }: { code: string }) {
  const { data: session, status } = useSession();
  const playerId = session?.user?.id ?? "";
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [betInput, setBetInput] = useState("");
  const [pending, start] = useTransition();

  const refresh = useCallback(async () => {
    if (!playerId) return;
    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) {
      setError(res.status === 401 ? "Faça login com Google" : "Sala não encontrada");
      return;
    }
    const data = await res.json();
    setRoom(data.room);
  }, [code, playerId]);

  useEffect(() => {
    if (!playerId) return;
    const nick = session?.user?.name?.slice(0, 16) || "Jogador";
    fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nick }),
    }).then(() => refresh());
  }, [playerId, code, refresh, session?.user?.name]);

  useEffect(() => {
    if (!playerId) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [playerId, refresh]);

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

  if (status === "loading" || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center text-amber-100/70">
        Entrando na mesa…
      </div>
    );
  }

  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const myTurn = room.actingSeat !== null && me?.seat === room.actingSeat;
  const toCall = me ? Math.max(0, room.currentBet - me.bet) : 0;
  const minBet = room.currentBet === 0 ? room.bigBlind : room.currentBet + room.minRaise;
  const seatedCount = room.players.filter((p) => p.seat !== null).length;

  return (
    <div className="relative flex min-h-screen flex-col text-amber-50">
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-amber-300">
            Poker Friends
          </p>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/50">
            Sala {room.code}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right text-sm text-emerald-100/60">
          <AuthBar />
          <p>
            Blinds {room.smallBlind}/{room.bigBlind}
            {room.handNumber > 0 ? ` · Mão #${room.handNumber}` : ""}
          </p>
          {room.lastAction && (
            <p className="max-w-xs truncate text-amber-200/80">{room.lastAction}</p>
          )}
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-4xl flex-1 px-2 pb-36 sm:px-6">
        <div className="relative mx-auto aspect-[4/3] w-full max-h-[70vh] min-h-[320px]">
          {/* felt */}
          <div className="absolute inset-[8%] rounded-[50%] border-[10px] border-[#3d2a14] bg-[radial-gradient(ellipse_at_center,#1a5c3a_0%,#0d3d28_45%,#062018_100%)] shadow-[inset_0_0_80px_rgba(0,0,0,0.45),0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-[6%] rounded-[50%] border border-emerald-400/15" />
          </div>

          {/* pot + board */}
          <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
            <p className="rounded bg-black/35 px-3 py-1 text-sm tracking-wide text-amber-200">
              Pote {room.pot}
            </p>
            <div className="flex gap-1.5 sm:gap-2">
              {room.community.map((c, i) => (
                <PlayingCard key={i} card={c} compact />
              ))}
              {room.status === "playing" &&
                room.community.length < 5 &&
                Array.from({ length: Math.max(0, (room.street === "preflop" ? 0 : room.street === "flop" ? 3 : room.street === "turn" ? 4 : 5) - room.community.length) }).map(
                  (_, i) => <PlayingCard key={`p${i}`} hidden compact />,
                )}
            </div>
            {room.winners && (
              <p className="mt-1 text-center text-sm text-amber-300">
                {room.winners
                  .map((w) => {
                    const p = room.players.find((x) => x.seat === w.seat);
                    return `${p?.nickname ?? "?"} +${w.amount} (${w.handName})`;
                  })
                  .join(" · ")}
              </p>
            )}
          </div>

          {/* seats */}
          {SEAT_POS.map((pos, seat) => {
            const p = room.players.find((x) => x.seat === seat);
            const isDealer = room.dealerSeat === seat && room.status !== "lobby";
            const isActing = room.actingSeat === seat;
            const empty = !p;
            return (
              <button
                key={seat}
                type="button"
                disabled={!!p || room.status === "playing" || pending}
                onClick={() => api("sit", { seat })}
                style={{ top: pos.top, left: pos.left }}
                className={`absolute z-20 w-24 -translate-x-1/2 -translate-y-1/2 sm:w-28 ${
                  empty
                    ? "cursor-pointer opacity-70 hover:opacity-100"
                    : "cursor-default"
                }`}
              >
                <div
                  className={`rounded-lg px-2 py-2 text-center transition ${
                    isActing
                      ? "bg-amber-500/90 text-emerald-950 ring-2 ring-amber-200"
                      : empty
                        ? "border border-dashed border-emerald-300/25 bg-emerald-950/40 text-emerald-100/50"
                        : "bg-emerald-950/80 text-amber-50"
                  }`}
                >
                  {empty ? (
                    <span className="text-xs">Assento {seat + 1}</span>
                  ) : (
                    <>
                      <p className="truncate text-xs font-medium sm:text-sm">
                        {p.nickname}
                        {p.id === playerId ? " (você)" : ""}
                      </p>
                      <p className="text-[0.65rem] text-amber-200/80 sm:text-xs">
                        {p.chips}
                        {p.bet > 0 ? ` · aposta ${p.bet}` : ""}
                        {p.folded ? " · fold" : ""}
                        {p.allIn ? " · all-in" : ""}
                      </p>
                      {p.holeCount > 0 && (
                        <div className="mt-1 flex justify-center gap-0.5">
                          {p.hole ? (
                            p.hole.map((c, i) => (
                              <PlayingCard key={i} card={c} compact />
                            ))
                          ) : (
                            <>
                              <PlayingCard hidden compact />
                              <PlayingCard hidden compact />
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {isDealer && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[0.6rem] font-bold text-emerald-950">
                    D
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* controls */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-emerald-800/50 bg-[#04150f]/95 px-4 py-4 backdrop-blur-md sm:px-8">
        {error && <p className="mb-2 text-sm text-rose-300">{error}</p>}
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2">
          {isHost && room.status !== "playing" && (
            <button
              type="button"
              disabled={pending || seatedCount < 2}
              onClick={() => api("start", {})}
              className="bg-amber-500 px-4 py-2.5 text-sm font-medium text-emerald-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {room.status === "showdown" ? "Próxima mão" : "Iniciar mão"}
            </button>
          )}

          {myTurn && room.status === "playing" && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => api("action", { action: "fold" })}
                className="border border-rose-400/40 px-3 py-2.5 text-sm text-rose-200 hover:bg-rose-500/10"
              >
                Fold
              </button>
              {toCall === 0 ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => api("action", { action: "check" })}
                  className="border border-emerald-400/40 px-3 py-2.5 text-sm hover:bg-emerald-500/10"
                >
                  Check
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => api("action", { action: "call" })}
                  className="border border-emerald-400/40 px-3 py-2.5 text-sm hover:bg-emerald-500/10"
                >
                  Call {toCall}
                </button>
              )}
              <input
                type="number"
                min={minBet}
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                placeholder={`${minBet}+`}
                className="w-24 border border-amber-200/30 bg-emerald-950/60 px-2 py-2 text-sm outline-none"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const amount = Number(betInput) || minBet;
                  api("action", {
                    action: room.currentBet === 0 ? "bet" : "raise",
                    amount,
                  });
                }}
                className="bg-amber-500/90 px-3 py-2.5 text-sm text-emerald-950 hover:bg-amber-400"
              >
                {room.currentBet === 0 ? "Bet" : "Raise"}
              </button>
            </>
          )}

          {!myTurn && room.status === "playing" && (
            <p className="text-sm text-emerald-100/50">Aguardando a vez…</p>
          )}

          {room.status === "lobby" && !me?.seat && (
            <p className="text-sm text-emerald-100/60">
              Toque em um assento livre para sentar.
            </p>
          )}

          {room.status === "lobby" && me?.seat !== null && me?.seat !== undefined && !isHost && (
            <p className="text-sm text-emerald-100/60">
              Aguardando o anfitrião iniciar…
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
