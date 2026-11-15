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
- כתובת הייצור: **https://logisticwh.vercel.app** (ציבורית; העובדים נכנסים דרך מסך הכניסה של המערכת).
- Settings → Deployment Protection: **Standard Protection** – כתובות Preview נעולות בהתחברות Vercel.
- Production Branch: `main`. פיתוח נעשה ב-branch נפרד ומוזג ל-`main` רק לאחר בדיקה ב-Preview.
- **Framework Preset חייב להיות Next.js.** אם הוא "Other", הבנייה מצליחה אך כל הכתובות מחזירות 404 (`NOT_FOUND`).
  הקובץ `vercel.json` מקבע `"framework": "nextjs"` כדי למנוע זאת.
