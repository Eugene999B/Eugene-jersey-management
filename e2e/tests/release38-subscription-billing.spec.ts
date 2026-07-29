import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page, loginId: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const identifier = page.getByPlaceholder("Click, then enter Login ID or email");
  await identifier.click();
  await identifier.fill(loginId);
  const secret = page.getByPlaceholder("Click, then enter password");
  await secret.click();
  await secret.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

test("shop owner can review and start a subscription renewal", async ({ page }) => {
  await signIn(page, "EJM-E2E-R25-OWNER");
  await page.goto("/dashboard/subscription");

  await expect(page.getByRole("heading", { name: "Subscription & usage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invoices & payment history" })).toBeVisible();
  await expect(page.getByText("EJM-E2E-R38-INVOICE")).toBeVisible();
  await expect(page.getByText("EJM Browser Pro renewal")).toBeVisible();
  await expect(page.getByText("E2E simulated failed attempt")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Invoice PDF" })).toHaveAttribute("href", /subscription-invoices\/.*\/pdf/);
});

test("platform administrator can operate the subscription invoice command centre", async ({ page }) => {
  await signIn(page, "EJM-E2E-R25-ADMIN");
  await page.goto("/admin/billing/invoices");

  await expect(page.getByRole("heading", { name: "Subscription invoices & reconciliation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Issue renewal invoice" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invoice register" })).toBeVisible();
  await expect(page.getByText("EJM-E2E-R38-INVOICE")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reconcile with Paystack" })).toBeVisible();
  await expect(page.getByText("Audited manual decision")).toBeVisible();
});

test("subscription billing remains usable on a narrow phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "EJM-E2E-R25-OWNER");
  await page.goto("/dashboard/subscription");

  await expect(page.getByRole("heading", { name: "Invoices & payment history" })).toBeVisible();
  await expect(page.getByText("EJM-E2E-R38-INVOICE")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
