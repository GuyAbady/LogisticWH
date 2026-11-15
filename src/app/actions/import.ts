"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { applyImport, buildCredentialsFile, MAX_FILE_BYTES, planImport, type ImportPlan } from "@/lib/user-import";

export type ImportState =
  | { mode: "preview" | "done"; plan: ImportPlan; credentialsFile?: string; credentialsCount?: number; error?: undefined }
  | { error: string; mode?: undefined }
  | undefined;

async function readFile(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "יש לבחור קובץ" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "יש להעלות קובץ ‎.xlsx" };
  if (file.size > MAX_FILE_BYTES) return { error: "הקובץ גדול מ-900KB. פצלו לכמה קבצים." };
  return { buffer: await file.arrayBuffer() };
}

export async function importUsersAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  // מנהל מערכת בלבד (requireRole("ADMIN") – תפקיד אחר מופנה לדף הבית שלו)
  const user = await requireRole("ADMIN");
  const f = await readFile(fd);
  if ("error" in f) return { error: f.error! };
  const createUnits = fd.get("createUnits") === "on";

  if (fd.get("intent") !== "commit") {
    const plan = await planImport(f.buffer, createUnits);
    delete plan._parsed;
    return plan.fatal ? { error: plan.fatal } : { mode: "preview", plan };
  }

  try {
    const { plan, credentials } = await applyImport(f.buffer, createUnits);
    if (plan.fatal) return { error: plan.fatal };
    await audit({
      userId: user.id, action: "USERS_IMPORT", entity: "User",
      details: `חדשים ${plan.counts.new}, עודכנו ${plan.counts.update}, שגויים ${plan.counts.error}, יחידות חדשות ${plan.newUnits.length}`,
    });
    revalidatePath("/warehouse/users");
    return {
      mode: "done",
      plan,
      credentialsCount: credentials.length,
      credentialsFile: credentials.length ? await buildCredentialsFile(credentials) : undefined,
    };
  } catch (e) {
    console.error(e);
    return { error: "הטעינה נכשלה ולא נשמר דבר (הכל בוצע בטרנזקציה אחת). נסו שוב." };
  }
}
