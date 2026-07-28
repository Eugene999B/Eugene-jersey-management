import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill("EJM-E2E-DESIGNER");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
}

async function studioMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[aria-label="Production material canvas"]');
    const main = canvas?.closest("main");
    const grid = main?.parentElement;
    const asides = grid ? Array.from(grid.children).filter((child) => child.tagName === "ASIDE") : [];
    if (!main || !grid || asides.length !== 2) throw new Error("Design Studio workspace was not found.");

    const mainRect = main.getBoundingClientRect();
    const childHeight = Array.from(main.children).reduce((total, child) => total + child.getBoundingClientRect().height, 0);
    const leftRect = asides[0].getBoundingClientRect();
    const rightRect = asides[1].getBoundingClientRect();

    return {
      alignItems: getComputedStyle(grid).alignItems,
      mainPosition: getComputedStyle(main).position,
      unexplainedMainHeight: mainRect.height - childHeight,
      main: { top: mainRect.top, bottom: mainRect.bottom, width: mainRect.width },
      left: { top: leftRect.top, width: leftRect.width },
      right: { top: rightRect.top, width: rightRect.width },
    };
  });
}

test("wide Design Studio keeps a compact sticky canvas without a stretched blank panel", async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1000 });
  await signIn(page);
  await page.goto("/dashboard/designs");

  const metrics = await studioMetrics(page);
  expect(metrics.alignItems).toBe("start");
  expect(metrics.mainPosition).toBe("sticky");
  expect(metrics.unexplainedMainHeight).toBeLessThan(16);
});

test("laptop Design Studio gives the canvas a full row above two balanced control columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/dashboard/designs");

  const metrics = await studioMetrics(page);
  expect(metrics.alignItems).toBe("start");
  expect(metrics.mainPosition).toBe("static");
  expect(metrics.unexplainedMainHeight).toBeLessThan(16);
  expect(metrics.main.width).toBeGreaterThan(metrics.left.width * 1.8);
  expect(metrics.main.width).toBeGreaterThan(metrics.right.width * 1.8);
  expect(metrics.left.top).toBeGreaterThan(metrics.main.bottom);
  expect(Math.abs(metrics.left.top - metrics.right.top)).toBeLessThan(2);
});
