import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page, loginIdValue: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill(loginIdValue);
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
}

async function addRectangle(page: Page) {
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resize Rectangle from south east" })).toBeVisible();
}

test("resizes and rotates one unlocked layer with canvas handles", async ({ page }) => {
  await signIn(page, "EJM-E2E-OWNER");
  await page.goto("/dashboard/designs");
  await addRectangle(page);

  const widthField = page.getByLabel("Width (mm)").first();
  const rotationField = page.getByLabel("Rotation (degrees)").first();
  const startingWidth = Number(await widthField.inputValue());

  const resizeHandle = page.getByRole("button", { name: "Resize Rectangle from south east" });
  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).not.toBeNull();
  if (!resizeBox) return;
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 45, resizeBox.y + resizeBox.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await widthField.inputValue())).toBeGreaterThan(startingWidth);

  const rotateHandle = page.getByRole("button", { name: "Rotate Rectangle" });
  const rotateBox = await rotateHandle.boundingBox();
  expect(rotateBox).not.toBeNull();
  if (!rotateBox) return;
  await page.mouse.move(rotateBox.x + rotateBox.width / 2, rotateBox.y + rotateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotateBox.x + rotateBox.width / 2 + 55, rotateBox.y + rotateBox.height / 2 + 15, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs(Number(await rotationField.inputValue()))).toBeGreaterThan(1);
});

test("mobile inspector exposes exact layer controls without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "EJM-E2E-DESIGNER");
  await page.goto("/dashboard/designs");
  await addRectangle(page);

  await page.getByRole("button", { name: "Open mobile inspector" }).click();
  const inspector = page.getByRole("dialog", { name: "Layer inspector" });
  await expect(inspector).toBeVisible();
  await inspector.getByLabel("Width (mm)").fill("70");
  await expect(inspector.getByLabel("Width (mm)")).toHaveValue("70");
  await inspector.getByRole("button", { name: "Close mobile inspector" }).click();
  await expect(inspector).toBeHidden();

  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});
