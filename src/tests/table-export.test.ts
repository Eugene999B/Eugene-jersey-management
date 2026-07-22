import { describe, expect, it } from "vitest";
import { buildTableCsv, buildTableDocx, buildTablePdf, buildTableXlsx, type TableExport } from "@/lib/table-export";

const report: TableExport = {
  title: "Sales report",
  subtitle: "Test range",
  metrics: [{ label: "Revenue", value: "GHS 100" }],
  columns: ["Receipt", "Customer", "Total"],
  rows: [["R-001", "Sample Customer", 100]],
};

describe("report exports", () => {
  it("builds valid office document containers", async () => {
    const [docx, xlsx] = await Promise.all([buildTableDocx(report), buildTableXlsx(report)]);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
    expect(docx.length).toBeGreaterThan(1_000);
    expect(xlsx.length).toBeGreaterThan(1_000);
  });

  it("builds PDF and CSV output", () => {
    expect(buildTablePdf(report).startsWith("%PDF-1.4")).toBe(true);
    expect(buildTableCsv(report)).toContain("R-001,Sample Customer,100");
  });

  it("neutralizes spreadsheet formulas in CSV output", () => {
    const csv = buildTableCsv({ ...report, rows: [["=HYPERLINK(\"https://example.test\")", "+cmd", "@unsafe"]] });
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'@unsafe");
  });

  it("paginates PDF output without dropping later rows", () => {
    const rows = Array.from({ length: 100 }, (_, index) => [`R-${String(index).padStart(3, "0")}`, `Customer ${index}`, index]);
    const pdf = buildTablePdf({ ...report, rows });
    expect(pdf).toContain("R-099");
    expect(pdf).toMatch(/\/Count [3-9]/);
  });
});
