import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsAdministrator(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const login = page.getByPlaceholder("Click, then enter Login ID or email");
  const secret = page.getByPlaceholder("Click, then enter password");
  await login.click();
  await login.fill("EJM-E2E-ADMIN");
  await secret.click();
  await secret.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname === "/admin", { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("shows administrator-controlled access terms without changing a business", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsAdministrator(page);
  await page.goto("/admin/access");

  await expect(page).toHaveURL(/\/admin\/access$/);
  await expect(page.getByRole("heading", { name: "Free, sponsored and emergency access" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create or replace a business access grant" })).toBeVisible();
  await expect(page.getByLabel("Business")).toBeVisible();
  await expect(page.getByLabel("Access type")).toBeVisible();
  await expect(page.getByLabel("Plan and limits")).toBeVisible();
  await expect(page.getByLabel("Start date")).toBeVisible();
  await expect(page.getByLabel("End date")).toBeVisible();
  await expect(page.getByLabel("After expiry")).toBeVisible();
  await expect(page.getByLabel("Disable invoices and payment prompts during this grant")).toBeChecked();
  await expect(page.getByRole("heading", { name: "Access grant ledger" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("exposes access grants in permission-aware desktop administrator navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signInAsAdministrator(page);
  const navigation = page.getByRole("navigation", { name: "Admin pages" });
  await expect(navigation.getByRole("link", { name: "Access grants", exact: true })).toBeVisible();
  await navigation.getByRole("link", { name: "Access grants", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/access$/);
  await expect(page.getByRole("navigation", { name: "Administrator breadcrumb" })).toContainText("Access grants");
});
