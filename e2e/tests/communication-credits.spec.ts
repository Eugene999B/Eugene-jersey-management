import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page, loginIdValue: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  await page.getByPlaceholder("Click, then enter Login ID or email").fill(loginIdValue);
  await page.getByPlaceholder("Click, then enter password").fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
}

test("saves a communication package immediately for the sole administrator", async ({ page }) => {
  await signIn(page, "EJM-E2E-ADMIN");
  await page.goto("/admin/billing/communications");
  await expect(page.getByRole("heading", { name: "Communication Credits", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent saved package changes", exact: true })).toBeVisible();
  await expect(page.getByText(/another administrator/i)).toHaveCount(0);

  const packageCard = page.locator("article").filter({ hasText: "SMS-STARTER · version" }).first();
  await expect(packageCard).toBeVisible();
  await packageCard.getByText("Edit and save package terms", { exact: true }).click();
  await packageCard.getByLabel("Price", { exact: true }).fill("80");
  await packageCard.getByLabel("Paid credit units", { exact: true }).fill("100");
  await packageCard.getByLabel("Bonus units", { exact: true }).fill("20");
  await packageCard.locator('input[name="isConfigured"]').check();
  await packageCard.locator('input[name="isPublic"]').check();
  await packageCard.locator('input[name="isActive"]').check();
  await packageCard.getByLabel("Commercial change reason").fill("Confirm sole administrator immediate package save");
  await packageCard.getByRole("button", { name: "Save changes now", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/billing\/communications\?saved=1$/);
  await expect(page.getByRole("status")).toContainText("saved immediately");
  await expect(page.getByText("APPLIED").first()).toBeVisible();
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
  await expectNoHorizontalOverflow(page);
});
