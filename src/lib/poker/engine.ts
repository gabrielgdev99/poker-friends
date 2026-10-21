import { freshDeck, shuffle } from "@/lib/poker/cards";
import { bestHand, compareHands } from "@/lib/poker/hand-eval";
import type { Player, PlayerAction, Room, Street, Winner } from "@/lib/types";

const MAX_SEATS = 10;

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
  for (let i = 1; i <= MAX_SEATS; i++) {
    const seat = (from + i) % MAX_SEATS;
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
  room.lastAction = `Showdown: ${result.map((w) => `assento ${w.seat + 1} +${w.amount}`).join(", ")}`;
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

export function createRoom(code: string, hostId: string, hostNickname: string): Room {
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
  };
  return {
    code,
    hostId,
    players: [host],
    status: "lobby",
    dealerSeat: 0,
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
    lastAction: "Sala criada",
    updatedAt: Date.now(),
  };
}

export function joinRoom(room: Room, playerId: string, nickname: string): Room {
  const existing = room.players.find((p) => p.id === playerId);
  const nick = nickname.slice(0, 16) || "Jogador";
  if (existing) {
    existing.nickname = nick;
    room.updatedAt = Date.now();
    return room;
  }
  if (room.players.length >= MAX_SEATS) throw new Error("Sala cheia");
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
  });
  room.lastAction = `${nick} entrou`;
  room.updatedAt = Date.now();
  return room;
}

export function sitDown(room: Room, playerId: string, seat: number): Room {
  if (seat < 0 || seat >= MAX_SEATS) throw new Error("Assento inválido");
  if (room.status === "playing") throw new Error("Espere o fim da mão");
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Jogador não encontrado");
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
  // UTG must act; mark blinds as not fully acted if facing raise later
  const actor = playerAt(room, room.actingSeat);
  if (actor) {
    // blinds already posted; they still need to act if raised
    for (const p of room.players) {
      if (p.seat === sbSeat || p.seat === bbSeat) p.actedThisRound = false;
      else if (p.seat !== null) p.actedThisRound = false;
    }
  }

  room.lastAction = `Mão #${room.handNumber} — blinds ${room.smallBlind}/${room.bigBlind}`;
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

  const toCall = room.currentBet - player.bet;

  switch (action) {
    case "fold": {
      player.folded = true;
      player.actedThisRound = true;
      room.lastAction = `${player.nickname} desistiu`;
      break;
    }
    case "check": {
      if (toCall > 0) throw new Error("Não pode dar check");
      player.actedThisRound = true;
      room.lastAction = `${player.nickname} deu check`;
      break;
    }
    case "call": {
      if (toCall <= 0) throw new Error("Nada para pagar");
      putChips(player, toCall, room);
      player.actedThisRound = true;
      room.lastAction = `${player.nickname} pagou ${toCall}`;
      break;
    }
    case "bet":
    case "raise": {
      const raiseTo = amount ?? 0;
      if (raiseTo < room.currentBet + room.minRaise && raiseTo < player.bet + player.chips) {
        // allow all-in short
        if (raiseTo !== player.bet + player.chips) {
          throw new Error(`Aumento mínimo para ${room.currentBet + room.minRaise}`);
        }
      }
      if (raiseTo <= room.currentBet && action === "raise") {
        throw new Error("Raise deve superar a aposta atual");
      }
      if (room.currentBet === 0 && action === "raise") {
        // treat as bet
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
      room.lastAction = `${player.nickname} ${action === "bet" ? "apostou" : "aumentou"} para ${newBet}`;
      break;
    }
    default:
      throw new Error("Ação inválida");
  }

  // Everyone folded?
  const remaining = room.players.filter((p) => p.seat !== null && !p.folded);
  if (remaining.length === 1) {
    awardPotTo(room, remaining, "Todos desistiram");
    room.updatedAt = Date.now();
    return room;
  }

  if (bettingComplete(room)) {
    advanceStreet(room);
  } else {
    const next = nextActor(room, player.seat!);
    room.actingSeat = next;
    if (next === null) advanceStreet(room);
  }

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
