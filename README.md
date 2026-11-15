# LogisticWH

מערכת רשת רספונסיבית (Mobile-First, RTL) לניהול מלאי, מצאי והחתמות ציוד דיגיטליות במרלו"ג.

## הרצה מקומית
דרישות: Node.js 22.12 ומעלה, PostgreSQL.

```bash
cp .env.example .env        # לעדכן DATABASE_URL ו-SESSION_SECRET
npm install                 # מייצר גם את Prisma Client
npm run db:migrate          # יצירת הטבלאות
npm run db:seed             # נתוני דוגמה
npm run dev                 # http://localhost:3000
```

משתמשי דוגמה (סיסמה `Demo1234!`):

| תפקיד | דוא"ל |
|---|---|
| מנהל מרלו"ג | warehouse@demo.local |
| מנהל יחידה (מערכות מידע) | it.manager@demo.local |
| מנהל יחידה (תפעול) | ops.manager@demo.local |
| עובד | avi@demo.local, noa@demo.local, ron@demo.local, shira@demo.local |

## פריסה ל-Vercel
1. ייבוא הריפו ב-Vercel.
2. **Storage → Create Database → Neon (Postgres)** וחיבור לפרויקט. Vercel יגדיר אוטומטית
   `DATABASE_URL` (Pooled) ו-`DATABASE_URL_UNPOOLED` (ישיר, משמש ל-migrations).
3. להוסיף משתני סביבה:
   - `SESSION_SECRET` – לפחות 32 תווים אקראיים (`openssl rand -base64 32`).
   - `SETUP_TOKEN` – לפחות 16 תווים, קוד חד-פעמי להקמה ראשונית.
4. Deploy. הסקריפט `vercel-build` מריץ `prisma migrate deploy` ואז `next build`.
5. **הקמה ראשונית:** לגלוש אל `https://<הדומיין>/setup`, להזין את `SETUP_TOKEN` וליצור את מנהל המרלו"ג הראשון.
   - הדף פעיל רק כשאין אף משתמש במערכת וכש-`SETUP_TOKEN` מוגדר; לאחר היצירה הוא נסגר אוטומטית.
   - מוגן בהשוואה בזמן קבוע, חסימה אחרי 5 כישלונות ב-15 דקות, ונעילת DB נגד יצירה כפולה במקביל.
   - **אחרי ההקמה: למחוק את `SETUP_TOKEN` מ-Vercel** (ואז ה-Deploy הבא מכבה את הדף לחלוטין).
6. **לא** להריץ `db:seed` בייצור (הסקריפט חוסם זאת).

### כתובת ייצור והגנת גישה
- הכתובת `logisticwh.vercel.app` **אינה** שייכת לפרויקט (תפוסה). יש להגדיר כתובת ייצור ב-Settings → Domains
  (למשל `<שם-פנוי>.vercel.app`) ולשייך אותה ל-Production.
- Settings → Deployment Protection: **Standard Protection** – כתובת הייצור ציבורית (העובדים נכנסים דרך מסך הכניסה של המערכת),
  כתובות Preview נעולות בהתחברות Vercel.
- Production Branch: `main`. פיתוח נעשה ב-branch נפרד ומוזג ל-`main` רק לאחר בדיקה ב-Preview.

> הערה: "Vercel Postgres" הופסק והועבר ל-Neon בדצמבר 2024; כיום מסד הנתונים מוקם דרך Vercel Marketplace.
> מקורות: [Vercel Docs – Postgres](https://vercel.com/docs/postgres), [Prisma – Deploy to Vercel](https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-vercel).

## מבנה
```
prisma/schema.prisma      סכמת DB (כולל יומן תנועות וחתימות)
prisma/seed.ts            נתוני דוגמה
src/proxy.ts              הפניות לפי תפקיד (בדיקה אופטימית)
src/lib/dal.ts            בדיקת הרשאות מחייבת מול DB
src/lib/session*.ts       Session מוצפן (JWT, httpOnly)
src/app/(app)/employee    ממשק עובד
src/app/(app)/manager     ממשק מנהל יחידה
src/app/(app)/warehouse   ממשק מנהל מרלו"ג
```

## אבטחה ופרטיות
- סיסמאות: bcrypt (12 סבבים). נעילה זמנית אחרי 5 כישלונות ב-15 דקות.
- יומן פעולות (`AuditLog`) לכניסות ולפעולות רגישות – בהתאם לתקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017.
- כל דף ופעולה בודקים הרשאה בצד השרת; מנהל יחידה מוגבל ליחידתו.
