import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
}

test("presents a rich brand-led marketplace on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/shops");

  await expect(page.getByRole("heading", { name: "EJM Marketplace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shop brands worth opening" })).toBeVisible();
  await expect(page.getByText("Brands available").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Open shop/ }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("keeps marketplace discovery engaging and usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shops");

  await expect(page.getByPlaceholder("Item, shop, team, brand or location")).toBeVisible();
  await expect(page.getByRole("button", { name: /Search/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore shops/ })).toBeVisible();
  await expect(page.getByText("Brands available").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
