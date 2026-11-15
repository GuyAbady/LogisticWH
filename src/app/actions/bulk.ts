"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { managerActor, requireRole } from "@/lib/dal";
import { audit, getClientIp } from "@/lib/audit";
import { errorMessage, type ActionResult } from "@/lib/action-result";
import { validateSignatureImage } from "@/lib/receipt";
import { appBaseUrl, emailLayout, escapeHtml, sendEmail, sendSmsWebhook } from "@/lib/notify";
import { acknowledgeTransfers, bulkCollect, bulkTransfer, rejectTransfer, type BulkLine } from "@/lib/bulk";

function revalidateAll() {
  for (const p of ["/employee", "/manager", "/warehouse"]) revalidatePath(p, "layout");
}

async function sigMeta(fd: FormData) {
  const imageData = String(fd.get("signature") ?? "");
  return { imageData, invalid: validateSignatureImage(imageData), ipAddress: await getClientIp(), userAgent: (await headers()).get("user-agent") };
}

/** חלוקה: ts:<serialId>=<employeeId>, tq:<itemId>:<employeeId>=<qty> */
export async function bulkTransferAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  // מנהל יחידה – תמיד היחידה שלו; מנהל מערכת – היחידה שנבחרה בטופס
  const user = await managerActor(await requireRole("UNIT_MANAGER"), fd.get("unitId") as string | null);
  const s = await sigMeta(fd);
  if (s.invalid) return { error: s.invalid };
  const lines: BulkLine[] = [];
  for (const [k, v] of fd.entries()) {
    const val = String(v);
    if (k.startsWith("ts:") && val) lines.push({ kind: "serial", serialId: k.slice(3), employeeId: val });
    if (k.startsWith("tq:") && Number(val) > 0) {
      const [, itemId, empId] = k.split(":");
      lines.push({ kind: "qty", catalogItemId: itemId, employeeId: empId, quantity: Number(val) });
    }
  }
  let signatureId: string;
  try {
    const res = await bulkTransfer(user, lines, s);
    signatureId = res.signatureId;
    await audit({ userId: user.id, action: "BULK_TRANSFER", entity: "Signature", entityId: signatureId, details: `${lines.length} שורות` });
    const url = `${await appBaseUrl()}/employee/sign`;
    for (const emp of res.employees) {
      await sendEmail(emp.email, "ציוד ממתין לאישורך – LogisticWH", emailLayout("ציוד חולק לך וממתין לאישורך", `
        <p>שלום ${escapeHtml(emp.fullName)}, מנהל/ת היחידה ${escapeHtml(user.fullName)} חילק/ה לך ציוד.</p>
        <p>עד לאישורך הציוד באחריות מנהל היחידה. <a href="${url}">לאישור קבלה</a></p>`), emp.id);
      await sendSmsWebhook(emp.phone, `LogisticWH: חולק לך ציוד ע"י ${user.fullName}. לאישור: ${url}`, url, emp.id);
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateAll();
  redirect(`/receipts/${signatureId}?new=1`);
}

/** זיכוי מרוכז: cs=<serialId>|<employeeId> (תיבות), cq:<itemId>:<employeeId>=<qty> */
export async function bulkCollectAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await managerActor(await requireRole("UNIT_MANAGER"), fd.get("unitId") as string | null);
  const s = await sigMeta(fd);
  if (s.invalid) return { error: s.invalid };
  const lines: BulkLine[] = [];
  for (const v of fd.getAll("cs").map(String)) {
    const [serialId, employeeId] = v.split("|");
    lines.push({ kind: "serial", serialId, employeeId });
  }
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("cq:") && Number(v) > 0) {
      const [, itemId, empId] = k.split(":");
      lines.push({ kind: "qty", catalogItemId: itemId, employeeId: empId, quantity: Number(v) });
    }
  }
  let signatureId: string;
  try {
    const res = await bulkCollect(user, lines, s);
    signatureId = res.signatureId;
    await audit({ userId: user.id, action: "BULK_COLLECT", entity: "Signature", entityId: signatureId, details: `${lines.length} שורות` });
    const url = `${await appBaseUrl()}/receipts/${signatureId}`;
    for (const emp of res.employees) {
      await sendEmail(emp.email, "זיכוי ציוד – LogisticWH", emailLayout("זוכית על ציוד", `
        <p>שלום ${escapeHtml(emp.fullName)}, מנהל/ת היחידה אסף/ה ממך ציוד וזוכית עליו.</p><p><a href="${url}">לטופס הזיכוי</a></p>`), emp.id);
      await sendSmsWebhook(emp.phone, `LogisticWH: זוכית על ציוד שנאסף ע"י ${user.fullName}. טופס: ${url}`, url, emp.id);
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateAll();
  redirect(`/receipts/${signatureId}?new=1`);
}

export async function acknowledgeAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const s = await sigMeta(fd);
  if (s.invalid) return { error: s.invalid };
  const txIds = fd.getAll("ack").map(String);
  let signatureId: string;
  try {
    const res = await acknowledgeTransfers(user, txIds, s);
    signatureId = res.signatureId;
    await audit({ userId: user.id, action: "TRANSFER_ACK", entity: "Signature", entityId: signatureId });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateAll();
  redirect(`/receipts/${signatureId}?new=1`);
}

export async function rejectTransferAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const txId = String(fd.get("txId") ?? "");
  try {
    await rejectTransfer(user, txId, String(fd.get("note") ?? ""));
    await audit({ userId: user.id, action: "TRANSFER_REJECT", entity: "Transaction", entityId: txId });
    revalidateAll();
    return { ok: "ההעברה נדחתה והציוד חזר למנהל היחידה" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
