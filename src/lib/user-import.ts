import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { z } from "zod";
import { db } from "./db";
import { PasswordSchema } from "./password";
import type { Role } from "@/generated/prisma/enums";

/*
 * טעינת עובדים מאקסל.
 * - תבנית: גיליון "עובדים" (כותרות + אימות נתונים לתפקיד וליחידה), גיליון "הוראות", גיליון "יחידות".
 * - קריאה לפי שם כותרת (לא לפי מיקום), כך שסדר עמודות שונה לא שובר את הטעינה.
 * - שני שלבים: בדיקה (ללא כתיבה) → טעינה (באותו קובץ, מחושב מחדש בשרת – לא סומכים על תוצאת הבדיקה מהלקוח).
 * - התאמה לפי מספר עובד: קיים → עדכון; חדש → יצירה. תפקיד מנהל מערכת אינו נטען מאקסל (מניעת הסלמת הרשאות).
 */

export const MAX_FILE_BYTES = 900 * 1024; // מתחת למגבלת 1MB של Server Actions (תיעוד Next.js: serverActions.bodySizeLimit)
// 300 שורות: bcrypt (10 סבבים, ~87ms לגיבוב ב-bcryptjs) × 300 ≈ 26 שניות – בתוך מגבלת זמן הפונקציה ב-Vercel
export const MAX_ROWS = 300;

const COLS = {
  employeeNumber: "מספר עובד",
  fullName: "שם מלא",
  email: 'דוא"ל',
  phone: "טלפון נייד",
  unit: "יחידה",
  role: "תפקיד",
  password: "סיסמה ראשונית",
} as const;
type ColKey = keyof typeof COLS;
const REQUIRED: ColKey[] = ["employeeNumber", "fullName", "email", "phone", "unit"];

const ROLE_BY_LABEL: Record<string, Exclude<Role, "ADMIN">> = {
  "עובד": "EMPLOYEE", "עובד יחידה": "EMPLOYEE", EMPLOYEE: "EMPLOYEE",
  "מנהל יחידה": "UNIT_MANAGER", UNIT_MANAGER: "UNIT_MANAGER",
  'מנהל מרלו"ג': "WAREHOUSE_MANAGER", "מנהל מרלוג": "WAREHOUSE_MANAGER", "מחסנאי": "WAREHOUSE_MANAGER", WAREHOUSE_MANAGER: "WAREHOUSE_MANAGER",
};
const ROLE_OPTIONS = ["עובד", "מנהל יחידה", 'מנהל מרלו"ג'];

const FONT = { name: "Arial", size: 11 };

// ───────── תבנית ─────────

export async function buildUserTemplate() {
  const units = await db.unit.findMany({ orderBy: { name: "asc" }, select: { name: true, code: true } });
  const wb = new ExcelJS.Workbook();
  wb.creator = "LogisticWH";

  // גיליון ההוראות נוצר ראשון – הוא הלשונית הראשונה שנפתחת
  const ins = wb.addWorksheet("הוראות", { views: [{ rightToLeft: true }] });
  ins.getColumn(1).width = 100;
  const lines = [
    "הוראות לטעינת עובדים – LogisticWH",
    "",
    "1. מלאו שורה לכל עובד בגיליון \"עובדים\". עמודות המסומנות * הן חובה.",
    "2. מספר עובד – מזהה ייחודי. עובד קיים עם אותו מספר יעודכן (שם, דוא\"ל, טלפון, יחידה, תפקיד).",
    "3. יחידה – שם או קוד של יחידה קיימת (רשימה בגיליון \"יחידות\"). יחידה חדשה תיווצר רק אם תסמנו זאת בטעינה.",
    `4. תפקיד – ${ROLE_OPTIONS.join(" / ")}. ריק = עובד. תפקיד מנהל מערכת אינו נטען מקובץ.`,
    "5. סיסמה ראשונית – רשות. 10 תווים לפחות, כולל אות באנגלית וספרה. ריק = תיווצר סיסמה אקראית ותוצג פעם אחת בסיום הטעינה.",
    "   לעובד קיים הסיסמה אינה משתנה.",
    "6. בטעינה: \"בדיקה\" מציגה מה יקרה לכל שורה בלי לשמור דבר; \"טעינה\" מבצעת בפועל.",
    `7. עד ${MAX_ROWS} שורות, קובץ ‎.xlsx עד 900KB.`,
    "",
    "דוגמה לשורה: 4001 | ישראל ישראלי | israel@example.com | 050-1234567 | מערכות מידע | עובד |",
  ];
  lines.forEach((t, i) => {
    const c = ins.getCell(`A${i + 1}`);
    c.value = t;
    c.font = i === 0 ? { ...FONT, size: 14, bold: true } : FONT;
    c.alignment = { horizontal: "right", readingOrder: "rtl", wrapText: true };
  });
  const ws = wb.addWorksheet("עובדים", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  const headers: [ColKey, number][] = [["employeeNumber", 14], ["fullName", 22], ["email", 28], ["phone", 16], ["unit", 22], ["role", 16], ["password", 18]];
  ws.columns = headers.map(([k, w]) => ({
    header: REQUIRED.includes(k) ? `${COLS[k]} *` : COLS[k],
    key: k,
    width: w,
    // מספר עובד וטלפון כטקסט – אחרת אקסל מוחק אפס מוביל (050… → 50…)
    style: { font: FONT, alignment: { horizontal: "right", readingOrder: "rtl" }, ...(k === "employeeNumber" || k === "phone" ? { numFmt: "@" } : {}) },
  }));
  const h = ws.getRow(1);
  h.font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  h.height = 22;

  // גיליון יחידות – מקור לרשימה הנפתחת
  const us = wb.addWorksheet("יחידות", { views: [{ rightToLeft: true }] });
  us.columns = [{ header: "שם יחידה", key: "name", width: 26, style: { font: FONT } }, { header: "קוד", key: "code", width: 12, style: { font: FONT } }];
  units.forEach((u) => us.addRow(u));
  us.getRow(1).font = { ...FONT, bold: true };

  for (let r = 2; r <= MAX_ROWS + 1; r++) {
    ws.getCell(`F${r}`).dataValidation = {
      type: "list", allowBlank: true, formulae: [`"${ROLE_OPTIONS.join(",")}"`],
      showErrorMessage: true, errorTitle: "תפקיד לא תקין", error: `יש לבחור: ${ROLE_OPTIONS.join(" / ")}`,
    };
    if (units.length) {
      ws.getCell(`E${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [`'יחידות'!$A$2:$A$${units.length + 1}`],
        // יחידה חדשה מותרת (תיווצר אם מסמנים "צור יחידות חסרות") – לכן אזהרה ולא חסימה
        showErrorMessage: true, errorStyle: "warning", errorTitle: "יחידה לא קיימת", error: "היחידה אינה ברשימה. ניתן להמשיך – היא תיווצר רק אם תסמנו 'צור יחידות חסרות' בטעינה.",
      };
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ───────── קריאה ובדיקה ─────────

export type RowResult = {
  row: number;
  employeeNumber: string;
  fullName: string;
  unit: string;
  role: string;
  status: "new" | "update" | "unchanged" | "error";
  messages: string[];
  newUnit?: boolean;
};

export type ImportPlan = {
  rows: RowResult[];
  newUnits: string[];
  counts: { new: number; update: number; unchanged: number; error: number };
  fatal?: string;
};

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text.trim(); // היפר-קישור
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue); // נוסחה
  }
  return String(v).trim();
}

const RowSchema = z.object({
  employeeNumber: z.string().min(1, "חסר מספר עובד").max(20, "מספר עובד ארוך מדי"),
  fullName: z.string().min(2, "שם מלא קצר מדי").max(80),
  email: z.string().toLowerCase().email('דוא"ל לא תקין'),
  phone: z.string().regex(/^[0-9+\-\s]{9,15}$/, "טלפון לא תקין"),
  unit: z.string().min(1, "חסרה יחידה"),
});

type ParsedRow = { row: number; data: Record<ColKey, string> };

async function readRows(buffer: ArrayBuffer): Promise<{ rows: ParsedRow[]; fatal?: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { rows: [], fatal: "לא ניתן לקרוא את הקובץ. יש להעלות קובץ Excel בפורמט ‎.xlsx" };
  }
  const ws = wb.getWorksheet("עובדים") ?? wb.worksheets.find((w) => w.name !== "הוראות" && w.name !== "יחידות");
  if (!ws) return { rows: [], fatal: 'לא נמצא גיליון "עובדים"' };

  // מיפוי עמודות לפי כותרת
  const colIndex: Partial<Record<ColKey, number>> = {};
  ws.getRow(1).eachCell((cell, col) => {
    const t = cellText(cell.value).replace(/\*/g, "").trim();
    const key = (Object.keys(COLS) as ColKey[]).find((k) => COLS[k] === t);
    if (key) colIndex[key] = col;
  });
  const missing = REQUIRED.filter((k) => !colIndex[k]);
  if (missing.length) return { rows: [], fatal: `חסרות עמודות חובה: ${missing.map((k) => COLS[k]).join(", ")}. מומלץ להוריד את התבנית מחדש.` };

  const rows: ParsedRow[] = [];
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return;
    const data = Object.fromEntries((Object.keys(COLS) as ColKey[]).map((k) => [k, colIndex[k] ? cellText(r.getCell(colIndex[k]!).value) : ""])) as Record<ColKey, string>;
    if (Object.values(data).every((v) => !v)) return;
    // טלפון שנשמר כמספר איבד את האפס המוביל
    if (/^5\d{8}$/.test(data.phone)) data.phone = "0" + data.phone;
    rows.push({ row: n, data });
  });
  if (rows.length === 0) return { rows, fatal: "הקובץ אינו מכיל שורות עובדים" };
  if (rows.length > MAX_ROWS) return { rows: [], fatal: `יותר מ-${MAX_ROWS} שורות בקובץ` };
  return { rows };
}

export async function planImport(buffer: ArrayBuffer, createUnits: boolean): Promise<ImportPlan & { _parsed?: ParsedRow[] }> {
  const empty = { rows: [], newUnits: [], counts: { new: 0, update: 0, unchanged: 0, error: 0 } };
  const { rows, fatal } = await readRows(buffer);
  if (fatal) return { ...empty, fatal };

  const [units, users] = await Promise.all([
    db.unit.findMany({ select: { id: true, name: true, code: true } }),
    db.user.findMany({ select: { id: true, employeeNumber: true, email: true, fullName: true, phone: true, unitId: true, role: true } }),
  ]);
  const unitByKey = new Map<string, { id: string; name: string }>();
  for (const u of units) {
    unitByKey.set(u.name.trim(), u);
    unitByKey.set(u.code.toUpperCase(), u);
  }
  const userByNumber = new Map(users.map((u) => [u.employeeNumber, u]));
  const userByEmail = new Map(users.map((u) => [u.email, u]));
  const seenNumbers = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  const newUnits = new Set<string>();

  const results: RowResult[] = rows.map(({ row, data }) => {
    const messages: string[] = [];
    const parsed = RowSchema.safeParse(data);
    if (!parsed.success) messages.push(...parsed.error.issues.map((i) => i.message));
    const d = parsed.success ? parsed.data : { ...data, email: data.email.toLowerCase() };

    const roleText = data.role.trim();
    let role: Exclude<Role, "ADMIN"> = "EMPLOYEE";
    if (roleText) {
      if (/מנהל מערכת|ADMIN/i.test(roleText)) messages.push("תפקיד מנהל מערכת אינו נטען מקובץ");
      else if (ROLE_BY_LABEL[roleText]) role = ROLE_BY_LABEL[roleText];
      else messages.push(`תפקיד לא מוכר: "${roleText}"`);
    }
    if (data.password) {
      const p = PasswordSchema.safeParse(data.password);
      if (!p.success) messages.push(p.error.issues[0].message);
    }

    const unit = unitByKey.get(d.unit.trim()) ?? unitByKey.get(d.unit.trim().toUpperCase());
    let isNewUnit = false;
    if (!unit && d.unit) {
      if (createUnits) { newUnits.add(d.unit.trim()); isNewUnit = true; }
      else messages.push(`יחידה לא קיימת: "${d.unit}" (סמנו "צור יחידות חסרות" כדי ליצור)`);
    }

    // כפילויות בתוך הקובץ
    if (d.employeeNumber) {
      if (seenNumbers.has(d.employeeNumber)) messages.push(`מספר עובד כפול בקובץ (גם בשורה ${seenNumbers.get(d.employeeNumber)})`);
      else seenNumbers.set(d.employeeNumber, row);
    }
    if (d.email) {
      if (seenEmails.has(d.email)) messages.push(`דוא"ל כפול בקובץ (גם בשורה ${seenEmails.get(d.email)})`);
      else seenEmails.set(d.email, row);
    }

    const existing = userByNumber.get(d.employeeNumber);
    const emailOwner = userByEmail.get(d.email);
    if (emailOwner && emailOwner.employeeNumber !== d.employeeNumber) messages.push(`הדוא"ל כבר משויך לעובד ${emailOwner.employeeNumber}`);
    if (existing?.role === "ADMIN") messages.push("לא ניתן לעדכן מנהל מערכת מקובץ");

    let status: RowResult["status"] = "new";
    if (messages.length) status = "error";
    else if (existing) {
      const same = existing.fullName === d.fullName && existing.email === d.email && existing.phone === d.phone && existing.unitId === unit?.id && existing.role === role;
      status = same ? "unchanged" : "update";
    }
    return {
      row, employeeNumber: d.employeeNumber, fullName: d.fullName, unit: unit?.name ?? d.unit, role,
      status, messages, newUnit: isNewUnit,
    };
  });

  const counts = { new: 0, update: 0, unchanged: 0, error: 0 };
  results.forEach((r) => counts[r.status]++);
  return { rows: results, newUnits: [...newUnits], counts, _parsed: rows };
}

/** סיסמה זמנית: 12 תווים, לפחות אות וספרה (תואם PasswordSchema) */
function tempPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  for (let i = 0; i < 10; i++) chars.push(all[randomInt(all.length)]);
  // ערבוב
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type Credential = { employeeNumber: string; fullName: string; email: string; password: string };

/** ביצוע הטעינה – רק שורות תקינות. מחזיר סיסמאות שנוצרו (מוצגות פעם אחת). */
export async function applyImport(buffer: ArrayBuffer, createUnits: boolean) {
  const plan = await planImport(buffer, createUnits);
  if (plan.fatal) return { plan, credentials: [] as Credential[] };
  const parsed = new Map(plan._parsed!.map((p) => [p.row, p.data]));
  const credentials: Credential[] = [];

  // גיבוב הסיסמאות לפני הטרנזקציה – לא מחזיקים חיבור DB פתוח בזמן חישוב bcrypt
  const hashes = new Map<number, string>();
  for (const r of plan.rows) {
    if (r.status !== "new") continue;
    const d = parsed.get(r.row)!;
    const password = d.password || tempPassword();
    hashes.set(r.row, await bcrypt.hash(password, 10)); // OWASP: bcrypt work factor ≥ 10
    if (!d.password) credentials.push({ employeeNumber: r.employeeNumber, fullName: d.fullName.trim(), email: d.email.trim().toLowerCase(), password });
  }

  await db.$transaction(async (tx) => {
    const unitIds = new Map<string, string>();
    for (const u of await tx.unit.findMany({ select: { id: true, name: true, code: true } })) {
      unitIds.set(u.name.trim(), u.id);
      unitIds.set(u.code.toUpperCase(), u.id);
    }
    for (const name of plan.newUnits) {
      const code = "U" + randomBytes(3).toString("hex").toUpperCase();
      const u = await tx.unit.create({ data: { name, code } });
      unitIds.set(name, u.id);
    }
    for (const r of plan.rows) {
      if (r.status !== "new" && r.status !== "update") continue;
      const d = parsed.get(r.row)!;
      const unitId = unitIds.get(d.unit.trim()) ?? unitIds.get(d.unit.trim().toUpperCase())!;
      const data = { fullName: d.fullName.trim(), email: d.email.trim().toLowerCase(), phone: d.phone.trim(), unitId, role: r.role as Exclude<Role, "ADMIN"> };
      if (r.status === "update") {
        await tx.user.update({ where: { employeeNumber: r.employeeNumber }, data });
      } else {
        await tx.user.create({ data: { ...data, employeeNumber: r.employeeNumber, passwordHash: hashes.get(r.row)! } });
      }
    }
  }, { timeout: 30_000 });

  delete plan._parsed;
  return { plan, credentials };
}

/** קובץ סיסמאות זמניות להורדה חד-פעמית */
export async function buildCredentialsFile(credentials: Credential[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("סיסמאות זמניות", { views: [{ rightToLeft: true }] });
  ws.columns = [
    { header: "מספר עובד", key: "employeeNumber", width: 14 },
    { header: "שם מלא", key: "fullName", width: 22 },
    { header: 'דוא"ל (שם משתמש)', key: "email", width: 30 },
    { header: "סיסמה זמנית", key: "password", width: 18 },
  ].map((c) => ({ ...c, style: { font: FONT, alignment: { horizontal: "right" as const, readingOrder: "rtl" as const } } }));
  credentials.forEach((c) => ws.addRow(c));
  ws.getRow(1).font = { ...FONT, bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
}
