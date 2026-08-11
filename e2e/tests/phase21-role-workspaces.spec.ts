import { expect, type Page, test } from "@playwright/test";

const roleWorkspaces = [
  { role: "Owner", loginId: "EJM-E2E-OWNER", allowedPath: "/dashboard/settings" },
  { role: "Manager", loginId: "EJM-E2E-MANAGER", allowedPath: "/dashboard/staff" },
  { role: "Cashier", loginId: "EJM-E2E-CASHIER", allowedPath: "/dashboard/pos", forbiddenPath: "/dashboard/staff" },
  { role: "Designer", loginId: "EJM-E2E-DESIGNER", allowedPath: "/dashboard/designs", forbiddenPath: "/dashboard/pos" },
  { role: "Inventory Clerk", loginId: "EJM-E2E-INVENTORY", allowedPath: "/dashboard/catalog", forbiddenPath: "/dashboard/pos" },
  { role: "Accountant", loginId: "EJM-E2E-ACCOUNTANT", allowedPath: "/dashboard/reports", forbiddenPath: "/dashboard/pos" },
  { role: "Viewer", loginId: "EJM-E2E-VIEWER", allowedPath: "/dashboard/reports", forbiddenPath: "/dashboard/pos" },
] as const;

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page, loginId: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  await page.getByPlaceholder("Click, then enter Login ID or email").fill(loginId);
  await page.getByPlaceholder("Click, then enter password").fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

for (const workspace of roleWorkspaces) {
  test(`${workspace.role} sees an authorized workspace and the shared subscription destination`, async ({ page }) => {
    await signIn(page, workspace.loginId);
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
    await expect(page.getByRole("link", { name: "Modules, plan & usage", exact: true })).toBeVisible();

    await page.goto("/dashboard/subscription");
    await expect(page.getByRole("heading", { name: "Subscription & usage" })).toBeVisible();

    await page.goto(workspace.allowedPath);
    await expect(page).toHaveURL(new RegExp(`${workspace.allowedPath.replaceAll("/", "\\/")}(?:\\?|$)`));

    if ("forbiddenPath" in workspace) {
      await page.goto(workspace.forbiddenPath);
      await expect(page).toHaveURL(/\/dashboard\?error=permission(?:&|$)/);
      await expect(page.getByText("Access restricted.", { exact: false })).toBeVisible();
    }
  });
}
