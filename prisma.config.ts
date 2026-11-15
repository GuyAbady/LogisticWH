import "dotenv/config";
import { defineConfig } from "prisma/config";

// ב-Vercel (Neon דרך ה-Marketplace) יש להגדיר:
//   DATABASE_URL          – מחרוזת Pooled לשימוש האפליקציה
//   DATABASE_URL_UNPOOLED – מחרוזת ישירה עבור migrations
// בפיתוח מקומי מספיק DATABASE_URL.
const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url: migrationUrl },
});
