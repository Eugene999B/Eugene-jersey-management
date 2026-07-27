import { expect, type Page, test } from "@playwright/test";

const accounts = {
  unrestrictedAdmin: "EJM-E2E-ADMIN",
  supportWorker: "EJM-E2E-SUPPORT",
  owner: "EJM-E2E-OWNER",
} as const;

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function revealCredentials(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Enter credentials" })).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await page.getByRole("button", { name: "Enter credentials" }).click();

  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await expect(loginId).toHaveValue("");
  await expect(passwordField).toHaveValue("");
  return { loginId, passwordField };
}

async function signIn(page: Page, loginIdValue: string) {
  const fields = await revealCredentials(page);
  await fields.loginId.click();
  await fields.loginId.fill(loginIdValue);
  await fields.passwordField.click();
  await fields.passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

test("keeps credential inputs absent until the user opens them", async ({ page }) => {
  const fields = await revealCredentials(page);
  await page.waitForTimeout(550);
  await expect(fields.loginId).toHaveValue("");
  await expect(fields.passwordField).toHaveValue("");

  await fields.loginId.click();
  await fields.loginId.fill("manual-user");
  await fields.passwordField.click();
  await fields.passwordField.fill("manual-password");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("input")).toHaveCount(0);
});

test("protects admin routes before authentication", async ({ page }) => {
  await page.goto("/admin/security");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("button", { name: "Enter credentials" })).toBeVisible();
});

test("keeps an unrestricted administrator signed in across refresh and route navigation", async ({ page }) => {
  await signIn(page, accounts.unrestrictedAdmin);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Command centre" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Command centre" })).toBeVisible();

  const destinations = [
    ["Admin staff", "/admin/staff", "Admin staff"],
    ["Broadcast", "/admin/broadcast", "Broadcast"],
    ["Security", "/admin/security", "Security"],
    ["Settings", "/admin/settings", "Settings"],
  ] as const;

  for (const [linkName, path, heading] of destinations) {
    await page.getByRole("link", { name: linkName, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("input")).toHaveCount(0);
});

test("redirects a support-only worker away from unauthorised admin pages", async ({ page }) => {
  await signIn(page, accounts.supportWorker);
  await expect(page).toHaveURL(/\/admin\/support$/);
  await expect(page.getByRole("heading", { name: "Support desk" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Support desk", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Billing", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Security", exact: true })).toHaveCount(0);

  await page.goto("/admin/security");
  await expect(page).toHaveURL(/\/admin\/support\?error=permission$/);
  await expect(page.getByRole("heading", { name: "Support desk" })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/admin\/support\?error=permission$/);
  await expect(page.getByRole("heading", { name: "Support desk" })).toBeVisible();
});

test("keeps a tenant owner inside the tenant dashboard across refresh", async ({ page }) => {
  await signIn(page, accounts.owner);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /What needs attention at EJM Browser Test Shop/ })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Tenant filtered", { exact: true })).toBeVisible();
});

test("keeps the login control usable without horizontal overflow on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fields = await revealCredentials(page);
  await fields.loginId.click();
  await fields.loginId.fill(accounts.supportWorker);
  await fields.passwordField.click();
  await fields.passwordField.fill(password());

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.getByRole("button", { name: "Open control room" })).toBeVisible();
});
