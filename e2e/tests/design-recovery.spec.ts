import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  await page.getByPlaceholder("Click, then enter Login ID or email").fill("EJM-E2E-OWNER");
  await page.getByPlaceholder("Click, then enter password").fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
}

test("recovers unsaved design work after a reload", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/dashboard/designs");

  await expect(page.getByRole("heading", { name: "Design Studio" })).toBeVisible();
  await page.getByLabel("Job name").fill("Recovered finals kit");
  await page.getByPlaceholder("Name, number, text…").fill("EUGENE 10");
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(page.getByText(/Recovery draft saved at/)).toBeVisible({ timeout: 8_000 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Recovered work found" })).toBeVisible();
  await page.getByRole("button", { name: "Restore recovered draft" }).click();

  await expect(page.getByLabel("Job name")).toHaveValue("Recovered finals kit");
  await expect(page.getByRole("button", { name: "Select and move EUGENE 10" })).toBeVisible();
  await expect(page.getByText("Recovered draft restored; local autosave remains active")).toBeVisible();
});

test("design recovery remains usable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsOwner(page);
  await page.goto("/dashboard/designs");
  await expect(page.getByRole("heading", { name: "Design Studio" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});
