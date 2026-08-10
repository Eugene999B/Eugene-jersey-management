import { expect, test, type Page } from "@playwright/test";

const OWNER_LOGIN_ID = "EJM-E2E-OWNER";
const BUYER_PHONE = "+233200000115";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInOwner(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  await page.getByPlaceholder("Click, then enter Login ID or email").fill(OWNER_LOGIN_ID);
  await page.getByPlaceholder("Click, then enter password").fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function signInBuyer(page: Page) {
  await page.goto("/buyer/login?next=/buyer/security");
  await page.getByPlaceholder("Phone number").fill(BUYER_PHONE);
  await page.getByPlaceholder("Password").fill(password());
  await page.getByRole("button", { name: "Continue securely", exact: true }).click();
  await expect(page).toHaveURL(/\/buyer\/security$/, { timeout: 30_000 });
}

test("workforce can review sessions and revoke every other device without ending the current one", async ({ browser }) => {
  test.setTimeout(120_000);
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await signInOwner(firstPage);
    await signInOwner(secondPage);

    await firstPage.goto("/account/security");
    await expect(firstPage.getByRole("heading", { name: "Your devices", exact: true })).toBeVisible();
    await expect(firstPage.getByText("Current device", { exact: true })).toBeVisible();
    await expect(firstPage.getByRole("button", { name: "Sign out other devices", exact: true })).toBeVisible();

    await firstPage.getByRole("button", { name: "Sign out other devices", exact: true }).click();
    await expect(firstPage).toHaveURL(/\/account\/security\?sessionsUpdated=/, { timeout: 30_000 });
    await expect(firstPage.getByText("Current device", { exact: true })).toBeVisible();

    await secondPage.goto("/dashboard");
    await expect(secondPage).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});

test("buyer security shows the durable current-device session", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await signInBuyer(page);
    await expect(page.getByRole("heading", { name: "Your devices", exact: true })).toBeVisible();
    await expect(page.getByText("Current device", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out this device", exact: true })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  } finally {
    await context.close();
  }
});
