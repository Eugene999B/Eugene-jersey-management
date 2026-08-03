import { createHmac } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const LOGIN_ID = "EJM-E2E-2FA-OWNER";
const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
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
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const login = page.getByPlaceholder("Click, then enter Login ID or email");
  const secret = page.getByPlaceholder("Click, then enter password");
  await login.click();
  await login.fill(LOGIN_ID);
  await secret.click();
  await secret.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/login\/two-factor(?:\?|$)/);
  await page.getByPlaceholder("123456 or XXXX-XXXX").fill(currentTotp(TOTP_SECRET));
  await page.getByRole("button", { name: "Complete sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
}

test("guides a new business through real operational setup", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  await expect(page.getByRole("heading", { name: "Finish business setup" })).toBeVisible();
  await page.getByRole("link", { name: /Continue setup/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/setup/);
  await expect(page.getByRole("heading", { name: /Configure EJM Browser Test Shop/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Setup progress" })).toBeVisible();

  for (let step = 1; step <= 10; step += 1) {
    await expect(page.getByRole("link", { name: new RegExp(`^Step ${step}\\b`) })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Production-business extension" })).toBeVisible();
  await expect(page.getByText(/Do not guess a machine protocol/)).toBeVisible();

  await page.getByLabel("Business name").fill("EJM Browser Test Shop");
  await page.getByRole("button", { name: "Save identity" }).click();
  await expect(page).toHaveURL(/\/dashboard\/setup\?step=2&saved=identity/);
  await expect(page.getByRole("status")).toContainText("Setup section saved");
  await expect(page.getByRole("heading", { name: "2. Business type" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
});
