export const CALL_AUDIO = {
  ringing: "/audio/facetime/vc~ringing.wav",
  connected: "/audio/facetime/vc~invitation-accepted.wav",
  ended: "/audio/facetime/vc~ended.wav",
  micMute: "/audio/facetime/MicMute.wav",
  micUnmute: "/audio/facetime/MicUnmute.wav",
} as const;

export type CallAudioId = keyof typeof CALL_AUDIO;

type AudioElements = Record<CallAudioId, HTMLAudioElement>;

function createAudio(src: string, loop = false): HTMLAudioElement {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.loop = loop;
  return audio;
}

function safePlay(audio: HTMLAudioElement): void {
  void audio.play().catch(() => undefined);
}

function stopAudio(audio: HTMLAudioElement): void {
  audio.pause();
  audio.currentTime = 0;
}

/** Single-call FaceTime SFX controller. One instance per call screen. */
export class CallAudioController {
  private readonly elements: AudioElements;
  private preloaded = false;
  private endedPlayed = false;
  private disposed = false;

  constructor(createElement: (src: string, loop?: boolean) => HTMLAudioElement = createAudio) {
    this.elements = {
      ringing: createElement(CALL_AUDIO.ringing, true),
      connected: createElement(CALL_AUDIO.connected),
      ended: createElement(CALL_AUDIO.ended),
      micMute: createElement(CALL_AUDIO.micMute),
      micUnmute: createElement(CALL_AUDIO.micUnmute),
    };
    this.elements.ringing.loop = true;
  }

  preload(): void {
    if (this.disposed || this.preloaded) return;
    this.preloaded = true;
    for (const audio of Object.values(this.elements)) {
      audio.preload = "auto";
      audio.load();
    }
  }

  /** Clear per-call guards so a new outbound call can ring and end again. */
  resetSession(): void {
    this.endedPlayed = false;
  }

  startRinging(): void {
    if (this.disposed) return;
    this.preload();
    stopAudio(this.elements.connected);
    const ringing = this.elements.ringing;
    ringing.loop = true;
    ringing.currentTime = 0;
    safePlay(ringing);
  }

  stopRinging(): void {
    if (this.disposed) return;
    stopAudio(this.elements.ringing);
  }

  playConnected(): void {
    if (this.disposed) return;
    this.preload();
    this.stopRinging();
    const connected = this.elements.connected;
    connected.currentTime = 0;
    safePlay(connected);
  }

  playEnded(): void {
    if (this.disposed || this.endedPlayed) return;
    this.endedPlayed = true;
    this.preload();
    this.stopRinging();
    stopAudio(this.elements.connected);
    const ended = this.elements.ended;
    ended.currentTime = 0;
    safePlay(ended);
  }

  playMicMute(): void {
    this.playOneShot("micMute");
  }

  playMicUnmute(): void {
    this.playOneShot("micUnmute");
  }

  stopAll(): void {
    if (this.disposed) return;
    for (const audio of Object.values(this.elements)) {
      stopAudio(audio);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopAll();
    for (const audio of Object.values(this.elements)) {
      audio.removeAttribute("src");
      audio.load();
    }
    this.disposed = true;
  }

  /** Test helper — exposes whether ended already fired this session. */
  hasPlayedEnded(): boolean {
    return this.endedPlayed;
  }

  private playOneShot(id: Exclude<CallAudioId, "ringing">): void {
    if (this.disposed) return;
    this.preload();
    const audio = this.elements[id];
    audio.currentTime = 0;
    safePlay(audio);
  }
}

export function createCallAudioController(): CallAudioController {
  return new CallAudioController();
}
