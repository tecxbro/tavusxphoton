import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCallLifecycle } from "../../hooks/useCallLifecycle";
import { CALL_MOTION } from "../../lib/callUi";

describe("useCallLifecycle", () => {
  it("advances bootstrapping → ringing → connecting → joining → live", async () => {
    vi.useFakeTimers();
    const startCall = vi.fn(async () => undefined);
    const endTavusCall = vi.fn(async () => undefined);
    const onExit = vi.fn();
    const clearRemoteMedia = vi.fn();
    const onResetVisuals = vi.fn();

    const { result, rerender } = renderHook(
      (props: { localStream: MediaStream | null; palJoined: boolean }) =>
        useCallLifecycle({
          autoStart: false,
          startCall,
          endTavusCall,
          onExit,
          localStream: props.localStream,
          palJoined: props.palJoined,
          callError: null,
          starting: false,
          clearRemoteMedia,
          onResetVisuals,
        }),
      { initialProps: { localStream: null, palJoined: false } },
    );

    await act(async () => {
      await result.current.beginCall();
    });
    expect(result.current.phase).toBe("bootstrapping");
    expect(onResetVisuals).toHaveBeenCalled();

    const stream = {} as MediaStream;
    rerender({ localStream: stream, palJoined: false });
    expect(result.current.phase).toBe("ringing");

    rerender({ localStream: stream, palJoined: true });
    expect(result.current.phase).toBe("connecting");

    act(() => {
      result.current.onRemoteFirstFrame();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CALL_MOTION.connectingMinMs);
    });
    expect(result.current.phase).toBe("joining");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CALL_MOTION.joinMs);
    });
    expect(result.current.phase).toBe("live");

    vi.useRealTimers();
  });

  it("requires a fresh remote frame after hangup restart", async () => {
    vi.useFakeTimers();
    const startCall = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      (props: { localStream: MediaStream | null; palJoined: boolean }) =>
        useCallLifecycle({
          autoStart: false,
          startCall,
          endTavusCall: vi.fn(async () => undefined),
          onExit: vi.fn(),
          localStream: props.localStream,
          palJoined: props.palJoined,
          callError: null,
          starting: false,
          clearRemoteMedia: vi.fn(),
          onResetVisuals: vi.fn(),
        }),
      { initialProps: { localStream: null, palJoined: false } },
    );

    const stream = {} as MediaStream;
    await act(async () => {
      await result.current.beginCall();
    });
    rerender({ localStream: stream, palJoined: false });
    rerender({ localStream: stream, palJoined: true });
    expect(result.current.phase).toBe("connecting");

    act(() => {
      result.current.handleEndCall();
    });
    expect(result.current.phase).toBe("ended");

    rerender({ localStream: null, palJoined: false });
    await act(async () => {
      await result.current.beginCall();
    });
    rerender({ localStream: stream, palJoined: false });
    rerender({ localStream: stream, palJoined: true });
    expect(result.current.phase).toBe("connecting");

    // Elapsed connecting time alone must not promote after restart.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CALL_MOTION.connectingMinMs * 2);
    });
    expect(result.current.phase).toBe("connecting");

    act(() => {
      result.current.onRemoteFirstFrame();
    });
    // Connecting clock was already aged above, so joining advances synchronously.
    expect(result.current.phase).toBe("joining");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CALL_MOTION.joinMs);
    });
    expect(result.current.phase).toBe("live");

    vi.useRealTimers();
  });

  it("maps fatal callError to connection-error and allows Retry beginCall", async () => {
    const endTavusCall = vi.fn(async () => undefined);
    const startCall = vi.fn(async () => undefined);

    const { result, rerender } = renderHook(
      (props: {
        localStream: MediaStream | null;
        callError: string | null;
      }) =>
        useCallLifecycle({
          autoStart: false,
          startCall,
          endTavusCall,
          onExit: vi.fn(),
          localStream: props.localStream,
          palJoined: false,
          callError: props.callError,
          starting: false,
          clearRemoteMedia: vi.fn(),
          onResetVisuals: vi.fn(),
        }),
      { initialProps: { localStream: null, callError: null } },
    );

    await act(async () => {
      await result.current.beginCall();
    });
    const stream = {} as MediaStream;
    rerender({ localStream: stream, callError: null });
    expect(result.current.phase).toBe("ringing");

    rerender({ localStream: stream, callError: "Daily connection error" });
    expect(result.current.phase).toBe("connection-error");
    expect(endTavusCall).toHaveBeenCalledTimes(1);

    // Parent clears error when startCall begins (useTavusCall.setError(null)).
    rerender({ localStream: null, callError: null });
    await act(async () => {
      await result.current.beginCall();
    });
    expect(startCall).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe("bootstrapping");
  });
});
