import { expect, test, type Page } from "@playwright/test";

const OWNER_LOGIN_ID = "EJM-E2E-OWNER";
const ADMIN_LOGIN_ID = "EJM-E2E-ADMIN";
const REFUND_ORDER_ID = "e2e-paystack-refund-order";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page, loginId: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginField = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginField.click();
  await loginField.fill(loginId);
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

function money(value: number) {
  return new RegExp(`GH₵\\s?${value}(?:\\.00)?`);
}

test("owner sees partial refund truth and remaining refundable capacity", async ({ page }) => {
  await signIn(page, OWNER_LOGIN_ID);
  await page.goto(`/dashboard/orders/${REFUND_ORDER_ID}`);

  const summary = page.getByRole("region", { name: "Order summary" });
  await expect(summary.getByText("Paid net", { exact: true }).locator("..")).toContainText(money(60));
  await expect(summary.getByText("Refunded", { exact: true }).locator("..")).toContainText(money(20));
  await expect(summary.getByText("Balance", { exact: true }).locator("..")).toContainText(money(20));

  const refunds = page.getByRole("region", { name: "Paystack refunds and reconciliation" });
  await expect(refunds).toBeVisible();
  await expect(refunds.getByText("Processed refunds", { exact: true }).locator("..")).toContainText(money(20));
  await expect(refunds.getByText("Still refundable", { exact: true }).locator("..")).toContainText(money(60));
  await expect(refunds.getByText("Browser acceptance partial refund", { exact: true })).toBeVisible();
  await expect(refunds.getByRole("button", { name: "Issue refund" })).toBeVisible();
});

test("refund order remains usable on a phone viewport", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await signIn(page, OWNER_LOGIN_ID);
    await page.goto(`/dashboard/orders/${REFUND_ORDER_ID}`);
    await expect(page.getByRole("heading", { name: "Paystack refunds and reconciliation" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  } finally {
    await context.close();
  }
});

test("platform administrator sees read-only refund reconciliation health", async ({ page }) => {
  await signIn(page, ADMIN_LOGIN_ID);
  await page.goto("/admin/integrations");
  await expect(page.getByRole("heading", { name: "Refund reconciliation" })).toBeVisible();
  await expect(page.getByText("Processed", { exact: true }).locator("..")).toContainText(/\d+/);
  await expect(page.getByText("Platform-wide read-only visibility into Paystack refund states.", { exact: false })).toBeVisible();
});
