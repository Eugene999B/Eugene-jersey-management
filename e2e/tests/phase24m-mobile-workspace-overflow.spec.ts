import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginField = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginField.fill("EJM-E2E-OWNER");
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
}

async function expectNoPageOverflow(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, `${path} document overflowed the mobile viewport`).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, `${path} body overflowed the mobile viewport`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("owner shop workspaces stay inside the mobile viewport", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  const paths = [
    "/dashboard",
    "/dashboard/catalog",
    "/dashboard/customers",
    "/dashboard/designs",
    "/dashboard/designs/workflow",
    "/dashboard/designs/production",
    "/dashboard/designs/materials",
    "/dashboard/customer-production",
    "/dashboard/production-stock",
    "/dashboard/suppliers",
    "/dashboard/network",
    "/dashboard/messages",
    "/dashboard/setup",
    "/dashboard/settings",
    "/dashboard/subscription",
  ];

  for (const path of paths) await expectNoPageOverflow(page, path);
});
