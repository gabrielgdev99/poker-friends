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

/** Bot skill — Iniciante / Médio / Difícil. */
export type BotDifficulty = "easy" | "medium" | "hard";

export type FeltAccent = "olive" | "wine" | "navy" | "amber";

export type UserProfile = {
  nickname: string;
  emoji: string;
  chipColor: string;
  feltAccent: FeltAccent;
};

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
  isBot: boolean;
  /** Set when isBot — affects fold/raise heuristics. */
  botDifficulty: BotDifficulty | null;
  /** Busted this table — spectate only until the table ends. */
  busted: boolean;
  /** Fun avatar emoji (from profile / guest). */
  emoji: string;
  /** Chip / seat accent color hex. */
  chipColor: string;
  /** Google profile image URL when available; null for guests/bots. */
  avatarUrl: string | null;
};

export type StatsQueue = {
  handWins: { id: string; nickname: string; amount: number }[];
  tableWin: { id: string; nickname: string } | null;
};

export type Winner = {
  seat: number;
  amount: number;
  handName: string;
};

export type SeatAction = {
  seat: number;
  label: string;
};

export type ChatMessage = {
  id: string;
  at: number;
  playerId: string;
  nickname: string;
  text: string;
  kind: "text" | "emoji";
};

export type BlindSchedule = {
  enabled: boolean;
  /** Increase by wall-clock minutes or by completed hands. */
  mode: "time" | "hands";
  /** Every N minutes (time) or N hands (hands). */
  every: number;
  /** Multiply SB each level (BB = 2× SB). Default 2. */
  multiplier: number;
  level: number;
  levelStartedAt: number | null;
  handsAtLevel: number;
};

export type Room = {
  code: string;
  hostId: string;
  /** Max occupied seats (2–10). Host picks on create. */
  maxSeats: number;
  players: Player[];
  status: "lobby" | "playing" | "showdown";
  dealerSeat: number;
  sbSeat: number | null;
  bbSeat: number | null;
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
  lastSeatAction: SeatAction | null;
  /** Seconds per human decision (default 18). */
  turnSeconds: number;
  /** Epoch ms when current actor must act. */
  turnDeadline: number | null;
  /** Host: auto-start next hand after showdown. */
  autoStartNext: boolean;
  /** Epoch ms when showdown reveal ends (for auto-start). */
  showdownUntil: number | null;
  /** In-room chat (short history). */
  chat: ChatMessage[];
  blindSchedule: BlindSchedule;
  /** True when ≤1 player still has chips — table session over. */
  tableEnded: boolean;
  championId: string | null;
  /** Flushed to Redis leaderboards on save; not for clients. */
  statsQueue: StatsQueue | null;
  updatedAt: number;
};

/** Public view: hole cards hidden except for viewer / showdown. */
export type PublicPlayer = Omit<Player, "hole"> & {
  hole: Card[] | null;
  holeCount: number;
};

export type PublicRoom = Omit<Room, "deck" | "players" | "statsQueue"> & {
  players: PublicPlayer[];
  /** Server time for client timer sync. */
  serverNow: number;
  /** Viewer-only hand strength / draw hint. */
  myHandHint: string | null;
  /** Next level blinds if schedule enabled (preview). */
  nextSmallBlind: number;
  nextBigBlind: number;
  /** e.g. "em 2 mãos" / "em ~5 min" */
  blindsProgress: string | null;
};
