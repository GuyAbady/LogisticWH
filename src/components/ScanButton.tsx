"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";

/*
 * סריקת ברקוד / QR ממצלמת הנייד – @zxing/browser 0.2.1 (html5-qrcode שבתוכנית לא מתוחזק מאז 2023).
 * הספרייה נטענת רק בלחיצה (dynamic import) כדי לא להכביד על טעינת הדפים.
 * מצבים:
 *  - fill:   מילוי שדה (ואופציונלית שליחת הטופס) – לחיפוש
 *  - append: הוספת שורה לתיבת טקסט – לקליטת מספרים סידוריים, סריקה רציפה
 *  - check:  סימון תיבה שה-data-scan שלה תואם – לבחירת פריטים בהחזרה, סריקה רציפה
 * דורש HTTPS (או localhost) והרשאת מצלמה.
 */
type Props = {
  targetId?: string;
  mode: "fill" | "append" | "check";
  submit?: boolean;
  label?: string;
};

type Controls = { stop: () => void };

export default function ScanButton({ targetId, mode, submit, label = "סריקה" }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const recent = useRef<{ v: string; t: number } | null>(null);

  const close = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const handle = (value: string) => {
      // התעלמות מאותו קוד שנקרא שוב בתוך 2 שניות
      const now = Date.now();
      if (recent.current && recent.current.v === value && now - recent.current.t < 2000) return;
      recent.current = { v: value, t: now };
      if (navigator.vibrate) navigator.vibrate(40);

      if (mode === "check") {
        const box = document.querySelector<HTMLInputElement>(`input[data-scan="${CSS.escape(value)}"]`);
        if (box) {
          box.checked = true;
          box.dispatchEvent(new Event("change", { bubbles: true }));
          setLast(`סומן: ${value}`);
        } else setLast(`לא נמצא ברשימה: ${value}`);
        return;
      }
      const el = targetId ? (document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null) : null;
      if (!el) return;
      if (mode === "append") {
        const lines = el.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (!lines.includes(value)) el.value = [...lines, value].join("\n");
        setLast(`נוסף: ${value}`);
        return;
      }
      el.value = value;
      close();
      if (submit) el.form?.requestSubmit();
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("הדפדפן אינו מאפשר גישה למצלמה (נדרש חיבור מאובטח HTTPS).");
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result) => {
            if (result) handle(result.getText().trim());
          },
        );
        if (cancelled) controlsRef.current.stop();
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "NotAllowedError" ? "לא ניתנה הרשאה למצלמה. אשרו גישה בהגדרות הדפדפן ונסו שוב."
          : name === "NotFoundError" ? "לא נמצאה מצלמה במכשיר."
          : "לא ניתן להפעיל את המצלמה.",
        );
      }
    })();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- מופעל רק בפתיחה/סגירה
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => { setError(null); setLast(null); setOpen(true); }} className="btn-secondary shrink-0" aria-label={`${label} ברקוד במצלמה`}>
        <ScanLine className="size-4" aria-hidden /> {label}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="סריקת ברקוד" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <div className="feedback-enter w-full max-w-md rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">סריקת ברקוד</h2>
              <button type="button" onClick={close} className="grid size-11 place-items-center rounded-lg hover:bg-slate-100" aria-label="סגירה">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {error ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
            ) : (
              <div className="relative overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-accent-600/80" aria-hidden />
              </div>
            )}
            <p className="mt-3 min-h-5 text-sm text-slate-700" aria-live="polite">
              {last ?? (mode === "fill" ? "כוונו את המצלמה לברקוד" : "סריקה רציפה – סרקו פריט אחרי פריט")}
            </p>
            {mode !== "fill" && !error && (
              <button type="button" onClick={close} className="btn-primary mt-2 w-full">סיום</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
