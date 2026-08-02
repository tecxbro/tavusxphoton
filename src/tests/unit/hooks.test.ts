import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoHideControls } from "../../hooks/useAutoHideControls";
import { useCallTimer } from "../../hooks/useCallTimer";
import { useMediaDevices } from "../../hooks/useMediaDevices";

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

describe("useAutoHideControls", () => {
  it("hides after inactivity and restores on bump", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ keep }) => useAutoHideControls(true, keep, 3000),
      { initialProps: { keep: false } },
    );

    expect(result.current.visible).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
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
});
