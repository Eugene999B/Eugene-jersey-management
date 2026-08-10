import { expect, test, type Page } from "@playwright/test";

const OWNER_LOGIN_ID = "EJM-E2E-OWNER";
const ADMIN_LOGIN_ID = "EJM-E2E-ADMIN";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page, loginId: string, destination: RegExp) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const login = page.getByPlaceholder("Click, then enter Login ID or email");
  const secret = page.getByPlaceholder("Click, then enter password");
  await login.click();
  await login.fill(loginId);
  await secret.click();
  await secret.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(destination, { timeout: 30_000 });
}

test("business report reconciles a real production job to manual financial truth", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, OWNER_LOGIN_ID, /\/dashboard$/);
  await page.goto("/dashboard/reports");

  await expect(page.getByRole("heading", { name: "Management reports", exact: true })).toBeVisible();
  await expect(page.getByText("Financial and operational truth", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment methods", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer & outstanding balances", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Supplier balances", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profit per production job", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jobs completed on time", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Heat-press rework rate", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Staff productivity", exact: true })).toBeVisible();
  await expect(page.getByText("Vinyl used", { exact: true })).toBeVisible();
  await expect(page.getByText("Vinyl waste", { exact: true })).toBeVisible();
  await expect(page.getByText("Garment stock", { exact: true })).toBeVisible();

  const financialTruthRow = page.getByRole("row").filter({ hasText: "E2E Phase 16 Financial Truth Job" });
  await expect(financialTruthRow).toBeVisible();
  await expect(financialTruthRow).toContainText("25.00");
  await expect(financialTruthRow).toContainText("6.40");
  await expect(financialTruthRow).toContainText("1.28");
  await expect(financialTruthRow).toContainText("5.00");
  await expect(financialTruthRow).toContainText("3.00");
  await expect(financialTruthRow).toContainText("2.00");
  await expect(financialTruthRow).toContainText("1.00");
  await expect(financialTruthRow).toContainText("43.68");
  await expect(financialTruthRow).toContainText("80.00");
  await expect(financialTruthRow).toContainText("36.32");
  await expect(financialTruthRow.getByText("Reconciled", { exact: true })).toBeVisible();
  await expect(page.getByText("Production-cost arithmetic reconciles", { exact: true })).toBeVisible();
});

test("unrestricted administrator sees platform billing support module and recorded device health", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, ADMIN_LOGIN_ID, /\/admin$/);
  await page.goto("/admin/reports");

  await expect(page.getByRole("heading", { name: "Platform reports", exact: true })).toBeVisible();
  await expect(page.getByText("Unrestricted platform intelligence", { exact: true })).toBeVisible();
  await expect(page.getByText("Active businesses", { exact: true })).toBeVisible();
  await expect(page.getByText("Subscription revenue", { exact: true })).toBeVisible();
  await expect(page.getByText("Failed subscription payments", { exact: true })).toBeVisible();
  await expect(page.getByText("Open support cases", { exact: true })).toBeVisible();
  await expect(page.getByText("Direct cutter success", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Subscription / sponsored / grant status", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Module usage footprint", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Subscription billing evidence", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Support cases", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Provider health", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Device bridge / Web Serial health", exact: true })).toBeVisible();
  await expect(page.getByText(/browser-mediated Web Serial cutter control/)).toBeVisible();
  await expect(page.getByText(/durable send\/failure job evidence/)).toBeVisible();
});
