import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import ExcelJS from "exceljs";

export type TableExport = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  metrics?: Array<{ label: string; value: string | number }>;
};

function escapeCsv(value: string | number) {
  const raw = String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildTableCsv(exportData: TableExport) {
  const metricRows = exportData.metrics?.map((metric) => [metric.label, metric.value]) ?? [];
  const tableRows = [exportData.columns, ...exportData.rows];
  return [...metricRows, [], ...tableRows].map((row) => row.map((cell) => escapeCsv(cell ?? "")).join(",")).join("\n");
}

export function buildTableWordHtml(exportData: TableExport) {
  const metrics = exportData.metrics?.map((metric) => `
    <div class="metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>
  `).join("") ?? "";
  const rows = exportData.rows.map((row) => `
    <tr>${row.map((cell) => `<td>${escapeHtml(cell ?? "")}</td>`).join("")}</tr>
  `).join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
        h1 { color: #0f766e; margin-bottom: 4px; }
        .subtitle { color: #64748b; margin-top: 0; }
        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 22px 0; }
        .metric { border: 1px solid #ded8cd; background: #f6f4ef; border-radius: 8px; padding: 12px; }
        .metric span { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; }
        .metric strong { display: block; margin-top: 6px; font-size: 18px; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #ded8cd; padding: 9px; text-align: left; }
        th { background: #0f766e; color: white; }
        tr:nth-child(even) td { background: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(exportData.title)}</h1>
      ${exportData.subtitle ? `<p class="subtitle">${escapeHtml(exportData.subtitle)}</p>` : ""}
      <div class="metrics">${metrics}</div>
      <table>
        <thead><tr>${exportData.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`;
}

export async function buildTableDocx(exportData: TableExport) {
  const metricParagraphs = (exportData.metrics ?? []).map((metric) => new Paragraph({
    children: [new TextRun({ text: `${metric.label}: `, bold: true }), new TextRun(String(metric.value))],
    spacing: { after: 80 },
  }));
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: exportData.columns.map((column) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: column, bold: true, color: "FFFFFF" })] })],
          shading: { fill: "0F766E" },
        })),
      }),
      ...exportData.rows.map((row) => new TableRow({
        children: row.map((cell) => new TableCell({ children: [new Paragraph(String(cell ?? ""))] })),
      })),
    ],
  });
  const document = new Document({
    creator: "Eugene Jersey Management",
    title: exportData.title,
    description: exportData.subtitle,
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: exportData.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT }),
        ...(exportData.subtitle ? [new Paragraph({ text: exportData.subtitle, spacing: { after: 240 } })] : []),
        ...metricParagraphs,
        new Paragraph({ text: "", spacing: { after: 120 } }),
        table,
      ],
    }],
  });
  return Packer.toBuffer(document);
}

export async function buildTableXlsx(exportData: TableExport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eugene Jersey Management";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Report");
  worksheet.addRow([exportData.title]);
  worksheet.mergeCells(1, 1, 1, Math.max(1, exportData.columns.length));
  worksheet.getCell(1, 1).font = { size: 18, bold: true, color: { argb: "FF0F766E" } };
  if (exportData.subtitle) {
    worksheet.addRow([exportData.subtitle]);
    worksheet.mergeCells(2, 1, 2, Math.max(1, exportData.columns.length));
    worksheet.getCell(2, 1).font = { italic: true, color: { argb: "FF64748B" } };
  }
  for (const metric of exportData.metrics ?? []) worksheet.addRow([metric.label, metric.value]);
  worksheet.addRow([]);
  const header = worksheet.addRow(exportData.columns);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  header.alignment = { vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: header.number }];
  for (const row of exportData.rows) worksheet.addRow(row);
  worksheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: Math.max(1, exportData.columns.length) } };
  worksheet.columns.forEach((column, index) => {
    const values = [exportData.columns[index] ?? "", ...exportData.rows.map((row) => String(row[index] ?? ""))];
    column.width = Math.min(48, Math.max(12, ...values.map((value) => value.length + 2)));
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function pdfEscape(text: string) {
  return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function buildTablePdf(exportData: TableExport) {
  const lines = [
    exportData.title,
    exportData.subtitle ?? "",
    ...(exportData.metrics?.map((metric) => `${metric.label}: ${metric.value}`) ?? []),
    "",
    exportData.columns.join(" | "),
    ...exportData.rows.map((row) => row.map(String).join(" | ")),
  ];
  const pageLines = Array.from({ length: Math.max(1, Math.ceil(lines.length / 43)) }, (_, index) => lines.slice(index * 43, (index + 1) * 43));
  const pageObjectNumbers = pageLines.map((_, index) => 4 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageLines.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (const [pageIndex, page] of pageLines.entries()) {
    const pageObjectNumber = 4 + pageIndex * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const content = [
      "BT",
      "42 780 Td",
      ...page.flatMap((line, lineIndex) => [
        pageIndex === 0 && lineIndex === 0 ? "/F1 16 Tf" : "/F1 9 Tf",
        `(${pdfEscape(line.slice(0, 118))}) Tj`,
        "0 -16 Td",
      ]),
      "ET",
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}
