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

## מערכת עיצוב
- סקילים בפרויקט (`.claude/skills/`, מקורות ב-`SOURCES.md`): `ui-ux-pro-max`, `emil-design-eng`,
  `review-animations`, `animation-performance`, `animate`. להשתמש בהם בכל שינוי ממשק.
- סגנון: Flat/Minimal לכלי ארגוני. Primary = slate (`brand-*`), Accent = ירוק מלאי (`accent-*`, 600=#047857).
  ניגודיות טקסט ≥ 4.5:1 (AA). לא להשתמש ב-#059669 עם טקסט לבן (3.77:1).
- רכיבים: `card`, `btn-primary|accent|secondary|danger`, `input`, `label`, `badge`, `link`, `table-base`, `feedback-enter` (globals.css).
- תנועה: כפתור `scale(0.97)` ב-160ms `--ease-out`; אין אנימציה לניווט/פעולות תכופות; רק transform/opacity;
  הודעות משוב 200ms; לכבד `prefers-reduced-motion`. hover ב-Tailwind v4 פעיל רק במכשירים עם hover.
- יעד מגע ≥ 44px (`min-h-11`), כפתורים קטנים בטבלאות `min-h-9`; פוקוס גלוי (`:focus-visible`).
- גופן: Arial בלבד (Lexend שהסקיל הציע – לא תומך בעברית).
- גרפים (סקיל `dataviz`): `src/components/charts/` – `StackedColumns` (לקוח, tooltip בריחוף/פוקוס), `ThinSegmentedBar`,
  `MeterList` (זמינות מלאי + אייקון/תווית חומרה), `RankedBars`, `ChartCard` (כולל "הצג כטבלה").
  פלטה: `SERIES` = כחול/כתום/טורקיז (3 חריצים ראשונים, עברו `validate_palette.js` על #ffffff); מעל 3 סדרות – לקפל ל"אחר".
  טקסט לעולם לא בצבע הסדרה; סטטוס תמיד עם אייקון + תווית; ציר זמן מימין (ישן) לשמאל (חדש); שברים כ"X מתוך Y".
- אייקונים: lucide-react בלבד (ללא אימוג'י). `ItemIcon` – אייקון לפי שם פריט/קטגוריה; `PageHeader icon`, `StatCard icon/tone`.

## מוסכמות קוד (שלב 2)
- לוגיקת מלאי: `src/lib/inventory.ts`. מוני פריט סידורי מחושבים מחדש מהסידוריים (`recalcSerialCounters`).
- שאילתות איתור/דוחות: `src/lib/reports.ts` – משמשות גם את המסכים וגם את הייצוא (מקור אחד).
- ייצוא Excel: `src/lib/excel.ts` + `src/app/api/export/[report]`. נתיבי `/api` לא עוברים ב-proxy – לבדוק הרשאה בקוד.
- טפסים: `src/components/ActionForm.tsx` – שליחה דרך startTransition כדי ש-React 19 לא ימחק שדות בשגיאת אימות.
- `uuid` מקובע ל-11.1.1 דרך `overrides` (GHSA-w5hq-g745-h8pq, תלות של exceljs).

## מוסכמות קוד (שלב 3)
- זרימת בקשות: `src/lib/requests.ts`. כל מעבר סטטוס מותנה (`updateMany where status`) – מונע מרוץ.
- הקצאה כמותית מפחיתה `availableQty` (שריון); החתימה רק רושמת אצל העובד. סידוריים: IN_STOCK→ALLOCATED→SIGNED.
- שחרור הקצאה נרשם כ-`DEALLOCATE`.
- חתימה: `signature_pad` 5 (לא react-signature-canvas – alpha, תלוי ב-signature_pad 2.x). רכיב: `SignatureField`.
- קבלה: `src/lib/receipt.ts` – JSON קנוני + SHA-256; דף `/receipts/[id]` מאמת שלמות. גישה: החותם / מרלו"ג / מנהל יחידת החותם.
- התראות: `src/lib/notify.ts` – SMTP (Nodemailer) ו-Webhook SMS עם HMAC; אופציונליים, כשל לא מבטל פעולה. תוכן מה-DB עובר escapeHtml.
- זמן: `src/lib/time.ts` – datetime-local מתפרש כשעון ישראל (שרתי Vercel ב-UTC).

## מוסכמות קוד (שלב 4)
- החזרות: `src/lib/returns.ts` – זימון (סידורי → PENDING_RETURN), קליטה עם חתימת מרלו"ג → מסמך RETURN.
  פגום: סידורי → IN_REPAIR (+REPAIR_OUT), כמותי → גריעה (+WRITE_OFF). הזימונים נסגרים אוטומטית.
- מרוכז: `src/lib/bulk.ts` – חלוקה מציוד המנהל (TRANSFER requiresAck, סידורי PENDING_ACK, כמותי pendingAckQty);
  אישור עובד (ACK) מעדכן רק `ackAt/ackSignatureId`; דחייה → תנועה הפוכה. איסוף (BULK_COLLECT) מזכה עובדים.
- מסמכים: `receipt.ts` – RECEIPT במבנה המקורי; RETURN/BULK_TRANSFER/BULK_COLLECT/ACK ב-`canonicalGeneric`.
  `/receipts/[id]` – גישה: החותם, עובד שמופיע במסמך, מרלו"ג, מנהל יחידה רלוונטי.
- סריקה: `src/components/ScanButton.tsx` (@zxing/browser 0.2.1, נטען בלחיצה). מצבים fill/append/check (`data-scan`).
  בדיקה אוטומטית: Chromium עם `--use-file-for-fake-video-capture` ווידאו Y4M עם ברקוד Code128.
- Node מקובע ל-`22.x` ב-engines (Vercel הזהיר ש->=22.12 ישודרג אוטומטית לגרסה ראשית חדשה).

## מוסכמות קוד (מנהל מערכת, טעינה, ניפוק)
- תפקיד `ADMIN`: `requireRole` מעביר אותו בכל בדיקה (על-תפקיד). `requireRole("ADMIN")` = מנהל מערכת בלבד.
  במסכי מנהל יחידה – `actingUnit`/`managerActor` (dal.ts): מנהל יחידה תמיד ביחידתו; ADMIN לפי `?unit=` / שדה `unitId`.
  רק ADMIN מעניק תפקיד ADMIN; חריג אתחול – כשאין אף ADMIN. מנהל מרלו"ג לא משבית/מאפס ADMIN. `/setup` יוצר ADMIN.
- קטגוריות: טבלת `Category`; `CatalogItem.category` = FK על `Category.name` (ON UPDATE CASCADE, ON DELETE RESTRICT).
- טעינת עובדים: `src/lib/user-import.ts` – תבנית (`/api/admin/template`), בדיקה ללא כתיבה, טעינה בטרנזקציה אחת.
  התאמה לפי מספר עובד; ADMIN לא נטען מקובץ; עד 300 שורות (bcrypt 10 סבבים ~87ms); הגיבוב לפני הטרנזקציה;
  סיסמאות זמניות מוחזרות פעם אחת כקובץ (לא נשמרות בגלוי).
- ניפוק ישיר: `src/lib/issue.ts` – מסמך `ISSUE` שנחתם ע"י המקבל; למנהל יחידה – נוסח "לחלוקה" (`ISSUE_TO_MANAGER_TERMS`).
- מעטפת: `src/components/Shell.tsx` – סרגל מתכווץ (עוגייה `lwh_sidebar`), מגירת נייד, סרגל תחתון (`mobile` ב-nav.ts, עד 4 + "עוד").

## מוסכמות קוד (בחירת מועד איסוף)
- `src/components/ui/` – רכיבים בסגנון shadcn (קבצים בשמות kebab-case); `cn` ב-`src/lib/utils.ts` (ללא תלויות).
  `src/components/ui.tsx` (PageHeader וכו') נשאר; `@/components/ui` מצביע אליו, `@/components/ui/<name>` לתיקייה.
- `SlotWeekPicker` (`ui/slot-week-picker.tsx`, framer-motion 14.9.0 מקובע): מותאם ל-RTL/עברית/שעון ישראל ולמערכת העיצוב –
  ללא גרדיאנט, תלת-ממד, blur מונפש או חלקיקים; סמן בחירה ב-`layoutId` (transform בלבד); `MotionConfig reducedMotion="user"`.
  `name` מייצר שדה מוסתר בפורמט datetime-local לטופס Server Action.
- משבצות איסוף: `src/lib/pickup-slots.ts` (`PICKUP_SCHEDULE`: א'–ה' 08:00–16:00, 30 דק', 4 שבועות, קיבולת 1 – הנחת עבודה).
  `PickupSlotPicker` בונה את המשבצות בדפדפן; השרת מעביר רק מועדים תפוסים. "מועד אחר" = datetime-local חופשי.
  `allocateRequest` חוסם מועד שהגיע לקיבולת ("המועד נתפס בינתיים").

## הקמה ראשונית
- `/setup` – יצירת מנהל מערכת (ADMIN) ראשון. פעיל רק אם `SETUP_TOKEN` (16+ תווים) מוגדר **ו**אין משתמשים.
- לוגיקה: `src/lib/setup.ts` (server-only) + `src/app/actions/setup.ts`.
- אין לייצא מקובץ `"use server"` פונקציות עזר – כל ייצוא שם הוא נקודת קצה ציבורית.

## פקודות
- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`
- `npm run db:migrate` · `npm run db:seed` (סיסמת דוגמה: `Demo1234!`)

## שלבי פיתוח
1. ✅ תשתית, סכמה, נתוני דוגמה, אימות והרשאות, מבנה ממשק לכל תפקיד
2. ✅ איתור מהיר (עובד/יחידה/ציוד/סידורי), ניהול מלאי, ייצוא Excel, ניהול משתמשים ויחידות, שינוי סיסמה
3. ✅ זרימת בקשות, הקצאה, חתימה דיגיטלית, קבלות (מייל + Webhook SMS)
4. ✅ זימוני החזרה וקליטה עם טופס זיכוי, פעולות מרוכזות למנהל יחידה (חלוקה + אישור עובד, איסוף), סריקת ברקוד
5. ✅ מנהל מערכת, טעינת עובדים מאקסל, קטגוריות, ניפוק ישיר (לעובד/למנהל יחידה), סרגל צד מתכווץ
