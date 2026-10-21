import Link from "next/link";
import { AuthBar } from "@/components/AuthBar";
import { ChampionsBoard } from "@/components/ChampionsBoard";

export default function CampeoesPage() {
  return (
    <main className="pf-shell">
      <div className="pf-frame pf-frame--wide">
        <div className="pf-row pf-row--start">
          <div className="min-w-0">
            <Link href="/" className="pf-navlink">
              ← Poker Friends
            </Link>
            <h1 className="pf-title pf-title--page">Campeões</h1>
            <p className="pf-lead">
              Quadro de honra da galera — fichas, mãos e mesas conquistadas. Glória ao
              Senhor e ao nuts 🙏
            </p>
          </div>
          <AuthBar />
        </div>
        <ChampionsBoard />
      </div>
    </main>
  );
}
