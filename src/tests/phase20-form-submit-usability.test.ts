import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 20 form submit usability", () => {
  test("shared buttons prevent repeat server-action submits while a form is pending", () => {
    const button = source("src/components/ui/button.tsx");

    expect(button).toContain('"use client"');
    expect(button).toContain('import { useFormStatus } from "react-dom"');
    expect(button).toContain("const { pending } = useFormStatus()");
    expect(button).toContain('const effectiveLoading = loading || (type !== "button" && pending)');
    expect(button).toContain("disabled={disabled || effectiveLoading}");
    expect(button).toContain("aria-busy={effectiveLoading || undefined}");
  });

  test("high-frequency shop forms continue to use the protected shared button", () => {
    const staff = source("src/app/dashboard/staff/page.tsx");
    const customers = source("src/app/dashboard/customers/page.tsx");
    const suppliers = source("src/app/dashboard/suppliers/page.tsx");
    const debts = source("src/app/dashboard/debts/page.tsx");

    for (const page of [staff, customers, suppliers, debts]) {
      expect(page).toContain('from "@/components/ui/button"');
      expect(page).toContain("<form action=");
      expect(page).toContain("<Button");
    }
  });

  test("explicit non-submit controls remain independent of form pending state", () => {
    const button = source("src/components/ui/button.tsx");
    expect(button).toContain('type !== "button" && pending');
  });
});
