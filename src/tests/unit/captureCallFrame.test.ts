import { describe, expect, it, vi } from "vitest";
import {
  CaptureFrameError,
  captureCallFrame,
} from "../../lib/captureCallFrame";

function mockVideo(width: number, height: number): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "videoWidth", { value: width });
  Object.defineProperty(video, "videoHeight", { value: height });
  return video;
}

describe("captureCallFrame", () => {
  it("exports a png blob and excludes chrome by drawing only media", async () => {
    const remote = mockVideo(720, 1280);
    const local = mockVideo(720, 1280);

    const drawImage = vi.fn();
    const toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob(["png"], { type: "image/png" }));
    });

    const ctx = {
      scale: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      drawImage,
      fillRect: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      translate: vi.fn(),
      fillStyle: "",
      font: "",
      textAlign: "center" as const,
      textBaseline: "middle" as const,
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctx,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = toBlob;

    try {
      const result = await captureCallFrame({
        sessionId: "demo",
        stageWidth: 390,
        stageHeight: 844,
        remoteVideo: remote,
        localVideo: local,
        selfView: {
          x: 250,
          y: 100,
          width: 120,
          height: 260,
          radius: 24,
          mirrored: true,
          videoEnabled: true,
        },
        devicePixelRatio: 2,
      });

      expect(result.filename).toMatch(/^mini-pho-demo-\d+\.png$/);
      expect(result.blob.type).toBe("image/png");
      expect(drawImage).toHaveBeenCalled();
      expect(ctx.clip).toHaveBeenCalled();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  });

  it("throws a non-blocking capture error when encoding fails", async () => {
    const remote = mockVideo(720, 1280);
    const ctx = {
      scale: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      fillStyle: "",
      font: "",
      textAlign: "center" as const,
      textBaseline: "middle" as const,
    };
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctx,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => cb(null));

    try {
      await expect(
        captureCallFrame({
          sessionId: "demo",
          stageWidth: 390,
          stageHeight: 844,
          remoteVideo: remote,
          localVideo: null,
          selfView: {
            x: 10,
            y: 10,
            width: 100,
            height: 200,
            radius: 20,
            mirrored: false,
            videoEnabled: false,
            placeholderLabel: "YG",
          },
        }),
      ).rejects.toBeInstanceOf(CaptureFrameError);
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  });
});
