import { expect, test, type Page } from "@playwright/test";

function required(name: "STAGING_ADMIN_LOGIN_ID" | "STAGING_ADMIN_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the external staging release acceptance journey.`);
  return value;
}

async function signInStagingAdmin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const login = page.getByPlaceholder("Click, then enter Login ID or email");
  const secret = page.getByPlaceholder("Click, then enter password");
  await login.click();
  await login.fill(required("STAGING_ADMIN_LOGIN_ID"));
  await secret.click();
  await secret.fill(required("STAGING_ADMIN_PASSWORD"));
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/admin(?:\?.*)?$/, { timeout: 30_000 });
}

test.describe("Phase 17 external staging release acceptance", () => {
  test.skip(process.env.E2E_EXTERNAL !== "true", "External staging smoke runs only against an explicitly supplied staging URL.");

  test("health, administrator reports, integration health and marketplace survive the staged release", async ({ page, request }) => {
    test.setTimeout(150_000);
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    const healthBody = await health.json() as { status?: string; database?: string };
    expect(healthBody.status).toBe("ready");
    expect(healthBody.database).toBe("connected");

    await signInStagingAdmin(page);
    await expect(page.getByRole("heading", { name: "Command centre", exact: true })).toBeVisible();

    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: "Platform reports", exact: true })).toBeVisible();
    await expect(page.getByText("Unrestricted platform intelligence", { exact: true })).toBeVisible();

    await page.goto("/admin/integrations");
    await expect(page.getByText("Production Integration Health", { exact: true })).toBeVisible();

    await page.goto("/shops");
    await expect(page.getByRole("heading", { name: "ESM Marketplace", exact: true })).toBeVisible();
  });
});
