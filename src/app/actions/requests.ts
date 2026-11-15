"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { audit, getClientIp } from "@/lib/audit";
import { errorMessage, type ActionResult } from "@/lib/action-result";
import { israelLocalToUtc } from "@/lib/time";
import { validateSignatureImage } from "@/lib/receipt";
import { appBaseUrl, emailLayout, escapeHtml, sendEmail, sendSmsWebhook } from "@/lib/notify";
import {
  allocateRequest, cancelRequest, createRequest, managerDecision, releaseAllocation, signReceipt, warehouseReject,
} from "@/lib/requests";

const fmtIL = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(d);

function revalidateAll() {
  for (const p of ["/employee", "/manager", "/warehouse"]) revalidatePath(p, "layout");
}

// ───────── עובד ─────────

const NewRequestSchema = z.object({
  catalogItemId: z.string().uuid("יש לבחור פריט"),
  quantity: z.coerce.number().int().min(1, "כמות מינימלית 1").max(100, "כמות מקסימלית 100"),
  justification: z.string().trim().max(500).optional(),
});

export async function submitRequest(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const parsed = NewRequestSchema.safeParse({
    catalogItemId: fd.get("catalogItemId"),
    quantity: fd.get("quantity"),
    justification: (fd.get("justification") as string) || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const r = await createRequest(user, parsed.data);
    await audit({ userId: user.id, action: "REQUEST_CREATE", entity: "EquipmentRequest", entityId: r.id });
    revalidateAll();
    return { ok: r.status === "PENDING_WAREHOUSE" ? 'הבקשה נשלחה ישירות למרלו"ג' : "הבקשה נשלחה לאישור מנהל היחידה" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function cancelMyRequest(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const id = String(fd.get("requestId") ?? "");
  try {
    await cancelRequest(user, id);
    await audit({ userId: user.id, action: "REQUEST_CANCEL", entity: "EquipmentRequest", entityId: id });
    revalidateAll();
    return { ok: "הבקשה בוטלה" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// ───────── מנהל יחידה ─────────

export async function decideRequest(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("UNIT_MANAGER");
  const id = String(fd.get("requestId") ?? "");
  const approve = fd.get("decision") === "approve";
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || undefined;
  try {
    await managerDecision(user, id, approve, note);
    await audit({ userId: user.id, action: approve ? "REQUEST_APPROVE" : "REQUEST_REJECT", entity: "EquipmentRequest", entityId: id });
    revalidateAll();
    return { ok: approve ? 'אושר והועבר למרלו"ג' : "הבקשה נדחתה" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// ───────── מרלו"ג ─────────

export async function allocate(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const requestId = String(fd.get("requestId") ?? "");
  const pickupDate = israelLocalToUtc(String(fd.get("pickupDate") ?? ""));
  if (!pickupDate) return { error: "יש לבחור מועד איסוף" };
  const serialIds = fd.getAll("serialIds").map(String);
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || undefined;
  try {
    const r = await allocateRequest(user, { requestId, serialIds, pickupDate, note });
    await audit({ userId: user.id, action: "REQUEST_ALLOCATE", entity: "EquipmentRequest", entityId: requestId });

    // הודעה לעובד: הציוד מוכן לאיסוף וחתימה
    const emp = await db.user.findUniqueOrThrow({ where: { id: r.requesterId } });
    const url = `${await appBaseUrl()}/employee/sign/${requestId}`;
    const when = fmtIL(pickupDate);
    await sendEmail(
      emp.email,
      'ציוד מוכן לאיסוף – LogisticWH',
      emailLayout("הציוד שביקשת מוכן לאיסוף", `
        <p>שלום ${escapeHtml(emp.fullName)},</p>
        <p>הוקצה עבורך: <b>${escapeHtml(r.catalogItem.name)}</b> (כמות ${r.quantity}).</p>
        <p>מועד איסוף: <b>${escapeHtml(when)}</b></p>
        ${note ? `<p>הערת המרלו"ג: ${escapeHtml(note)}</p>` : ""}
        <p><a href="${url}" style="display:inline-block;background:#047857;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">לחתימה על קבלת הציוד</a></p>`),
      emp.id,
    );
    await sendSmsWebhook(emp.phone, `LogisticWH: ${r.catalogItem.name} מוכן לאיסוף ב-${when}. לחתימה: ${url}`, url, emp.id);

    revalidateAll();
    return { ok: "הציוד הוקצה והעובד עודכן" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function release(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const id = String(fd.get("requestId") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || undefined;
  try {
    await releaseAllocation(user, id, note);
    await audit({ userId: user.id, action: "REQUEST_RELEASE", entity: "EquipmentRequest", entityId: id });
    revalidateAll();
    return { ok: "ההקצאה שוחררה והבקשה חזרה לתור" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function rejectByWarehouse(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const id = String(fd.get("requestId") ?? "");
  try {
    await warehouseReject(user, id, String(fd.get("note") ?? "").slice(0, 300));
    await audit({ userId: user.id, action: "REQUEST_REJECT_WH", entity: "EquipmentRequest", entityId: id });
    revalidateAll();
    return { ok: "הבקשה נדחתה" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// ───────── חתימה ─────────

export async function submitSignature(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const requestId = String(fd.get("requestId") ?? "");
  const imageData = String(fd.get("signature") ?? "");
  if (fd.get("agree") !== "on") return { error: "יש לאשר את תנאי הקבלה" };
  const invalid = validateSignatureImage(imageData);
  if (invalid) return { error: invalid };

  let signatureId: string;
  try {
    const res = await signReceipt(user, {
      requestId,
      imageData,
      ipAddress: await getClientIp(),
      userAgent: (await headers()).get("user-agent"),
    });
    signatureId = res.signatureId;
    await audit({ userId: user.id, action: "RECEIPT_SIGNED", entity: "Signature", entityId: signatureId });

    // קבלה למייל ולנייד (כשל בשליחה אינו מבטל את החתימה)
    const url = `${await appBaseUrl()}/receipts/${signatureId}`;
    const rows = res.doc.items
      .map((i) => `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0">${escapeHtml(i.name)}</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;direction:ltr;text-align:right">${escapeHtml(i.serialNumber ?? "—")}</td><td style="padding:6px;border-bottom:1px solid #e2e8f0">${i.quantity}</td></tr>`)
      .join("");
    await sendEmail(
      user.email,
      "קבלה דיגיטלית על ציוד – LogisticWH",
      emailLayout("קבלה דיגיטלית על קבלת ציוד", `
        <p>שלום ${escapeHtml(user.fullName)}, חתימתך נקלטה ב-${escapeHtml(fmtIL(new Date(res.doc.signedAt)))}.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px"><tr style="color:#475569"><th style="text-align:right;padding:6px">פריט</th><th style="text-align:right;padding:6px">מספר סידורי</th><th style="text-align:right;padding:6px">כמות</th></tr>${rows}</table>
        <p><a href="${url}">לצפייה בקבלה המלאה</a></p>`),
      user.id,
    );
    await sendSmsWebhook(user.phone, `LogisticWH: חתמת על קבלת ציוד. קבלה: ${url}`, url, user.id);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateAll();
  redirect(`/receipts/${signatureId}?new=1`);
}
