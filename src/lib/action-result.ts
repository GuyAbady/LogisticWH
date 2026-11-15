// תוצאה אחידה ל-Server Actions המשמשים עם useActionState
export type ActionResult = { ok?: string; error?: string } | undefined;

export function errorMessage(e: unknown, fallback = "אירעה שגיאה. נסה שוב.") {
  if (e && typeof e === "object" && "code" in e && e.code === "P2002") return "ערך כפול – קיים כבר רשומה עם אותם פרטים";
  if (e instanceof Error && ["InventoryError", "RequestError", "ReturnError", "BulkError", "IssueError"].includes(e.name)) return e.message;
  console.error(e);
  return fallback;
}
