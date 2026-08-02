import "@testing-library/jest-dom/vitest";

class MockMediaStreamTrack {
  kind: "audio" | "video";
  enabled = true;
  constructor(kind: "audio" | "video") {
    this.kind = kind;
  }
  stop() {
    this.enabled = false;
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[];
  constructor(tracks: MockMediaStreamTrack[] = []) {
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
}

Object.defineProperty(globalThis.navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: async () =>
      new MockMediaStream([
        new MockMediaStreamTrack("video"),
        new MockMediaStreamTrack("audio"),
      ]),
  },
});

Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: async () => undefined,
});

Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: () => undefined,
});
