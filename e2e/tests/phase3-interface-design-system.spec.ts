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
  await loginId.fill("EJM-E2E-OWNER");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
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

const viewports = [
  { name: "small Android", width: 360, height: 740 },
  { name: "standard mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "1024 laptop", width: 1024, height: 768 },
  { name: "1366 laptop", width: 1366, height: 768 },
  { name: "large desktop", width: 1600, height: 900 },
] as const;

test("keeps the Phase 3 system usable across required screen sizes", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsOwner(page);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/dashboard/customers");
    await expect(page.getByRole("heading", { name: "Customer records" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const search = page.getByRole("textbox", { name: "Search customers" }).first();
    const searchBox = await search.boundingBox();
    expect(searchBox?.height ?? 0, `${viewport.name} customer search touch height`).toBeGreaterThanOrEqual(40);

    await page.goto("/dashboard/pos");
    await expect(page.getByRole("heading", { name: "Point of Sale" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const card = page.getByRole("radio", { name: "CARD" });
    await card.click();
    await expect(card).toHaveAttribute("aria-checked", "true");
    await expect(card).toContainText("Selected");

    await page.screenshot({ path: testInfo.outputPath(`phase3-${viewport.width}x${viewport.height}.png`), fullPage: false });
  }
});
