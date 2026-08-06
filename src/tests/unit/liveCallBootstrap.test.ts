import { afterEach, describe, expect, it, vi } from "vitest";
import {
  armLiveCallFromGesture,
  resetLiveCallBootstrap,
  takeWarmedLocalMedia,
} from "../../lib/liveCallBootstrap";

describe("liveCallBootstrap", () => {
  afterEach(() => {
    resetLiveCallBootstrap();
    vi.unstubAllGlobals();
  });

  it("warms getUserMedia once from the gesture arm and hands it off", async () => {
    const stream = { id: "warm" } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia },
    });

    armLiveCallFromGesture();
    armLiveCallFromGesture();

    expect(getUserMedia).toHaveBeenCalledTimes(1);

    const first = takeWarmedLocalMedia();
    const second = takeWarmedLocalMedia();
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    await expect(first).resolves.toBe(stream);
  });
});
