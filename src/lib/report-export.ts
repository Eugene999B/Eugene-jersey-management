import { currency, shortDate } from "@/lib/format";

export type ExportOrder = {
  receiptNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: Date;
};

export type ExportSummary = {
  shopName: string;
  currencyCode: string;
  revenue: number;
  debt: number;
  orders: ExportOrder[];
  lowStock: { sku: string; productName: string; stockQty: number }[];
};

function escapeCsv(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCsvReport(summary: ExportSummary) {
  const rows = [
    ["Receipt", "Customer", "Status", "Payment", "Total", "Date"],
    ...summary.orders.map((order) => [
      order.receiptNumber,
      order.customerName,
      order.status,
      order.paymentStatus,
      order.totalAmount,
      shortDate(order.createdAt),
    ]),
    [],
    ["Low stock SKU", "Product", "Stock"],
    ...summary.lowStock.map((item) => [item.sku, item.productName, item.stockQty]),
  ];

  return rows.map((row) => row.map((cell) => escapeCsv(cell ?? "")).join(",")).join("\n");
}

export function buildWordHtmlReport(summary: ExportSummary) {
  const rows = summary.orders.map((order) => `
    <tr>
      <td>${order.receiptNumber}</td>
      <td>${order.customerName}</td>
      <td>${order.status}</td>
      <td>${order.paymentStatus}</td>
      <td>${currency(order.totalAmount, summary.currencyCode)}</td>
      <td>${shortDate(order.createdAt)}</td>
    </tr>
  `).join("");

  const lowStock = summary.lowStock.map((item) => `
    <tr><td>${item.sku}</td><td>${item.productName}</td><td>${item.stockQty}</td></tr>
  `).join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #111827; }
        h1 { color: #0f766e; }
        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #ded8cd; padding: 8px; text-align: left; }
        th { background: #f6f4ef; }
      </style>
    </head>
    <body>
      <h1>${summary.shopName} Performance Report</h1>
      <p><strong>Revenue:</strong> ${currency(summary.revenue, summary.currencyCode)}</p>
      <p><strong>Open debt:</strong> ${currency(summary.debt, summary.currencyCode)}</p>
      <h2>Orders</h2>
      <table>
        <thead><tr><th>Receipt</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h2>Low Stock</h2>
      <table>
        <thead><tr><th>SKU</th><th>Product</th><th>Stock</th></tr></thead>
        <tbody>${lowStock}</tbody>
      </table>
    </body>
  </html>`;
}

function pdfEscape(text: string) {
  return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function buildSimplePdf(summary: ExportSummary) {
  const lines = [
    `${summary.shopName} Performance Report`,
    `Revenue: ${currency(summary.revenue, summary.currencyCode)}`,
    `Open debt: ${currency(summary.debt, summary.currencyCode)}`,
    "",
    "Recent orders",
    ...summary.orders.slice(0, 24).map((order) => `${order.receiptNumber} | ${order.customerName} | ${currency(order.totalAmount, summary.currencyCode)} | ${order.status}`),
    "",
    "Low stock",
    ...summary.lowStock.slice(0, 20).map((item) => `${item.sku} | ${item.productName} | ${item.stockQty}`),
  ];

  const content = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "/F1 18 Tf" : "/F1 10 Tf",
      `(${pdfEscape(line)}) Tj`,
      "0 -18 Td",
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
