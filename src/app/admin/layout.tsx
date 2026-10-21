import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  return (
    <div className="pf-shell">
      <header className="pf-topbar">
        <div className="min-w-0">
          <p className="pf-title pf-title--bar">Poker Friends</p>
          <p className="pf-kicker">Admin · {admin.email}</p>
        </div>
        <nav className="pf-topbar__nav">
          <Link href="/admin" className="pf-navlink">
            Salas
          </Link>
          <Link href="/" className="pf-navlink">
            Início
          </Link>
        </nav>
      </header>
      <main className="pf-frame pf-frame--wide">{children}</main>
    </div>
  );
}
