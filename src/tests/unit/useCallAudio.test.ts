import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useCallAudio } from "../../hooks/useCallAudio";
import { CALL_AUDIO } from "../../lib/callAudio";

type FakeAudio = HTMLAudioElement & {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
};

describe("useCallAudio", () => {
  const created: FakeAudio[] = [];
  let OriginalAudio: typeof Audio;

  beforeEach(() => {
    created.length = 0;
    OriginalAudio = globalThis.Audio;
    globalThis.Audio = class FakeAudioCtor {
      src: string;
      loop = false;
      preload = "auto";
      currentTime = 0;
      play = vi.fn(() => Promise.resolve());
      pause = vi.fn();
      load = vi.fn();
      removeAttribute = vi.fn();
      constructor(src?: string) {
        this.src = src ?? "";
        created.push(this as unknown as FakeAudio);
      }
    } as unknown as typeof Audio;
  });

  afterEach(() => {
    globalThis.Audio = OriginalAudio;
  });

  function bySrc(src: string): FakeAudio {
    const matches = created.filter((item) => item.src === src);
    const audio = matches.at(-1);
    if (!audio) throw new Error(`Missing audio for ${src}`);
    return audio;
  }

  it("maps phase transitions to ringing, connected, and ended", () => {
    const { rerender, unmount } = renderHook(
      ({ phase, audioEnabled }) => useCallAudio(phase, audioEnabled),
      { initialProps: { phase: "bootstrapping" as const, audioEnabled: true } },
    );

    act(() => {
      rerender({ phase: "ringing", audioEnabled: true });
    });
    const ringing = bySrc(CALL_AUDIO.ringing);
    expect(ringing.loop).toBe(true);
    expect(ringing.play).toHaveBeenCalled();

    act(() => {
      rerender({ phase: "connecting", audioEnabled: true });
    });
    expect(ringing.pause).toHaveBeenCalled();
    expect(bySrc(CALL_AUDIO.connected).play).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ phase: "live", audioEnabled: true });
    });
    act(() => {
      rerender({ phase: "ended", audioEnabled: true });
    });
    expect(bySrc(CALL_AUDIO.ended).play).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ phase: "ended", audioEnabled: true });
    });
    expect(bySrc(CALL_AUDIO.ended).play).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("plays mic mute and unmute when audioEnabled flips", () => {
    const { rerender, unmount } = renderHook(
      ({ phase, audioEnabled }) => useCallAudio(phase, audioEnabled),
      { initialProps: { phase: "live" as const, audioEnabled: true } },
    );

    act(() => {
      rerender({ phase: "live", audioEnabled: false });
    });
    expect(bySrc(CALL_AUDIO.micMute).play).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ phase: "live", audioEnabled: true });
    });
    expect(bySrc(CALL_AUDIO.micUnmute).play).toHaveBeenCalledTimes(1);

    unmount();
  });
});
