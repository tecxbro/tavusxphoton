import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoHideControls } from "../../hooks/useAutoHideControls";
import { useCallTimer } from "../../hooks/useCallTimer";
import { useMediaDevices } from "../../hooks/useMediaDevices";
import type { CameraFacing } from "../../lib/callState";

type FakeTrack = MediaStreamTrack & {
  stop: ReturnType<typeof vi.fn>;
};

function createFakeTrack(kind: "audio" | "video"): FakeTrack {
  return {
    kind,
    enabled: true,
    stop: vi.fn(),
  } as unknown as FakeTrack;
}

function createFakeStream(tracks: FakeTrack[]): MediaStream {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
  } as unknown as MediaStream;
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
    const oldVideo = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video");
    const replacement = createFakeStream([newVideo]);

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(replacement);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
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

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(oldVideo.stop).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.flipCamera();
    });

    expect(oldVideo.stop).toHaveBeenCalledTimes(1);
    expect(result.current.facingMode).toBe("environment");
    expect(result.current.stream?.getVideoTracks()[0]).toBe(newVideo);
  });

  it("leaves the old video attached when flip fails", async () => {
    const oldVideo = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error("camera busy"));

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    await act(async () => {
      const facing = await result.current.flipCamera();
      expect(facing).toBeNull();
    });

    expect(oldVideo.stop).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(initial);
    expect(result.current.facingMode).toBe("user");
  });

  it("coalesces rapid Flip presses onto one replacement", async () => {
    const oldVideo = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video");
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
      value: { getUserMedia },
    });
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

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    let first!: Promise<CameraFacing | null>;
    let second!: Promise<CameraFacing | null>;
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
    const oldVideo = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video");
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
      value: { getUserMedia },
    });
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

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.requestPermissions();
    });

    let pending!: Promise<CameraFacing | null>;
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

  it("passes the newly acquired track to beforeAttach before attaching", async () => {
    const oldVideo = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video");
    const replacement = createFakeStream([newVideo]);
    const order: string[] = [];

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(replacement);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
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
