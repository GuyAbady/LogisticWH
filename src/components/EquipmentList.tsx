import { Hash, Package } from "lucide-react";
import type { getUserEquipment } from "@/lib/queries";
import { EmptyState, SerialBadge, fmtDate } from "./ui";

type Equipment = Awaited<ReturnType<typeof getUserEquipment>>;

export default function EquipmentList({ data }: { data: Equipment }) {
  const { serials, holdings } = data;
  if (!serials.length && !holdings.length) return <EmptyState text="אין ציוד חתום" />;
  return (
    <div className="space-y-6">
      {serials.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Hash className="size-4" /> פריטים סידוריים ({serials.length})</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {serials.map((s) => (
              <li key={s.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{s.catalogItem.name}</p>
                  <SerialBadge status={s.status} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-sm text-slate-600">
                  <dt>מק&quot;ט</dt><dd className="ltr font-mono">{s.catalogItem.sku}</dd>
                  <dt>מספר סידורי</dt><dd className="ltr font-mono">{s.serialNumber}</dd>
                  <dt>תאריך חתימה</dt><dd>{s.transactions[0] ? fmtDate(s.transactions[0].createdAt) : "—"}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}
      {holdings.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Package className="size-4" /> פריטים כמותיים ({holdings.length})</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {holdings.map((h) => (
              <li key={h.id} className="card flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{h.catalogItem.name}</p>
                  <p className="ltr text-right font-mono text-sm text-slate-600">{h.catalogItem.sku}</p>
                  {h.pendingAckQty > 0 && (
                    <p className="mt-1 text-xs text-orange-700">{h.pendingAckQty} ממתינים לאישורך</p>
                  )}
                </div>
                <span className="text-2xl font-bold">{h.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
