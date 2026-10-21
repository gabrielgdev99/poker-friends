"use client";

import { useParams } from "next/navigation";
import { TableView } from "@/components/TableView";

export default function SalaPage() {
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();
  if (!code) return null;
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_center,#0d3d28_0%,#04150f_70%)]">
      <TableView code={code} />
    </div>
  );
}
