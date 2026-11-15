# LogisticWH – הנחיות ל-Claude Code

## הנחיות משתמש (חובה בכל תוצר)
- **שפה:** כל הטקסט בממשק, בתיעוד, בהודעות למשתמש ובמסמכים – בעברית.
- **פונט:** Arial בכל התוצרים (אתרים, מסמכים, קבצי Excel, קבלות PDF/מייל).
- **מידע מהימן בלבד:** לאמת גרסאות ספריות מול npm ותיעוד רשמי (Next.js, Prisma, Vercel) לפני שימוש. לא להסתמך על זיכרון.
- **אתגור:** לכל הצעה טכנית לציין חלופה/סיכון ולתת סימוכין (קישור לתיעוד, CVE, מספר גרסה).

## מחסנית
- Next.js 16 (App Router, Turbopack) + TypeScript, Tailwind CSS 4 (RTL), lucide-react
- Prisma 7.10.1 (גרסה יציבה מקובעת; תג `latest` ב-npm מצביע על RC) + PostgreSQL
  - ייצור: Vercel + Neon (Vercel Marketplace). פיתוח: PostgreSQL מקומי.
  - קליינט נוצר אל `src/generated/prisma` (לא נשמר ב-git; `postinstall` מייצר).
- אימות: Session JWT (jose) בעוגיית httpOnly + bcryptjs. בדיקה אופטימית ב-`src/proxy.ts`,
  בדיקה מחייבת ב-`src/lib/dal.ts` (`requireRole`) **בכל דף ובכל Server Action**.
- אקסל: ExcelJS (לא SheetJS – גרסת npm 0.18.5 עם CVE-2023-30533, CVE-2024-22363).
- ברקוד (שלב ב'): `@zxing/browser` (לא html5-qrcode – לא מתוחזק מאז 2023).

## כללי נתונים
- כל שינוי מלאי/שיוך: בתוך `db.$transaction` אחד, הכולל עדכון `CatalogItem.availableQty`
  ורישום שורת `Transaction` (יומן Append-only – לא מעדכנים/מוחקים).
- חתימה: רשומת `Signature` עם `documentHash` (SHA-256 של `documentJson`), IP, User-Agent.
- חתימה מרוכזת של מנהל יחידה: `requiresAck=true`; האחריות עוברת לעובד רק לאחר `ackAt`.
- מנהל יחידה רואה/פועל רק על עובדי היחידה שלו – לסנן תמיד לפי `user.unitId` מהשרת.

## מוסכמות קוד (שלב 2)
- לוגיקת מלאי: `src/lib/inventory.ts`. מוני פריט סידורי מחושבים מחדש מהסידוריים (`recalcSerialCounters`).
- שאילתות איתור/דוחות: `src/lib/reports.ts` – משמשות גם את המסכים וגם את הייצוא (מקור אחד).
- ייצוא Excel: `src/lib/excel.ts` + `src/app/api/export/[report]`. נתיבי `/api` לא עוברים ב-proxy – לבדוק הרשאה בקוד.
- טפסים: `src/components/ActionForm.tsx` – שליחה דרך startTransition כדי ש-React 19 לא ימחק שדות בשגיאת אימות.
- `uuid` מקובע ל-11.1.1 דרך `overrides` (GHSA-w5hq-g745-h8pq, תלות של exceljs).

## הקמה ראשונית
- `/setup` – יצירת מנהל מרלו"ג ראשון. פעיל רק אם `SETUP_TOKEN` (16+ תווים) מוגדר **ו**אין משתמשים.
- לוגיקה: `src/lib/setup.ts` (server-only) + `src/app/actions/setup.ts`.
- אין לייצא מקובץ `"use server"` פונקציות עזר – כל ייצוא שם הוא נקודת קצה ציבורית.

## פקודות
- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`
- `npm run db:migrate` · `npm run db:seed` (סיסמת דוגמה: `Demo1234!`)

## שלבי פיתוח
1. ✅ תשתית, סכמה, נתוני דוגמה, אימות והרשאות, מבנה ממשק לכל תפקיד
2. ✅ איתור מהיר (עובד/יחידה/ציוד/סידורי), ניהול מלאי, ייצוא Excel, ניהול משתמשים ויחידות, שינוי סיסמה
3. זרימת בקשות, הקצאה, חתימה דיגיטלית, קבלות (מייל + Webhook SMS)
4. זימוני החזרה, פעולות מרוכזות למנהל יחידה, תשתית סריקת ברקוד
