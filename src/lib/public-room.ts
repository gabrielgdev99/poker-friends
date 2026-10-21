import type { PublicRoom, Room } from "@/lib/types";

export function toPublicRoom(room: Room, viewerId?: string): PublicRoom {
  const showAll = room.status === "showdown";
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    dealerSeat: room.dealerSeat,
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
    updatedAt: room.updatedAt,
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
        hole: reveal && p.hole ? p.hole : null,
        holeCount: p.hole?.length ?? 0,
      };
    }),
  };
}
