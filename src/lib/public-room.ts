import { blindsProgressLabel, defaultBlindSchedule, nextBlinds } from "@/lib/poker/blinds";
import { describeMyHand } from "@/lib/poker/hand-hint";
import type { PublicRoom, Room } from "@/lib/types";

export function toPublicRoom(room: Room, viewerId?: string): PublicRoom {
  const showAll = room.status === "showdown";
  const me = viewerId ? room.players.find((p) => p.id === viewerId) : undefined;
  const myHandHint =
    me && !me.folded && (room.status === "playing" || room.status === "showdown")
      ? describeMyHand(me.hole, room.community)
      : null;
  const blindSchedule = room.blindSchedule ?? defaultBlindSchedule();
  const nxt = nextBlinds({ ...room, blindSchedule });

  return {
    code: room.code,
    hostId: room.hostId,
    maxSeats: room.maxSeats ?? 10,
    status: room.status,
    dealerSeat: room.dealerSeat,
    sbSeat: room.sbSeat ?? null,
    bbSeat: room.bbSeat ?? null,
    smallBlind: room.smallBlind,
    bigBlind: room.bigBlind,
    pot: room.pot,
    community: room.community,
    currentBet: room.currentBet,
    minRaise: room.minRaise,
    actingSeat: room.actingSeat,
    street: room.street,
    handNumber: room.handNumber,
    winners: room.winners,
    lastAction: room.lastAction,
    lastSeatAction: room.lastSeatAction ?? null,
    turnSeconds: room.turnSeconds ?? 18,
    turnDeadline: room.turnDeadline ?? null,
    autoStartNext: !!room.autoStartNext,
    showdownUntil: room.showdownUntil ?? null,
    chat: room.chat ?? [],
    blindSchedule,
    tableEnded: !!room.tableEnded,
    championId: room.championId ?? null,
    nextSmallBlind: nxt.sb,
    nextBigBlind: nxt.bb,
    blindsProgress: blindsProgressLabel({ ...room, blindSchedule }),
    updatedAt: room.updatedAt,
    serverNow: Date.now(),
    myHandHint,
    players: room.players.map((p) => {
      const reveal = showAll || p.id === viewerId;
      return {
        id: p.id,
        nickname: p.nickname,
        seat: p.seat,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        actedThisRound: p.actedThisRound,
        isBot: !!p.isBot,
        botDifficulty: p.isBot ? p.botDifficulty ?? "medium" : null,
        busted: !!p.busted,
        emoji: p.emoji || (p.isBot ? "🤖" : "🙏"),
        chipColor: p.chipColor || "#f0b429",
        avatarUrl: p.avatarUrl || null,
        hole: reveal && p.hole ? p.hole : null,
        holeCount: p.hole?.length ?? 0,
      };
    }),
  };
}
