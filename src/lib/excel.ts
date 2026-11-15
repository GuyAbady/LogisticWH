import "server-only";
import ExcelJS from "exceljs";

/*
 * הפקת קבצי Excel אחידים: גיליון RTL, פונט Arial בכל התאים,
 * שורת כותרת מודגשת וקפואה, מסנן אוטומטי ורוחב עמודות קבוע.
 */

export type Column = { header: string; key: string; width?: number; type?: "date" | "number" | "text" };
export type Sheet = { name: string; columns: Column[]; rows: Record<string, unknown>[] };

const FONT = "Arial";

export async function buildWorkbook(title: string, sheets: Sheet[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LogisticWH";
  wb.created = new Date();
  wb.title = title;

  for (const sheet of sheets) {
    // שם גיליון: עד 31 תווים וללא תווים אסורים
    const ws = wb.addWorksheet(sheet.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31), {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
      properties: { defaultRowHeight: 18 },
    });
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 18,
      style: {
        font: { name: FONT, size: 11 },
        alignment: { horizontal: "right", vertical: "middle", readingOrder: "rtl" },
        ...(c.type === "date" ? { numFmt: "dd/mm/yyyy hh:mm" } : {}),
      },
    }));
    for (const row of sheet.rows) ws.addRow(row);

    const header = ws.getRow(1);
    header.font = { name: FONT, size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    header.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    header.height = 22;
    if (sheet.rows.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(buffer: Buffer, filename: string) {
  // RFC 6266 / RFC 5987: שם קובץ בעברית דרך filename*
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
