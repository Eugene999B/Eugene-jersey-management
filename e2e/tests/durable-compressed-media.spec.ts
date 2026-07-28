import { expect, type Page, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAH0lEQVR4nGNkYGAQYOAgHrEwCHAwMJCARjWMahg6GgC3uAoWp+kCcgAAAABJRU5ErkJggg==",
  "base64",
);

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
  await loginId.fill("EJM-E2E-R30-OWNER");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
}

function uploadedFile(name: string) {
  return { name, mimeType: "image/png", buffer: png };
}

function databasePathFromImageSource(source: string | null) {
  if (!source) return null;
  const parsed = new URL(source, "http://ejm.local");
  const optimizedSource = parsed.searchParams.get("url");
  const candidate = optimizedSource ? decodeURIComponent(optimizedSource) : source;
  const match = candidate.match(/\/api\/media\/database\/[A-Za-z0-9_-]+\/(?:main|thumb)/);
  return match?.[0] ?? null;
}

async function expectCompressedWebp(page: Page, path: string | null) {
  expect(path).toBeTruthy();
  const response = await page.request.get(new URL(path ?? "", page.url()).toString());
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/webp");
  const body = await response.body();
  expect(body.length).toBeGreaterThan(0);
  expect(body.length).toBeLessThan(700_000);
}

test("stores compressed shop, product and Design Studio images durably in PostgreSQL", async ({ page }) => {
  await signIn(page);

  await page.goto("/dashboard/settings");
  await expect(page.getByText("PostgreSQL compressed media ready")).toBeVisible();
  await expect(page.getByText(/large original is discarded/i)).toBeVisible();
  await expect(page.getByText(/Production media uploads require S3\/R2 storage/i)).toHaveCount(0);
  await expect(page.locator('input[name="logoFile"]')).toHaveAttribute("accept", /\.heic/);

  await page.locator('input[name="logoFile"]').setInputFiles(uploadedFile("release30-logo.png"));
  await page.getByRole("button", { name: "Save settings" }).click();
  const logo = page.getByRole("main").getByRole("img", { name: "EJM Release 30 Media Shop" });
  await expect(logo).toBeVisible();
  await expect.poll(async () => databasePathFromImageSource(await logo.getAttribute("src"))).not.toBeNull();
  await expectCompressedWebp(page, databasePathFromImageSource(await logo.getAttribute("src")));

  await page.goto("/dashboard/catalog");
  const productForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Create product" }) });
  await expect(productForm.locator('input[name="photo"]')).toHaveAttribute("accept", /\.heif/);
  await productForm.locator('input[name="name"]').fill("Release 30 Compressed Product");
  await productForm.locator('select[name="categoryId"]').selectOption({ label: "Release 30 Products" });
  await productForm.locator('input[name="basePrice"]').fill("125");
  await productForm.locator('input[name="stockQty"]').fill("7");
  await productForm.locator('input[name="sku"]').fill("R30-MEDIA-001");
  await productForm.locator('input[name="photo"]').setInputFiles(uploadedFile("release30-product.png"));
  await productForm.getByRole("button", { name: "Create product" }).click();

  const productCard = page.locator("article").filter({ hasText: "Release 30 Compressed Product" });
  await expect(productCard).toBeVisible();
  const productStyle = await productCard.getByRole("img", { name: "Release 30 Compressed Product" }).getAttribute("style");
  await expectCompressedWebp(page, databasePathFromImageSource(productStyle));

  await page.goto("/dashboard/designs");
  const artworkInput = page.locator('input[type="file"][multiple]');
  await expect(artworkInput).toHaveAttribute("accept", /\.tiff/);
  await artworkInput.setInputFiles(uploadedFile("release30-design.png"));
  await expect(page.getByText("1 artwork file added")).toBeVisible();
  const designHref = await page.locator('svg[aria-label="Production material canvas"] image').getAttribute("href");
  await expectCompressedWebp(page, databasePathFromImageSource(designHref));
});
