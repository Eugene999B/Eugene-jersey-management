import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

const LOGIN_ID = "EJM-E2E-OWNER";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const login = page.getByPlaceholder("Click, then enter Login ID or email");
  const secret = page.getByPlaceholder("Click, then enter password");
  await login.click();
  await login.fill(LOGIN_ID);
  await secret.click();
  await secret.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
}

function formForButton(page: import("@playwright/test").Page, buttonName: string) {
  return page.getByRole("button", { name: buttonName }).locator("xpath=ancestor::form");
}

async function resourceId(page: import("@playwright/test").Page, heading: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
  await expect(article).toBeVisible();
  return article.locator('input[name="id"]').first().inputValue();
}

test("operator executes a reviewed manual heat press job with persistent timer, QC and photo evidence", async ({ page }) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  const materialName = `Phase 13 HTV ${suffix}`;
  const garmentName = `Phase 13 tee ${suffix}`;
  const placementName = `Phase 13 chest ${suffix}`;
  const designName = `Phase 13 artwork ${suffix}`;

  await signIn(page);
  await page.goto("/dashboard/designs/materials");

  const material = formForButton(page, "Add material recipe");
  await material.getByLabel("Material name").fill(materialName);
  await material.getByLabel("Material type").fill("Heat-transfer vinyl");
  await material.getByLabel("Colour").fill("White");
  await material.getByLabel("Roll width (mm)").fill("500");
  await material.getByLabel("Remaining length (m)").fill("20");
  await material.getByLabel("Cost per metre").fill("12");
  await material.getByLabel("Blade / profile").fill("45 degree blade");
  await material.getByLabel("Cutter force").fill("90");
  await material.getByLabel("Cutter speed").fill("300");
  await material.getByLabel("Cut passes").fill("1");
  await material.getByLabel("Press temperature (°C)").fill("150");
  await material.getByLabel("Press duration (seconds)").fill("1");
  await material.getByLabel("Pressure").fill("Medium");
  await material.getByLabel("Peel method").fill("Warm");
  await material.getByLabel("Repress (seconds)").fill("1");
  await material.getByRole("button", { name: "Add material recipe" }).click();
  const materialId = await resourceId(page, materialName);

  const garment = formForButton(page, "Add garment profile");
  await garment.getByLabel("Garment profile").fill(garmentName);
  await garment.getByLabel("Garment type").fill("T-shirt");
  await garment.getByLabel("Colour").fill("Black");
  await garment.getByLabel("Fabric").fill("100% cotton");
  await garment.getByLabel("Available sizes").fill("S, M, L");
  await garment.getByLabel("Maximum safe press temperature (°C)").fill("170");
  await garment.getByLabel("Garment cost").fill("25");
  await garment.getByLabel("Default selling price").fill("45");
  await garment.getByRole("button", { name: "Add garment profile" }).click();
  const garmentId = await resourceId(page, garmentName);

  const placement = formForButton(page, "Add placement template");
  await placement.getByLabel("Placement name").fill(placementName);
  await placement.getByLabel("Location code").fill("LEFT_CHEST");
  await placement.getByLabel("Garment profile").selectOption({ label: garmentName });
  await placement.getByLabel("Default width (mm)").fill("100");
  await placement.getByLabel("Default height (mm)").fill("100");
  await placement.getByLabel("Size-specific dimensions").fill("M: 110x105");
  await placement.getByRole("button", { name: "Add placement template" }).click();
  const placementId = await resourceId(page, placementName);

  const fixture = await page.evaluate(async ({ title, garmentId, placementId, materialId }) => {
    const designResponse = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        canvas: {
          version: 6,
          jobName: title,
          customer: "",
          material: "htv",
          sheet: "custom",
          customWidth: 300,
          customHeight: 500,
          copies: 1,
          mirror: true,
          showGrid: true,
          snap: true,
          weedBox: true,
          registrationMarks: false,
          contourOffset: 0,
          layers: [{
            id: "phase13-artwork",
            kind: "rectangle",
            name: "Chest artwork",
            visible: true,
            locked: false,
            x: 100,
            y: 100,
            width: 80,
            height: 60,
            rotation: 0,
            color: "#111827",
          }],
        },
      }),
    });
    const design = await designResponse.json() as { design?: { id: string }; error?: string };
    if (!designResponse.ok || !design.design) throw new Error(design.error ?? "Could not create heat-press design fixture.");

    const briefResponse = await fetch("/api/design-production-briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designJobId: design.design.id,
        garmentId,
        garmentSize: "M",
        placementId,
        materialId,
        action: "REVIEW",
      }),
    });
    const brief = await briefResponse.json() as { brief?: { id: string }; error?: string };
    if (!briefResponse.ok || !brief.brief) throw new Error(brief.error ?? "Could not create reviewed heat-press fixture.");
    return { designId: design.design.id, briefId: brief.brief.id };
  }, { title: designName, garmentId, placementId, materialId });

  await page.goto(`/dashboard/designs/heat-press?brief=${encodeURIComponent(fixture.briefId)}`);
  await expect(page.getByRole("heading", { name: "Heat press", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: designName, exact: true })).toBeVisible();
  await expect(page.getByText(`${garmentName} · M`, { exact: true })).toBeVisible();
  await expect(page.getByText("150 °C · 1s", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create heat press attempt", exact: true }).click();
  await expect(page.getByText("Attempt 1 · Ready", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Start first press", exact: true }).click();
  await expect(page.getByText("First-press timer started.", { exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("First-press timer paused.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume first press", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Mark first press complete", exact: true }).click();
  await expect(page.getByText("First press recorded. Follow the saved peel method next.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Record peel completed", exact: true }).click();
  await expect(page.getByText("Peel recorded. Repress is now ready.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start repress", exact: true }).click();
  await page.waitForTimeout(1_050);
  await page.getByRole("button", { name: "Mark repress complete", exact: true }).click();
  await expect(page.getByText("Repress recorded. Continue to quality inspection.", { exact: true })).toBeVisible();

  const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.getByLabel("Attach finished photo", { exact: true }).setInputFiles({ name: "finished.png", mimeType: "image/png", buffer: onePixelPng });
  await expect(page.getByText("Finished-product photo attached to this heat press attempt.", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /Finished garment evidence uploaded/ })).toBeVisible();

  for (const label of [
    "Design is centred and positioned correctly",
    "Correct garment size was pressed",
    "Correct garment and material colour were used",
    "No lifted vinyl edges",
    "No scorch or heat marks",
    "No vinyl cracking, melting or damage",
    "Carrier was removed using the correct peel method",
    "Customer instructions and placement were satisfied",
  ]) {
    await page.getByRole("checkbox", { name: label, exact: true }).check();
  }
  await expect(page.getByText("All required quality checks pass.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark quality passed", exact: true }).click();
  await expect(page.getByText("Quality passed. This heat press attempt is complete.", { exact: true })).toBeVisible();
  await expect(page.getByText("Attempt 1 · Passed", { exact: true })).toBeVisible();
  await expect(page.getByText("Quality passed", { exact: true }).last()).toBeVisible();
});
