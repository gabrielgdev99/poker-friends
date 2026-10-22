"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { TableView } from "@/components/TableView";

export default function SalaPage() {
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();

  useEffect(() => {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (type: "landscape") => Promise<void>;
    };
    if (!orientation?.lock) return;
    void orientation.lock("landscape").catch(() => {});
    return () => {
      try {
        orientation.unlock();
      } catch {
        /* the browser never locked */
      }
    };
  }, []);

  if (!code) return null;
  return (
    <div className="table-page min-h-dvh overflow-x-hidden bg-[#070a08]">
      <div className="table-rotate" role="alertdialog" aria-label="Gire o celular">
        <strong>Vira o celular</strong>
        <p>A mesa só abre deitada.</p>
      </div>
      <TableView code={code} />
    </div>
  );
}
