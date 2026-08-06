import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoHideControls } from "../../hooks/useAutoHideControls";
import { useCallTimer } from "../../hooks/useCallTimer";
import {
  isSameCamera,
  useMediaDevices,
  type CameraFlipResult,
} from "../../hooks/useMediaDevices";

type FakeTrack = MediaStreamTrack & {
  stop: ReturnType<typeof vi.fn>;
  getSettings: ReturnType<typeof vi.fn>;
};

function createFakeTrack(
  kind: "audio" | "video",
  settings: MediaTrackSettings = {},
): FakeTrack {
  return {
    kind,
    enabled: true,
    stop: vi.fn(),
    getSettings: vi.fn(() => settings),
  } as unknown as FakeTrack;
}

function createFakeStream(tracks: FakeTrack[]): MediaStream {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
  } as unknown as MediaStream;
}

function installMediaStreamMock() {
  Object.defineProperty(globalThis, "MediaStream", {
    configurable: true,
    value: class {
      private tracks: FakeTrack[];
      constructor(tracks: FakeTrack[] = []) {
        this.tracks = tracks;
      }
      getTracks() {
        return this.tracks;
      }
      getVideoTracks() {
        return this.tracks.filter((track) => track.kind === "video");
      }
      getAudioTracks() {
        return this.tracks.filter((track) => track.kind === "audio");
      }
    },
  });
}

describe("useCallTimer", () => {
  it("tracks elapsed time while running", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ running }) => useCallTimer(running),
      { initialProps: { running: true } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(1);

    rerender({ running: false });
    const frozen = result.current.formatted;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.formatted).toBe(frozen);
    vi.useRealTimers();
  });
});

describe("useMediaDevices toggles", () => {
  it("toggles microphone and camera tracks", async () => {
    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });
    expect(result.current.stream).toBeTruthy();

    act(() => {
      expect(result.current.toggleAudio()).toBe(false);
    });
    expect(result.current.audioEnabled).toBe(false);

    act(() => {
      expect(result.current.toggleVideo()).toBe(false);
    });
    expect(result.current.videoEnabled).toBe(false);
  });
});

describe("useMediaDevices request lifecycle", () => {
  it("shares one underlying request for simultaneous calls", async () => {
    const video = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const stream = createFakeStream([video, audio]);
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          window.setTimeout(() => resolve(stream), 20);
        }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    const { result } = renderHook(() => useMediaDevices());
    let first: Promise<MediaStream | null>;
    let second: Promise<MediaStream | null>;
    await act(async () => {
      first = result.current.requestPermissions();
      second = result.current.requestPermissions();
      await Promise.all([first, second]);
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await expect(first!).resolves.toBe(stream);
    await expect(second!).resolves.toBe(stream);
  });

  it("stops a late stream after stopAll and does not attach it", async () => {
    const video = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const stream = createFakeStream([video, audio]);
    let resolveMedia: ((value: MediaStream) => void) | null = null;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveMedia = resolve;
        }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    const { result } = renderHook(() => useMediaDevices());
    let pending!: Promise<MediaStream | null>;
    await act(async () => {
      pending = result.current.requestPermissions();
    });

    act(() => {
      result.current.stopAll();
    });

    await act(async () => {
      resolveMedia?.(stream);
      await pending;
    });

    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(result.current.stream).toBeNull();
  });

  it("stops the old video only after a successful flip", async () => {
    const oldVideo = createFakeTrack("video", { deviceId: "front" });
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video", {
      deviceId: "back",
      facingMode: "environment",
    });
    const replacement = createFakeStream([newVideo]);

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(replacement);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn(async () => []) },
    });
    installMediaStreamMock();

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(oldVideo.stop).not.toHaveBeenCalled();

    let flipResult!: CameraFlipResult;
    await act(async () => {
      flipResult = await result.current.flipCamera();
    });

    expect(flipResult).toEqual({ status: "switched" });
    expect(oldVideo.stop).toHaveBeenCalledTimes(1);
    expect(result.current.facingMode).toBe("environment");
    expect(result.current.stream?.getVideoTracks()[0]).toBe(newVideo);
    expect(result.current.error).toBeNull();
    expect(result.current.cameraActionError).toBeNull();
  });

  it("leaves the old video attached when flip fails", async () => {
    const oldVideo = createFakeTrack("video", { deviceId: "front" });
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error("camera busy"));

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn(async () => []) },
    });

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    let flipResult!: CameraFlipResult;
    await act(async () => {
      flipResult = await result.current.flipCamera();
    });

    expect(flipResult.status).toBe("failed");
    expect(oldVideo.stop).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(initial);
    expect(result.current.facingMode).toBe("user");
    expect(result.current.error).toBeNull();
    expect(result.current.cameraActionError).toBe("camera busy");
    expect(result.current.isFlippingCamera).toBe(false);
  });

  it("returns a nonfatal no-op when only one camera exists", async () => {
    const oldVideo = createFakeTrack("video", { deviceId: "only" });
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);

    const getUserMedia = vi.fn().mockResolvedValueOnce(initial);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: vi.fn(async () => [
          { kind: "videoinput", deviceId: "only" },
        ]),
      },
    });

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    let flipResult!: CameraFlipResult;
    await act(async () => {
      flipResult = await result.current.flipCamera();
    });

    expect(flipResult).toEqual({
      status: "noop",
      reason: "no-second-camera",
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(oldVideo.stop).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(initial);
    expect(result.current.facingMode).toBe("user");
    expect(result.current.error).toBeNull();
    expect(result.current.cameraActionError).toBeNull();
    expect(result.current.isFlippingCamera).toBe(false);
  });

  it("returns a nonfatal same-camera no-op and stops the redundant track", async () => {
    const oldVideo = createFakeTrack("video", { deviceId: "cam-1" });
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const sameVideo = createFakeTrack("video", { deviceId: "cam-1" });
    const replacement = createFakeStream([sameVideo]);

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(replacement);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn(async () => []) },
    });
    installMediaStreamMock();

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    let flipResult!: CameraFlipResult;
    await act(async () => {
      flipResult = await result.current.flipCamera();
    });

    expect(flipResult).toEqual({ status: "noop", reason: "same-camera" });
    expect(sameVideo.stop).toHaveBeenCalledTimes(1);
    expect(oldVideo.stop).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(initial);
    expect(result.current.facingMode).toBe("user");
    expect(result.current.error).toBeNull();
    expect(result.current.cameraActionError).toBeNull();
  });

  it("keeps the old stream when Daily rejects the replacement", async () => {
    const oldVideo = createFakeTrack("video", { deviceId: "front" });
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video", { deviceId: "back" });
    const replacement = createFakeStream([newVideo]);

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(replacement);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn(async () => []) },
    });
    installMediaStreamMock();

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    let flipResult!: CameraFlipResult;
    await act(async () => {
      flipResult = await result.current.flipCamera(async () => {
        throw new Error("Daily refused track");
      });
    });

    expect(flipResult.status).toBe("failed");
    if (flipResult.status === "failed") {
      expect(flipResult.error.message).toBe("Daily refused track");
    }
    expect(newVideo.stop).toHaveBeenCalledTimes(1);
    expect(oldVideo.stop).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(initial);
    expect(result.current.facingMode).toBe("user");
    expect(result.current.error).toBeNull();
    expect(result.current.cameraActionError).toBe("Daily refused track");
    expect(result.current.isFlippingCamera).toBe(false);
  });

  it("coalesces rapid Flip presses onto one replacement", async () => {
    const oldVideo = createFakeTrack("video", { deviceId: "front" });
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video", { deviceId: "back" });
    const replacement = createFakeStream([newVideo]);

    let resolveFlip: ((value: MediaStream) => void) | null = null;
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(
        () =>
          new Promise<MediaStream>((resolve) => {
            resolveFlip = resolve;
          }),
      );

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn(async () => []) },
    });
    installMediaStreamMock();

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    let first!: Promise<CameraFlipResult>;
    let second!: Promise<CameraFlipResult>;
    await act(async () => {
      first = result.current.flipCamera();
      second = result.current.flipCamera();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(2); // permissions + one flip

    await act(async () => {
      resolveFlip?.(replacement);
      await Promise.all([first, second]);
    });

    expect(first).toBe(second);
    expect(result.current.facingMode).toBe("environment");
  });

  it("does not attach a late flip after stopAll", async () => {
    const oldVideo = createFakeTrack("video", { deviceId: "front" });
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video", { deviceId: "back" });
    const replacement = createFakeStream([newVideo]);

    let resolveFlip: ((value: MediaStream) => void) | null = null;
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(
        () =>
          new Promise<MediaStream>((resolve) => {
            resolveFlip = resolve;
          }),
      );

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn(async () => []) },
    });
    installMediaStreamMock();

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    let pending!: Promise<CameraFlipResult>;
    await act(async () => {
      pending = result.current.flipCamera();
    });

    act(() => {
      result.current.stopAll();
    });

    await act(async () => {
      resolveFlip?.(replacement);
      await pending;
    });

    expect(newVideo.stop).toHaveBeenCalled();
    expect(result.current.stream).toBeNull();
    expect(result.current.facingMode).toBe("user");
  });

  it("passes the newly acquired track to replaceVideoTrack before attaching", async () => {
    const oldVideo = createFakeTrack("video", { deviceId: "front" });
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video", { deviceId: "back" });
    const replacement = createFakeStream([newVideo]);
    const order: string[] = [];

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(replacement);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn(async () => []) },
    });
    installMediaStreamMock();

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    await act(async () => {
      await result.current.flipCamera(async (track) => {
        order.push("beforeAttach");
        expect(track).toBe(newVideo);
        expect(result.current.stream?.getVideoTracks()[0]).toBe(oldVideo);
      });
      order.push("afterFlip");
    });

    expect(order).toEqual(["beforeAttach", "afterFlip"]);
    expect(result.current.stream?.getVideoTracks()[0]).toBe(newVideo);
    expect(oldVideo.stop).toHaveBeenCalledTimes(1);
  });

  it("stopAll stops every current track", async () => {
    const video = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const stream = createFakeStream([video, audio]);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
        enumerateDevices: vi.fn(async () => []),
      },
    });

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    act(() => {
      result.current.stopAll();
    });

    expect(video.stop).toHaveBeenCalledTimes(1);
    expect(audio.stop).toHaveBeenCalledTimes(1);
    expect(result.current.stream).toBeNull();
  });
});

describe("isSameCamera", () => {
  it("matches on deviceId when both are nonempty", () => {
    const a = createFakeTrack("video", { deviceId: "a", facingMode: "user" });
    const b = createFakeTrack("video", {
      deviceId: "a",
      facingMode: "environment",
    });
    expect(isSameCamera(a, b)).toBe(true);
  });

  it("does not treat matching facingMode alone as the same camera", () => {
    const a = createFakeTrack("video", { facingMode: "user" });
    const b = createFakeTrack("video", { facingMode: "user" });
    expect(isSameCamera(a, b)).toBe(false);
  });

  it("falls back to groupId + facingMode when deviceId is missing", () => {
    const a = createFakeTrack("video", {
      groupId: "g1",
      facingMode: "user",
    });
    const b = createFakeTrack("video", {
      groupId: "g1",
      facingMode: "user",
    });
    expect(isSameCamera(a, b)).toBe(true);
  });
});

describe("useAutoHideControls", () => {
  it("hides after 2000ms and restores on bump", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ keep }) => useAutoHideControls(true, keep, 2000),
      { initialProps: { keep: false } },
    );

    expect(result.current.visible).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.visible).toBe(false);

    act(() => {
      result.current.show();
    });
    expect(result.current.visible).toBe(true);

    rerender({ keep: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.visible).toBe(true);
    vi.useRealTimers();
  });

  it("pauses while overlay feedback is active", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAutoHideControls(true, false, 2000));

    act(() => {
      result.current.pause();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.resume();
      result.current.bump();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.visible).toBe(false);
    vi.useRealTimers();
  });
});
