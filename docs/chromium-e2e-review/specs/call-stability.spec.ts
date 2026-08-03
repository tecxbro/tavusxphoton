import { expect, test } from "@playwright/test";
import { JOIN_MORPH_MS } from "../../src/lib/callState";
import { installMockMedia } from "./helpers/installMockMedia";

const SECRET = process.env.TEST_CONTROLLER_SECRET || "local-dev-controller-secret";

async function prepareController(
  page: import("@playwright/test").Page,
  sessionId: string,
) {
  await page.goto("/pho-controller");
  await page.getByTestId("pho-session-input").fill(sessionId);
  await page.getByTestId("pho-secret-input").fill(SECRET);
  await expect(page.getByTestId("pho-connection")).toContainText(
    "API reachable",
    { timeout: 15_000 },
  );
}

test.describe("call stability", () => {
  test("repeated controls and controller actions do not leak DOM or canvases", async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const sessionId = `stable-${Date.now()}`;

    const callContext = await browser.newContext();
    await callContext
      .grantPermissions(["camera", "microphone"])
      .catch(() => undefined);
    const callPage = await callContext.newPage();
    await installMockMedia(callPage);
    await callPage.goto(`/call/${sessionId}?debugGlass=1`);

    const controllerContext = await browser.newContext();
    const controllerPage = await controllerContext.newPage();
    await prepareController(controllerPage, sessionId);

    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ringing",
      { timeout: 15_000 },
    );

    await expect
      .poll(
        async () =>
          callPage.evaluate(
            () => window.__miniPhoLiquidGlassDebug__?.mode ?? null,
          ),
        { timeout: 20_000 },
      )
      .toMatch(/active|reduced|fallback|error/);

    await controllerPage.getByTestId("pho-answer").click();
    await expect
      .poll(
        async () =>
          callPage.getByTestId("call-screen").getAttribute("data-phase"),
        { timeout: 15_000 },
      )
      .toBe("live");

    await expect(callPage.getByTestId("tap-restore")).toBeVisible({
      timeout: 10_000,
    });

    const baseline = await callPage.evaluate(() => ({
      buttons: document.querySelectorAll("button").length,
      liquid: document.querySelectorAll(".liquidGL").length,
      bodyChildren: document.body.childElementCount,
      canvases: Array.from(document.querySelectorAll("canvas")).filter((node) =>
        (node as HTMLCanvasElement).hasAttribute("data-liquid-ignore"),
      ).length,
    }));

    await callPage.getByTestId("tap-restore").click();
    await expect(callPage.getByTestId("facetime-chrome")).toHaveAttribute(
      "data-visible",
      "true",
    );

    for (let i = 0; i < 50; i += 1) {
      await callPage.getByTestId("toggle-camera").click();
      await callPage.getByTestId("toggle-mic").click();
    }

    for (let i = 0; i < 20; i += 1) {
      await expect(callPage.getByTestId("tap-restore")).toBeVisible({
        timeout: 5_000,
      });
      await callPage.getByTestId("tap-restore").click();
      await expect(callPage.getByTestId("facetime-chrome")).toHaveAttribute(
        "data-visible",
        "true",
      );
      await expect(callPage.getByTestId("tap-restore")).toBeVisible({
        timeout: 5_000,
      });
    }

    for (let i = 0; i < 20; i += 1) {
      await callPage.evaluate(() => {
        window.dispatchEvent(new Event("resize"));
        window.visualViewport?.dispatchEvent(new Event("resize"));
      });
    }

    await expect(callPage.getByTestId("toggle-camera")).toHaveCount(1);
    await expect(callPage.getByTestId("toggle-mic")).toHaveCount(1);
    await expect(callPage.getByTestId("more-button")).toHaveCount(1);

    await expect(callPage.getByTestId("tap-restore")).toBeVisible({
      timeout: 10_000,
    });

    const afterControls = await callPage.evaluate(() => {
      const debug = window.__miniPhoLiquidGlassDebug__;
      const liquidCanvases = Array.from(
        document.querySelectorAll("canvas"),
      ).filter((node) =>
        (node as HTMLCanvasElement).hasAttribute("data-liquid-ignore"),
      ).length;
      const backdrop = getComputedStyle(
        document.querySelector(".liquidGL") as Element,
      ).backdropFilter;
      return {
        buttons: document.querySelectorAll("button").length,
        liquid: document.querySelectorAll(".liquidGL").length,
        bodyChildren: document.body.childElementCount,
        canvases: liquidCanvases,
        orphanShadows: Array.from(document.body.children).filter((node) => {
          if (!(node instanceof HTMLElement)) return false;
          const style = getComputedStyle(node);
          return (
            style.position === "fixed" &&
            (node.shadowRoot != null || node.id.includes("liquid"))
          );
        }).length,
        camera: document.querySelectorAll('[data-testid="toggle-camera"]').length,
        mic: document.querySelectorAll('[data-testid="toggle-mic"]').length,
        more: document.querySelectorAll('[data-testid="more-button"]').length,
        debugMode: debug?.mode ?? null,
        debugVersion: debug?.packageVersion ?? null,
        backdrop,
      };
    });

    expect(afterControls.buttons).toBe(baseline.buttons);
    expect(afterControls.liquid).toBe(baseline.liquid);
    expect(afterControls.bodyChildren).toBe(baseline.bodyChildren);
    expect(afterControls.canvases).toBeLessThanOrEqual(1);
    if (afterControls.debugMode === "active" || afterControls.debugMode === "reduced") {
      expect(afterControls.canvases).toBe(1);
      expect(afterControls.backdrop === "none" || afterControls.backdrop === "").toBe(
        true,
      );
    }
    expect(afterControls.debugVersion).toBe("2.0.1");
    expect(afterControls.orphanShadows).toBe(0);
    expect(afterControls.camera).toBe(1);
    expect(afterControls.mic).toBe(1);
    expect(afterControls.more).toBe(1);

    await controllerPage.getByTestId("pho-reset").click();
    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ringing",
      { timeout: 15_000 },
    );

    await controllerPage.getByTestId("pho-answer").click();
    await expect
      .poll(
        async () =>
          callPage.getByTestId("call-screen").getAttribute("data-phase"),
        { timeout: 15_000, intervals: [25, 50, 100] },
      )
      .toMatch(/joining|live/);
    await controllerPage.getByTestId("pho-end").click();
    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ended",
      { timeout: 5_000 },
    );
    await callPage.waitForTimeout(JOIN_MORPH_MS + 300);
    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ended",
    );

    const growthStart = await callPage.evaluate(
      () => document.body.childElementCount,
    );

    for (let i = 0; i < 10; i += 1) {
      await controllerPage.getByTestId("pho-reset").click();
      await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
        "data-phase",
        "ringing",
        { timeout: 15_000 },
      );
      await controllerPage.getByTestId("pho-answer").click();
      await expect
        .poll(
          async () =>
            callPage.getByTestId("call-screen").getAttribute("data-phase"),
          { timeout: 15_000 },
        )
        .toMatch(/joining|live/);
      await controllerPage.getByTestId("pho-end").click();
      await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
        "data-phase",
        "ended",
        { timeout: 5_000 },
      );
    }

    const growthEnd = await callPage.evaluate(() => ({
      bodyChildren: document.body.childElementCount,
      canvases: Array.from(document.querySelectorAll("canvas")).filter((node) =>
        (node as HTMLCanvasElement).hasAttribute("data-liquid-ignore"),
      ).length,
    }));
    expect(growthEnd.bodyChildren).toBe(growthStart);
    expect(growthEnd.canvases).toBeLessThanOrEqual(1);

    await callContext.close();
    await controllerContext.close();
  });
});
