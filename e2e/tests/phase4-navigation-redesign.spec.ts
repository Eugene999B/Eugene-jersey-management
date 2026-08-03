import { createHmac } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const PHASE4_OWNER_LOGIN_ID = "EJM-E2E-2FA-OWNER";
const PHASE4_OWNER_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

function decodeBase32(value: string) {
  let bits = "";
  for (const character of value.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid disposable TOTP secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function signIn(page: Page, loginIdValue: string, twoFactorSecret?: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill(loginIdValue);
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();

  if (twoFactorSecret) {
    await expect(page).toHaveURL(/\/login\/two-factor(?:\?|$)/);
    await page.getByPlaceholder("123456 or XXXX-XXXX").fill(currentTotp(twoFactorSecret));
    await page.getByRole("button", { name: "Complete sign in" }).click();
  }

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

test("provides desktop breadcrumbs, tool search and a collapsible shop sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, PHASE4_OWNER_LOGIN_ID, PHASE4_OWNER_TOTP_SECRET);
  await page.goto("/dashboard/orders");
  await expect(page.getByRole("heading", { name: "Production orders" })).toBeVisible();
  await page.goto("/dashboard/customers");

  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Customers");
  await expect(page.getByRole("link", { name: "Quick sale" })).toBeVisible();
  await page.getByRole("button", { name: "Search ESM tools" }).click();
  const searchDialog = page.getByRole("dialog", { name: "Search ESM tools" });
  await searchDialog.getByRole("textbox", { name: "Search pages and tools" }).fill("supplier");
  await expect(searchDialog.getByRole("link", { name: /Suppliers & purchasing/ })).toBeVisible();
  await searchDialog.getByRole("button", { name: "Close search" }).click();

  await page.getByRole("button", { name: "Collapse shop sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand shop sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand shop sidebar" }).click();
  await expect(page.getByText("Recently used", { exact: true })).toBeVisible();
});

test("shows the exact mobile shop bar and grouped More menu without covering content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, PHASE4_OWNER_LOGIN_ID, PHASE4_OWNER_TOTP_SECRET);
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
    await expect(adminNavigation.locator("p", { hasText: section })).toBeVisible();
  }
  await expect(page.getByRole("navigation", { name: "Administrator breadcrumb" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const quickNavigation = page.getByRole("navigation", { name: "Quick admin navigation" });
  await expect(quickNavigation).toBeVisible();
  await expect(quickNavigation.getByRole("button", { name: "Show all platform tools" })).toBeVisible();
});
