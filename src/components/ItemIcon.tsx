import { createElement } from "react";
import {
  Battery, Cable, Hand, HardHat, Laptop, Package, RadioTower, Shirt, Smartphone, Tablet, Monitor, Headphones, Wrench,
  type LucideIcon,
} from "lucide-react";

/*
 * אייקון לפי שם הפריט (ואם אין התאמה – לפי קטגוריה). Lucide בלבד – SVG עקבי,
 * ללא אימוג'י (ui-ux-pro-max: "No emojis as icons").
 */
const BY_NAME: [RegExp, LucideIcon][] = [
  [/מחשב|לפטופ|laptop/i, Laptop],
  [/טאבלט|tablet/i, Tablet],
  [/טלפון|סמארטפון|phone/i, Smartphone],
  [/קשר|radio|מוטורולה/i, RadioTower],
  [/אפוד|חולצ|מדים|vest/i, Shirt],
  [/כפפ|glove/i, Hand],
  [/קסד|helmet/i, HardHat],
  [/סוללה|סוללות|battery/i, Battery],
  [/כבל|cable|מטען/i, Cable],
  [/מסך|monitor/i, Monitor],
  [/אוזני|headset/i, Headphones],
  [/כלי|מברג|wrench/i, Wrench],
];
const BY_CATEGORY: [RegExp, LucideIcon][] = [
  [/מחשוב/, Laptop],
  [/תקשורת/, RadioTower],
  [/מגן|בטיחות/, HardHat],
  [/מתכל/, Battery],
];

/** אייקונים לבחירה בקטגוריה (מפתח → אייקון) */
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  package: { icon: Package, label: "כללי" },
  laptop: { icon: Laptop, label: "מחשב" },
  tablet: { icon: Tablet, label: "טאבלט" },
  phone: { icon: Smartphone, label: "טלפון" },
  radio: { icon: RadioTower, label: "קשר" },
  monitor: { icon: Monitor, label: "מסך" },
  headphones: { icon: Headphones, label: "שמע" },
  cable: { icon: Cable, label: "כבלים" },
  battery: { icon: Battery, label: "סוללות" },
  hardhat: { icon: HardHat, label: "ציוד מגן" },
  shirt: { icon: Shirt, label: "ביגוד" },
  hand: { icon: Hand, label: "כפפות" },
  wrench: { icon: Wrench, label: "כלי עבודה" },
};

/** סדר עדיפות: לפי שם הפריט → אייקון שנבחר לקטגוריה → לפי שם הקטגוריה → כללי */
export function iconFor(name: string, category?: string, iconKey?: string | null): LucideIcon {
  return (
    BY_NAME.find(([re]) => re.test(name))?.[1] ??
    (iconKey ? CATEGORY_ICONS[iconKey]?.icon : undefined) ??
    (category ? BY_CATEGORY.find(([re]) => re.test(category))?.[1] : undefined) ??
    Package
  );
}

/** שבב אייקון: ריבוע מעוגל עם רקע עדין */
export default function ItemIcon({ name, category, iconKey, size = "md" }: { name: string; category?: string; iconKey?: string | null; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "size-7 rounded-lg" : size === "lg" ? "size-11 rounded-xl" : "size-9 rounded-xl";
  const ico = size === "sm" ? "size-3.5" : size === "lg" ? "size-5" : "size-4";
  return (
    <span className={`grid shrink-0 place-items-center bg-slate-100 text-slate-700 ${box}`} aria-hidden>
      {createElement(iconFor(name, category, iconKey), { className: ico, strokeWidth: 1.75 })}
    </span>
  );
}
