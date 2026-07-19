export type TableExport = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  metrics?: Array<{ label: string; value: string | number }>;
};

function escapeCsv(value: string | number) {
  const text = String(value);
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
    ...exportData.rows.slice(0, 36).map((row) => row.map(String).join(" | ")),
  ];

  const content = [
    "BT",
    "/F1 16 Tf",
    "42 780 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "/F1 16 Tf" : "/F1 9 Tf",
      `(${pdfEscape(line.slice(0, 118))}) Tj`,
      "0 -16 Td",
    ]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];

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
