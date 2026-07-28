import { expect, type Page, test } from "@playwright/test";

const staff = {
  loginId: "EJM-E2E-RECOVERY",
  challenge: "release28-staff-recovery-public-token-2026",
  code: "482913",
};

const buyer = {
  phone: "+233200000129",
  challenge: "release28-buyer-recovery-public-token-2026",
  code: "593824",
};

test.describe.configure({ mode: "serial", retries: 0 });

function basePassword() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

function replacementPassword() {
  return `${basePassword()}R8`;
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

async function signInStaff(page: Page, password: string) {
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill(staff.loginId);
  await passwordField.click();
  await passwordField.fill(password);
  await page.getByRole("button", { name: "Open control room" }).click();
}

test("keeps staff and buyer forgotten-password entry points mobile-safe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Request a reset code" })).toBeVisible();
  await expect(page.getByLabel("Login ID, email or phone")).toBeVisible();
  await expect(page.getByText("SMS", { exact: true })).toBeVisible();
  await expect(page.getByText("Email OTP", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/buyer/login?next=/cart");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/buyer\/forgot-password\?next=%2Fcart$/);
  await expect(page.getByRole("heading", { name: "Reset your buyer password" })).toBeVisible();
  await expect(page.getByLabel("Buyer phone or email")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("resets a staff password with an opaque one-time challenge and revokes old credentials", async ({ page }) => {
  const newPassword = replacementPassword();
  await page.goto(`/reset-password?sent=1&challenge=${encodeURIComponent(staff.challenge)}`);
  await expect(page.getByRole("heading", { name: "Create a new password" })).toBeVisible();
  await expect(page.getByText("Code sent by SMS", { exact: false })).toBeVisible();
  await page.getByLabel("Six-digit recovery code").fill(staff.code);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1$/);

  await signInStaff(page, basePassword());
  await expect(page.getByText("The Login ID or password is not correct.")).toBeVisible();

  await page.reload();
  await signInStaff(page, newPassword);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Command centre" })).toBeVisible();
});

test("resets a buyer password and signs in with the replacement password", async ({ page }) => {
  const newPassword = replacementPassword();
  await page.goto(`/buyer/reset-password?sent=1&challenge=${encodeURIComponent(buyer.challenge)}&next=%2Fshops`);
  await expect(page.getByRole("heading", { name: "Create a new buyer password" })).toBeVisible();
  await expect(page.getByText("Code sent by SMS", { exact: false })).toBeVisible();
  await page.getByLabel("Six-digit recovery code").fill(buyer.code);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/buyer\/login\?reset=1&next=%2Fshops$/);
  await expect(page.getByText("Your buyer password was changed successfully.", { exact: false })).toBeVisible();

  await page.getByPlaceholder("Phone number").fill(buyer.phone);
  await page.getByPlaceholder("Password").fill(newPassword);
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page).toHaveURL(/\/shops$/);
  await expect(page.getByText("EJM Release 28 Recovery Buyer", { exact: true })).toBeVisible();
});