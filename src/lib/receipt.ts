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

// ───────── מסמכים נוספים (שלב 4) ─────────
// מבנה כללי לטופסי זיכוי, חלוקה/איסוף מרוכזים ואישור עובד. RECEIPT נשאר במבנה המקורי
// כדי שקבלות קיימות ימשיכו לעבור אימות.

export type DocType = "RETURN" | "BULK_TRANSFER" | "BULK_COLLECT" | "ACK";

export const DOC_TITLES: Record<DocType | "RECEIPT", string> = {
  RECEIPT: "קבלה דיגיטלית על קבלת ציוד",
  RETURN: "טופס אישור החזרת ציוד (זיכוי)",
  BULK_TRANSFER: "החתמה מרוכזת – חלוקת ציוד ע\"י מנהל היחידה",
  BULK_COLLECT: "זיכוי מרוכז – איסוף ציוד ע\"י מנהל היחידה",
  ACK: "אישור עובד לקבלת ציוד שחולק ע\"י מנהל היחידה",
};

export const DOC_TERMS: Record<DocType, string> = {
  RETURN: "המרלו\"ג מאשר כי הציוד המפורט לעיל הוחזר ונקלט במלאי, והעובד זוכה מאחריותו לציוד זה.",
  BULK_TRANSFER:
    "מנהל היחידה מאשר כי חילק את הציוד המפורט לעובדים הרשומים. עד לאישור כל עובד, האחריות לציוד נשארת על מנהל היחידה.",
  BULK_COLLECT: "מנהל היחידה מאשר כי אסף מהעובדים את הציוד המפורט והוא באחריותו. העובדים זוכו מאחריותם לציוד זה.",
  ACK: "אני מאשר/ת כי קיבלתי לידי את הציוד המפורט לעיל ממנהל היחידה, וכי מעתה הוא באחריותי האישית.",
};

export type DocLine = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sku: string;
  name: string;
  serialNumber: string | null;
  quantity: number;
  condition: string | null;
};

export type GenericDoc = {
  type: DocType;
  version: 1;
  signedAt: string;
  signer: { id: string; fullName: string; role: string };
  unit: string | null;
  lines: DocLine[];
  reference: string | null;
  terms: string;
};

export function canonicalGeneric(doc: GenericDoc) {
  return JSON.stringify({
    type: doc.type,
    version: doc.version,
    signedAt: doc.signedAt,
    signer: { id: doc.signer.id, fullName: doc.signer.fullName, role: doc.signer.role },
    unit: doc.unit,
    lines: doc.lines.map((l) => ({
      employeeId: l.employeeId, employeeName: l.employeeName, employeeNumber: l.employeeNumber,
      sku: l.sku, name: l.name, serialNumber: l.serialNumber, quantity: l.quantity, condition: l.condition,
    })),
    reference: doc.reference,
    terms: doc.terms,
  });
}

/** אימות לכל סוגי המסמכים */
export function verifyDocument(documentJson: string, documentHash: string) {
  try {
    const doc = JSON.parse(documentJson) as { type: string };
    if (doc.type === "RECEIPT") return verifyReceipt(documentJson, documentHash);
    return sha256(canonicalGeneric(doc as GenericDoc)) === documentHash;
  } catch {
    return false;
  }
}
