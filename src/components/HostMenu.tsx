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
    <div className="pf-modal-back">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fechar menu"
        onClick={onClose}
      />
      <div ref={panel} className="pf-modal">
        <div className="pf-row">
          <h2 className="pf-title" style={{ fontSize: "1.35rem" }}>
            Menu da mesa
          </h2>
          <button type="button" onClick={onClose} className="pf-btn pf-btn--ghost pf-btn--sm" aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="pf-note" style={{ margin: "0.4rem 0 0.9rem" }}>
          Controles do anfitrião — a mesa fica limpa pra você jogar também.
        </p>

        <div className="pf-stack">
          {room.status !== "playing" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="pf-check">
                  Nível bot
                  <select
                    className="pf-select"
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
                  className="pf-btn pf-btn--ghost pf-btn--sm"
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
                    className="pf-btn pf-btn--danger pf-btn--sm"
                  >
                    Remover {b.nickname}
                  </button>
                ))}

              <label className="pf-check">
                Timer
                <select
                  className="pf-select"
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

              <label className="pf-check">
                SB
                <select
                  className="pf-select"
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

              <label className="pf-check">
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
                <div className="pf-wrap">
                  <select
                    className="pf-select"
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
                    className="pf-select"
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
                    className="pf-select"
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

              <label className="pf-check">
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
                disabled={
                  pending ||
                  (room.tableEnded ? false : seatedCount < 2)
                }
                onClick={() => {
                  onApi(room.tableEnded ? "rematch" : "start", {});
                  onClose();
                }}
                className="pf-btn pf-btn--wax pf-btn--block"
              >
                {room.tableEnded
                  ? "Jogar de novo"
                  : room.status === "showdown"
                    ? "Próxima mão"
                    : "Iniciar mão"}
              </button>
              {room.tableEnded && (
                <p className="pf-note">
                  Mesma sala · fichas novas (buy-in) · quem faliu pode sentar.
                  Encerrar mesa apaga a sala.
                </p>
              )}
            </>
          )}

          {room.status === "playing" && (
            <p className="pf-note">
              Ajustes de bots/blinds só entre mãos. Você pode encerrar a qualquer
              hora.
            </p>
          )}

          <hr style={{ border: 0, borderTop: "1px solid rgba(242,235,224,0.12)" }} />

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
            className="pf-btn pf-btn--danger pf-btn--block"
          >
            Encerrar mesa
          </button>
        </div>
      </div>
    </div>
  );
}
