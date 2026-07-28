import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page, loginIdValue: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill(loginIdValue);
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
}

async function ensureSmsStarterProposal(page: Page) {
  const pendingTitle = page.getByText("SMS Starter · proposed version 2", { exact: true });
  if (await pendingTitle.isVisible().catch(() => false)) return pendingTitle;

  const packageCard = page.locator("article").filter({ hasText: "SMS-STARTER · version 1" });
  await expect(packageCard).toBeVisible();
  await packageCard.getByText("Propose new commercial terms", { exact: true }).click();
  await packageCard.getByLabel("Price", { exact: true }).fill("80");
  await packageCard.getByLabel("Paid credit units", { exact: true }).fill("100");
  await packageCard.getByLabel("Bonus units", { exact: true }).fill("20");
  await packageCard.locator('input[name="isConfigured"]').check();
  await packageCard.locator('input[name="isPublic"]').check();
  await packageCard.locator('input[name="isActive"]').check();
  await packageCard.getByLabel("Commercial change reason").fill("Set controlled E2E SMS package terms");
  await packageCard.getByRole("button", { name: "Submit for second-admin approval", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/billing\/communications\?requested=1$/);
  await expect(page.getByText("Package proposal recorded. A different Billing administrator must approve it.", { exact: true })).toBeVisible();
  return page.getByText("SMS Starter · proposed version 2", { exact: true });
}

test("records a communication package proposal and blocks requester self-approval", async ({ page }) => {
  await signIn(page, "EJM-E2E-ADMIN");
  await page.goto("/admin/billing/communications");
  await expect(page.getByRole("heading", { name: "Communication Credits", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Authoritative package catalogue", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending second-admin approvals", exact: true })).toBeVisible();

  const pendingTitle = await ensureSmsStarterProposal(page);
  await expect(pendingTitle).toBeVisible();
  const decisionForm = page.locator("form").filter({ has: page.getByPlaceholder("Approval or rejection note") }).filter({ hasText: "Approve" }).first();
  await decisionForm.getByPlaceholder("Approval or rejection note").fill("Requester must not approve this package");
  await decisionForm.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/billing\/communications\?error=self-approval$/);
  await expect(page.getByText("The administrator who requested the package change cannot approve it.", { exact: true })).toBeVisible();
  await expect(page.getByText("SMS Starter · proposed version 2", { exact: true })).toBeVisible();
});

test("keeps communication credit administration usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "EJM-E2E-ADMIN");
  await page.goto("/admin/billing/communications");
  await expect(page.getByRole("heading", { name: "Communication Credits", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("starts each shop with isolated zero balances and no invented public package", async ({ page }) => {
  await signIn(page, "EJM-E2E-OWNER");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/messages");
  await expect(page.getByRole("heading", { name: "Send customer message", exact: true })).toBeVisible();

  const smsWallet = page.locator("article").filter({ hasText: "SMS wallet" }).first();
  const whatsappWallet = page.locator("article").filter({ hasText: "WHATSAPP wallet" }).first();
  await expect(smsWallet).toContainText("0");
  await expect(whatsappWallet).toContainText("0");
  await expect(page.getByText("No approved public packages are available yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buy with Paystack", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
