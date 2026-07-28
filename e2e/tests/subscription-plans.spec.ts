import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsAdministrator(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  await page.getByPlaceholder("Click, then enter Login ID or email").fill("EJM-E2E-ADMIN");
  await page.getByPlaceholder("Click, then enter password").fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("saves subscription terms immediately for the sole administrator", async ({ page }) => {
  await signInAsAdministrator(page);
  await page.goto("/admin/billing");
  await expect(page.getByRole("heading", { name: "Subscription Plans & Billing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent saved plan changes" })).toBeVisible();
  await expect(page.getByText(/another administrator/i)).toHaveCount(0);

  const basicPlan = page.locator("article").filter({ hasText: "BASIC · version" }).first();
  await expect(basicPlan).toBeVisible();
  await basicPlan.getByText("Edit and save plan terms").click();
  await basicPlan.getByLabel("Monthly price").fill("150");
  await basicPlan.getByLabel("Yearly price").fill("1500");
  await basicPlan.getByLabel("Included staff accounts").fill("3");
  await basicPlan.getByLabel("Maximum products").fill("500");
  await basicPlan.getByLabel("Monthly order limit").fill("1000");
  await basicPlan.locator('input[name="features"][value="POS"]').check();
  await basicPlan.locator('input[name="isConfigured"]').check();
  await basicPlan.locator('input[name="isPublic"]').check();
  await basicPlan.locator('input[name="isActive"]').check();
  await basicPlan.getByLabel("Commercial change reason").fill("Confirm sole administrator immediate plan save");
  await basicPlan.getByRole("button", { name: "Save changes now" }).click();

  await expect(page).toHaveURL(/\/admin\/billing\?saved=1$/);
  await expect(page.getByRole("status")).toContainText("saved immediately");
  await expect(page.getByText("APPLIED").first()).toBeVisible();
});

test("keeps subscription administration usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsAdministrator(page);
  await page.goto("/admin/billing");
  await expect(page.getByRole("heading", { name: "Subscription Plans & Billing" })).toBeVisible();
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});

test("removes arbitrary tenant price entry from new-shop creation", async ({ page }) => {
  await signInAsAdministrator(page);
  await page.goto("/admin/shops/new");
  await expect(page.getByRole("heading", { name: "Create shop, owner, and verification file" })).toBeVisible();
  await expect(page.getByText("Commercial terms come only from a saved plan version")).toBeVisible();
  await expect(page.locator('input[name="monthlyPrice"]')).toHaveCount(0);
  await expect(page.locator('input[name="yearlyPrice"]')).toHaveCount(0);
  await expect(page.locator('select[name="planId"]')).toBeVisible();
});
