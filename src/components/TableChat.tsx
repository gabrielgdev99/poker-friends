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
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const messages = room.chat ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
    <div className="flex max-h-44 flex-col border border-amber-900/30 bg-[#1a1208]/70 sm:max-h-52">
      <div className="border-b border-amber-900/30 px-2 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-amber-200/60">
        Chat da mesa ☕
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-1.5 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-amber-100/40">
            Manda um 🙏 ou um “glória” — a galera tá vendo.
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
      <div className="flex flex-wrap gap-1 border-t border-amber-900/30 px-1.5 py-1">
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
        className="flex gap-1 border-t border-amber-900/30 p-1.5"
        onSubmit={(ev) => {
          ev.preventDefault();
          send(text, "text");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={160}
          placeholder="Digite… (sem fofoca do culto)"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-amber-50 outline-none placeholder:text-amber-100/30"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="bg-amber-600/90 px-3 py-1.5 text-xs font-medium text-[#1a1208] hover:bg-amber-500 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
      {error && <p className="px-2 pb-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
