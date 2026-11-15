/* נתוני דוגמה ל-LogisticWH. הרצה: npx prisma db seed
 * כל המשתמשים מקבלים את סיסמת הדוגמה DEMO_PASSWORD – לסביבת פיתוח בלבד!
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const DEMO_PASSWORD = "Demo1234!";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("אין להריץ נתוני דוגמה בסביבת ייצור");
  }

  // ניקוי (סדר הפוך לתלויות)
  await db.auditLog.deleteMany();
  await db.returnSummons.deleteMany();
  await db.transaction.deleteMany();
  await db.signature.deleteMany();
  await db.quantityHolding.deleteMany();
  await db.inventorySerial.deleteMany();
  await db.equipmentRequest.deleteMany();
  await db.catalogItem.deleteMany();
  await db.category.deleteMany();
  await db.user.deleteMany();
  await db.unit.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // פיזור תאריכי תנועות לדוגמה על פני השבועיים האחרונים – כדי שגרף הפעילות יהיה מייצג
  const daysAgo = (d: number, h = 10) => new Date(Date.now() - d * 86400000 - h * 3600000 + 12 * 3600000);
  let cursor = 12;
  const nextDay = () => {
    cursor = cursor <= 1 ? 12 : cursor - 1;
    return daysAgo(cursor, 9 + (cursor % 7));
  };

  // ── יחידות ──
  const [logistics, it, ops] = await Promise.all([
    db.unit.create({ data: { name: 'מרלו"ג מרכזי', code: "WH" } }),
    db.unit.create({ data: { name: "מערכות מידע", code: "IT" } }),
    db.unit.create({ data: { name: "תפעול ושטח", code: "OPS" } }),
  ]);

  // ── משתמשים ──
  const mkUser = (
    employeeNumber: string,
    fullName: string,
    email: string,
    phone: string,
    role: "EMPLOYEE" | "UNIT_MANAGER" | "WAREHOUSE_MANAGER" | "ADMIN",
    unitId: string,
  ) =>
    db.user.create({
      data: { employeeNumber, fullName, email, phone, role, unitId, passwordHash },
    });

  const admin = await mkUser("9000", "מנהלת מערכת", "admin@demo.local", "050-0000009", "ADMIN", logistics.id);
  void admin;
  const whManager = await mkUser("1001", "דנה לוי", "warehouse@demo.local", "050-0000001", "WAREHOUSE_MANAGER", logistics.id);
  const itManager = await mkUser("2001", "יוסי כהן", "it.manager@demo.local", "050-0000002", "UNIT_MANAGER", it.id);
  const opsManager = await mkUser("3001", "מיכל אברהם", "ops.manager@demo.local", "050-0000003", "UNIT_MANAGER", ops.id);
  const itEmp1 = await mkUser("2002", "אבי מזרחי", "avi@demo.local", "050-0000004", "EMPLOYEE", it.id);
  const itEmp2 = await mkUser("2003", "נועה פרץ", "noa@demo.local", "050-0000005", "EMPLOYEE", it.id);
  const opsEmp1 = await mkUser("3002", "רון ביטון", "ron@demo.local", "050-0000006", "EMPLOYEE", ops.id);
  const opsEmp2 = await mkUser("3003", "שירה דהן", "shira@demo.local", "050-0000007", "EMPLOYEE", ops.id);

  // ── קטגוריות ──
  for (const [name, icon] of [["מחשוב", "laptop"], ["תקשורת", "radio"], ["ציוד מגן", "hardhat"], ["מתכלים", "battery"]] as const) {
    await db.category.create({ data: { name, icon } });
  }

  // ── קטלוג ──
  const serialItems = [
    { sku: "LAP-001", name: "מחשב נייד Dell Latitude", category: "מחשוב", prefix: "DL", count: 8 },
    { sku: "PHN-001", name: "טלפון נייד Samsung Galaxy", category: "תקשורת", prefix: "SG", count: 6 },
    { sku: "RAD-001", name: "מכשיר קשר Motorola", category: "תקשורת", prefix: "MT", count: 10 },
    { sku: "TAB-001", name: "טאבלט שטח מוקשח", category: "מחשוב", prefix: "TB", count: 4 },
  ];
  const quantityItems = [
    { sku: "VST-001", name: "אפוד זוהר", category: "ציוד מגן", qty: 120 },
    { sku: "GLV-001", name: "כפפות עבודה (זוג)", category: "ציוד מגן", qty: 300 },
    { sku: "HLM-001", name: "קסדת מגן", category: "ציוד מגן", qty: 40 },
    { sku: "BAT-001", name: "סוללה AA (מארז 4)", category: "מתכלים", qty: 500 },
    { sku: "CBL-001", name: "כבל USB-C", category: "מחשוב", qty: 80 },
  ];

  const catalog: Record<string, { id: string; serialIds: string[] }> = {};

  for (const it2 of serialItems) {
    const item = await db.catalogItem.create({
      data: {
        sku: it2.sku,
        name: it2.name,
        category: it2.category,
        requiresSerial: true,
        totalQuantity: it2.count,
        availableQty: it2.count,
      },
    });
    const serialIds: string[] = [];
    for (let i = 1; i <= it2.count; i++) {
      const s = await db.inventorySerial.create({
        data: { serialNumber: `${it2.prefix}-${String(1000 + i)}`, catalogItemId: item.id },
      });
      serialIds.push(s.id);
    }
    await db.transaction.create({
      data: { type: "STOCK_IN", catalogItemId: item.id, quantity: it2.count, performedById: whManager.id, note: "קליטת מלאי ראשונית", createdAt: daysAgo(13) },
    });
    catalog[it2.sku] = { id: item.id, serialIds };
  }

  for (const q of quantityItems) {
    const item = await db.catalogItem.create({
      data: { sku: q.sku, name: q.name, category: q.category, totalQuantity: q.qty, availableQty: q.qty },
    });
    await db.transaction.create({
      data: { type: "STOCK_IN", catalogItemId: item.id, quantity: q.qty, performedById: whManager.id, note: "קליטת מלאי ראשונית", createdAt: daysAgo(serialItems.length + quantityItems.indexOf(q) > 7 ? 6 : 13) },
    });
    catalog[q.sku] = { id: item.id, serialIds: [] };
  }

  // ── שיוכים חתומים לדוגמה ──
  // סימון: חתימות דוגמה ללא תמונה אמיתית (מחרוזת ריקה) – רק לצורך המחשה.
  async function issueSerial(sku: string, idx: number, userId: string) {
    const serialId = catalog[sku].serialIds[idx];
    const sig = await db.signature.create({
      data: {
        kind: "RECEIPT",
        signerId: userId,
        imageData: "",
        documentHash: "seed",
        documentJson: JSON.stringify({ seed: true, serialId }),
      },
    });
    await db.inventorySerial.update({ where: { id: serialId }, data: { status: "SIGNED", holderId: userId } });
    await db.catalogItem.update({ where: { id: catalog[sku].id }, data: { availableQty: { decrement: 1 } } });
    await db.transaction.create({
      data: {
        type: "ISSUE",
        catalogItemId: catalog[sku].id,
        serialId,
        quantity: 1,
        toUserId: userId,
        performedById: whManager.id,
        signatureId: sig.id,
        createdAt: nextDay(),
      },
    });
  }

  async function issueQty(sku: string, qty: number, userId: string) {
    const sig = await db.signature.create({
      data: {
        kind: "RECEIPT",
        signerId: userId,
        imageData: "",
        documentHash: "seed",
        documentJson: JSON.stringify({ seed: true, sku, qty }),
      },
    });
    await db.quantityHolding.upsert({
      where: { catalogItemId_userId: { catalogItemId: catalog[sku].id, userId } },
      create: { catalogItemId: catalog[sku].id, userId, quantity: qty },
      update: { quantity: { increment: qty } },
    });
    await db.catalogItem.update({ where: { id: catalog[sku].id }, data: { availableQty: { decrement: qty } } });
    await db.transaction.create({
      data: { type: "ISSUE", catalogItemId: catalog[sku].id, quantity: qty, toUserId: userId, performedById: whManager.id, signatureId: sig.id, createdAt: nextDay() },
    });
  }

  await issueSerial("LAP-001", 0, itEmp1.id);
  await issueSerial("LAP-001", 1, itEmp2.id);
  await issueSerial("LAP-001", 2, itManager.id);
  await issueSerial("PHN-001", 0, itEmp1.id);
  await issueSerial("RAD-001", 0, opsEmp1.id);
  await issueSerial("RAD-001", 1, opsEmp2.id);
  await issueSerial("TAB-001", 0, opsEmp1.id);
  await issueQty("VST-001", 1, opsEmp1.id);
  await issueQty("VST-001", 1, opsEmp2.id);
  await issueQty("GLV-001", 4, opsEmp1.id);
  await issueQty("HLM-001", 1, opsEmp2.id);
  await issueQty("CBL-001", 2, itEmp1.id);
  // ציוד על מנהל היחידה – לחלוקה מרוכזת (שלב 4)
  await issueSerial("RAD-001", 2, itManager.id);
  await issueQty("CBL-001", 6, itManager.id);

  // ── בקשות לדוגמה ──
  await db.equipmentRequest.create({
    data: {
      requesterId: itEmp2.id,
      unitId: it.id,
      catalogItemId: catalog["PHN-001"].id,
      quantity: 1,
      justification: "טלפון לתורנות חירום",
    },
  });
  await db.equipmentRequest.create({
    data: {
      requesterId: opsEmp2.id,
      unitId: ops.id,
      catalogItemId: catalog["GLV-001"].id,
      quantity: 2,
      status: "PENDING_WAREHOUSE",
      managerId: opsManager.id,
      managerDecidedAt: new Date(),
      managerNote: "מאושר",
      justification: "החלפת כפפות בלויות",
    },
  });

  console.log("✔ נתוני דוגמה נטענו. סיסמה לכל המשתמשים:", DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
