import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
}

async function addTextLayer(page: Page, value: string) {
  const input = page.getByPlaceholder("Name, number, text…");
  await input.fill(value);
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(page.getByRole("button", { name: `Select and move ${value}` })).toBeVisible();
}

function layerListButton(page: Page, name: string) {
  return page.getByRole("button", { name: new RegExp(`^${escapeRegExp(name)}(?: Group)?$`) });
}

test("groups layers and reopens immutable shop versions", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/dashboard/designs");

  await expect(page.getByRole("heading", { name: "Design Studio" })).toBeVisible();
  await page.getByLabel("Job name").fill("Grouped history kit");
  await addTextLayer(page, "EUGENE");
  await addTextLayer(page, "10");

  await layerListButton(page, "EUGENE").click();
  await page.keyboard.down("Shift");
  await layerListButton(page, "10").click();
  await page.keyboard.up("Shift");
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Group selected" }).click();
  await expect(page.getByText("Group", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Saved version 1 to this shop", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Job name").fill("Grouped history kit revised");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved version 2 to this shop", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await page.getByLabel("Open shop project").selectOption({ label: "Grouped history kit revised" });
  await expect(page.getByRole("button", { name: "Open version 1" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Open version 2" })).toBeVisible();

  await layerListButton(page, "EUGENE").click();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Open version 1" }).click();
  await expect(page.getByLabel("Job name")).toHaveValue("Grouped history kit");
  await expect(page.getByText("Version 1 opened; save changes to create a new current version", { exact: true })).toBeVisible();
});

test("advanced Design Studio remains usable without horizontal overflow on mobile", async ({ page }) => {
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
