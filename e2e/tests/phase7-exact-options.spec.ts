import { expect, type Page, test } from "@playwright/test";

const LOGIN_ID = "EJM-E2E-CATALOG";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
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
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
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

test("requires an exact available option before adding one grouped item to the POS cart", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/dashboard/pos");

  await expect(page.getByRole("heading", { name: "Point of Sale" })).toBeVisible();
  await page.getByPlaceholder("Search product or SKU").fill("Phase 7 exact option item");

  const product = page.getByRole("button", { name: "Choose option for Phase 7 exact option item" });
  await expect(product).toBeVisible();
  await expect(page.getByText("2 options · choose exact option", { exact: true })).toBeVisible();
  await product.click();

  const dialog = page.getByRole("dialog", { name: "Choose Phase 7 exact option item" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Exact option required", { exact: true })).toBeVisible();

  const available = dialog.getByRole("radio", { name: /Size XL.*Colour Black.*Material Cotton.*Sleeve Long/ });
  const unavailable = dialog.getByRole("radio", { name: /Size M.*Colour Blue.*Material Cotton/ });
  await expect(available).toBeEnabled();
  await expect(unavailable).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Add selected option" })).toBeDisabled();

  await available.check();
  await expect(available).toBeChecked();
  await expect(dialog.getByRole("status")).toContainText("Size XL · Colour Black · Material Cotton · Sleeve Long");
  await dialog.getByRole("button", { name: "Add selected option" }).click();

  await expect(dialog).toBeHidden();
  const cart = page.locator("#pos-cart");
  await expect(cart.getByText("Phase 7 exact option item", { exact: true })).toBeVisible();
  await expect(cart.getByText("Size XL · Colour Black · Material Cotton · Sleeve Long", { exact: true })).toBeVisible();
  await expect(cart.getByText("EJM-P7-BLACK-XL", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
