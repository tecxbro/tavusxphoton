import type { Page } from "@playwright/test";

/**
 * Installs a same-page media mock before any app code runs.
 *
 * The script is passed as a raw string (not a serialized function) so that
 * TypeScript/esbuild transforms can never inject module-scope helpers (e.g.
 * `__name`) that would be undefined inside the page and crash the script.
 */
const MOCK_MEDIA_SCRIPT = `
(() => {
  window.__mockMediaInstalled = "starting";

  const makeTrack = (kind) => {
    const track = {
      kind,
      id: "mock-" + kind + "-" + Math.random().toString(36).slice(2),
      label: kind === "video" ? "Mock Camera" : "Mock Microphone",
      enabled: true,
      muted: false,
      readyState: "live",
      contentHint: "",
      onended: null,
      onmute: null,
      onunmute: null,
      stop() {
        track.readyState = "ended";
      },
      clone() {
        return makeTrack(kind);
      },
      getCapabilities() {
        return {};
      },
      getConstraints() {
        return {};
      },
      getSettings() {
        return kind === "video"
          ? { facingMode: "user", width: 640, height: 480, deviceId: "mock" }
          : { deviceId: "mock", groupId: "mock" };
      },
      applyConstraints() {
        return Promise.resolve();
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    };
    return track;
  };

  const createMockStream = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    const paint = () => {
      if (!ctx) return;
      ctx.fillStyle = "#1d4f7c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(320, 240, 80, 0, Math.PI * 2);
      ctx.fill();
    };
    paint();

    try {
      if (typeof canvas.captureStream === "function") {
        const captured = canvas.captureStream(20);
        if (captured.getVideoTracks().length > 0) {
          const animate = () => {
            paint();
            if (captured.getVideoTracks().some((t) => t.readyState === "live")) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
          if (captured.getAudioTracks().length === 0) {
            try {
              captured.addTrack(makeTrack("audio"));
            } catch (e) {
              // Audio track optional in browser mocks.
            }
          }
          return captured;
        }
      }
    } catch (e) {
      // Fall through to synthetic tracks.
    }

    const video = makeTrack("video");
    const audio = makeTrack("audio");
    try {
      return new MediaStream([video, audio]);
    } catch (e) {
      // Some engines refuse non-native tracks; return a stream-like object.
      return {
        id: "mock-stream",
        active: true,
        onaddtrack: null,
        onremovetrack: null,
        getTracks: () => [video, audio],
        getVideoTracks: () => [video],
        getAudioTracks: () => [audio],
        addTrack() {},
        removeTrack() {},
        clone() {
          return this;
        },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      };
    }
  };

  const mockGetUserMedia = async () => createMockStream();
  const mockEnumerate = async () => [
    {
      deviceId: "mock-camera",
      groupId: "mock",
      kind: "videoinput",
      label: "Mock Camera",
      toJSON() {
        return this;
      },
    },
    {
      deviceId: "mock-mic",
      groupId: "mock",
      kind: "audioinput",
      label: "Mock Microphone",
      toJSON() {
        return this;
      },
    },
  ];

  try {
    if (typeof MediaDevices !== "undefined") {
      MediaDevices.prototype.getUserMedia = mockGetUserMedia;
      MediaDevices.prototype.enumerateDevices = mockEnumerate;
    }
  } catch (error) {
    window.__mockMediaError = "proto: " + String(error);
  }

  if (navigator.mediaDevices) {
    try {
      navigator.mediaDevices.getUserMedia = mockGetUserMedia;
      navigator.mediaDevices.enumerateDevices = mockEnumerate;
    } catch (error) {
      window.__mockMediaError = "instance: " + String(error);
    }
  }

  const permissions = navigator.permissions;
  if (permissions && permissions.query) {
    const originalQuery = permissions.query.bind(permissions);
    permissions.query = (desc) => {
      if (desc && (desc.name === "camera" || desc.name === "microphone")) {
        return Promise.resolve({
          state: "granted",
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false;
          },
        });
      }
      return originalQuery(desc);
    };
  }

  window.__mockMediaInstalled = "done";
})();
`;

export async function installMockMedia(page: Page): Promise<void> {
  await page.addInitScript(MOCK_MEDIA_SCRIPT);
}
