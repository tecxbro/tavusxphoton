import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createTavusConversation = vi.fn();
const endTavusConversation = vi.fn();

vi.mock("../../lib/tavus/tavus-client", () => ({
  createTavusConversation: (...args: unknown[]) =>
    createTavusConversation(...args),
  endTavusConversation: (...args: unknown[]) => endTavusConversation(...args),
}));

type HandlerMap = Record<string, Array<(event?: unknown) => void>>;

function createMockCall() {
  const handlers: HandlerMap = {};
  const call = {
    on: vi.fn((event: string, handler: (event?: unknown) => void) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
      return call;
    }),
    off: vi.fn((event: string, handler: (event?: unknown) => void) => {
      handlers[event] = (handlers[event] || []).filter((h) => h !== handler);
      return call;
    }),
    join: vi.fn(async () => undefined),
    leave: vi.fn(async () => undefined),
    destroy: vi.fn(async () => undefined),
    isDestroyed: vi.fn(() => false),
    participants: vi.fn(() => ({})),
    setLocalVideo: vi.fn(),
    setLocalAudio: vi.fn(),
    setInputDevicesAsync: vi.fn(async () => undefined),
    emit(event: string, payload?: unknown) {
      for (const handler of handlers[event] || []) {
        handler(payload);
      }
    },
  };
  return call;
}

const createCallObject = vi.fn();

vi.mock("@daily-co/daily-js", () => ({
  default: {
    createCallObject: (...args: unknown[]) => createCallObject(...args),
  },
}));

describe("useTavusCall", () => {
  beforeEach(() => {
    createTavusConversation.mockReset();
    endTavusConversation.mockReset();
    createCallObject.mockReset();
    createTavusConversation.mockResolvedValue({
      conversation_id: "conv_1",
      conversation_url: "https://tavus.daily.co/room-1",
      meeting_token: "meeting-token-1",
    });
    endTavusConversation.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates one conversation and one Daily call object per Call", async () => {
    const call = createMockCall();
    createCallObject.mockReturnValue(call);

    const { useTavusCall } = await import("../../hooks/useTavusCall");
    const { result } = renderHook(() => useTavusCall());

    await act(async () => {
      await result.current.startCall();
    });

    expect(createCallObject).toHaveBeenCalledTimes(1);
    expect(createTavusConversation).toHaveBeenCalledTimes(1);
    expect(call.join).toHaveBeenCalledWith({
      url: "https://tavus.daily.co/room-1",
      token: "meeting-token-1",
      videoSource: expect.anything(),
      audioSource: expect.anything(),
    });
  });

  it("marks palJoined and attaches remote tracks for non-local participants", async () => {
    const call = createMockCall();
    createCallObject.mockReturnValue(call);

    const { useTavusCall } = await import("../../hooks/useTavusCall");
    const { result } = renderHook(() => useTavusCall());

    await act(async () => {
      await result.current.startCall();
    });

    const videoTrack = { kind: "video", id: "v1" } as MediaStreamTrack;
    const audioTrack = { kind: "audio", id: "a1" } as MediaStreamTrack;

    await act(async () => {
      call.emit("participant-joined", {
        participant: {
          local: false,
          session_id: "gary",
          tracks: {
            video: { state: "playable", persistentTrack: videoTrack },
            audio: { state: "playable", persistentTrack: audioTrack },
          },
        },
      });
      call.emit("track-started", {
        participant: { local: false, session_id: "gary", tracks: {} },
        track: videoTrack,
        type: "video",
      });
      call.emit("track-started", {
        participant: { local: false, session_id: "gary", tracks: {} },
        track: audioTrack,
        type: "audio",
      });
    });

    await waitFor(() => {
      expect(result.current.palJoined).toBe(true);
      expect(result.current.remoteVideoStream?.getVideoTracks()[0]).toBe(
        videoTrack,
      );
      expect(result.current.remoteAudioStream?.getAudioTracks()[0]).toBe(
        audioTrack,
      );
    });
  });

  it("ends Tavus once and leaves/destroys Daily on end", async () => {
    const call = createMockCall();
    createCallObject.mockReturnValue(call);

    const { useTavusCall } = await import("../../hooks/useTavusCall");
    const { result } = renderHook(() => useTavusCall());

    await act(async () => {
      await result.current.startCall();
    });

    await act(async () => {
      await result.current.endCall();
    });

    expect(endTavusConversation).toHaveBeenCalledTimes(1);
    expect(endTavusConversation).toHaveBeenCalledWith("conv_1");
    expect(call.leave).toHaveBeenCalledTimes(1);
    expect(call.destroy).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh conversation after reset", async () => {
    const first = createMockCall();
    const second = createMockCall();
    createCallObject
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    createTavusConversation
      .mockResolvedValueOnce({
        conversation_id: "conv_1",
        conversation_url: "https://tavus.daily.co/room-1",
        meeting_token: "tok-1",
      })
      .mockResolvedValueOnce({
        conversation_id: "conv_2",
        conversation_url: "https://tavus.daily.co/room-2",
        meeting_token: "tok-2",
      });

    const { useTavusCall } = await import("../../hooks/useTavusCall");
    const { result } = renderHook(() => useTavusCall());

    await act(async () => {
      await result.current.startCall();
    });
    await act(async () => {
      await result.current.resetCall();
    });
    await act(async () => {
      await result.current.startCall();
    });

    expect(createTavusConversation).toHaveBeenCalledTimes(2);
    expect(createCallObject).toHaveBeenCalledTimes(2);
    expect(second.join).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://tavus.daily.co/room-2",
        token: "tok-2",
      }),
    );
  });

  it("does not create duplicate conversations for overlapping startCall", async () => {
    const call = createMockCall();
    createCallObject.mockReturnValue(call);

    let resolveCreate: (value: unknown) => void = () => undefined;
    createTavusConversation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const { useTavusCall } = await import("../../hooks/useTavusCall");
    const { result } = renderHook(() => useTavusCall());

    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    await act(async () => {
      first = result.current.startCall();
      second = result.current.startCall();
    });

    resolveCreate({
      conversation_id: "conv_1",
      conversation_url: "https://tavus.daily.co/room-1",
      meeting_token: "tok",
    });

    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(createTavusConversation).toHaveBeenCalledTimes(1);
    expect(createCallObject).toHaveBeenCalledTimes(1);
  });

  it("ends a conversation if permissions fail after create", async () => {
    const call = createMockCall();
    createCallObject.mockReturnValue(call);

    const getUserMedia = vi
      .spyOn(navigator.mediaDevices, "getUserMedia")
      .mockRejectedValue(new Error("Permission denied"));

    createTavusConversation.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        conversation_id: "conv_denied",
        conversation_url: "https://tavus.daily.co/room",
        meeting_token: "tok",
      };
    });

    const { useTavusCall } = await import("../../hooks/useTavusCall");
    const { result } = renderHook(() => useTavusCall());

    await act(async () => {
      await result.current.startCall();
    });

    expect(endTavusConversation).toHaveBeenCalledWith("conv_denied");
    expect(call.join).not.toHaveBeenCalled();
    getUserMedia.mockRestore();
  });

  it("passes the newly acquired camera track to Daily on flip", async () => {
    type FakeTrack = MediaStreamTrack & { stop: ReturnType<typeof vi.fn> };
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
        getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
        getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
      } as unknown as MediaStream;
    }

    const oldVideo = createFakeTrack("video");
    const audio = createFakeTrack("audio");
    const initial = createFakeStream([oldVideo, audio]);
    const newVideo = createFakeTrack("video");
    const replacement = createFakeStream([newVideo]);

    const getUserMedia = vi
      .spyOn(navigator.mediaDevices, "getUserMedia")
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(replacement);

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
          return this.tracks.filter((t) => t.kind === "video");
        }
        getAudioTracks() {
          return this.tracks.filter((t) => t.kind === "audio");
        }
      },
    });

    const call = createMockCall();
    createCallObject.mockReturnValue(call);

    const { useTavusCall } = await import("../../hooks/useTavusCall");
    const { result } = renderHook(() => useTavusCall());

    await act(async () => {
      await result.current.startCall();
    });

    await act(async () => {
      await result.current.flipCamera();
    });

    expect(call.setInputDevicesAsync).toHaveBeenCalledWith({
      videoSource: newVideo,
    });
    expect(result.current.localStream?.getVideoTracks()[0]).toBe(newVideo);
    getUserMedia.mockRestore();
  });
});
