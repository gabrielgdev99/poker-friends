import { NextResponse } from "next/server";
import {
  BUY_IN,
  DAILY_CLAIM,
  GUEST_STACK,
  STARTING_BANK,
  canClaimDaily,
  claimDaily,
  ensureBank,
} from "@/lib/bank";
import { requireUser } from "@/lib/require-user";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (user.isGuest) {
    return NextResponse.json({
      isGuest: true,
      balance: null,
      buyIn: GUEST_STACK,
      dailyClaim: null,
      startingBank: null,
      note: "Convidado: fichas locais no navegador (localStorage). Stack na mesa = 1000.",
      canClaim: false,
    });
  }
  const bank = await ensureBank(user.id);
  return NextResponse.json({
    isGuest: false,
    balance: bank.balance,
    lastClaimAt: bank.lastClaimAt,
    canClaim: canClaimDaily(bank),
    buyIn: BUY_IN,
    dailyClaim: DAILY_CLAIM,
    startingBank: STARTING_BANK,
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (user.isGuest) {
    return NextResponse.json(
      { error: "Recarga diária só pra conta Google. Convidado usa fichas locais." },
      { status: 400 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "claim") {
    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  }
  const result = await claimDaily(user.id);
  if (!result.claimed) {
    const hours = Math.ceil(result.nextInMs / 3_600_000);
    return NextResponse.json(
      {
        error: `Recarga já usada. Volta em ~${hours}h.`,
        bank: result.bank,
        claimed: false,
      },
      { status: 400 },
    );
  }
  return NextResponse.json({
    claimed: true,
    added: DAILY_CLAIM,
    balance: result.bank.balance,
    bank: result.bank,
  });
}
