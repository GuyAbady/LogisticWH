import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import nodemailer, { type Transporter } from "nodemailer";
import { audit } from "./audit";

/*
 * שליחת התראות: מייל (Nodemailer/SMTP) ו-Webhook לספק SMS.
 * שניהם אופציונליים – אם לא הוגדרו משתני סביבה, הפעולה העסקית ממשיכה כרגיל
 * ונרשם ביומן שההתראה לא נשלחה. כשל בשליחה לעולם אינו מבטל חתימה/הקצאה.
 */

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** כתובת בסיס לקישורים בהודעות: APP_URL אם הוגדר, אחרת דומיין הייצור של Vercel, אחרת ה-Host של הבקשה */
export async function appBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

let transporter: Transporter | null = null;
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/** מעטפת HTML אחידה למיילים: RTL, Arial */
export function emailLayout(title: string, bodyHtml: string) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;direction:rtl;text-align:right">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#1e293b;color:#fff;padding:12px 16px;border-radius:10px 10px 0 0;font-weight:bold">LogisticWH</div>
<div style="background:#fff;border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 10px 10px">
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h1>${bodyHtml}</div>
<p style="font-size:12px;color:#475569;margin-top:12px">הודעה אוטומטית ממערכת LogisticWH. אין להשיב למייל זה.</p>
</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string, userId?: string) {
  const t = getTransporter();
  if (!t) {
    await audit({ userId, action: "EMAIL_SKIPPED", details: `SMTP לא מוגדר · ${subject}` });
    return { sent: false as const, reason: "SMTP לא מוגדר" };
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || "LogisticWH <no-reply@example.com>", to, subject, html });
    await audit({ userId, action: "EMAIL_SENT", details: subject });
    return { sent: true as const };
  } catch (e) {
    console.error("email failed", e);
    await audit({ userId, action: "EMAIL_FAILED", details: subject });
    return { sent: false as const, reason: "שליחה נכשלה" };
  }
}

/**
 * Webhook ל-SMS: POST JSON {to, message, url}. אם SMS_WEBHOOK_SECRET מוגדר –
 * נשלחת כותרת X-LogisticWH-Signature = HMAC-SHA256(body), כדי שהספק יוכל לאמת מקור.
 */
export async function sendSmsWebhook(to: string, message: string, url: string | undefined, userId?: string) {
  const endpoint = process.env.SMS_WEBHOOK_URL;
  if (!endpoint) {
    await audit({ userId, action: "SMS_SKIPPED", details: "SMS_WEBHOOK_URL לא מוגדר" });
    return { sent: false as const, reason: "Webhook לא מוגדר" };
  }
  const body = JSON.stringify({ to, message, url });
  const hdrs: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.SMS_WEBHOOK_SECRET) {
    hdrs["X-LogisticWH-Signature"] = createHmac("sha256", process.env.SMS_WEBHOOK_SECRET).update(body).digest("hex");
  }
  try {
    const res = await fetch(endpoint, { method: "POST", headers: hdrs, body, signal: AbortSignal.timeout(5000) });
    await audit({ userId, action: res.ok ? "SMS_SENT" : "SMS_FAILED", details: `HTTP ${res.status}` });
    return res.ok ? { sent: true as const } : { sent: false as const, reason: `HTTP ${res.status}` };
  } catch (e) {
    console.error("sms webhook failed", e);
    await audit({ userId, action: "SMS_FAILED", details: "timeout/network" });
    return { sent: false as const, reason: "שליחה נכשלה" };
  }
}
