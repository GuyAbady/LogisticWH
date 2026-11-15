import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import type { AssignmentRow } from "@/lib/reports";
import { TX_LABELS } from "@/lib/reports";
import { EmptyState, fmtDate, fmtDateTime } from "./ui";

/** כפתור הורדת Excel – קישור רגיל לנתיב הייצוא (ההרשאה נבדקת בשרת) */
export function ExportButton({ report, id, label = "ייצוא ל-Excel" }: { report: string; id?: string; label?: string }) {
  const href = `/api/export/${report}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
  return (
    <a href={href} className="btn-secondary" download>
      <FileSpreadsheet className="size-4 text-emerald-700" /> {label}
    </a>
  );
}

type Cols = { user?: boolean; unit?: boolean; item?: boolean };

/** טבלת ציוד משויך. בנייד מוצגת גלילה אופקית בתוך הכרטיס בלבד. */
export function AssignmentTable({ rows, show = { user: true, unit: true, item: true } }: { rows: AssignmentRow[]; show?: Cols }) {
  if (!rows.length) return <EmptyState text="אין ציוד משויך" />;
  return (
    <div className="overflow-x-auto">
      <table className="table-base min-w-[640px]">
        <thead className="text-right text-slate-500">
          <tr className="border-b border-slate-200">
            {show.unit && <th className="py-2">יחידה</th>}
            {show.user && <th>עובד</th>}
            {show.item && <th>פריט</th>}
            <th>מספר סידורי</th>
            <th>כמות</th>
            <th>סטטוס</th>
            <th>נחתם</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.serialId ?? r.catalogItemId}-${r.userId}`} className="border-b border-slate-100">
              {show.unit && (
                <td className="py-2"><Link className="link" href={`/warehouse/lookup/unit/${r.unitId}`}>{r.unitName}</Link></td>
              )}
              {show.user && (
                <td className="py-2">
                  <Link className="link" href={`/warehouse/lookup/user/${r.userId}`}>{r.userName}</Link>
                  <span className="mr-1 text-xs text-slate-500">({r.employeeNumber})</span>
                </td>
              )}
              {show.item && (
                <td className="py-2">
                  <Link className="link" href={`/warehouse/inventory/${r.catalogItemId}`}>{r.itemName}</Link>
                  <span className="ltr mr-1 inline-block font-mono text-xs text-slate-500">{r.sku}</span>
                </td>
              )}
              <td className="py-2">
                {r.serialId ? (
                  <Link className="ltr inline-block font-mono link" href={`/warehouse/lookup/serial/${r.serialId}`}>{r.serialNumber}</Link>
                ) : "—"}
              </td>
              <td>{r.quantity}</td>
              <td>{r.status}</td>
              <td className="text-slate-600">{r.signedAt ? fmtDate(r.signedAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type HistoryItem = {
  id: string;
  type: keyof typeof TX_LABELS;
  createdAt: Date;
  quantity: number;
  note: string | null;
  catalogItem: { sku: string; name: string };
  serial: { serialNumber: string } | null;
  fromUser: { fullName: string } | null;
  toUser: { fullName: string } | null;
  performedBy: { fullName: string };
};

export function HistoryList({ items, showItem = true }: { items: HistoryItem[]; showItem?: boolean }) {
  if (!items.length) return <EmptyState text="אין תנועות" />;
  return (
    <ol className="divide-y divide-slate-100 text-sm">
      {items.map((t) => (
        <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
          <div>
            <span className="font-bold">{TX_LABELS[t.type]}</span>
            {showItem && <> · {t.catalogItem.name}</>}
            {t.serial && <span className="ltr mx-1 inline-block font-mono text-xs">{t.serial.serialNumber}</span>}
            {!t.serial && <> · כמות {t.quantity}</>}
            <span className="text-slate-600"> · {t.fromUser?.fullName ?? "מחסן"} ← {t.toUser?.fullName ?? "מחסן"}</span>
            {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
          </div>
          <span className="shrink-0 text-xs text-slate-500">
            {fmtDateTime(t.createdAt)} · {t.performedBy.fullName}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** טופס חיפוש GET – עובד ללא JavaScript */
export function SearchBox({ action, defaultValue, placeholder }: { action: string; defaultValue?: string; placeholder: string }) {
  return (
    <form action={action} className="flex gap-2">
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} className="input" minLength={2} autoComplete="off" />
      <button className="btn-primary shrink-0">חיפוש</button>
    </form>
  );
}
