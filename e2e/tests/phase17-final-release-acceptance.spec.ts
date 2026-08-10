import { expect, test, type Browser, type Page } from "@playwright/test";

const OWNER_LOGIN_ID = "EJM-E2E-OWNER";
const ADMIN_LOGIN_ID = "EJM-E2E-ADMIN";
const BUYER_PHONE = "+233200000115";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInStaff(page: Page, loginId: string, destination: RegExp) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const login = page.getByPlaceholder("Click, then enter Login ID or email");
  const secret = page.getByPlaceholder("Click, then enter password");
  await login.click();
  await login.fill(loginId);
  await secret.click();
  await secret.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(destination, { timeout: 30_000 });
}

async function signInBuyer(page: Page) {
  await page.goto("/buyer/login?next=/buyer/production-requests");
  await page.getByPlaceholder("Phone number").fill(BUYER_PHONE);
  await page.getByPlaceholder("Password").fill(password());
  await page.getByRole("button", { name: "Continue securely", exact: true }).click();
  await expect(page).toHaveURL(/\/buyer\/production-requests$/, { timeout: 30_000 });
}

async function assertRouteHealthy(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `${path} should return a document response`).not.toBeNull();
  expect(response!.status(), `${path} should not return an HTTP error`).toBeLessThan(400);
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
  await expect(page.locator("body")).not.toContainText("Application error: a server-side exception has occurred");
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function ownerReleaseSweep(browser: Browser, viewport?: { width: number; height: number }) {
  const context = await browser.newContext(viewport ? { viewport } : undefined);
  const page = await context.newPage();
  try {
    await signInStaff(page, OWNER_LOGIN_ID, /\/dashboard$/);
    for (const route of [
      "/dashboard",
      "/dashboard/catalog",
      "/dashboard/orders",
      "/dashboard/customers",
      "/dashboard/designs",
      "/dashboard/designs/materials",
      "/dashboard/designs/production",
      "/dashboard/production-stock",
      "/dashboard/customer-production",
      "/dashboard/reports",
      "/dashboard/settings",
    ]) {
      await assertRouteHealthy(page, route);
      if (viewport) await assertNoHorizontalOverflow(page);
    }
    await expect(page.locator("body")).toBeVisible();
  } finally {
    await context.close();
  }
}

test("final release sweeps owner buyer public and platform-admin surfaces", async ({ browser }) => {
  test.setTimeout(240_000);
  await ownerReleaseSweep(browser);

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  try {
    await assertRouteHealthy(publicPage, "/shops");
    await expect(publicPage.getByRole("heading", { name: "ESM Marketplace", exact: true })).toBeVisible();
    await assertRouteHealthy(publicPage, "/shop/ejm-browser-test-shop");
    await assertRouteHealthy(publicPage, "/shop/ejm-browser-test-shop/custom-production");
  } finally {
    await publicContext.close();
  }

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  try {
    await signInBuyer(buyerPage);
    await expect(buyerPage.getByRole("heading", { name: "My custom production requests", exact: true })).toBeVisible();
    await assertRouteHealthy(buyerPage, "/shops?offer=CUSTOM");
    await assertRouteHealthy(buyerPage, "/buyer/production-requests");
  } finally {
    await buyerContext.close();
  }

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    await signInStaff(adminPage, ADMIN_LOGIN_ID, /\/admin$/);
    for (const route of ["/admin", "/admin/reports", "/admin/integrations", "/admin/shops", "/admin/support/cases", "/admin/activity", "/admin/security", "/admin/settings"]) {
      await assertRouteHealthy(adminPage, route);
    }
    await expect(adminPage.locator("body")).toBeVisible();
  } finally {
    await adminContext.close();
  }
});

test("final release keeps critical owner workflow usable at 390 by 844", async ({ browser }) => {
  test.setTimeout(180_000);
  await ownerReleaseSweep(browser, { width: 390, height: 844 });
});
