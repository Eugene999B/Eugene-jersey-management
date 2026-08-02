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

test("provides desktop breadcrumbs, tool search and a collapsible shop sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "EJM-E2E-OWNER");
  await page.goto("/dashboard/customers");

  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Customers");
  await expect(page.getByRole("link", { name: "Quick sale" })).toBeVisible();
  await page.getByRole("button", { name: "Search ESM tools" }).click();
  await page.getByRole("textbox", { name: "Search pages and tools" }).fill("supplier");
  await expect(page.getByRole("link", { name: /Suppliers & purchasing/ })).toBeVisible();
  await page.getByRole("button", { name: "Close search" }).click();

  await page.getByRole("button", { name: "Collapse shop sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand shop sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand shop sidebar" }).click();
  await expect(page.getByText("Recently used", { exact: true })).toBeVisible();
});

test("shows the exact mobile shop bar and grouped More menu without covering content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "EJM-E2E-OWNER");
  const quickNavigation = page.getByRole("navigation", { name: "Quick shop navigation" });
  await expect(quickNavigation).toBeVisible();
  for (const label of ["Home", "Sell", "Orders", "Items"]) {
    await expect(quickNavigation.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await quickNavigation.getByRole("button", { name: "Show all shop tools" }).click();
  const dialog = page.getByRole("dialog", { name: "All shop tools" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Customers & money", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Operations", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Management", { exact: true })).toBeVisible();

  const contentBottom = await page.locator("main").evaluate((element) => element.getBoundingClientRect().bottom);
  const navTop = await quickNavigation.evaluate((element) => element.getBoundingClientRect().top);
  expect(contentBottom).toBeGreaterThan(navTop);
});

test("groups desktop administrator tools and keeps a five-place mobile bar", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "EJM-E2E-ADMIN");
  const adminNavigation = page.getByRole("navigation", { name: "Admin pages" });
  for (const section of ["Businesses", "Plans & access", "Billing", "Support", "Communications", "Security", "Platform settings"]) {
    await expect(adminNavigation.locator("p").filter({ hasText: new RegExp(`^${section.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`) })).toBeVisible();
  }
  await expect(page.getByRole("navigation", { name: "Administrator breadcrumb" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const quickNavigation = page.getByRole("navigation", { name: "Quick admin navigation" });
  await expect(quickNavigation).toBeVisible();
  await expect(quickNavigation.getByRole("button", { name: "Show all platform tools" })).toBeVisible();
});
