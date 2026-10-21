import { freshDeck, shuffle } from "@/lib/poker/cards";
import { bestHand, compareHands } from "@/lib/poker/hand-eval";
import { defaultBlindSchedule, onHandStarting } from "@/lib/poker/blinds";
import { SHOWDOWN_MS, defaultTurnSeconds, resetTurnClock } from "@/lib/poker/clock";
import type {
  BlindSchedule,
  Player,
  PlayerAction,
  Room,
  StatsQueue,
  Street,
  Winner,
} from "@/lib/types";

export const SEAT_CAP = 10;
export const SEAT_MIN = 2;

export function clampMaxSeats(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return SEAT_CAP;
  return Math.min(SEAT_CAP, Math.max(SEAT_MIN, Math.floor(v)));
}

export function roomMaxSeats(room: Room): number {
  return clampMaxSeats(room.maxSeats ?? SEAT_CAP);
}

export function seatedPlayers(room: Room): Player[] {
  return room.players
    .filter((p) => p.seat !== null && p.chips > 0)
    .sort((a, b) => (a.seat! - b.seat!));
}

export function activeInHand(room: Room): Player[] {
  return room.players.filter(
    (p) => p.seat !== null && !p.folded && (p.hole?.length || p.allIn || room.status === "playing"),
  );
}

function nextOccupiedSeat(room: Room, from: number, pred?: (p: Player) => boolean): number | null {
  const n = roomMaxSeats(room);
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    const p = room.players.find((x) => x.seat === seat);
    if (!p) continue;
    if (pred && !pred(p)) continue;
    return seat;
  }
  return null;
}

function playerAt(room: Room, seat: number): Player | undefined {
  return room.players.find((p) => p.seat === seat);
}

function putChips(p: Player, amount: number, room: Room) {
  const pay = Math.min(amount, p.chips);
  p.chips -= pay;
  p.bet += pay;
  room.pot += pay;
  if (p.chips === 0) p.allIn = true;
}

function resetBets(room: Room) {
  for (const p of room.players) {
    p.bet = 0;
    p.actedThisRound = false;
  }
  room.currentBet = 0;
  room.minRaise = room.bigBlind;
}

function needsAction(p: Player, room: Room): boolean {
  if (p.folded || p.allIn || p.seat === null) return false;
  if (!p.actedThisRound) return true;
  return p.bet < room.currentBet;
}

function bettingComplete(room: Room): boolean {
  const live = room.players.filter((p) => p.seat !== null && !p.folded);
  if (live.length <= 1) return true;
  const canAct = live.filter((p) => !p.allIn);
  if (canAct.length === 0) return true;
  return canAct.every((p) => !needsAction(p, room));
}

function nextActor(room: Room, fromSeat: number): number | null {
  return nextOccupiedSeat(
    room,
    fromSeat,
    (p) => !p.folded && !p.allIn && needsAction(p, room),
  );
}

function dealCommunity(room: Room, n: number) {
  for (let i = 0; i < n; i++) {
    const c = room.deck.pop();
    if (c) room.community.push(c);
  }
}

function advanceStreet(room: Room) {
  const order: (Street | null)[] = ["preflop", "flop", "turn", "river", null];
  const idx = order.indexOf(room.street);
  const next = order[idx + 1];

  if (!next) {
    showdown(room);
    return;
  }

  room.street = next;
  resetBets(room);

  if (next === "flop") dealCommunity(room, 3);
  if (next === "turn" || next === "river") dealCommunity(room, 1);

  const live = room.players.filter((p) => p.seat !== null && !p.folded);
  // HU: dealer (SB) acts first postflop; multiway: left of dealer
  const first =
    live.length === 2
      ? live.find((p) => p.seat === room.dealerSeat && !p.allIn)?.seat ??
        nextOccupiedSeat(room, room.dealerSeat, (p) => !p.folded && !p.allIn)
      : nextOccupiedSeat(room, room.dealerSeat, (p) => !p.folded && !p.allIn);
  room.actingSeat = first;
  if (room.status === "playing") resetTurnClock(room);

  // If everyone all-in, burn through remaining streets
  if (first === null || bettingComplete(room)) {
    if (room.players.filter((p) => p.seat !== null && !p.folded && !p.allIn).length <= 1) {
      // run out board
      while (room.street !== "river" && room.status === "playing") {
        const cur: Street = room.street ?? "preflop";
        const nxt: Street | null =
          cur === "preflop" ? "flop" : cur === "flop" ? "turn" : cur === "turn" ? "river" : null;
        if (!nxt) break;
        room.street = nxt;
        if (nxt === "flop") dealCommunity(room, 3);
        if (nxt === "turn" || nxt === "river") dealCommunity(room, 1);
      }
      showdown(room);
    }
  }
}

function enqueueHandWins(room: Room, result: Winner[]) {
  const queue: StatsQueue = room.statsQueue ?? { handWins: [], tableWin: null };
  for (const w of result) {
    const p = room.players.find((x) => x.seat === w.seat);
    if (!p || p.isBot) continue;
    queue.handWins.push({ id: p.id, nickname: p.nickname, amount: w.amount });
  }
  room.statsQueue = queue;
}

/** After pot awarded: bust zeros → spectate; end table if ≤1 with chips. */
function resolveBustsAndTable(room: Room) {
  for (const p of room.players) {
    if (p.chips > 0) continue;
    p.busted = true;
    p.seat = null;
    p.hole = null;
    p.bet = 0;
    p.folded = true;
    p.allIn = false;
    p.actedThisRound = false;
  }

  const solvent = room.players.filter((p) => p.chips > 0);
  if (solvent.length > 1) return;

  room.tableEnded = true;
  room.championId = solvent[0]?.id ?? null;
  room.autoStartNext = false;
  room.showdownUntil = null;
  const champ = solvent[0];
  if (champ && !champ.isBot) {
    const queue: StatsQueue = room.statsQueue ?? { handWins: [], tableWin: null };
    queue.tableWin = { id: champ.id, nickname: champ.nickname };
    room.statsQueue = queue;
  }
  room.lastAction = champ
    ? `🏆 ${champ.nickname} conquistou a mesa! Quem faliu pode sentar de novo.`
    : "Mesa encerrada — sentem de novo pra outra.";
  // Table over: spectators may rejoin with a fresh stack
  for (const p of room.players) {
    if (p.busted || p.chips <= 0) {
      p.busted = false;
      p.chips = 1000;
    }
  }
}

function awardPotTo(room: Room, winners: Player[], handName: string) {
  const share = Math.floor(room.pot / winners.length);
  let rem = room.pot - share * winners.length;
  const result: Winner[] = [];
  for (const w of winners) {
    const extra = rem > 0 ? 1 : 0;
    rem -= extra;
    const amount = share + extra;
    w.chips += amount;
    result.push({ seat: w.seat!, amount, handName });
  }
  room.pot = 0;
  room.winners = result;
  room.status = "showdown";
  room.actingSeat = null;
  room.turnDeadline = null;
  room.showdownUntil = Date.now() + SHOWDOWN_MS;
  room.lastAction = `Showdown: ${result.map((w) => `assento ${w.seat + 1} +${w.amount}`).join(", ")}`;
  room.lastSeatAction = {
    seat: winners[0].seat!,
    label: `+${result[0].amount}`,
  };
  enqueueHandWins(room, result);
  resolveBustsAndTable(room);
}

function showdown(room: Room) {
  const contenders = room.players.filter((p) => p.seat !== null && !p.folded && p.hole);
  if (contenders.length === 0) {
    room.status = "lobby";
    return;
  }
  if (contenders.length === 1) {
    awardPotTo(room, contenders, "Vitória");
    return;
  }

  const ranked = contenders.map((p) => ({
    player: p,
    hand: bestHand(p.hole!, room.community),
  }));
  ranked.sort((a, b) => compareHands(b.hand, a.hand));
  const best = ranked[0].hand;
  const winners = ranked.filter((r) => compareHands(r.hand, best) === 0).map((r) => r.player);
  awardPotTo(room, winners, best.name);
}

export function createRoom(
  code: string,
  hostId: string,
  hostNickname: string,
  maxSeats: number = SEAT_CAP,
): Room {
  const host: Player = {
    id: hostId,
    nickname: hostNickname,
    seat: 0,
    chips: 1000,
    hole: null,
    bet: 0,
    folded: false,
    allIn: false,
    actedThisRound: false,
    isBot: false,
    botDifficulty: null,
    busted: false,
    emoji: "🙏",
    chipColor: "#f0b429",
    avatarUrl: null,
  };
  return {
    code,
    hostId,
    maxSeats: clampMaxSeats(maxSeats),
    players: [host],
    status: "lobby",
    dealerSeat: 0,
    sbSeat: null,
    bbSeat: null,
    smallBlind: 5,
    bigBlind: 10,
    pot: 0,
    community: [],
    deck: [],
    currentBet: 0,
    minRaise: 10,
    actingSeat: null,
    street: null,
    handNumber: 0,
    winners: null,
    lastAction: "Sala aberta — a paz do Senhor e boa sorte 🙏",
    lastSeatAction: null,
    turnSeconds: defaultTurnSeconds(),
    turnDeadline: null,
    autoStartNext: true,
    showdownUntil: null,
    chat: [],
    blindSchedule: defaultBlindSchedule(),
    tableEnded: false,
    championId: null,
    statsQueue: null,
    updatedAt: Date.now(),
  };
}

export function joinRoom(
  room: Room,
  playerId: string,
  nickname: string,
  style?: { emoji?: string; chipColor?: string; avatarUrl?: string | null },
): Room {
  const existing = room.players.find((p) => p.id === playerId);
  const nick = nickname.slice(0, 16) || "Jogador";
  const emoji = style?.emoji || "🙏";
  const chipColor = style?.chipColor || "#f0b429";
  const avatarUrl =
    typeof style?.avatarUrl === "string" && style.avatarUrl.startsWith("http")
      ? style.avatarUrl
      : null;
  if (existing) {
    existing.nickname = nick;
    existing.emoji = emoji;
    existing.chipColor = chipColor;
    if (avatarUrl) existing.avatarUrl = avatarUrl;
    room.updatedAt = Date.now();
    return room;
  }
  const max = roomMaxSeats(room);
  const claiming = room.players.filter((p) => !p.busted).length;
  if (claiming >= max) throw new Error(`Sala cheia (${max} assentos)`);
  room.players.push({
    id: playerId,
    nickname: nick,
    seat: null,
    chips: 1000,
    hole: null,
    bet: 0,
    folded: false,
    allIn: false,
    actedThisRound: false,
    isBot: false,
    botDifficulty: null,
    busted: false,
    emoji,
    chipColor,
    avatarUrl,
  });
  room.lastAction = `${emoji} ${nick} entrou`;
  room.updatedAt = Date.now();
  return room;
}

export function sitDown(room: Room, playerId: string, seat: number): Room {
  const max = roomMaxSeats(room);
  if (seat < 0 || seat >= max) throw new Error("Assento inválido");
  if (room.status === "playing") throw new Error("Espere o fim da mão");
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Jogador não encontrado");
  if (player.busted) {
    throw new Error("Você faliu — só assiste até alguém conquistar a mesa");
  }
  if (player.chips <= 0) {
    throw new Error("Sem fichas — modo espectador (sem rebuy no meio da mesa)");
  }
  if (room.players.some((p) => p.seat === seat && p.id !== playerId)) {
    throw new Error("Assento ocupado");
  }
  player.seat = seat;
  room.lastAction = `${player.nickname} sentou no assento ${seat + 1}`;
  room.updatedAt = Date.now();
  return room;
}

export function startHand(room: Room, requesterId: string): Room {
  if (requesterId !== room.hostId) throw new Error("Só o anfitrião inicia a mão");
  if (room.status === "playing") throw new Error("Mão em andamento");

  // New table session after a champion — fresh stacks for everyone
  if (room.tableEnded) {
    room.tableEnded = false;
    room.championId = null;
    room.autoStartNext = true;
    for (const p of room.players) {
      p.busted = false;
      p.chips = 1000;
      p.hole = null;
      p.bet = 0;
      p.folded = false;
      p.allIn = false;
      p.actedThisRound = false;
    }
  }

  // Clear showdown → lobby first if needed
  room.status = "lobby";
  room.winners = null;
  room.community = [];
  room.pot = 0;

  const seated = seatedPlayers(room);
  if (seated.length < 2) throw new Error("Precisa de pelo menos 2 jogadores sentados");

  for (const p of room.players) {
    p.hole = null;
    p.bet = 0;
    p.folded = false;
    p.allIn = false;
    p.actedThisRound = false;
  }

  // Count completed hands / bump blinds before posting new blinds
  onHandStarting(room);
  room.handNumber += 1;
  room.dealerSeat =
    nextOccupiedSeat(room, room.dealerSeat, (p) => p.chips > 0) ?? seated[0].seat!;
  room.deck = shuffle(freshDeck());
  room.street = "preflop";
  room.status = "playing";
  room.winners = null;
  room.community = [];
  room.pot = 0;
  resetBets(room);

  const sbSeat =
    seated.length === 2
      ? room.dealerSeat
      : nextOccupiedSeat(room, room.dealerSeat, (p) => p.chips > 0)!;
  const bbSeat = nextOccupiedSeat(room, sbSeat, (p) => p.chips > 0)!;

  room.sbSeat = sbSeat;
  room.bbSeat = bbSeat;
  const sb = playerAt(room, sbSeat)!;
  const bb = playerAt(room, bbSeat)!;
  putChips(sb, room.smallBlind, room);
  putChips(bb, room.bigBlind, room);
  room.currentBet = Math.max(sb.bet, bb.bet);
  room.minRaise = room.bigBlind;
  sb.actedThisRound = false;
  bb.actedThisRound = false;

  for (const p of seatedPlayers(room)) {
    p.hole = [room.deck.pop()!, room.deck.pop()!];
  }

  room.actingSeat =
    nextOccupiedSeat(room, bbSeat, (p) => !p.folded && !p.allIn && p.chips >= 0) ?? bbSeat;
  for (const p of room.players) {
    if (p.seat !== null) p.actedThisRound = false;
  }

  room.showdownUntil = null;
  room.lastSeatAction = null;
  room.lastAction = `Mão #${room.handNumber} — blinds ${room.smallBlind}/${room.bigBlind}`;
  resetTurnClock(room);
  room.updatedAt = Date.now();
  return room;
}

export function applyAction(
  room: Room,
  playerId: string,
  action: PlayerAction,
  amount?: number,
): Room {
  if (room.status !== "playing" || room.actingSeat === null) {
    throw new Error("Nenhuma mão em andamento");
  }
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.seat !== room.actingSeat) {
    throw new Error("Não é sua vez");
  }
  if (player.folded || player.allIn) throw new Error("Você não pode agir");
  if (player.busted || player.chips < 0) throw new Error("Espectador — sem fichas");

  const toCall = room.currentBet - player.bet;

  let seatLabel = "";
  switch (action) {
    case "fold": {
      player.folded = true;
      player.actedThisRound = true;
      room.lastAction = `${player.nickname} desistiu`;
      seatLabel = "Fold";
      break;
    }
    case "check": {
      if (toCall > 0) throw new Error("Não pode dar check");
      player.actedThisRound = true;
      room.lastAction = `${player.nickname} deu check`;
      seatLabel = "Check";
      break;
    }
    case "call": {
      if (toCall <= 0) throw new Error("Nada para pagar");
      putChips(player, toCall, room);
      player.actedThisRound = true;
      room.lastAction = `${player.nickname} pagou ${toCall}`;
      seatLabel = `Call ${toCall}`;
      break;
    }
    case "bet":
    case "raise": {
      const raiseTo = amount ?? 0;
      if (raiseTo < room.currentBet + room.minRaise && raiseTo < player.bet + player.chips) {
        if (raiseTo !== player.bet + player.chips) {
          throw new Error(`Aumento mínimo para ${room.currentBet + room.minRaise}`);
        }
      }
      if (raiseTo <= room.currentBet && action === "raise") {
        throw new Error("Raise deve superar a aposta atual");
      }
      const need = raiseTo - player.bet;
      if (need <= 0) throw new Error("Valor inválido");
      if (need > player.chips) throw new Error("Fichas insuficientes");
      const prev = room.currentBet;
      putChips(player, need, room);
      const newBet = player.bet;
      if (newBet > prev) {
        room.minRaise = Math.max(room.minRaise, newBet - prev);
        room.currentBet = newBet;
        for (const p of room.players) {
          if (p.id !== player.id && !p.folded && !p.allIn) p.actedThisRound = false;
        }
      }
      player.actedThisRound = true;
      const verb = action === "bet" || prev === 0 ? "Bet" : "Raise";
      room.lastAction = `${player.nickname} ${verb === "Bet" ? "apostou" : "aumentou"} para ${newBet}`;
      seatLabel = `${verb} ${newBet}`;
      break;
    }
    default:
      throw new Error("Ação inválida");
  }

  room.lastSeatAction = { seat: player.seat!, label: seatLabel };
  continueAfterFoldOrAction(room, player.seat!);
  return room;
}

/** After a fold/action: award, advance street, or pass turn. */
function continueAfterFoldOrAction(room: Room, fromSeat: number) {
  const remaining = room.players.filter((p) => p.seat !== null && !p.folded);
  if (remaining.length === 1) {
    awardPotTo(room, remaining, "Todos desistiram");
    room.updatedAt = Date.now();
    return;
  }

  if (bettingComplete(room)) {
    advanceStreet(room);
  } else {
    const next = nextActor(room, fromSeat);
    room.actingSeat = next;
    if (next === null) advanceStreet(room);
  }

  if (room.status === "playing") resetTurnClock(room);
  else room.turnDeadline = null;

  room.updatedAt = Date.now();
}

export function updateRoomSettings(
  room: Room,
  requesterId: string,
  patch: {
    turnSeconds?: number;
    autoStartNext?: boolean;
    smallBlind?: number;
    bigBlind?: number;
    blindSchedule?: Partial<BlindSchedule> & { enabled?: boolean };
  },
): Room {
  if (requesterId !== room.hostId) throw new Error("Só o anfitrião altera ajustes");
  if (room.status === "playing") throw new Error("Espere o fim da mão");
  if (patch.turnSeconds !== undefined) {
    const s = Math.floor(patch.turnSeconds);
    if (s < 8 || s > 60) throw new Error("Timer entre 8 e 60s");
    room.turnSeconds = s;
  }
  if (patch.autoStartNext !== undefined) {
    room.autoStartNext = patch.autoStartNext;
  }
  if (patch.smallBlind !== undefined) {
    const sb = Math.floor(patch.smallBlind);
    if (sb < 1 || sb > 50_000) throw new Error("Small blind inválido");
    room.smallBlind = sb;
    room.bigBlind = Math.max(sb * 2, patch.bigBlind ? Math.floor(patch.bigBlind) : sb * 2);
    room.minRaise = room.bigBlind;
  } else if (patch.bigBlind !== undefined) {
    const bb = Math.floor(patch.bigBlind);
    if (bb < 2 || bb > 100_000) throw new Error("Big blind inválido");
    room.bigBlind = bb;
    room.smallBlind = Math.max(1, Math.floor(bb / 2));
    room.minRaise = room.bigBlind;
  }
  if (patch.blindSchedule) {
    const cur = room.blindSchedule ?? defaultBlindSchedule();
    const next = { ...cur, ...patch.blindSchedule };
    if (next.mode !== "time" && next.mode !== "hands") next.mode = "hands";
    next.every = Math.min(120, Math.max(1, Math.floor(next.every || 4)));
    next.multiplier = Math.min(10, Math.max(1.5, Number(next.multiplier) || 2));
    if (patch.blindSchedule.enabled && !cur.enabled) {
      next.level = 0;
      next.handsAtLevel = 0;
      next.levelStartedAt = Date.now();
    }
    if (!next.enabled) {
      next.levelStartedAt = null;
      next.handsAtLevel = 0;
    }
    room.blindSchedule = next;
  }
  room.lastAction = "Ajustes da sala atualizados";
  room.updatedAt = Date.now();
  return room;
}

export function leaveSeat(room: Room, playerId: string): Room {
  if (room.status === "playing") throw new Error("Espere o fim da mão");
  const p = room.players.find((x) => x.id === playerId);
  if (!p) throw new Error("Jogador não encontrado");
  p.seat = null;
  room.lastAction = `${p.nickname} levantou`;
  room.updatedAt = Date.now();
  return room;
}

/**
 * Leave the room entirely (back to lobby).
 * Mid-hand: auto-fold then remove — safe default, no mid-hand sit-out limbo.
 */
export function leaveRoom(room: Room, playerId: string): Room {
  const p = room.players.find((x) => x.id === playerId);
  if (!p) throw new Error("Jogador não encontrado");

  const wasSeat = p.seat;
  const wasActing = room.status === "playing" && room.actingSeat === wasSeat;

  if (room.status === "playing" && wasSeat !== null && !p.folded) {
    p.folded = true;
    p.actedThisRound = true;
    room.lastSeatAction = { seat: wasSeat, label: "Saiu" };
    room.lastAction = `${p.nickname} saiu da mesa (fold)`;
    if (wasActing || room.players.filter((x) => x.seat !== null && !x.folded).length <= 1) {
      continueAfterFoldOrAction(room, wasSeat);
    } else if (bettingComplete(room)) {
      advanceStreet(room);
      if (room.status === "playing") resetTurnClock(room);
    }
  } else {
    room.lastAction = `${p.nickname} saiu da mesa`;
  }

  room.players = room.players.filter((x) => x.id !== playerId);

  if (room.hostId === playerId) {
    const nextHost =
      room.players.find((x) => !x.isBot) ?? room.players.find((x) => x.seat !== null) ?? room.players[0];
    room.hostId = nextHost?.id ?? "";
    if (nextHost) {
      room.lastAction = `${p.nickname} saiu · ${nextHost.nickname} é o anfitrião`;
    }
  }

  // Clear acting seat if it pointed at the leaver
  if (room.actingSeat === wasSeat) {
    room.actingSeat =
      room.status === "playing" ? nextActor(room, wasSeat ?? 0) : null;
    if (room.status === "playing") resetTurnClock(room);
  }

  room.updatedAt = Date.now();
  return room;
}
