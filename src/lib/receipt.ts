import "server-only";
import { createHash } from "node:crypto";

/*
 * מסמך הקבלה שנחתם. נבנה בסדר שדות קבוע (JSON קנוני) כדי שה-Hash יהיה ניתן לשחזור:
 * כל שינוי בדיעבד במסמך השמור ישנה את ה-SHA-256 ויתגלה באימות.
 */
export const RECEIPT_TERMS =
  "אני מאשר/ת כי קיבלתי לידי את הציוד המפורט לעיל במצב תקין, כי הוא באחריותי האישית, " +
  "וכי אחזיר אותו למרלו\"ג בסיום השימוש או לפי דרישה. ידוע לי כי אובדן או נזק יטופלו לפי נהלי הארגון.";

export type ReceiptDoc = {
  type: "RECEIPT";
  version: 1;
  requestId: string;
  signedAt: string; // ISO
  employee: { id: string; fullName: string; employeeNumber: string; unit: string };
  issuedBy: string;
  items: { sku: string; name: string; serialNumber: string | null; quantity: number }[];
  terms: string;
};

export function canonicalJson(doc: ReceiptDoc) {
  // בניה מפורשת בסדר קבוע – לא תלוי בסדר המפתחות של האובייקט שהתקבל
  return JSON.stringify({
    type: doc.type,
    version: doc.version,
    requestId: doc.requestId,
    signedAt: doc.signedAt,
    employee: { id: doc.employee.id, fullName: doc.employee.fullName, employeeNumber: doc.employee.employeeNumber, unit: doc.employee.unit },
    issuedBy: doc.issuedBy,
    items: doc.items.map((i) => ({ sku: i.sku, name: i.name, serialNumber: i.serialNumber, quantity: i.quantity })),
    terms: doc.terms,
  });
}

export function sha256(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** אימות: ה-Hash השמור תואם לתוכן המסמך השמור */
export function verifyReceipt(documentJson: string, documentHash: string) {
  try {
    const doc = JSON.parse(documentJson) as ReceiptDoc;
    return sha256(canonicalJson(doc)) === documentHash;
  } catch {
    return false;
  }
}

/** בדיקת תמונת חתימה: PNG ב-Base64, גודל סביר */
export function validateSignatureImage(dataUrl: string) {
  if (!dataUrl) return "יש לחתום בתיבת החתימה";
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) return "פורמט חתימה לא תקין";
  const b64 = dataUrl.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return "פורמט חתימה לא תקין";
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes < 800) return "החתימה ריקה או קצרה מדי – יש לחתום שוב";
  if (bytes > 300_000) return "קובץ החתימה גדול מדי";
  // חתימת PNG: 89 50 4E 47
  const head = Buffer.from(b64.slice(0, 12), "base64");
  if (!(head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)) return "פורמט חתימה לא תקין";
  return null;
}
