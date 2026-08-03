import { expect, test, type Browser, type Page } from "@playwright/test";
import { installMockMedia } from "./helpers/installMockMedia";

const SECRET = process.env.TEST_CONTROLLER_SECRET || "local-dev-controller-secret";

async function openCall(browser: Browser, sessionId = "demo") {
  const context = await browser.newContext();
  await context.grantPermissions(["camera", "microphone"]).catch(() => undefined);
  const page = await context.newPage();
  await installMockMedia(page);
  await page.goto(`/call/${sessionId}`);
  return { context, page };
}

async function openController(browser: Browser, sessionId = "demo") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/pho-controller");
  await page.getByTestId("pho-session-input").fill(sessionId);
  await page.getByTestId("pho-secret-input").fill(SECRET);
  await expect(page.getByTestId("pho-connection")).toContainText(
    "API reachable",
    { timeout: 15_000 },
  );
  return { context, page };
}

async function expectPhase(page: Page, phase: string | RegExp, timeout = 15_000) {
  if (typeof phase === "string") {
    await expect(page.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      phase,
      { timeout },
    );
    return;
  }
  await expect
    .poll(async () => page.getByTestId("call-screen").getAttribute("data-phase"), {
      timeout,
    })
    .toMatch(phase);
}

async function expectRemoteActive(page: Page, active: boolean) {
  if (active) {
    await expect(page.getByTestId("remote-video")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 5_000 },
    );
  } else {
    await expect(page.getByTestId("remote-video")).not.toHaveAttribute(
      "data-active",
    );
  }
}

test.describe("pho controller cross-context signaling", () => {
  test("answers, acknowledges, ends, and resets across isolated contexts", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const sessionId = `ctx-${Date.now()}`;
    const call = await openCall(browser, sessionId);
    const controller = await openController(browser, sessionId);

    await expectPhase(call.page, "ringing");
    await expectRemoteActive(call.page, false);
    await call.page.waitForTimeout(2000);
    await expectPhase(call.page, "ringing");

    await controller.page.getByTestId("pho-answer").click();
    await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
      /Queued revision|Applied:/,
      { timeout: 5_000 },
    );

    await expectPhase(call.page, /connecting|joining|live/, 5_000);
    await expectRemoteActive(call.page, true);
    await expectPhase(call.page, /joining|live/);
    await expectPhase(call.page, "live");

    await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
      "Applied:",
      { timeout: 15_000 },
    );

    // Duplicate answer while live: acknowledged without changing phase.
    await controller.page.getByTestId("pho-answer").click();
    await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
      "Applied:",
      { timeout: 15_000 },
    );
    await expectPhase(call.page, "live");

    await controller.page.getByTestId("pho-end").click();
    await expectPhase(call.page, "ended", 5_000);
    await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
      "Applied: ended",
      { timeout: 15_000 },
    );

    await controller.page.getByTestId("pho-reset").click();
    await expectPhase(call.page, "ringing", 15_000);
    await expectRemoteActive(call.page, false);
    await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
      "Applied: ringing",
      { timeout: 15_000 },
    );

    // Controller reload recovers latest command/ack.
    await controller.page.reload();
    await controller.page.getByTestId("pho-session-input").fill(sessionId);
    await controller.page.getByTestId("pho-secret-input").fill(SECRET);
    await expect(controller.page.getByTestId("pho-connection")).toContainText(
      "API reachable",
      { timeout: 15_000 },
    );

    await call.context.close();
    await controller.context.close();
  });

  test("ends from ringing, connecting, joining, and live", async ({ browser }) => {
    test.setTimeout(240_000);
    const phases = ["ringing", "connecting", "joining", "live"] as const;

    for (const target of phases) {
      const sessionId = `end-${target}`;
      const call = await openCall(browser, sessionId);
      const controller = await openController(browser, sessionId);
      await expectPhase(call.page, "ringing");

      if (target !== "ringing") {
        await controller.page.getByTestId("pho-answer").click();
        if (target === "connecting") {
          await expectPhase(call.page, /connecting|joining|live/, 5_000);
        } else if (target === "joining") {
          await expectPhase(call.page, /joining|live/, 15_000);
        } else {
          await expectPhase(call.page, "live", 15_000);
        }
      }

      await controller.page.getByTestId("pho-end").click();
      await expectPhase(call.page, "ended", 8_000);
      await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
        "Applied: ended",
        { timeout: 15_000 },
      );

      await call.context.close();
      await controller.context.close();
    }
  });

  test("reset from live restores timer and ignores stale revisions after reload", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const call = await openCall(browser, "reset-live");
    const controller = await openController(browser, "reset-live");

    await expectPhase(call.page, "ringing");
    await controller.page.getByTestId("pho-answer").click();
    await expectPhase(call.page, "live", 15_000);

    await call.page.waitForTimeout(1200);
    await controller.page.getByTestId("pho-reset").click();
    await expectPhase(call.page, "ringing", 15_000);
    await expect(call.page.getByTestId("call-screen")).toBeVisible();
    await expectRemoteActive(call.page, false);

    // Call reload should not replay the applied revision from sessionStorage.
    await call.page.reload();
    await installMockMedia(call.page);
    await expectPhase(call.page, "ringing", 15_000);
    await call.page.waitForTimeout(1500);
    await expectPhase(call.page, "ringing");

    await call.context.close();
    await controller.context.close();
  });

  test("invalid secrets produce an error and no command", async ({ browser }) => {
    const call = await openCall(browser, "bad-secret");
    const controller = await openController(browser, "bad-secret");
    await expectPhase(call.page, "ringing");

    await controller.page.getByTestId("pho-secret-input").fill("definitely-wrong");
    await controller.page.getByTestId("pho-answer").click();
    await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
      "Error:",
      { timeout: 10_000 },
    );
    await expect(controller.page.getByTestId("pho-controller-status")).not.toContainText(
      "Applied:",
    );
    await call.page.waitForTimeout(1200);
    await expectPhase(call.page, "ringing");

    await call.context.close();
    await controller.context.close();
  });

  test("does not show Applied until acknowledgement exists", async ({ browser }) => {
    const controller = await openController(browser, "no-client");
    // No call client is listening for this session.
    await controller.page.getByTestId("pho-answer").click();
    await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
      "Queued revision",
      { timeout: 5_000 },
    );
    await expect(controller.page.getByTestId("pho-controller-status")).not.toContainText(
      "Applied:",
    );
    await expect(controller.page.getByTestId("pho-controller-status")).toContainText(
      "Queued, call client has not acknowledged",
      { timeout: 20_000 },
    );
    await controller.context.close();
  });
});
