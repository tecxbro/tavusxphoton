import { expect, test } from "@playwright/test";
import { installMockMedia } from "./helpers/installMockMedia";

test.describe("pho controller call flow", () => {
  test("answers, ends, and resets without auto-answer", async ({
    context,
  }) => {
    test.setTimeout(120_000);
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
    await expect(callPage.getByTestId("remote-video")).toHaveCount(0);

    await callPage.waitForTimeout(2500);
    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ringing",
    );
    await expect(callPage.getByTestId("remote-video")).toHaveCount(0);

    await controllerPage.getByTestId("pho-answer").click();

    // The connecting phase can be shorter than one assertion poll when the
    // mock video decodes instantly, so accept any post-answer phase here.
    await expect
      .poll(
        async () =>
          callPage.getByTestId("call-screen").getAttribute("data-phase"),
        { timeout: 5_000, intervals: [25, 50, 100] },
      )
      .toMatch(/connecting|joining|live/);
    await expect(callPage.getByTestId("remote-video")).toHaveCount(1);

    await expect
      .poll(async () => callPage.getByTestId("call-screen").getAttribute("data-phase"), {
        timeout: 15_000,
      })
      .toMatch(/joining|live/);

    await expect
      .poll(async () => callPage.getByTestId("call-screen").getAttribute("data-phase"), {
        timeout: 10_000,
      })
      .toBe("live");

    await controllerPage.getByTestId("pho-answer").click();
    await callPage.waitForTimeout(800);
    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "live",
    );

    await controllerPage.getByTestId("pho-end").click();
    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ended",
      { timeout: 5_000 },
    );

    await controllerPage.getByTestId("pho-reset").click();
    await expect(callPage.getByTestId("call-screen")).toHaveAttribute(
      "data-phase",
      "ringing",
      { timeout: 15_000 },
    );
    await expect(callPage.getByTestId("remote-video")).toHaveCount(0);
  });
});
