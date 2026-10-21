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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0d3d28_0%,#04150f_55%)] text-amber-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-800/40 px-4 py-4 sm:px-8">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl text-amber-300">
            Poker Friends
          </p>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/50">
            Admin · {admin.email}
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin" className="text-amber-200 hover:text-amber-100">
            Salas
          </Link>
          <Link href="/" className="text-emerald-200/60 hover:text-amber-200">
            Início
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
