export type Suit = "s" | "h" | "d" | "c";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";

export type Card = { rank: Rank; suit: Suit };

export type Street = "preflop" | "flop" | "turn" | "river";

export type PlayerAction = "fold" | "check" | "call" | "bet" | "raise";

export type Player = {
  id: string;
  nickname: string;
  seat: number | null;
  chips: number;
  hole: Card[] | null;
  bet: number;
  folded: boolean;
  allIn: boolean;
  actedThisRound: boolean;
};

export type Winner = {
  seat: number;
  amount: number;
  handName: string;
};

export type Room = {
  code: string;
  hostId: string;
  players: Player[];
  status: "lobby" | "playing" | "showdown";
  dealerSeat: number;
  smallBlind: number;
  bigBlind: number;
  pot: number;
  community: Card[];
  deck: Card[];
  currentBet: number;
  minRaise: number;
  actingSeat: number | null;
  street: Street | null;
  handNumber: number;
  winners: Winner[] | null;
  lastAction: string | null;
  updatedAt: number;
};

/** Public view: hole cards hidden except for viewer / showdown. */
export type PublicPlayer = Omit<Player, "hole"> & {
  hole: Card[] | null;
  holeCount: number;
};

export type PublicRoom = Omit<Room, "deck" | "players"> & {
  players: PublicPlayer[];
};
