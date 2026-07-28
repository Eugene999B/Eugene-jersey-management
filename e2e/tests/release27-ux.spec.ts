import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  await page.getByPlaceholder("Click, then enter Login ID or email").fill("EJM-E2E-ADMIN");
  await page.getByPlaceholder("Click, then enter password").fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/admin$/);
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

test("keeps administrator help, security and sign out visible on a short desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await signInAsAdmin(page);
  await expect(page.getByRole("link", { name: "Personal security", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open administrator help" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("puts personal security and sign out inside the mobile administrator tools drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsAdmin(page);
  await page.getByRole("button", { name: "Open platform tools" }).click();
  const dialog = page.getByRole("dialog", { name: "All platform tools" });
  await expect(dialog.getByRole("link", { name: "Personal security", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("shows buyer account creation before the login page fold and preserves checkout destination", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyer/login?next=/cart");
  const createAccount = page.getByRole("link", { name: /Create a buyer account/ });
  await expect(createAccount).toBeVisible();
  const box = await createAccount.boundingBox();
  expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(760);
  await createAccount.click();
  await expect(page).toHaveURL(/\/buyer\/register\?next=%2Fcart$/);
  await expect(page.getByRole("heading", { name: "Register before you checkout." })).toBeVisible();
  await expect(page.getByRole("button", { name: /SMS unavailable|Send phone verification code/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("keeps marketplace filters URL-backed, visible and clearable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shops?q=Browser&city=Accra&ordering=open&sort=products");
  await expect(page.getByRole("heading", { name: "EJM Marketplace" })).toBeVisible();
  await expect(page.getByPlaceholder("Shop, team, brand or item")).toHaveValue("Browser");
  await expect(page.locator('select[name="city"]')).toHaveValue("Accra");
  await expect(page.locator('select[name="ordering"]')).toHaveValue("open");
  await expect(page.locator('select[name="sort"]')).toHaveValue("products");
  await expect(page.getByText("Search: Browser", { exact: true })).toBeVisible();
  await expect(page.getByText("Location: Accra", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear filters" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/shops$/);
});
