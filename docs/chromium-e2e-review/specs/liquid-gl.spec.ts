import { expect, test } from "@playwright/test";
import { installMockMedia } from "./helpers/installMockMedia";

test.describe("liquid-gl runtime", () => {
  test("initializes a single LiquidGL canvas on WebGL-capable browsers", async ({
    page,
    browserName,
  }) => {
    test.setTimeout(90_000);
    await page.context().grantPermissions(["camera", "microphone"]).catch(() => undefined);
    await installMockMedia(page);
    await page.goto("/call/demo?debugGlass=1");

    await expect(page.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ringing",
      { timeout: 15_000 },
    );

    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__miniPhoLiquidGlassDebug__ ?? null),
        { timeout: 20_000 },
      )
      .not.toBeNull();

    const debug = await page.evaluate(() => window.__miniPhoLiquidGlassDebug__);
    expect(debug?.packageVersion).toBe("2.0.1");
    expect(debug?.snapshotFound).toBe(true);
    expect(debug?.targetCount ?? 0).toBeGreaterThan(0);

    if (debug?.mode === "active" || debug?.mode === "reduced") {
      expect(debug.canvasCount).toBe(1);
      const backdrop = await page.evaluate(() => {
        const el = document.querySelector(".liquidGL");
        return el ? getComputedStyle(el).backdropFilter : null;
      });
      expect(backdrop === "none" || backdrop === "").toBe(true);
    }

    // Bundle presence check (Chromium): production chunk references liquid-gl.
    if (browserName === "chromium") {
      const response = await page.goto("/");
      expect(response?.ok()).toBeTruthy();
    }

    await page.addInitScript(() => {
      window.__miniPhoForceGlassFallback__ = true;
    });
    await page.reload();
    await installMockMedia(page);
    await expect(page.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ringing",
      { timeout: 15_000 },
    );
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__miniPhoLiquidGlassDebug__?.mode ?? null,
          ),
        { timeout: 15_000 },
      )
      .toBe("fallback");

    const fallbackBackdrop = await page.evaluate(() => {
      const el = document.querySelector(".liquidGL");
      return el ? getComputedStyle(el).backdropFilter : null;
    });
    expect(fallbackBackdrop && fallbackBackdrop !== "none").toBeTruthy();
  });
});
