"use client";

import { useParams } from "next/navigation";
import { TableView } from "@/components/TableView";

export default function SalaPage() {
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();
  if (!code) return null;
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#070a08]">
      <TableView code={code} />
    </div>
  );
}
