/**
 * צירוף מחלקות CSS (תואם לחתימת `cn` של shadcn/ui).
 * גרסה ללא תלויות: מסננת ערכים ריקים ומחברת. לא ממזגת התנגשויות Tailwind
 * (את זה עושה tailwind-merge) – אצלנו הרכיבים לא מעבירים מחלקות סותרות, ולכן אין צורך בתלות נוספת.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
