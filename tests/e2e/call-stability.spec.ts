import { expect, test } from "@playwright/test";
import { JOIN_MORPH_MS } from "../../src/lib/callState";
import { installMockMedia } from "./helpers/installMockMedia";

test.describe("call stability", () => {
  test("repeated controls and controller actions do not leak DOM", async ({
    context,
  }) => {
    test.setTimeout(300_000);
    await context.grantPermissions(["camera", "microphone"]).catch(() => undefined);

    const callPage = await context.newPage();
    await installMockMedia(callPage);
    await callPage.goto("/call/demo");

    const controllerPage = await context.newPage();
    await controllerPage.goto("/pho-controller");

    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ringing",
      { timeout: 15_000 },
    );

    await controllerPage.getByTestId("pho-answer").click();
    await expect
      .poll(async () => callPage.getByTestId("call-screen").getAttribute("data-phase"), {
        timeout: 15_000,
      })
      .toBe("live");

    // Auto-hide leaves the controls hidden after 2s of no interaction;
    // that state is stable indefinitely, so measure DOM counts there.
    await expect(callPage.getByTestId("tap-restore")).toBeVisible({
      timeout: 10_000,
    });

    const baseline = await callPage.evaluate(() => ({
      buttons: document.querySelectorAll("button").length,
      liquid: document.querySelectorAll(".liquidGL").length,
      bodyChildren: document.body.childElementCount,
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

    // Return to the same stable hidden state the baseline was measured in.
    await expect(callPage.getByTestId("tap-restore")).toBeVisible({
      timeout: 10_000,
    });

    const afterControls = await callPage.evaluate(() => ({
      buttons: document.querySelectorAll("button").length,
      liquid: document.querySelectorAll(".liquidGL").length,
      bodyChildren: document.body.childElementCount,
      canvases: document.querySelectorAll("canvas").length,
      webgl: Array.from(document.querySelectorAll("canvas")).filter((node) => {
        const canvas = node as HTMLCanvasElement;
        return Boolean(
          canvas.getContext("webgl") || canvas.getContext("webgl2"),
        );
      }).length,
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
    }));

    expect(afterControls.buttons).toBe(baseline.buttons);
    expect(afterControls.liquid).toBe(baseline.liquid);
    expect(afterControls.bodyChildren).toBe(baseline.bodyChildren);
    expect(afterControls.webgl).toBe(0);
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
    // Poll quickly so we usually catch the short-lived joining phase and end
    // the call while its JOIN_COMPLETE timeout is still pending.
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

    const growthEnd = await callPage.evaluate(
      () => document.body.childElementCount,
    );
    expect(growthEnd).toBe(growthStart);
  });
});
