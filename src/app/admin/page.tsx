import { AdminRooms } from "@/components/AdminRooms";
import { storeMode } from "@/lib/store";

export default function AdminPage() {
  return (
    <div className="pf-stack">
      <div>
        <h1 className="pf-title pf-title--page">Salas ativas</h1>
        <p className="pf-lead">
          Store: {storeMode()} · feche salas vazias ou travadas · expulse jogadores
          fora de mão.
        </p>
      </div>
      <AdminRooms />
    </div>
  );
}
