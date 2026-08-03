import { objectCoverSourceRect, roundRectPath } from "./objectCover";

export interface CaptureSelfViewLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  mirrored: boolean;
  videoEnabled: boolean;
  placeholderLabel?: string;
  placeholderAvatar?: string;
}

export interface CaptureCallFrameOptions {
  sessionId: string;
  stageWidth: number;
  stageHeight: number;
  remoteVideo: HTMLVideoElement;
  localVideo: HTMLVideoElement | null;
  selfView: CaptureSelfViewLayout;
  devicePixelRatio?: number;
}

export class CaptureFrameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureFrameError";
  }
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  mirrored = false,
): void {
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  if (sw <= 0 || sh <= 0) return;
  const src = objectCoverSourceRect(sw, sh, dw, dh);
  ctx.save();
  if (mirrored) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(video, src.x, src.y, src.width, src.height, 0, 0, dw, dh);
  } else {
    ctx.drawImage(video, src.x, src.y, src.width, src.height, dx, dy, dw, dh);
  }
  ctx.restore();
}

async function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  layout: CaptureSelfViewLayout,
): Promise<void> {
  const { x, y, width, height, radius, placeholderLabel, placeholderAvatar } =
    layout;
  ctx.save();
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.fillStyle = "#1f3a3a";
  ctx.fillRect(x, y, width, height);

  const avatarSize = Math.min(width, height) * 0.42;
  const cx = x + width / 2;
  const cy = y + height / 2;

  if (placeholderAvatar) {
    try {
      const img = await loadImage(placeholderAvatar);
      ctx.beginPath();
      ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(
        img,
        cx - avatarSize / 2,
        cy - avatarSize / 2,
        avatarSize,
        avatarSize,
      );
    } catch {
      drawInitials(ctx, placeholderLabel ?? "?", cx, cy, avatarSize);
    }
  } else {
    drawInitials(ctx, placeholderLabel ?? "?", cx, cy, avatarSize);
  }
  ctx.restore();
}

function drawInitials(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#0e1c1c";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.round(size * 0.38)}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.slice(0, 2).toUpperCase(), cx, cy + 1);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load avatar"));
    img.src = src;
  });
}

export async function captureCallFrame(
  options: CaptureCallFrameOptions,
): Promise<{ blob: Blob; filename: string }> {
  const {
    sessionId,
    stageWidth,
    stageHeight,
    remoteVideo,
    localVideo,
    selfView,
  } = options;

  if (stageWidth <= 0 || stageHeight <= 0) {
    throw new CaptureFrameError("Call stage is not ready.");
  }

  const dpr = Math.min(options.devicePixelRatio ?? (window.devicePixelRatio || 1), 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(stageWidth * dpr);
  canvas.height = Math.round(stageHeight * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new CaptureFrameError("Canvas is unavailable.");
  }
  ctx.scale(dpr, dpr);

  try {
    drawVideoCover(ctx, remoteVideo, 0, 0, stageWidth, stageHeight, false);
  } catch {
    throw new CaptureFrameError(
      "Unable to capture remote video. Cross-origin media may block photos.",
    );
  }

  ctx.save();
  roundRectPath(
    ctx,
    selfView.x,
    selfView.y,
    selfView.width,
    selfView.height,
    selfView.radius,
  );
  ctx.clip();

  if (selfView.videoEnabled && localVideo) {
    try {
      drawVideoCover(
        ctx,
        localVideo,
        selfView.x,
        selfView.y,
        selfView.width,
        selfView.height,
        selfView.mirrored,
      );
    } catch {
      throw new CaptureFrameError(
        "Unable to capture local camera. Cross-origin media may block photos.",
      );
    }
  } else {
    await drawPlaceholder(ctx, selfView);
  }
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new CaptureFrameError("Failed to encode PNG."));
      },
      "image/png",
    );
  });

  const filename = `mini-pho-${sessionId}-${Date.now()}.png`;
  return { blob, filename };
}

export async function shareOrDownloadCapture(
  blob: Blob,
  filename: string,
): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], title: "FaceTime photo" });
      return;
    } catch {
      // Fall through to download when share is cancelled or unsupported.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
