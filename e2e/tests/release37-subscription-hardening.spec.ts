import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  await page.getByPlaceholder("Click, then enter Login ID or email").fill("EJM-E2E-R25-OWNER");
  await page.getByPlaceholder("Click, then enter password").fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

test("shop owner can review subscription state, live usage and plan features", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/dashboard/subscription");

  await expect(page.getByRole("heading", { name: "Subscription & usage" })).toBeVisible();
  await expect(page.getByText("Assigned commercial terms")).toBeVisible();
  await expect(page.getByText("Live plan usage")).toBeVisible();
  await expect(page.getByText("Orders created this calendar month")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Included features" })).toBeVisible();
});

test("subscription centre remains usable on a narrow phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsOwner(page);
  await page.goto("/dashboard/subscription");

  await expect(page.getByRole("heading", { name: "Subscription & usage" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  await expect(page.getByText("Products", { exact: true }).first()).toBeVisible();
});
