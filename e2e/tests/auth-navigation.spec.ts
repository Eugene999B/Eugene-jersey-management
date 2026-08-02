import { createHmac } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const accounts = {
  unrestrictedAdmin: "EJM-E2E-ADMIN",
  supportWorker: "EJM-E2E-SUPPORT",
  owner: "EJM-E2E-OWNER",
  twoFactorOwner: "EJM-E2E-2FA-OWNER",
  twoFactorOwnerSecret: "JBSWY3DPEHPK3PXP",
  twoFactorBuyerPhone: "+233200000099",
  twoFactorBuyerSecret: "KRSXG5DSNFXGOIDB",
  supplier: "browser-supplier@ejm.test",
} as const;

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

async function finishTwoFactor(page: Page, secret: string) {
  await expect(page).toHaveURL(/\/login\/two-factor(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Confirm it is you" })).toBeVisible();
  await page.getByPlaceholder("123456 or XXXX-XXXX").fill(currentTotp(secret));
  await page.getByRole("button", { name: "Complete sign in" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, `document width ${dimensions.document} exceeds viewport ${dimensions.viewport}`).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, `body width ${dimensions.body} exceeds viewport ${dimensions.viewport}`).toBeLessThanOrEqual(dimensions.viewport + 1);
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
    ["Administrator staff", "/admin/staff", "Admin staff"],
    ["Platform broadcast", "/admin/broadcast", "Broadcast"],
    ["Security controls", "/admin/security", "Security"],
    ["Platform settings", "/admin/settings", "Settings"],
  ] as const;

  for (const [linkName, path, heading] of destinations) {
    await page.getByRole("link", { name: linkName, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?loggedOut=1$/);
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

test("requires the optional challenge only for a protected shop account", async ({ page }) => {
  const fields = await revealCredentials(page);
  await fields.loginId.click();
  await fields.loginId.fill(accounts.twoFactorOwner);
  await fields.passwordField.click();
  await fields.passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await finishTwoFactor(page, accounts.twoFactorOwnerSecret);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /What needs attention at EJM Browser Test Shop/ })).toBeVisible();
});

test("requires the optional challenge for a protected buyer account", async ({ page }) => {
  await page.goto("/buyer/login?next=/shops");
  await page.getByPlaceholder("Phone number").first().fill(accounts.twoFactorBuyerPhone);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password());
  await page.getByRole("button", { name: "Continue securely" }).click();
  await finishTwoFactor(page, accounts.twoFactorBuyerSecret);
  await expect(page).toHaveURL(/\/shops$/);
  await expect(page.getByText("EJM Browser Protected Buyer", { exact: true })).toBeVisible();
});

test("keeps the login control usable without horizontal overflow on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fields = await revealCredentials(page);
  await fields.loginId.click();
  await fields.loginId.fill(accounts.supportWorker);
  await fields.passwordField.click();
  await fields.passwordField.fill(password());

  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole("button", { name: "Open control room" })).toBeVisible();
});

test("keeps the primary owner workspace usable on a mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, accounts.owner);
  const quickShopNavigation = page.getByRole("navigation", { name: "Quick shop navigation" });
  await expect(quickShopNavigation).toBeVisible();
  await expect(quickShopNavigation.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(quickShopNavigation.getByRole("link", { name: "Sell", exact: true })).toBeVisible();
  await expect(quickShopNavigation.getByRole("link", { name: "Orders", exact: true })).toBeVisible();
  await expect(quickShopNavigation.getByRole("link", { name: "Items", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Show all shop tools" }).click();
  await expect(page.getByRole("dialog", { name: "All shop tools" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff & permissions", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Business settings", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close all shop tools" }).click();

  const routes = [
    ["dashboard", "/dashboard", /What needs attention at EJM Browser Test Shop/],
    ["pos", "/dashboard/pos", "Point of Sale"],
    ["orders", "/dashboard/orders", "Production orders"],
    ["catalog", "/dashboard/catalog", "Items and services"],
    ["customers", "/dashboard/customers", "Customer records"],
    ["staff", "/dashboard/staff", "Staff directory"],
    ["settings", "/dashboard/settings", "Shop settings"],
    ["designs", "/dashboard/designs", "Design Studio"],
  ] as const;

  for (const [screenshotName, path, heading] of routes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Quick shop navigation" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`mobile-owner-${screenshotName}.png`), fullPage: false });
  }

  await page.goto("/dashboard/pos");
  await expect(page.getByRole("button", { name: /View cart with 0 items/ })).toBeVisible();

  await page.goto("/dashboard/orders");
  await expect(page.getByRole("tab", { name: /Pending/ })).toBeVisible();

  await page.goto("/dashboard/designs");
  const canvas = page.getByLabel("Production material canvas");
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  const jobDetailsBox = await page.getByRole("heading", { name: "Job details" }).boundingBox();
  expect(canvasBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(jobDetailsBox?.y ?? Number.NEGATIVE_INFINITY);
});

test("keeps the remaining owner controls usable on a mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, accounts.owner);

  const routes = [
    ["debts", "/dashboard/debts", "Debts and installments"],
    ["messages", "/dashboard/messages", "Send customer message"],
    ["suppliers", "/dashboard/suppliers", "Suppliers"],
    ["network", "/dashboard/network", "Shop network"],
    ["closing", "/dashboard/closing", "Daily closing"],
    ["commerce", "/dashboard/commerce", "Commerce control centre"],
    ["reports", "/dashboard/reports", "Reports"],
    ["exports", "/dashboard/exports", "Reports and exports"],
  ] as const;

  for (const [screenshotName, path, heading] of routes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Quick shop navigation" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`mobile-owner-secondary-${screenshotName}.png`), fullPage: false });
  }
});

test("keeps public marketplace and storefront browsing mobile-safe", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const routes = [
    ["marketplace", "/shops", "ESM Marketplace"],
    ["storefront", "/shop/ejm-browser-test-shop", "EJM Browser Test Shop"],
  ] as const;

  for (const [name, path, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`mobile-public-${name}.png`), fullPage: false });
  }
});

test("keeps the supplier portal usable on a mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, accounts.supplier);
  await expect(page).toHaveURL(/\/supplier$/);
  await expect(page.getByRole("heading", { name: "EJM Browser Supply Partner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Purchase orders from EJM Browser Test Shop/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("mobile-supplier-portal.png"), fullPage: false });
});

test("keeps platform administration usable on a mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, accounts.unrestrictedAdmin);
  const quickNavigation = page.getByRole("navigation", { name: "Quick admin navigation" });
  await expect(quickNavigation).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const quickNavigationBox = await quickNavigation.boundingBox();
  expect(quickNavigationBox?.y ?? Number.NEGATIVE_INFINITY).toBeGreaterThan(700);

  await page.getByRole("button", { name: "Show all platform tools" }).click();
  await expect(page.getByRole("dialog", { name: "All platform tools" })).toBeVisible();
  const allAdminNavigation = page.getByRole("navigation", { name: "All admin navigation" });
  await expect(allAdminNavigation.getByRole("link", { name: "Applications", exact: true })).toBeVisible();
  await expect(allAdminNavigation.getByRole("link", { name: "Security controls", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close all platform tools" }).click();

  const routes = [
    ["overview", "/admin"],
    ["shops", "/admin/shops"],
    ["staff", "/admin/staff"],
    ["support", "/admin/support"],
    ["billing", "/admin/billing"],
    ["broadcast", "/admin/broadcast"],
    ["activity", "/admin/activity"],
    ["security", "/admin/security"],
    ["settings", "/admin/settings"],
  ] as const;

  for (const [name, path] of routes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("navigation", { name: "Quick admin navigation" })).toBeVisible();
    await expect(page.locator("main h1, main h2").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`mobile-admin-${name}.png`), fullPage: false });
  }
});
