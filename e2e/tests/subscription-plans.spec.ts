import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsAdministrator(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill("EJM-E2E-ADMIN");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("records a plan proposal and blocks requester self-approval", async ({ page }) => {
  await signInAsAdministrator(page);
  await page.goto("/admin/billing");
  await expect(page.getByRole("heading", { name: "Subscription Plans & Billing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Authoritative plan catalogue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending second-admin approvals" })).toBeVisible();

  const basicPlan = page.locator("article").filter({ hasText: "BASIC · version 1" });
  await expect(basicPlan).toBeVisible();
  await basicPlan.getByText("Propose new terms").click();
  await basicPlan.getByLabel("Monthly price").fill("150");
  await basicPlan.getByLabel("Yearly price").fill("1500");
  await basicPlan.getByLabel("Included staff accounts").fill("3");
  await basicPlan.getByLabel("Maximum products").fill("500");
  await basicPlan.getByLabel("Monthly order limit").fill("1000");
  await basicPlan.locator('input[name="features"][value="POS"]').check();
  await basicPlan.locator('input[name="isConfigured"]').check();
  await basicPlan.locator('input[name="isPublic"]').check();
  await basicPlan.getByLabel("Commercial change reason").fill("Set the controlled E2E Basic plan terms");
  await basicPlan.getByRole("button", { name: "Submit for second-admin approval" }).click();

  await expect(page).toHaveURL(/\/admin\/billing\?requested=1$/);
  await expect(page.getByRole("status")).toContainText("different billing administrator");
  await expect(page.getByText("Basic · proposed version 2")).toBeVisible();

  const pending = page.locator("div").filter({ hasText: "Basic · proposed version 2" }).filter({ has: page.getByPlaceholder("Approval or rejection note") }).first();
  await pending.getByPlaceholder("Approval or rejection note").fill("Requester must not approve this proposal");
  await pending.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/\/admin\/billing\?error=self-approval$/);
  await expect(page.getByRole("alert")).toContainText("cannot approve");
  await expect(page.getByText("Basic · proposed version 2")).toBeVisible();
});

test("keeps subscription administration usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsAdministrator(page);
  await page.goto("/admin/billing");
  await expect(page.getByRole("heading", { name: "Subscription Plans & Billing" })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});

test("removes arbitrary tenant price entry from new-shop creation", async ({ page }) => {
  await signInAsAdministrator(page);
  await page.goto("/admin/shops/new");
  await expect(page.getByRole("heading", { name: "Create shop, owner, and verification file" })).toBeVisible();
  await expect(page.getByText("Commercial terms come only from an approved plan version")).toBeVisible();
  await expect(page.locator('input[name="monthlyPrice"]')).toHaveCount(0);
  await expect(page.locator('input[name="yearlyPrice"]')).toHaveCount(0);
  await expect(page.locator('select[name="planId"]')).toBeVisible();
});
