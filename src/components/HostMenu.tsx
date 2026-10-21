"use client";

import { useEffect, useRef } from "react";
import type { BotDifficulty, PublicRoom } from "@/lib/types";

const BOT_LEVELS: { value: BotDifficulty; label: string }[] = [
  { value: "easy", label: "Iniciante" },
  { value: "medium", label: "Médio" },
  { value: "hard", label: "Difícil" },
];

export function HostMenu({
  open,
  onClose,
  room,
  pending,
  botDifficulty,
  onBotDifficulty,
  onApi,
  onCloseRoom,
}: {
  open: boolean;
  onClose: () => void;
  room: PublicRoom;
  pending: boolean;
  botDifficulty: BotDifficulty;
  onBotDifficulty: (d: BotDifficulty) => void;
  onApi: (path: string, body: Record<string, unknown>) => void;
  onCloseRoom: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const sched = room.blindSchedule;
  const seatedCount = room.players.filter((p) => p.seat !== null && p.chips > 0).length;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end sm:items-center sm:justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Fechar menu"
        onClick={onClose}
      />
      <div
        ref={panel}
        className="relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-amber-900/40 bg-[#1a1208] p-4 shadow-2xl sm:rounded-2xl sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-amber-300">
            Menu da mesa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-100/50 hover:text-amber-100"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-amber-100/45">
          Controles do anfitrião — a mesa fica limpa pra você jogar também.
        </p>

        <div className="space-y-4 text-sm">
          {room.status !== "playing" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-emerald-100/60">
                  Nível bot
                  <select
                    className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                    value={botDifficulty}
                    disabled={pending}
                    onChange={(e) =>
                      onBotDifficulty(e.target.value as BotDifficulty)
                    }
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
                    onApi("bots", { action: "add", difficulty: botDifficulty })
                  }
                  className="border border-amber-200/40 px-3 py-1.5 text-amber-100 hover:bg-amber-500/10 disabled:opacity-40"
                >
                  Chamar bot
                </button>
              </div>
              {room.players
                .filter((p) => p.isBot)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={pending}
                    onClick={() => onApi("bots", { action: "remove", botId: b.id })}
                    className="mr-1 border border-rose-400/30 px-2 py-1 text-xs text-rose-200/90"
                  >
                    Remover {b.nickname}
                  </button>
                ))}

              <label className="flex items-center gap-2 text-xs text-emerald-100/60">
                Timer
                <select
                  className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                  value={room.turnSeconds}
                  disabled={pending}
                  onChange={(e) =>
                    onApi("settings", { turnSeconds: Number(e.target.value) })
                  }
                >
                  {[12, 18, 25, 30].map((s) => (
                    <option key={s} value={s}>
                      {s}s
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs text-emerald-100/60">
                SB
                <select
                  className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-amber-100"
                  value={room.smallBlind}
                  disabled={pending}
                  onChange={(e) =>
                    onApi("settings", { smallBlind: Number(e.target.value) })
                  }
                >
                  {[5, 10, 25, 50, 100].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs text-emerald-100/60">
                <input
                  type="checkbox"
                  checked={!!sched?.enabled}
                  disabled={pending}
                  onChange={(e) =>
                    onApi("settings", {
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
                <div className="flex flex-wrap gap-2">
                  <select
                    className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-xs text-amber-100"
                    value={sched.mode}
                    disabled={pending}
                    onChange={(e) =>
                      onApi("settings", {
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
                  <select
                    className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-xs text-amber-100"
                    value={sched.every}
                    disabled={pending}
                    onChange={(e) =>
                      onApi("settings", {
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
                          a cada {n}
                          {sched.mode === "time" ? " min" : " mãos"}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    className="border border-emerald-700/50 bg-emerald-950/60 px-1 py-1 text-xs text-amber-100"
                    value={sched.multiplier}
                    disabled={pending}
                    onChange={(e) =>
                      onApi("settings", {
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
                        ×{m}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-emerald-100/60">
                <input
                  type="checkbox"
                  checked={room.autoStartNext}
                  disabled={pending || room.tableEnded}
                  onChange={(e) =>
                    onApi("settings", { autoStartNext: e.target.checked })
                  }
                />
                Auto próxima mão
              </label>

              <button
                type="button"
                disabled={pending || seatedCount < 2}
                onClick={() => {
                  onApi("start", {});
                  onClose();
                }}
                className="w-full bg-amber-500 py-2.5 font-medium text-emerald-950 hover:bg-amber-400 disabled:opacity-40"
              >
                {room.tableEnded
                  ? "Nova mesa"
                  : room.status === "showdown"
                    ? "Próxima mão"
                    : "Iniciar mão"}
              </button>
            </>
          )}

          {room.status === "playing" && (
            <p className="text-xs text-amber-100/50">
              Ajustes de bots/blinds só entre mãos. Você pode encerrar a qualquer
              hora.
            </p>
          )}

          <hr className="border-amber-900/40" />

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "Encerrar mesa pra todo mundo? A sala some do Redis.",
                )
              ) {
                return;
              }
              onCloseRoom();
            }}
            className="w-full border border-rose-500/50 bg-rose-950/40 py-2.5 text-rose-100 hover:bg-rose-900/40 disabled:opacity-40"
          >
            Encerrar mesa
          </button>
        </div>
      </div>
    </div>
  );
}
