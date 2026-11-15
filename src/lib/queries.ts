import "server-only";
import { db } from "./db";

/** תיק הציוד של עובד: פריטים סידוריים + כמותיים, כולל תאריך חתימה אחרון */
export async function getUserEquipment(userId: string) {
  const [serials, holdings] = await Promise.all([
    db.inventorySerial.findMany({
      where: { holderId: userId },
      include: {
        catalogItem: { select: { sku: true, name: true, category: true } },
        transactions: {
          where: { type: "ISSUE", toUserId: userId },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { catalogItem: { name: "asc" } },
    }),
    db.quantityHolding.findMany({
      where: { userId, OR: [{ quantity: { gt: 0 } }, { pendingAckQty: { gt: 0 } }] },
      include: { catalogItem: { select: { sku: true, name: true, category: true } } },
      orderBy: { catalogItem: { name: "asc" } },
    }),
  ]);
  return { serials, holdings };
}
