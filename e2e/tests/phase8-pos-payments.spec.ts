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

async function addPhase7OptionToCart(page: Page) {
  await page.goto("/dashboard/pos");
  await page.getByPlaceholder("Search product or SKU").fill("Phase 7 exact option item");
  await page.getByRole("button", { name: "Choose option for Phase 7 exact option item" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose Phase 7 exact option item" });
  const available = dialog.getByRole("radio", { name: /Size XL.*Colour Black.*Material Cotton.*Sleeve Long/ });
  await available.check();
  await dialog.getByRole("button", { name: "Add selected option" }).click();
  await expect(page.locator("#pos-cart").getByText("Phase 7 exact option item", { exact: true })).toBeVisible();
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

test("balances mixed cash and mobile-money payment before checkout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await addPhase7OptionToCart(page);

  const payment = page.getByRole("region", { name: "Payment breakdown" });
  await expect(payment).toBeVisible();
  await payment.getByRole("radio", { name: /Split or mixed/ }).click();

  const cashAllocation = payment.getByLabel("Amount allocated").first();
  await cashAllocation.fill("50");
  await payment.getByRole("button", { name: "Add Mobile money to mixed payment" }).click();

  const allocations = payment.getByLabel("Amount allocated");
  await expect(allocations).toHaveCount(2);
  await expect(allocations.nth(1)).toHaveValue("75.00");
  await payment.getByLabel("Cash received").fill("60");
  await payment.getByLabel("Mobile-money reference").fill("E2E-MOMO-7788");
  await payment.getByLabel(/I confirmed this mobile-money amount was received/).check();

  await expect(payment.getByRole("status")).toContainText("Payment balances exactly");
  await expect(payment.getByRole("status")).toContainText("Paid now: GH₵125.00");
  await expect(payment.getByRole("status")).toContainText("Change: GH₵10.00");
  await expect(page.getByRole("button", { name: "Complete sale & print" })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});
