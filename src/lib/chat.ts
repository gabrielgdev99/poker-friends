import type { ChatMessage, Room } from "@/lib/types";

const MAX_MESSAGES = 40;
const MIN_INTERVAL_MS = 800;
const MAX_LEN = 160;

const EMOJI_ONLY = /^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\s]+$/u;

export const QUICK_EMOJIS = ["🙏", "😂", "🔥", "😎", "😅", "🙌", "❤️", "🐟", "🃏", "✝️"];

export function appendChat(
  room: Room,
  msg: {
    playerId: string;
    nickname: string;
    text: string;
    kind?: "text" | "emoji";
  },
): ChatMessage {
  if (!room.chat) room.chat = [];
  const text = msg.text.trim().slice(0, MAX_LEN);
  if (!text) throw new Error("Mensagem vazia");

  const last = [...room.chat].reverse().find((m) => m.playerId === msg.playerId);
  if (last && Date.now() - last.at < MIN_INTERVAL_MS) {
    throw new Error("Calma, irmão — espere um segundo");
  }

  const entry: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    playerId: msg.playerId,
    nickname: msg.nickname.slice(0, 16),
    text,
    kind: msg.kind ?? (EMOJI_ONLY.test(text) ? "emoji" : "text"),
  };
  room.chat.push(entry);
  if (room.chat.length > MAX_MESSAGES) {
    room.chat = room.chat.slice(-MAX_MESSAGES);
  }
  room.updatedAt = Date.now();
  return entry;
}
