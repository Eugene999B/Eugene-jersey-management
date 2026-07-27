import { expect, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsAdministrator(page: Parameters<typeof test>[0] extends never ? never : import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill("EJM-E2E-ADMIN");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("shows production integration health without mutating providers", async ({ page }) => {
  await signInAsAdministrator(page);
  await page.goto("/admin/integrations");

  await expect(page.getByRole("heading", { name: "Provider and settlement control centre" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment ownership model" })).toBeVisible();
  await expect(page.getByText("Each store owns its settlement", { exact: true })).toBeVisible();
  await expect(page.getByText("Administrator owns platform income", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Run checks again" })).toBeVisible();
});

test("keeps integration health usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsAdministrator(page);
  await page.goto("/admin/integrations");

  await expect(page.getByRole("heading", { name: "Provider and settlement control centre" })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});
