"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { audit, getClientIp } from "@/lib/audit";
import { errorMessage, type ActionResult } from "@/lib/action-result";
import { validateSignatureImage } from "@/lib/receipt";
import { appBaseUrl, emailLayout, escapeHtml, sendEmail, sendSmsWebhook } from "@/lib/notify";
import { directIssue, type IssueLine } from "@/lib/issue";

/** ניפוק ישיר. שדות: recipientId, serialIds (תיבות), qty:<itemId>=<כמות>, signature, agree */
export async function issueAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  if (fd.get("agree") !== "on") return { error: "המקבל צריך לאשר את נוסח הקבלה" };
  const imageData = String(fd.get("signature") ?? "");
  const invalid = validateSignatureImage(imageData);
  if (invalid) return { error: invalid };

  const lines: IssueLine[] = fd.getAll("serialIds").map((v) => ({ kind: "serial" as const, serialId: String(v) }));
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("qty:") && Number(v) > 0) lines.push({ kind: "qty", catalogItemId: k.slice(4), quantity: Number(v) });
  }

  let signatureId: string;
  try {
    const res = await directIssue(user, {
      recipientId: String(fd.get("recipientId") ?? ""),
      lines,
      imageData,
      ipAddress: await getClientIp(),
      userAgent: (await headers()).get("user-agent"),
    });
    signatureId = res.signatureId;
    await audit({ userId: user.id, action: "DIRECT_ISSUE", entity: "Signature", entityId: signatureId, details: `${lines.length} שורות ל-${res.recipient.employeeNumber}` });
    const url = `${await appBaseUrl()}/receipts/${signatureId}`;
    const rows = res.lines.map((l) => `<li>${escapeHtml(l.name)}${l.serialNumber ? ` (${escapeHtml(l.serialNumber)})` : ""} × ${l.quantity}</li>`).join("");
    await sendEmail(res.recipient.email, "קבלה על ניפוק ציוד – LogisticWH", emailLayout("נופק לך ציוד מהמרלו\"ג", `
      <p>שלום ${escapeHtml(res.recipient.fullName)}, נופק לך הציוד הבא:</p><ul>${rows}</ul><p><a href="${url}">לקבלה החתומה</a></p>`), res.recipient.id);
    await sendSmsWebhook(res.recipient.phone, `LogisticWH: נופק לך ציוד מהמרלו"ג. קבלה: ${url}`, url, res.recipient.id);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  for (const p of ["/warehouse", "/employee", "/manager"]) revalidatePath(p, "layout");
  redirect(`/receipts/${signatureId}?new=1`);
}
