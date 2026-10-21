import { AdminRooms } from "@/components/AdminRooms";
import { storeMode } from "@/lib/store";

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-amber-300 sm:text-4xl">
          Salas ativas
        </h1>
        <p className="mt-2 text-sm text-emerald-100/60">
          Store: {storeMode()} · feche salas vazias ou travadas · expulse jogadores
          fora de mão.
        </p>
      </div>
      <AdminRooms />
    </div>
  );
}
