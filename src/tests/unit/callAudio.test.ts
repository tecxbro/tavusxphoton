import { describe, expect, it, vi } from "vitest";
import { CALL_AUDIO, CallAudioController } from "../../lib/callAudio";

type FakeAudio = {
  src: string;
  loop: boolean;
  preload: string;
  currentTime: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
};

function createFakeAudio(src: string, loop = false): FakeAudio {
  return {
    src,
    loop,
    preload: "auto",
    currentTime: 12,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    load: vi.fn(),
    removeAttribute: vi.fn(),
  };
}

function createController() {
  const created: FakeAudio[] = [];
  const controller = new CallAudioController((src, loop = false) => {
    const audio = createFakeAudio(src, loop);
    created.push(audio);
    return audio as unknown as HTMLAudioElement;
  });
  const bySrc = Object.fromEntries(created.map((audio) => [audio.src, audio]));
  return {
    controller,
    ringing: bySrc[CALL_AUDIO.ringing]!,
    connected: bySrc[CALL_AUDIO.connected]!,
    ended: bySrc[CALL_AUDIO.ended]!,
    micMute: bySrc[CALL_AUDIO.micMute]!,
    micUnmute: bySrc[CALL_AUDIO.micUnmute]!,
  };
}

describe("CallAudioController", () => {
  it("exposes the public FaceTime audio URLs", () => {
    expect(CALL_AUDIO).toEqual({
      ringing: "/audio/facetime/vc~ringing.wav",
      connected: "/audio/facetime/vc~invitation-accepted.wav",
      ended: "/audio/facetime/vc~ended.wav",
      micMute: "/audio/facetime/MicMute.wav",
      micUnmute: "/audio/facetime/MicUnmute.wav",
    });
  });

  it("loops ringing and resets currentTime before play", () => {
    const { controller, ringing } = createController();
    controller.startRinging();
    expect(ringing.loop).toBe(true);
    expect(ringing.currentTime).toBe(0);
    expect(ringing.pause).not.toHaveBeenCalled();
    expect(ringing.play).toHaveBeenCalledTimes(1);
  });

  it("stops ringing with pause and currentTime 0", () => {
    const { controller, ringing } = createController();
    controller.startRinging();
    ringing.currentTime = 4;
    controller.stopRinging();
    expect(ringing.pause).toHaveBeenCalled();
    expect(ringing.currentTime).toBe(0);
  });

  it("does not overlap ringing and connected", () => {
    const { controller, ringing, connected } = createController();
    controller.startRinging();
    ringing.currentTime = 3;
    controller.playConnected();
    expect(ringing.pause).toHaveBeenCalled();
    expect(ringing.currentTime).toBe(0);
    expect(connected.currentTime).toBe(0);
    expect(connected.play).toHaveBeenCalledTimes(1);
  });

  it("plays ended only once until the session resets", () => {
    const { controller, ended, ringing } = createController();
    controller.startRinging();
    controller.playEnded();
    controller.playEnded();
    expect(ended.play).toHaveBeenCalledTimes(1);
    expect(ringing.pause).toHaveBeenCalled();
    expect(controller.hasPlayedEnded()).toBe(true);

    controller.resetSession();
    controller.playEnded();
    expect(ended.play).toHaveBeenCalledTimes(2);
  });

  it("resets currentTime before mic one-shots", () => {
    const { controller, micMute, micUnmute } = createController();
    micMute.currentTime = 9;
    micUnmute.currentTime = 8;
    controller.playMicMute();
    controller.playMicUnmute();
    expect(micMute.currentTime).toBe(0);
    expect(micUnmute.currentTime).toBe(0);
    expect(micMute.play).toHaveBeenCalledTimes(1);
    expect(micUnmute.play).toHaveBeenCalledTimes(1);
  });

  it("swallows rejected play() promises", async () => {
    const { controller, ringing } = createController();
    ringing.play.mockReturnValueOnce(Promise.reject(new Error("NotAllowedError")));
    expect(() => controller.startRinging()).not.toThrow();
    await Promise.resolve();
  });

  it("preloads each asset once and cleans up on dispose", () => {
    const { controller, ringing, connected, ended, micMute, micUnmute } =
      createController();
    controller.preload();
    controller.preload();
    for (const audio of [ringing, connected, ended, micMute, micUnmute]) {
      expect(audio.load).toHaveBeenCalledTimes(1);
    }

    controller.dispose();
    controller.startRinging();
    expect(ringing.play).not.toHaveBeenCalled();
    expect(ringing.removeAttribute).toHaveBeenCalledWith("src");
  });
});
