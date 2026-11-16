# תכנית פיתוח מעודכנת – LogisticWH

**שם המערכת:** LogisticWH
**תיאור:** אפליקציית רשת רספונסיבית (Mobile-First, RTL, ניתנת להתקנה כ-PWA) לניהול מלאי, מצאי, ניפוק והחתמות ציוד דיגיטליות במרלו"ג מול יחידות ארגוניות ועובדים.
**כתובת ייצור:** https://logisticwh.vercel.app
**קוד מקור:** `GuyAbady/LogisticWH` · ענף ייצור: `main` · ענף פיתוח: `claude/gracious-albattani-x19vws`
**עודכן:** 16.11.2026 · מצב: שלבים 1–5 הושלמו ופרוסים בייצור

> מסמך זה מחליף את `logisticwh.md` המקורי. הוא משקף את המערכת כפי שנבנתה בפועל, כולל כל ההחלטות שסטו מהתכנית המקורית ונימוקיהן (נספח בסוף).

---

## 1. מחסנית טכנולוגית (בפועל)

כל הגרסאות נבדקו מול npm ותיעוד רשמי בזמן ההתקנה, ומקובעות (ללא `^`) כדי שבנייה עתידית לא תשתנה בלי כוונה.

| רכיב | גרסה | הערות ונימוק |
|---|---|---|
| Next.js (App Router, Turbopack) + React | 16.4.6 · 19.3.0 | בתכנית: 14+. נבחרה הגרסה היציבה העדכנית. ב-16 קובץ ה-middleware נקרא `proxy.ts` |
| TypeScript | 5.x | |
| Tailwind CSS | 4.3.3 | RTL מלא; רכיבים משותפים כ-`@utility` ב-`globals.css` |
| אייקונים | lucide-react 1.73.0 | ללא אימוג'י |
| ORM | Prisma 7.10.1 + `@prisma/adapter-pg` | התג `latest` ב-npm מצביע על 8.0.0-rc (גרסת טרום-שחרור) – לא אומץ |
| בסיס נתונים | PostgreSQL – Neon דרך Vercel Marketplace | בתכנית: SQLite לפיתוח. ב-Vercel מערכת הקבצים זמנית, ו-"Vercel Postgres" הועבר ל-Neon (12/2024) |
| אימות | jose 6.2.17 (JWT בעוגיית httpOnly) + bcryptjs 3.0.3 | בתכנית: NextAuth. הדפוס המומלץ בתיעוד Next.js; ללא תלות חיצונית |
| אימות קלט | zod 4.6.7 | |
| ייצוא/טעינת Excel | ExcelJS 4.4.0 | בתכנית: SheetJS (`xlsx`) – גרסת npm 0.18.5 עם CVE-2023-30533 ו-CVE-2024-22363, ועיצוב תאים רק בגרסה בתשלום |
| חתימה דיגיטלית | signature_pad 5.1.4 | בתכנית: react-signature-canvas – הגרסה העדכנית alpha ותלויה ב-signature_pad 2.x משנת 2018 |
| סריקת ברקוד | @zxing/browser 0.2.1 + @zxing/library 0.23.0 | בתכנית: html5-qrcode – ללא עדכון מאז 04/2023 |
| מייל | Nodemailer 10.5.0 (SMTP) | אופציונלי – אם לא מוגדר, נרשם ביומן שלא נשלח |
| SMS | Webhook (POST JSON) עם חתימת HMAC-SHA256 | שכבה מוכנה לחיבור ספק |
| Node.js | 22.x (מקובע ב-`engines`) | Vercel הזהיר ש-`>=22.12` ישודרג אוטומטית לגרסה ראשית חדשה |
| תיקון אבטחה | `overrides: uuid 11.1.1` | GHSA-w5hq-g745-h8pq בתלות של ExcelJS |

---

## 2. תפקידים והרשאות (RBAC)

| יכולת | עובד | מנהל יחידה | מנהל מרלו"ג | מנהל מערכת |
|---|:-:|:-:|:-:|:-:|
| צפייה בציוד החתום עליי, חתימה בנייד, קבלות | ✓ | ✓ | – | ✓ |
| הגשת בקשת ציוד | ✓ | ✓ (ישר למרלו"ג) | – | ✓ (ישר למרלו"ג) |
| אישור/דחיית בקשות היחידה | – | ✓ (יחידתו בלבד) | – | ✓ (בחירת יחידה) |
| חלוקה מרוכזת לעובדים + זיכוי מרוכז | – | ✓ (יחידתו בלבד) | – | ✓ (בחירת יחידה) |
| איתור, מלאי, קליטה, תיקון, גריעה, ייצוא Excel | – | – | ✓ | ✓ |
| הקצאה לבקשות, ניפוק ישיר, זימוני החזרה וקליטתן | – | – | ✓ | ✓ |
| קטגוריות ועריכת פריטי קטלוג | – | – | ✓ | ✓ |
| משתמשים ויחידות (יצירה, עריכה, השבתה, איפוס סיסמה) | – | – | ✓ (לא על מנהל מערכת) | ✓ |
| לוח ניהול, יומן פעולות, טעינת עובדים מאקסל | – | – | – | ✓ |

**כללי הרשאה:**
- בדיקה כפולה: `src/proxy.ts` מבצע בדיקה מהירה לפי העוגייה (הפניות בלבד), ו-`src/lib/dal.ts` (`requireRole`) מבצע את הבדיקה המחייבת מול בסיס הנתונים **בכל דף ובכל Server Action**. נתיבי `/api` אינם עוברים ב-proxy ובודקים הרשאה בעצמם.
- מנהל יחידה רואה ופועל רק על עובדי היחידה שלו – הסינון בשרת, לא לפי פרמטר מהלקוח.
- מנהל מערכת עובר כל בדיקת תפקיד; במסכי מנהל יחידה הוא בוחר יחידה פעילה (`actingUnit`/`managerActor`).
- רק מנהל מערכת מעניק תפקיד מנהל מערכת. **חריג אתחול:** כשאין אף מנהל מערכת – מנהל מרלו"ג רשאי (כולל קידום עצמי), והפעולה נרשמת ביומן.
- אסור להוריד את מנהל המערכת האחרון מתפקידו. תפקיד מנהל מערכת אינו נטען מקובץ Excel.

---

## 3. סכמת בסיס נתונים (Prisma – נוכחית)

```prisma
// LogisticWH – סכמת בסיס נתונים
// PostgreSQL (בייצור: Neon דרך Vercel Marketplace)
//
// עקרונות מרכזיים (שינויים מול התוכנית המקורית):
// 1. Transaction – יומן תנועות שאינו נמחק/נערך (Append-only) לכל שינוי מלאי ושיוך.
//    מאפשר איתור היסטורי מלא ("מי החזיק פריט X ומתי").
// 2. Signature – טבלת חתימות נפרדת עם Hash של המסמך, IP, User-Agent וזמן,
//    לחיזוק משקל ראייתי (חוק חתימה אלקטרונית, התשס"א-2001).
// 3. QuantityHolding – יתרה נוכחית של פריט כמותי לעובד (מחליף את BulkAssignment כלוג).
// 4. ReturnSummons – מקושר ב-Foreign Keys (ולא מחרוזות) ותומך גם בפריטים כמותיים.
// 5. Enums אמיתיים במקום מחרוזות חופשיות.

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ───────────── Enums ─────────────

enum Role {
  EMPLOYEE
  UNIT_MANAGER
  WAREHOUSE_MANAGER
  ADMIN // מנהל מערכת: כל יכולות המחסנאי ומנהל היחידה + ניהול משתמשים, טעינה מאקסל וקטגוריות
}

enum SerialStatus {
  IN_STOCK // במחסן
  ALLOCATED // הוקצה לבקשה, ממתין לאיסוף וחתימה
  PENDING_ACK // נחתם ע"י מנהל יחידה, ממתין לאישור העובד
  SIGNED // חתום על עובד
  PENDING_RETURN // זומן להחזרה
  IN_REPAIR // בתיקון
  WRITTEN_OFF // הושבת / נגרע
}

enum RequestStatus {
  PENDING_MANAGER // ממתין למנהל יחידה
  REJECTED_MANAGER // נדחה ע"י מנהל יחידה
  PENDING_WAREHOUSE // אושר, ממתין למרלו"ג
  REJECTED_WAREHOUSE // נדחה ע"י המרלו"ג
  ALLOCATED // הוקצה, נקבע מועד איסוף
  FULFILLED // נחתם ונמסר
  CANCELLED // בוטל
}

enum SummonsStatus {
  PENDING_RETURN
  RETURNED_CREDITED
  CANCELLED
}

enum TransactionType {
  STOCK_IN // קליטת מלאי
  ALLOCATE // הקצאה לבקשה
  DEALLOCATE // שחרור הקצאה (ביטול/שינוי)
  ISSUE // מסירה + חתימה לעובד
  RETURN // החזרה + זיכוי
  TRANSFER // העברה בין עובדים
  ADJUST // תיקון מלאי ידני
  REPAIR_OUT // יציאה לתיקון
  REPAIR_IN // חזרה מתיקון
  WRITE_OFF // גריעה
}

enum SignatureKind {
  RECEIPT // חתימת עובד על קבלת ציוד
  RETURN // אישור החזרה
  MANAGER_BULK // חתימה מרוכזת של מנהל יחידה
  EMPLOYEE_ACK // אישור עובד לחתימה מרוכזת
}

// ───────────── Models ─────────────

model Unit {
  id        String             @id @default(uuid())
  name      String             @unique
  code      String             @unique
  createdAt DateTime           @default(now())
  users     User[]
  requests  EquipmentRequest[]
}

model User {
  id             String   @id @default(uuid())
  employeeNumber String   @unique // מספר עובד
  fullName       String
  email          String   @unique
  phone          String
  role           Role     @default(EMPLOYEE)
  passwordHash   String
  isActive       Boolean  @default(true)
  unitId         String
  unit           Unit     @relation(fields: [unitId], references: [id])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  serialItems        InventorySerial[]   @relation("SerialHolder")
  quantityHoldings   QuantityHolding[]
  requests           EquipmentRequest[]  @relation("Requester")
  managedRequests    EquipmentRequest[]  @relation("ManagerDecision")
  signatures         Signature[]
  txFrom             Transaction[]       @relation("TxFrom")
  txTo               Transaction[]       @relation("TxTo")
  txPerformed        Transaction[]       @relation("TxPerformedBy")
  summons            ReturnSummons[]     @relation("SummonedUser")
  summonsCreated     ReturnSummons[]     @relation("SummonsCreatedBy")
  auditLogs          AuditLog[]

  @@index([unitId])
}

// קטגוריות פריטים מנוהלות. CatalogItem.category מפנה לשם הקטגוריה (FK על name),
// כך ששינוי שם מתעדכן אוטומטית בכל הפריטים (ON UPDATE CASCADE), ומחיקה נחסמת כשיש פריטים.
model Category {
  id        String        @id @default(uuid())
  name      String        @unique
  icon      String? // מפתח אייקון (ראו ItemIcon)
  createdAt DateTime      @default(now())
  items     CatalogItem[]
}

model CatalogItem {
  id             String   @id @default(uuid())
  sku            String   @unique // מק"ט
  name           String
  category       String
  categoryRef    Category @relation(fields: [category], references: [name], onUpdate: Cascade, onDelete: Restrict)
  description    String?
  requiresSerial Boolean  @default(false)
  // סה"כ במלאי הארגון (מחסן + משויך) ויתרה זמינה במחסן.
  // מתעדכנים אך ורק בתוך טרנזקציה יחד עם רשומת Transaction.
  totalQuantity  Int      @default(0)
  availableQty   Int      @default(0)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  serials      InventorySerial[]
  holdings     QuantityHolding[]
  requests     EquipmentRequest[]
  transactions Transaction[]
  summons      ReturnSummons[]

  @@index([category])
}

model InventorySerial {
  id                 String            @id @default(uuid())
  serialNumber       String            @unique
  status             SerialStatus      @default(IN_STOCK)
  catalogItemId      String
  catalogItem        CatalogItem       @relation(fields: [catalogItemId], references: [id])
  holderId           String?
  holder             User?             @relation("SerialHolder", fields: [holderId], references: [id])
  allocatedRequestId String?
  allocatedRequest   EquipmentRequest? @relation(fields: [allocatedRequestId], references: [id])
  notes              String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  transactions Transaction[]
  summons      ReturnSummons[]

  @@index([catalogItemId, status])
  @@index([holderId])
}

// יתרה נוכחית של פריט כמותי אצל עובד
model QuantityHolding {
  id            String      @id @default(uuid())
  catalogItemId String
  catalogItem   CatalogItem @relation(fields: [catalogItemId], references: [id])
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  quantity      Int         @default(0)
  // כמות שנחתמה ע"י מנהל יחידה וממתינה לאישור העובד
  pendingAckQty Int         @default(0)
  updatedAt     DateTime    @updatedAt

  @@unique([catalogItemId, userId])
  @@index([userId])
}

model EquipmentRequest {
  id                String        @id @default(uuid())
  requesterId       String
  requester         User          @relation("Requester", fields: [requesterId], references: [id])
  unitId            String
  unit              Unit          @relation(fields: [unitId], references: [id])
  catalogItemId     String
  catalogItem       CatalogItem   @relation(fields: [catalogItemId], references: [id])
  quantity          Int           @default(1)
  status            RequestStatus @default(PENDING_MANAGER)
  justification     String?
  managerId         String?
  manager           User?         @relation("ManagerDecision", fields: [managerId], references: [id])
  managerNote       String?
  managerDecidedAt  DateTime?
  warehouseNote     String?
  pickupDate        DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  allocatedSerials InventorySerial[]
  transactions     Transaction[]

  @@index([unitId, status])
  @@index([requesterId])
}

model Signature {
  id           String        @id @default(uuid())
  kind         SignatureKind
  signerId     String
  signer       User          @relation(fields: [signerId], references: [id])
  // תמונת החתימה כ-PNG Base64. (חלופה עתידית: Vercel Blob + שמירת URL בלבד)
  imageData    String
  // SHA-256 של תוכן המסמך שנחתם (רשימת פריטים, כמויות, זמן) – מונע שינוי בדיעבד
  documentHash String
  documentJson String // תוכן המסמך שנחתם (JSON) לצורך הפקת קבלה חוזרת
  ipAddress    String?
  userAgent    String?
  signedAt     DateTime      @default(now())

  transactions Transaction[] @relation("TxSignature")
  ackFor       Transaction[] @relation("TxAckSignature")

  @@index([signerId])
}

// יומן תנועות – Append-only. אין לעדכן/למחוק רשומות (למעט שדות אישור העובד).
model Transaction {
  id             String           @id @default(uuid())
  type           TransactionType
  catalogItemId  String
  catalogItem    CatalogItem      @relation(fields: [catalogItemId], references: [id])
  serialId       String?
  serial         InventorySerial? @relation(fields: [serialId], references: [id])
  quantity       Int              @default(1)
  fromUserId     String? // null = מהמחסן
  fromUser       User?            @relation("TxFrom", fields: [fromUserId], references: [id])
  toUserId       String? // null = אל המחסן
  toUser         User?            @relation("TxTo", fields: [toUserId], references: [id])
  performedById  String
  performedBy    User             @relation("TxPerformedBy", fields: [performedById], references: [id])
  signatureId    String?
  signature      Signature?       @relation("TxSignature", fields: [signatureId], references: [id])
  requestId      String?
  request        EquipmentRequest? @relation(fields: [requestId], references: [id])
  // חתימה מרוכזת של מנהל: האחריות עוברת לעובד רק לאחר אישורו
  requiresAck    Boolean          @default(false)
  ackAt          DateTime?
  ackSignatureId String?
  ackSignature   Signature?       @relation("TxAckSignature", fields: [ackSignatureId], references: [id])
  note           String?
  createdAt      DateTime         @default(now())

  @@index([catalogItemId, createdAt])
  @@index([serialId])
  @@index([toUserId])
  @@index([fromUserId])
}

model ReturnSummons {
  id            String           @id @default(uuid())
  userId        String
  user          User             @relation("SummonedUser", fields: [userId], references: [id])
  catalogItemId String
  catalogItem   CatalogItem      @relation(fields: [catalogItemId], references: [id])
  serialId      String? // לפריט סידורי
  serial        InventorySerial? @relation(fields: [serialId], references: [id])
  quantity      Int              @default(1) // לפריט כמותי
  reason        String
  dueDate       DateTime?
  status        SummonsStatus    @default(PENDING_RETURN)
  createdById   String
  createdBy     User             @relation("SummonsCreatedBy", fields: [createdById], references: [id])
  createdAt     DateTime         @default(now())
  closedAt      DateTime?
  // טופס הזיכוי החתום שסגר את הזימון
  returnSignatureId String?

  @@index([userId, status])
}

// יומן פעולות מערכת (כניסות, פעולות רגישות) – לעמידה בתקנות הגנת הפרטיות (אבטחת מידע)
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String
  entity    String?
  entityId  String?
  details   String?
  ipAddress String?
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}
```

### שינויים מול הסכמה המקורית

| נושא | בתכנית המקורית | בפועל | למה |
|---|---|---|---|
| היסטוריה | מצב נוכחי בלבד | `Transaction` – יומן Append-only לכל תנועה | איתור "מי החזיק פריט ומתי"; חתימה לא נדרסת |
| חתימות | `signatureUrl` על הפריט | `Signature` נפרדת: תמונה, JSON קנוני, SHA-256, IP, User-Agent | משקל ראייתי (חוק חתימה אלקטרונית, התשס"א-2001); זיהוי שינוי בדיעבד |
| פריטים כמותיים | `BulkAssignment` כלוג | `QuantityHolding` – יתרה לעובד + `pendingAckQty` | יתרה נוכחית מהירה; ההיסטוריה ביומן |
| זימוני החזרה | שמות כמחרוזות | FK לעובד, לפריט ולסידורי + כמות + טופס זיכוי | שלמות נתונים; תמיכה בכמותי |
| סטטוסים | מחרוזות חופשיות | Enums | מניעת ערכים שגויים |
| קטגוריות | מחרוזת חופשית | טבלת `Category`, FK על השם (CASCADE בשינוי שם) | ניהול מרכזי ואייקונים |
| יומן אבטחה | – | `AuditLog` | תקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017 |
| תפקידים | 3 | + `ADMIN` | ניהול מערכת וטעינת עובדים |

### מיגרציות (לפי סדר)
1. `20261115162809_init` – הסכמה הבסיסית.
2. `20261115183014_add_deallocate` – סוג תנועה `DEALLOCATE` (שחרור הקצאה).
3. `20261115185350_summons_return_signature` – קישור זימון לטופס הזיכוי.
4. `20261115211212_admin_role_categories` – תפקיד `ADMIN` וטבלת `Category`, **כולל מילוי הקטגוריות מהפריטים הקיימים לפני הוספת ה-FK** (בלעדיו המיגרציה נכשלת על נתוני ייצור).

---

## 4. תהליכים עסקיים

כל פעולה שמשנה מלאי או שיוך רצה בטרנזקציה אחת, כוללת רשומה ביומן התנועות, ומעברי סטטוס מותנים (`updateMany where status`) כדי למנוע כפילות בפעולות מקבילות. כל תהליך חתום מפיק מסמך עם SHA-256, שדף `/receipts/[id]` מאמת.

| תהליך | שלבים | מסמך חתום |
|---|---|---|
| בקשת ציוד | עובד מגיש → מנהל יחידה מאשר/דוחה → מרלו"ג מקצה (סידוריים / שריון כמות) וקובע מועד איסוף בשעון ישראל → העובד חותם בנייד → הציוד נרשם עליו | `RECEIPT` |
| שחרור/דחייה/ביטול | המרלו"ג משחרר הקצאה (`DEALLOCATE`) או דוחה; העובד מבטל בקשה שטרם הוקצתה | – |
| ניפוק ישיר | מרלו"ג מאתר מקבל (יחידה / שם / מספר עובד) → בוחר סידוריים (כולל סריקה) וכמויות → המקבל חותם על מכשיר המרלו"ג | `ISSUE` |
| ניפוק למנהל יחידה | כמו ניפוק ישיר, בנוסח "לחלוקה לעובדי היחידה" → המנהל מחלק במסך "פעולות מרוכזות" | `ISSUE` |
| חלוקה מרוכזת | מנהל יחידה מחלק מציוד הרשום עליו בחתימה אחת → כל עובד מאשר או דוחה בנייד. עד האישור – באחריות המנהל | `BULK_TRANSFER` + `ACK` |
| זיכוי מרוכז | מנהל יחידה אוסף ציוד מעובדיו בחתימה אחת; העובדים מזוכים | `BULK_COLLECT` |
| זימון והחזרה | מרלו"ג מזמן מתיק העובד (סיבה, תאריך יעד, סימון איחור) → קולט בחתימת מרלו"ג. פגום: סידורי → תיקון, כמותי → גריעה. הזימונים נסגרים אוטומטית | `RETURN` |
| ניהול מלאי | פריט חדש, קליטה סידורית/כמותית (כולל סריקה רציפה), תיקון ספירה, תיקון, גריעה | – |
| טעינת עובדים | הורדת תבנית → מילוי → בדיקה (ללא כתיבה) → טעינה בטרנזקציה אחת; עדכון לפי מספר עובד; סיסמאות זמניות בקובץ חד-פעמי; עד 300 שורות / 900KB | – |
| ייצוא Excel | 7 דוחות: מלאי, שיוכים, יומן תנועות, עובד, יחידה, פריט, סידורי – RTL, Arial, כותרת קפואה, מסנן | – |

התראות (מייל + SMS) נשלחות בהקצאה, בחתימה, בזימון, בזיכוי, בחלוקה ובניפוק. כשל בשליחה לעולם אינו מבטל את הפעולה.

---

## 5. מפת מסכים

| תפקיד | נתיב | תיאור |
|---|---|---|
| כולם | `/login` · `/account` · `/receipts/[id]` | כניסה · שינוי סיסמה · מסמך חתום עם אימות שלמות והדפסה |
| הקמה | `/setup` | יצירת מנהל המערכת הראשון (פעיל רק כשאין משתמשים ו-`SETUP_TOKEN` מוגדר) |
| עובד | `/employee` · `/employee/sign` (+ `/[id]`) · `/employee/requests` · `/employee/returns` | הציוד שלי · חתימה ואישור חלוקות · בקשות · זימונים וטופסי זיכוי |
| מנהל יחידה | `/manager` · `/manager/requests` · `/manager/bulk` | מצבת היחידה + גרף ציוד לפי עובד · אישור בקשות · חלוקה/זיכוי מרוכזים |
| מנהל מרלו"ג | `/warehouse` | לוח בקרה: מדדים, גרף פעילות 14 ימים, זמינות מלאי, פילוח לפי פריט |
| | `/warehouse/issue` | ניפוק ישיר |
| | `/warehouse/lookup` (+ `user`/`unit`/`serial`) | איתור מהיר ותיקי עובד/יחידה/סידורי |
| | `/warehouse/inventory` (+ `new`, `[id]`) | מלאי, פריט חדש, כרטיס פריט ועריכה |
| | `/warehouse/requests` · `/warehouse/returns` | דרישות והקצאה · זימונים וקליטת החזרות |
| | `/warehouse/categories` · `/warehouse/users` | קטגוריות · משתמשים ויחידות (כולל "החשבון שלי") |
| מנהל מערכת | `/admin` · `/admin/import` | לוח ניהול ויומן פעולות · טעינת עובדים מאקסל |
| API | `/api/export/[report]` · `/api/admin/template` | ייצוא דוחות · תבנית טעינה |

---

## 6. עיצוב ותצוגה גרפית

- **סקילים בפרויקט** (`.claude/skills/`, מקורות ורישיון MIT ב-`SOURCES.md`): `ui-ux-pro-max`, `emil-design-eng`, `review-animations`, `animation-performance`, `animate`. נבדקו לפני התקנה (ללא קריאות רשת וללא הרצת פקודות).
- **סגנון:** שטוח ומינימלי לכלי ארגוני. Primary – slate; Accent – ירוק מלאי `#047857` (5.48:1 מול לבן). הירוק `#059669` שהסקיל הציע נדחה (3.77:1 – נכשל ב-AA).
- **גופן:** Arial בלבד (Lexend שהוצע אינו תומך בעברית).
- **נגישות:** ניגודיות טקסט ≥ 4.5:1 (נבדקה בחישוב), יעדי מגע ≥ 44px, פוקוס גלוי, `prefers-reduced-motion`.
- **תנועה:** משוב לחיצה `scale(0.97)` ב-160ms; ללא אנימציה לניווט ולפעולות תכופות; הודעות משוב 200ms.
- **גרפים** (מתודת `dataviz`): פלטה כחול/כתום/טורקיז שעברה את `validate_palette.js` (CVD ΔE 9.2); tooltip בריחוף ובמקלדת; תצוגת טבלה לכל גרף; סטטוס תמיד עם אייקון + תווית; ציר זמן מימין לשמאל; כמויות כ"X מתוך Y".
- **מעטפת:** סרגל צד ימני מתכווץ לפס אייקונים (נשמר בעוגייה), מגירת ניווט בנייד, סרגל תחתון עד 4 פריטים + "עוד".
- **אייקונים:** lucide-react; אייקון לכל פריט לפי שם/קטגוריה, ולכל כותרת מסך.

---

## 7. אבטחה ופרטיות

- סיסמאות ב-bcrypt (12 סבבים; 10 בטעינה מרוכזת – המינימום של OWASP), נעילה זמנית אחרי 5 כישלונות ב-15 דקות.
- עוגיית Session: httpOnly, Secure בייצור, SameSite=Lax, תוקף 8 שעות; מפתח נפרד לייצור ול-Preview.
- `AuditLog` לכל כניסה ופעולה רגישה, מוצג בלוח הניהול.
- מסמכים חתומים: JSON קנוני + SHA-256; שינוי בדיעבד מזוהה בדף המסמך.
- תוכן מבסיס הנתונים עובר `escapeHtml` לפני הכנסה למייל; Webhook ה-SMS חתום ב-HMAC.
- `/setup` מוגן בקוד חד-פעמי, השוואה בזמן קבוע, חסימה אחרי 5 כישלונות ונעילת DB נגד יצירה כפולה.
- אין ייצוא של פונקציות עזר מקובצי `"use server"` (כל ייצוא שם הוא נקודת קצה ציבורית).
- כפוף לתקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017, ולתיקון 13 לחוק הגנת הפרטיות.

---

## 8. פריסה ותפעול

- **Vercel** (פרויקט `logisticwh`, framework `nextjs` – מקובע ב-`vercel.json`; הגדרת "Other" גרמה בעבר ל-404 בכל הנתיבים).
- **בנייה:** `vercel-build` = `prisma generate && prisma migrate deploy && next build` – מיגרציה שנכשלת עוצרת את הפריסה.
- **Neon:** `DATABASE_URL` (Pooled) לאפליקציה, `DATABASE_URL_UNPOOLED` למיגרציות. ל-Preview נוצר branch נפרד של בסיס הנתונים.
- **זרימת שינויים:** פיתוח בענף נפרד → Preview → Pull Request → מיזוג ל-`main` → ייצור. מוזגו PR #1–#7.

| משתנה | מצב |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | מוגדרים (Neon) |
| `SESSION_SECRET` | מוגדר – ערך נפרד ל-Production ול-Preview |
| `SETUP_TOKEN` | מנוטרל (ערך קצר מ-16 תווים) – `/setup` כבוי |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | **טרם הוגדרו** |
| `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_SECRET` | **טרם הוגדרו** |
| `APP_URL` | לא נדרש (ברירת מחדל: דומיין הייצור של Vercel) |

**פקודות:** `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run db:migrate` · `npm run db:seed` (פיתוח בלבד; חסום בייצור).

---

## 9. סטטוס ובדיקות

| שלב | תוכן | בדיקות E2E (דפדפן אמיתי) |
|---|---|---|
| 1 | תשתית, סכמה, נתוני דוגמה, אימות והרשאות, מבנה ממשק | 15/15 · הקמה 8/8 |
| 2 | איתור, מלאי, ייצוא Excel, משתמשים ויחידות, שינוי סיסמה | 43/43 |
| 3 | בקשות, הקצאה, חתימה דיגיטלית, קבלות, מייל + SMS | 25/25 |
| 4 | זימוני החזרה, פעולות מרוכזות, סריקת ברקוד | 26/26 · סריקה עם מצלמה מדומה וברקוד Code128 אמיתי 2/2 |
| 5 | מנהל מערכת, טעינה מאקסל, קטגוריות, ניפוק ישיר, סרגל מתכווץ, עריכת משתמש | 38/38 · קידום עצמי בנייד 6/6 |

בדיקות נוספות: התאמת מוני מלאי לנתונים בפועל (0 אי-התאמות לאחר כל שלב), זיהוי זיוף מסמך חתום, קליטת מיילים ו-SMS בשרתי בדיקה מקומיים עם אימות HMAC, ניגודיות צבעים בחישוב, ומיגרציות על DB ריק ועל DB עם נתונים.

---

## 10. פתוחים והמלצות

| נושא | המלצה | הערה |
|---|---|---|
| מייל ו-SMS | להגדיר SMTP וספק SMS ב-Vercel | עד אז ההתראות לא נשלחות (נרשם ביומן) |
| סריקת ברקוד | לבדוק בטלפון אמיתי באתר הייצור | נבדק רק עם מצלמה מדומה; דורש HTTPS והרשאת מצלמה |
| Node.js | לשקול מעבר ל-24.x (LTS) | `@zxing/library` 0.23.0 מצהירה על Node ≥ 24; כרגע אזהרה בלבד (רצה בדפדפן) |
| סיסמה שנחשפה בשיחה | להחליף במסך "שינוי סיסמה" | |
| אתר הדגמה | פרויקט Vercel נפרד עם נתוני דוגמה (רשות) | ללא SMTP/SMS; ללא נתונים אמיתיים |
| מצב כהה | (רשות) | המערכת והגרפים בנויים למצב בהיר בלבד |
| חתימה רק בעמדת מרלו"ג | (רשות) | כיום עובד יכול לחתום על הקצאה מהנייד לפני איסוף פיזי |
| תמונות חתימה | מעבר ל-Vercel Blob אם נפח ה-DB יגדל | כ-10–30KB לחתימה (הערכה) |
| Prisma 8 | לשקול רק אחרי שחרור יציב | |

---

## 11. פרומפטים להמשך הפיתוח ב-Claude Code

העתיקו לפי הצורך. Claude Code קורא את `CLAUDE.md` בפרויקט, הכולל את ההנחיות: עברית, Arial בכל התוצרים, מידע מהימן בלבד, ואתגור כל הצעה עם סימוכין.

### פרומפט: הגדרת שליחת מייל ו-SMS
> "חבר את שליחת ההתראות לספקים אמיתיים: הדרך אותי שלב אחר שלב בהגדרת משתני SMTP ו-`SMS_WEBHOOK_URL` ב-Vercel, הוסף במסך הניהול כפתור 'שליחת הודעת בדיקה' שמציג אם השליחה הצליחה, ובדוק מול יומן הפעולות. אמת את גרסת Nodemailer ואת דרישות הספק בתיעוד הרשמי."

### פרומפט: מעבר ל-Node.js 24
> "עדכן את הפרויקט ל-Node.js 24.x (LTS): עדכן `engines`, הרץ את כל בדיקות ה-E2E (שלבים 1–5, הקמה וסריקה), ודא בלוג הבנייה ב-Vercel שאזהרת ה-EBADENGINE של `@zxing/library` נעלמה. ציין סיכונים ומקורות."

### פרומפט: חתימה בעמדת מרלו"ג בלבד
> "הוסף הגדרה ברמת מערכת: חתימת עובד על הקצאה תתאפשר רק בעמדת המרלו"ג (מכשיר המחסנאי), לא מהנייד האישי. השאר את האפשרות הקיימת כברירת מחדל, הוסף מתג בלוח הניהול, ורשום כל שינוי ביומן."

### פרומפט: אתר הדגמה
> "הקם סביבת הדגמה נפרדת: פרויקט Vercel חדש עם בסיס Neon נפרד שנטען בנתוני הדוגמה, ללא SMTP/SMS, עם באנר 'סביבת הדגמה' בכל המסכים. ודא שאין בה נתוני ייצור."

### פרומפט: דוחות מתקדמים
> "הוסף ללוח הבקרה סינון לפי טווח תאריכים ויחידה (בשורה אחת מעל הגרפים, לפי סקיל dataviz), ודוח Excel של ציוד באיחור החזרה. השתמש ברכיבי `src/components/charts` הקיימים."

---

## נספח: סטיות מהתכנית המקורית

| בתכנית | בפועל | נימוק / סימוכין |
|---|---|---|
| Next.js 14 | Next.js 16.4.6 | הגרסה היציבה העדכנית בזמן הפיתוח |
| SQLite → PostgreSQL | PostgreSQL (Neon) מההתחלה | פריסה ל-Vercel (מערכת קבצים זמנית); Vercel Postgres הועבר ל-Neon |
| NextAuth / JWT | jose + bcryptjs, Session בעוגייה | הדפוס בתיעוד האימות של Next.js; ללא תלות חיצונית |
| `xlsx` (SheetJS) | ExcelJS | CVE-2023-30533, CVE-2024-22363; עיצוב תאים רק בגרסה בתשלום |
| react-signature-canvas | signature_pad 5.1.4 | הגרסה העדכנית alpha, תלויה ב-signature_pad 2.x |
| html5-qrcode | @zxing/browser | ללא עדכון מאז 04/2023 |
| 3 תפקידים | 4 (+ מנהל מערכת) | ניהול משתמשים, טעינה מאקסל, קטגוריות |
| מנהל יחידה מחתים ישירות | המנהל חותם, העובד מאשר; האחריות עוברת רק לאחר אישור | החלטת המשתמש; הציוד מגיע למנהל דרך בקשה או ניפוק – לא ישר ממלאי המרלו"ג |
| ניפוק רק דרך בקשה | + ניפוק ישיר במסך מרלו"ג | בקשת המשתמש |
| קטגוריה כמחרוזת | טבלת קטגוריות מנוהלת | בקשת המשתמש; עקביות ואייקונים |
| זימון החזרה עם מחרוזות | FK + טופס זיכוי חתום | שלמות נתונים ומסמך לעובד |
| ללא היסטוריה | יומן תנועות Append-only | דרישת "איתור וחקירה" |
| — | `AuditLog`, נעילת כניסה, `/setup` מוגן | תקנות הגנת הפרטיות (אבטחת מידע) |
