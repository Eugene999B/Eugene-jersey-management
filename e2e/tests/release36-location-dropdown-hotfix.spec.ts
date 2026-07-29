import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill("EJM-E2E-R25-OWNER");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

async function mockGhanaLocationDirectory(page: Page) {
  await page.route("**/api/ghana-locations**", async (route) => {
    const url = new URL(route.request().url());
    const level = url.searchParams.get("level");
    const region = url.searchParams.get("region");
    const items = level === "districts"
      ? region === "Ashanti"
        ? [{ code: "0601", name: "Kumasi Metropolitan", capital: "Kumasi" }]
        : [{ code: "0101", name: "Accra Metropolitan", capital: "Accra" }]
      : level === "communities"
        ? region === "Ashanti"
          ? [{ code: "060101", name: "Kumasi" }]
          : [{ code: "010101", name: "Accra" }, { code: "010102", name: "Osu" }]
        : [];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ source: "browser acceptance fixture", manualEntryAllowed: false, items }),
    });
  });
}

test("existing shop settings use region, district and town dropdowns in sequence", async ({ page }) => {
  await mockGhanaLocationDirectory(page);
  await signInAsOwner(page);
  await page.goto("/dashboard/settings");

  const region = page.locator('select[name="region"]');
  const district = page.locator('select[name="district"]');
  const town = page.locator('select[name="city"]');

  await expect(region).toBeVisible();
  await expect(district).toBeVisible();
  await expect(town).toBeVisible();
  expect(await district.evaluate((element) => element.tagName)).toBe("SELECT");
  expect(await town.evaluate((element) => element.tagName)).toBe("SELECT");

  await region.selectOption("Ashanti");
  await expect(district).toBeEnabled();
  await district.selectOption("Kumasi Metropolitan");
  await expect(town).toBeEnabled();
  await town.selectOption("Kumasi");

  await expect(region).toHaveValue("Ashanti");
  await expect(district).toHaveValue("Kumasi Metropolitan");
  await expect(town).toHaveValue("Kumasi");
  await expect(page.locator('input[name="suburb"]')).toBeEditable();
});
