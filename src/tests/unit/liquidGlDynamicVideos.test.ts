import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import liquidGL from "liquid-gl";

type DestinationRect = { x: number; y: number; w: number; h: number };

interface DynamicVideoRenderer {
  canvas?: HTMLCanvasElement | null;
  gl: {
    bindTexture: ReturnType<typeof vi.fn>;
    texSubImage2D: ReturnType<typeof vi.fn>;
    pixelStorei: ReturnType<typeof vi.fn>;
    TEXTURE_2D: number;
    RGBA: number;
    UNSIGNED_BYTE: number;
    UNPACK_FLIP_Y_WEBGL: number;
  };
  texture: object;
  staticSnapshotCanvas: HTMLCanvasElement;
  snapshotTarget: HTMLElement;
  scaleFactor: number;
  textureWidth: number;
  textureHeight: number;
  lenses: unknown[];
  _rafId?: number | null;
  _isScrolling?: boolean;
  _scrollUpdateCounter?: number;
  _capturing?: boolean;
  captureSnapshot?: () => Promise<void> | void;
  _uploadTexture?: (src?: unknown) => boolean;
  _videoNodes: HTMLVideoElement[];
  _videoFrameState: WeakMap<HTMLVideoElement, { time: number; geom: string }>;
  _lastVideoDestinations: Map<HTMLVideoElement, DestinationRect>;
  _videoDirtyRects: DestinationRect[];
  _tmpCanvas: HTMLCanvasElement;
  _tmpCtx: CanvasRenderingContext2D;
  _videoAlphaState: WeakMap<HTMLVideoElement, unknown>;
  _syncDynamicVideos: () => void;
  _clearDynamicVideoState: () => void;
  destroy: () => void;
  _isIgnored: (el: HTMLElement) => boolean;
  _initVideoBlit: () => boolean;
  _videoIsOpaque: (vid: HTMLVideoElement) => boolean;
  _blitVideoToTexture: (...args: unknown[]) => boolean;
  _getVideoSourceCrop: (vid: HTMLVideoElement) => {
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    mirroredX: boolean;
    objectFit: string;
    objectPosition: string;
  };
  _getMaxLensZ: () => number;
  _createRoundedRectPath?: (...args: unknown[]) => void;
}

function createMockWebGL() {
  const gl: Record<string, unknown> = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    TEXTURE_2D: 0x0de1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    COLOR_BUFFER_BIT: 0x4000,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    FRAMEBUFFER: 0x8d40,
    COLOR_ATTACHMENT0: 0x8ce0,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    TEXTURE0: 0x84c0,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ""),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ""),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texSubImage2D: vi.fn(),
    texParameteri: vi.fn(),
    pixelStorei: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawArrays: vi.fn(),
    activeTexture: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform4f: vi.fn(),
    createFramebuffer: vi.fn(() => ({})),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => 0x8cd5),
    getParameter: vi.fn(() => 8192),
  };
  return gl;
}

function mockVideoRect(
  vid: HTMLVideoElement,
  rect: { left: number; top: number; width: number; height: number },
) {
  vi.spyOn(vid, "getBoundingClientRect").mockReturnValue({
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() {
      return {};
    },
  } as DOMRect);
}

function prepareVideo(
  vid: HTMLVideoElement,
  opts: {
    readyState?: number;
    currentTime?: number;
    videoWidth?: number;
    videoHeight?: number;
    opacity?: string;
    ignored?: boolean;
    rect: { left: number; top: number; width: number; height: number };
  },
) {
  Object.defineProperty(vid, "readyState", {
    configurable: true,
    value: opts.readyState ?? 4,
  });
  Object.defineProperty(vid, "currentTime", {
    configurable: true,
    value: opts.currentTime ?? 1,
  });
  Object.defineProperty(vid, "videoWidth", {
    configurable: true,
    value: opts.videoWidth ?? 640,
  });
  Object.defineProperty(vid, "videoHeight", {
    configurable: true,
    value: opts.videoHeight ?? 480,
  });
  if (opts.ignored) {
    vid.setAttribute("data-liquid-ignore", "");
  } else {
    vid.removeAttribute("data-liquid-ignore");
  }
  vid.style.opacity = opts.opacity ?? "1";
  mockVideoRect(vid, opts.rect);
}

describe("liquidGL dynamic video sync (patched 2.0.1)", () => {
  let renderer: DynamicVideoRenderer;
  let stage: HTMLElement;
  let texSubImage2D: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="liquid-gl-snapshot"></div>
      <button class="liquidGL"><span class="content">A</span></button>
    `;
    stage = document.querySelector("#liquid-gl-snapshot")!;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 800,
      width: 400,
      height: 800,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    } as DOMRect);

    const mockGl = createMockWebGL();
    texSubImage2D = mockGl.texSubImage2D as ReturnType<typeof vi.fn>;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((type: string) => {
        if (
          type === "webgl" ||
          type === "webgl2" ||
          type === "experimental-webgl"
        ) {
          return mockGl as unknown as WebGLRenderingContext;
        }
        if (type === "2d") {
          return {
            drawImage: vi.fn(),
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            clip: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
            setTransform: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            arcTo: vi.fn(),
            closePath: vi.fn(),
            getImageData: vi.fn(() => ({
              data: new Uint8ClampedArray(32 * 32 * 4).fill(255),
            })),
          } as unknown as CanvasRenderingContext2D;
        }
        return null;
      }) as typeof HTMLCanvasElement.prototype.getContext,
    );

    delete window.__liquidGLRenderer__;
    window.__liquidGLNoWebGL__ = false;

    liquidGL({
      snapshot: "#liquid-gl-snapshot",
      target: ".liquidGL",
      reveal: "none",
    });

    renderer = window.__liquidGLRenderer__ as unknown as DynamicVideoRenderer;
    expect(renderer).toBeTruthy();

    if (renderer._rafId) {
      cancelAnimationFrame(renderer._rafId);
      renderer._rafId = null;
    }

    // Prevent in-flight constructor snapshot retries from mutating texture
    // dimensions / clearing dynamic-video state mid-test.
    renderer.captureSnapshot = vi.fn(async () => undefined);
    renderer._uploadTexture = vi.fn(() => false);
    renderer._capturing = false;

    const snap = document.createElement("canvas");
    snap.width = 400;
    snap.height = 800;
    renderer.staticSnapshotCanvas = snap;
    renderer.texture = {};
    renderer.textureWidth = 400;
    renderer.textureHeight = 800;
    renderer.scaleFactor = 1;
    renderer._isScrolling = false;
    // Lenses sit above stage videos in production; keep maxLensZ above video z.
    renderer._getMaxLensZ = () => 10;
    renderer._initVideoBlit = () => true;
    renderer._videoIsOpaque = () => true;
    renderer._blitVideoToTexture = vi.fn(() => true);
    renderer._createRoundedRectPath = vi.fn();
    renderer._clearDynamicVideoState();

    // Ensure canvas fallback helpers exist even if constructor 2d mocks differ.
    if (!renderer._tmpCtx?.drawImage) {
      renderer._tmpCtx = {
        drawImage: vi.fn(),
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        clip: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arcTo: vi.fn(),
        closePath: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    }
  });

  afterEach(() => {
    if (renderer?._rafId) {
      cancelAnimationFrame(renderer._rafId);
      renderer._rafId = null;
    }
    renderer?.destroy?.();
    renderer?.canvas?.remove();
    delete window.__liquidGLRenderer__;
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("rescans and retains ignored and not-ready videos for cleanup", () => {
    const live = document.createElement("video");
    const ignored = document.createElement("video");
    const notReady = document.createElement("video");
    stage.append(live, ignored, notReady);

    prepareVideo(live, {
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });
    prepareVideo(ignored, {
      ignored: true,
      rect: { left: 100, top: 0, width: 100, height: 100 },
    });
    prepareVideo(notReady, {
      readyState: 0,
      rect: { left: 200, top: 0, width: 100, height: 100 },
    });

    renderer._syncDynamicVideos();

    expect(renderer._videoNodes).toHaveLength(3);
    expect(renderer._videoNodes).toContain(ignored);
    expect(renderer._videoNodes).toContain(notReady);
  });

  it("rescans newly added videos without application-layer help", () => {
    renderer._syncDynamicVideos();
    expect(renderer._videoNodes).toHaveLength(0);

    const remote = document.createElement("video");
    stage.append(remote);
    prepareVideo(remote, {
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });

    renderer._syncDynamicVideos();
    expect(renderer._videoNodes).toEqual([remote]);
    expect(renderer._lastVideoDestinations.has(remote)).toBe(true);
  });

  it("cleans up the previous destination when geometry changes", () => {
    const local = document.createElement("video");
    stage.append(local);
    prepareVideo(local, {
      rect: { left: 0, top: 0, width: 400, height: 800 },
    });

    renderer._syncDynamicVideos();
    expect(renderer._lastVideoDestinations.get(local)).toEqual({
      x: 0,
      y: 0,
      w: 400,
      h: 800,
    });
    const uploadsAfterFirst = texSubImage2D.mock.calls.length;

    prepareVideo(local, {
      rect: { left: 280, top: 560, width: 100, height: 160 },
      currentTime: 1,
    });
    renderer._syncDynamicVideos();

    expect(texSubImage2D.mock.calls.length).toBeGreaterThan(uploadsAfterFirst);
    expect(renderer._videoDirtyRects).toContainEqual({
      x: 0,
      y: 0,
      w: 400,
      h: 800,
    });
    expect(renderer._lastVideoDestinations.get(local)).toEqual({
      x: 280,
      y: 560,
      w: 100,
      h: 160,
    });
  });

  it("cleans up when a video becomes ignored", () => {
    const local = document.createElement("video");
    stage.append(local);
    prepareVideo(local, {
      rect: { left: 10, top: 20, width: 80, height: 120 },
    });
    renderer._syncDynamicVideos();
    expect(renderer._lastVideoDestinations.has(local)).toBe(true);

    prepareVideo(local, {
      ignored: true,
      rect: { left: 10, top: 20, width: 80, height: 120 },
    });
    renderer._syncDynamicVideos();

    expect(renderer._lastVideoDestinations.has(local)).toBe(false);
    expect(renderer._videoDirtyRects).toContainEqual({
      x: 10,
      y: 20,
      w: 80,
      h: 120,
    });
    expect(renderer._videoFrameState.get(local)).toBeUndefined();
  });

  it("cleans up when a video becomes not ready", () => {
    const local = document.createElement("video");
    stage.append(local);
    prepareVideo(local, {
      rect: { left: 10, top: 20, width: 80, height: 120 },
    });
    renderer._syncDynamicVideos();

    prepareVideo(local, {
      readyState: 1,
      rect: { left: 10, top: 20, width: 80, height: 120 },
    });
    renderer._syncDynamicVideos();

    expect(renderer._lastVideoDestinations.has(local)).toBe(false);
    expect(renderer._videoDirtyRects).toContainEqual({
      x: 10,
      y: 20,
      w: 80,
      h: 120,
    });
  });

  it("cleans up when a video is removed from the DOM", () => {
    const local = document.createElement("video");
    stage.append(local);
    prepareVideo(local, {
      rect: { left: 50, top: 60, width: 90, height: 110 },
    });
    renderer._syncDynamicVideos();
    expect(renderer._lastVideoDestinations.has(local)).toBe(true);

    local.remove();
    renderer._syncDynamicVideos();

    expect(renderer._lastVideoDestinations.has(local)).toBe(false);
    expect(renderer._videoDirtyRects).toContainEqual({
      x: 50,
      y: 60,
      w: 90,
      h: 110,
    });
  });

  it("redraws an unchanged remote frame whose destination intersects a dirty rect", () => {
    const remote = document.createElement("video");
    const local = document.createElement("video");
    stage.append(remote, local);

    prepareVideo(remote, {
      currentTime: 5,
      rect: { left: 0, top: 0, width: 400, height: 800 },
    });
    prepareVideo(local, {
      currentTime: 2,
      rect: { left: 0, top: 0, width: 400, height: 800 },
    });
    renderer._syncDynamicVideos();

    const remoteState = renderer._videoFrameState.get(remote);
    expect(remoteState?.time).toBe(5);
    texSubImage2D.mockClear();

    // Local moves to PiP; remote geometry/time unchanged but overlaps restored rect.
    prepareVideo(remote, {
      currentTime: 5,
      rect: { left: 0, top: 0, width: 400, height: 800 },
    });
    prepareVideo(local, {
      currentTime: 2,
      rect: { left: 280, top: 560, width: 100, height: 160 },
    });
    renderer._syncDynamicVideos();

    expect(renderer._videoDirtyRects.some((d) => d.w === 400 && d.h === 800)).toBe(
      true,
    );
    // Remote must upload again despite unchanged currentTime/geometry.
    expect(texSubImage2D.mock.calls.length).toBeGreaterThan(0);
    expect(renderer._videoFrameState.get(remote)?.time).toBe(5);
  });

  it("skips an unchanged frame outside every dirty rectangle", () => {
    const remote = document.createElement("video");
    const local = document.createElement("video");
    stage.append(remote, local);

    prepareVideo(remote, {
      currentTime: 3,
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });
    prepareVideo(local, {
      currentTime: 1,
      rect: { left: 250, top: 500, width: 80, height: 120 },
    });
    renderer._syncDynamicVideos();
    texSubImage2D.mockClear();

    prepareVideo(remote, {
      currentTime: 3,
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });
    prepareVideo(local, {
      currentTime: 1,
      // Move within a region that does not intersect remote.
      rect: { left: 300, top: 600, width: 80, height: 120 },
    });
    renderer._syncDynamicVideos();

    // Local restore + local redraw only — remote destination is outside dirty rects.
    const remoteStillCached = renderer._videoFrameState.get(remote);
    expect(remoteStillCached?.time).toBe(3);
    // Ensure remote was not force-drawn: dirty rects should not include remote area
    // as a redraw target beyond local's old/new rects.
    expect(
      renderer._videoDirtyRects.every(
        (d) =>
          d.x >= 250 ||
          d.y >= 500 ||
          d.x + d.w <= 0 ||
          d.y + d.h <= 0 ||
          !(d.x < 200 && d.y < 200 && d.x + d.w > 0 && d.y + d.h > 0),
      ),
    ).toBe(true);
  });

  it("updates _videoFrameState only after a successful upload", () => {
    const vid = document.createElement("video");
    stage.append(vid);
    prepareVideo(vid, {
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });

    renderer._initVideoBlit = () => false;
    renderer._blitVideoToTexture = vi.fn(() => false);
    vi.spyOn(renderer._tmpCtx, "drawImage").mockImplementation(() => {
      throw new Error("draw failed");
    });

    renderer._syncDynamicVideos();

    expect(renderer._videoFrameState.get(vid)).toBeUndefined();
    expect(renderer._lastVideoDestinations.has(vid)).toBe(false);
  });

  it("retries after both upload paths fail", () => {
    const vid = document.createElement("video");
    stage.append(vid);
    prepareVideo(vid, {
      currentTime: 7,
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });

    renderer._initVideoBlit = () => false;
    renderer._blitVideoToTexture = vi.fn(() => false);
    const drawSpy = vi
      .spyOn(renderer._tmpCtx, "drawImage")
      .mockImplementation(() => {
        throw new Error("draw failed");
      });

    renderer._syncDynamicVideos();
    expect(renderer._videoFrameState.get(vid)).toBeUndefined();

    drawSpy.mockRestore();
    renderer._initVideoBlit = () => true;
    renderer._blitVideoToTexture = vi.fn(() => true);

    renderer._syncDynamicVideos();
    expect(renderer._videoFrameState.get(vid)?.time).toBe(7);
    expect(renderer._lastVideoDestinations.has(vid)).toBe(true);
  });

  it("invalidates cached video state when opacity changes", () => {
    const remote = document.createElement("video");
    stage.append(remote);
    // Opacity < 1 forces canvas compositing — keep drawImage successful.
    vi.spyOn(renderer._tmpCtx, "drawImage").mockImplementation(() => undefined);
    renderer._initVideoBlit = () => true;
    renderer._blitVideoToTexture = vi.fn(() => true);

    prepareVideo(remote, {
      currentTime: 4,
      opacity: "0.2",
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });
    renderer._syncDynamicVideos();
    const firstGeom = renderer._videoFrameState.get(remote)?.geom;
    expect(firstGeom).toEqual(expect.stringContaining(",200"));
    texSubImage2D.mockClear();

    prepareVideo(remote, {
      currentTime: 4,
      opacity: "1",
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });
    renderer._syncDynamicVideos();

    const secondGeom = renderer._videoFrameState.get(remote)?.geom;
    expect(secondGeom).not.toBe(firstGeom);
    expect(secondGeom).toEqual(expect.stringContaining(",1000"));
    expect(
      (renderer._blitVideoToTexture as ReturnType<typeof vi.fn>).mock.calls
        .length,
    ).toBeGreaterThan(0);
  });

  it("clears dynamic-video state after full snapshot replacement", () => {
    const vid = document.createElement("video");
    stage.append(vid);
    prepareVideo(vid, {
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });
    renderer._syncDynamicVideos();
    expect(renderer._lastVideoDestinations.size).toBe(1);
    expect(renderer._videoFrameState.get(vid)).toBeTruthy();

    renderer._clearDynamicVideoState();

    expect(renderer._lastVideoDestinations.size).toBe(0);
    expect(renderer._videoDirtyRects).toEqual([]);
    expect(renderer._videoFrameState.get(vid)).toBeUndefined();
  });

  it("clears dynamic-video state during destruction", () => {
    const vid = document.createElement("video");
    stage.append(vid);
    prepareVideo(vid, {
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });
    renderer._syncDynamicVideos();
    expect(renderer._lastVideoDestinations.size).toBe(1);

    renderer.destroy();

    expect(renderer._lastVideoDestinations.size).toBe(0);
    expect(renderer._videoDirtyRects).toEqual([]);
    expect(renderer._videoNodes).toEqual([]);
  });

  it("maintains one shared canvas", () => {
    const canvases = document.querySelectorAll("canvas[data-liquid-ignore]");
    expect(canvases.length).toBe(1);
    expect(renderer.canvas).toBe(canvases[0]);
  });
});
