"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Eraser } from "lucide-react";

/*
 * תיבת חתימה למסך מגע, מבוססת signature_pad 5 (ולא react-signature-canvas, שגרסתו העדכנית היא alpha
 * ותלויה ב-signature_pad 2.x משנת 2018).
 * - קנבס בצפיפות פיקסלים של המסך (devicePixelRatio) – חתימה חדה ברטינה.
 * - שינוי גודל/סיבוב מסך משחזר את הקווים (toData/fromData) במקום למחוק אותם.
 * - הערך נשמר בשדה נסתר name={name} כ-PNG Base64 על רקע לבן (מתאים להדפסה).
 */
export default function SignatureField({ name = "signature" }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current!;
    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255,255,255)",
      penColor: "#0f172a",
      minWidth: 0.8,
      maxWidth: 2.6,
    });
    padRef.current = pad;

    const resize = () => {
      const data = pad.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")!.scale(ratio, ratio);
      pad.clear(); // ממלא את הרקע הלבן מחדש
      if (data.length) pad.fromData(data);
    };
    const onEnd = () => setValue(pad.isEmpty() ? "" : pad.toDataURL("image/png"));

    resize();
    pad.addEventListener("endStroke", onEnd);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      pad.removeEventListener("endStroke", onEnd);
      pad.off();
    };
  }, []);

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          className="block h-48 w-full touch-none rounded-xl md:h-56"
          aria-label="תיבת חתימה – חתמו באצבע או בעכבר"
          role="img"
        />
        {!value && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">חתמו כאן</span>
        )}
        <span className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-slate-200" aria-hidden />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
        <span>{value ? "החתימה נקלטה" : "יש לחתום בתוך המסגרת"}</span>
        <button
          type="button"
          className="btn-secondary min-h-9 px-3 text-xs"
          onClick={() => {
            padRef.current?.clear();
            setValue("");
          }}
        >
          <Eraser className="size-3.5" aria-hidden /> ניקוי
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
