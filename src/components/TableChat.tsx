"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ChatMessage, PublicRoom } from "@/lib/types";

const QUICK_EMOJIS = ["🙏", "😂", "🔥", "😎", "😅", "🙌", "❤️", "🐟", "🃏", "✝️"];

export function TableChat({
  code,
  room,
  onRoom,
}: {
  code: string;
  room: PublicRoom;
  onRoom: (r: PublicRoom) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messages = room.chat ?? [];
  const unreadRef = useRef(messages.length);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (open) {
      unreadRef.current = messages.length;
      setUnread(0);
      bottom.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const n = messages.length - unreadRef.current;
    if (n > 0) setUnread(n);
  }, [messages.length, open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(ev: MouseEvent) {
      if (!panelRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function send(payload: string, kind?: "text" | "emoji") {
    if (!payload.trim()) return;
    setError(null);
    start(async () => {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload, kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não rolou enviar");
        return;
      }
      onRoom(data.room);
      setText("");
    });
  }

  return (
    <div
      ref={panelRef}
      className="pointer-events-none fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] right-2 z-40 flex flex-col items-end gap-2 sm:right-5"
    >
      {open && (
        <div className="pointer-events-auto flex w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#14100a]/92 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-amber-200/55">
              Chat da mesa
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-amber-100/50 hover:text-amber-100"
              aria-label="Fechar chat"
            >
              ✕
            </button>
          </div>
          <div className="h-48 space-y-1 overflow-y-auto overscroll-contain px-3 py-2 text-sm sm:h-56">
            {messages.length === 0 && (
              <p className="text-xs text-amber-100/40">
                Manda um 🙏 — a galera tá vendo.
              </p>
            )}
            {messages.map((m: ChatMessage) => (
              <p key={m.id} className="leading-snug">
                <span className="font-medium text-amber-300/90">{m.nickname}</span>
                <span className="text-amber-100/80">
                  {m.kind === "emoji" ? ` ${m.text}` : `: ${m.text}`}
                </span>
              </p>
            ))}
            <div ref={bottom} />
          </div>
          <div className="flex flex-wrap gap-0.5 border-t border-amber-900/30 px-2 py-1">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                disabled={pending}
                onClick={() => send(e, "emoji")}
                className="px-1 text-base hover:scale-110 disabled:opacity-40"
                aria-label={`Enviar ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
          <form
            className="flex gap-1 border-t border-amber-900/30 p-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              send(text, "text");
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={160}
              placeholder="Digite…"
              className="min-w-0 flex-1 rounded-full bg-black/30 px-3 py-1.5 text-sm text-amber-50 outline-none placeholder:text-amber-100/30"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              className="rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-[#1a1208] hover:bg-amber-300 disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
          {error && <p className="px-3 pb-2 text-xs text-rose-300">{error}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-amber-400 text-lg text-[#1a1208] shadow-xl transition hover:bg-amber-300 active:scale-95 sm:h-12 sm:w-12"
        aria-label={open ? "Fechar chat" : "Abrir chat"}
        aria-expanded={open}
      >
        💬
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.65rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
