"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { audit, getClientIp } from "@/lib/audit";
import { errorMessage, type ActionResult } from "@/lib/action-result";
import { validateSignatureImage } from "@/lib/receipt";
import { israelLocalToUtc } from "@/lib/time";
import { appBaseUrl, emailLayout, escapeHtml, sendEmail, sendSmsWebhook } from "@/lib/notify";
import { cancelSummons, createSummons, receiveReturn, type ReturnItem } from "@/lib/returns";

function revalidateAll() {
  for (const p of ["/employee", "/manager", "/warehouse"]) revalidatePath(p, "layout");
}

export async function createSummonsAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const userId = String(fd.get("userId") ?? "");
  const item = String(fd.get("item") ?? "");
  const reason = String(fd.get("reason") ?? "").slice(0, 300);
  const due = String(fd.get("dueDate") ?? "");
  const dueDate = due ? israelLocalToUtc(`${due}T23:59`) : null;
  if (due && !dueDate) return { error: "תאריך לא תקין" };
  try {
    const [kind, id] = item.split(":");
    const s = await createSummons(user, {
      userId,
      reason,
      dueDate,
      ...(kind === "s" ? { serialId: id } : { catalogItemId: id, quantity: Number(fd.get("quantity") || 0) }),
    });
    await audit({ userId: user.id, action: "SUMMONS_CREATE", entity: "ReturnSummons", entityId: s.id });

    const [emp, ci] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId } }),
      db.catalogItem.findUniqueOrThrow({ where: { id: s.catalogItemId } }),
    ]);
    const url = `${await appBaseUrl()}/employee/returns`;
    const dueTxt = dueDate ? new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "Asia/Jerusalem" }).format(dueDate) : null;
    await sendEmail(emp.email, "זימון להחזרת ציוד – LogisticWH", emailLayout("זימון להחזרת ציוד", `
      <p>שלום ${escapeHtml(emp.fullName)},</p>
      <p>הנך מתבקש/ת להחזיר למרלו"ג: <b>${escapeHtml(ci.name)}</b> (כמות ${s.quantity}).</p>
      <p>סיבה: ${escapeHtml(s.reason)}</p>${dueTxt ? `<p>עד: <b>${escapeHtml(dueTxt)}</b></p>` : ""}
      <p><a href="${url}">לפרטים</a></p>`), emp.id);
    await sendSmsWebhook(emp.phone, `LogisticWH: זומנת להחזיר ${ci.name}${dueTxt ? ` עד ${dueTxt}` : ""}. פרטים: ${url}`, url, emp.id);
    revalidateAll();
    return { ok: "הזימון נשלח לעובד" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function cancelSummonsAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const id = String(fd.get("summonsId") ?? "");
  try {
    await cancelSummons(id);
    await audit({ userId: user.id, action: "SUMMONS_CANCEL", entity: "ReturnSummons", entityId: id });
    revalidateAll();
    return { ok: "הזימון בוטל" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function receiveReturnAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const userId = String(fd.get("userId") ?? "");
  const imageData = String(fd.get("signature") ?? "");
  const invalid = validateSignatureImage(imageData);
  if (invalid) return { error: invalid };

  // פריטים: תיבות סימון "ret" עם s:<serialId>; כמויות בשדות qty:<itemId>; פגום: dmg:<key>
  const items: ReturnItem[] = [];
  for (const v of fd.getAll("ret").map(String)) {
    if (v.startsWith("s:")) items.push({ kind: "serial", serialId: v.slice(2), damaged: fd.get(`dmg:${v}`) === "on" });
  }
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("qty:") && Number(v) > 0) {
      const itemId = k.slice(4);
      items.push({ kind: "qty", catalogItemId: itemId, quantity: Number(v), damaged: fd.get(`dmg:q:${itemId}`) === "on" });
    }
  }

  let signatureId: string;
  try {
    const res = await receiveReturn(user, {
      userId, items, imageData, ipAddress: await getClientIp(), userAgent: (await headers()).get("user-agent"),
    });
    signatureId = res.signatureId;
    await audit({ userId: user.id, action: "RETURN_RECEIVED", entity: "Signature", entityId: signatureId });
    const url = `${await appBaseUrl()}/receipts/${signatureId}`;
    const rows = res.doc.lines.map((l) => `<li>${escapeHtml(l.name)}${l.serialNumber ? ` (${escapeHtml(l.serialNumber)})` : ""} × ${l.quantity} – ${escapeHtml(l.condition ?? "")}</li>`).join("");
    await sendEmail(res.employee.email, "טופס אישור החזרת ציוד – LogisticWH", emailLayout("אישור החזרת ציוד (זיכוי)", `
      <p>שלום ${escapeHtml(res.employee.fullName)}, הציוד הבא נקלט במרלו"ג וזוכית עליו:</p><ul>${rows}</ul>
      <p><a href="${url}">לטופס הזיכוי החתום</a></p>`), res.employee.id);
    await sendSmsWebhook(res.employee.phone, `LogisticWH: החזרת הציוד נקלטה וזוכית. טופס זיכוי: ${url}`, url, res.employee.id);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateAll();
  redirect(`/receipts/${signatureId}?new=1`);
}
