import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import liquidGL from "liquid-gl";

interface VideoRebuildRenderer {
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
  _rafId?: number | null;
  _isScrolling?: boolean;
  _capturing?: boolean;
  captureSnapshot?: () => Promise<void> | void;
  _uploadTexture?: (src?: unknown) => boolean;
  _videoNodes: HTMLVideoElement[];
  _videoFrameState: WeakMap<HTMLVideoElement, { time: number; geom: string }>;
  _tmpCanvas: HTMLCanvasElement;
  _tmpCtx: CanvasRenderingContext2D;
  _rebuildDynamicVideoTexture: () => void;
  _updateDynamicVideos: () => void;
  _isIgnored: (el: HTMLElement) => boolean;
  _initVideoBlit: () => boolean;
  _videoIsOpaque: (vid: HTMLVideoElement) => boolean;
  _blitVideoToTexture: (...args: unknown[]) => boolean;
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
  mockVideoRect(vid, opts.rect);
}

describe("liquidGL video texture rebuild (patched 2.0.1)", () => {
  let renderer: VideoRebuildRenderer;
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

    renderer = window.__liquidGLRenderer__ as unknown as VideoRebuildRenderer;
    expect(renderer).toBeTruthy();

    if (renderer._rafId) {
      cancelAnimationFrame(renderer._rafId);
      renderer._rafId = null;
    }

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
    renderer._getMaxLensZ = () => 10;
    renderer._initVideoBlit = () => true;
    renderer._videoIsOpaque = () => true;
    renderer._blitVideoToTexture = vi.fn(() => true);
    renderer._createRoundedRectPath = vi.fn();
    renderer._videoNodes = [];
    renderer._videoFrameState = new WeakMap();

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
    renderer?.canvas?.remove();
    delete window.__liquidGLRenderer__;
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("uploads the static base over the complete texture then redraws videos", () => {
    const remote = document.createElement("video");
    stage.append(remote);
    prepareVideo(remote, {
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });

    const updateSpy = vi.spyOn(renderer, "_updateDynamicVideos");
    texSubImage2D.mockClear();
    (renderer.captureSnapshot as ReturnType<typeof vi.fn>).mockClear();

    renderer._rebuildDynamicVideoTexture();

    expect(texSubImage2D).toHaveBeenCalledWith(
      renderer.gl.TEXTURE_2D,
      0,
      0,
      0,
      renderer.gl.RGBA,
      renderer.gl.UNSIGNED_BYTE,
      renderer.staticSnapshotCanvas,
    );
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(renderer.captureSnapshot).not.toHaveBeenCalled();
    expect(
      Object.prototype.hasOwnProperty.call(renderer, "_lastVideoDestinations"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(renderer, "_videoDirtyRects"),
    ).toBe(false);
  });

  it("rescans newly added videos and excludes ignored ones via rebuild", () => {
    expect(renderer._videoNodes).toEqual([]);

    const live = document.createElement("video");
    const ignored = document.createElement("video");
    stage.append(live, ignored);
    prepareVideo(live, {
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });
    prepareVideo(ignored, {
      ignored: true,
      rect: { left: 100, top: 0, width: 100, height: 100 },
    });

    renderer._rebuildDynamicVideoTexture();

    expect(renderer._videoNodes).toEqual([live]);
    expect(renderer._videoNodes).not.toContain(ignored);
  });

  it("rescans newly eligible videos from _updateDynamicVideos alone", () => {
    expect(renderer._videoNodes).toEqual([]);

    const remote = document.createElement("video");
    stage.append(remote);
    prepareVideo(remote, {
      ignored: true,
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });

    renderer._updateDynamicVideos();
    expect(renderer._videoNodes).toEqual([]);

    prepareVideo(remote, {
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });
    renderer._updateDynamicVideos();

    expect(renderer._videoNodes).toEqual([remote]);
  });

  it("removes ignored videos from the active list on the next update pass", () => {
    const local = document.createElement("video");
    stage.append(local);
    prepareVideo(local, {
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });

    renderer._updateDynamicVideos();
    expect(renderer._videoNodes).toEqual([local]);

    prepareVideo(local, {
      ignored: true,
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });
    renderer._updateDynamicVideos();

    expect(renderer._videoNodes).toEqual([]);
  });

  it("clears _videoFrameState before drawing", () => {
    const remote = document.createElement("video");
    stage.append(remote);
    prepareVideo(remote, {
      currentTime: 4,
      rect: { left: 0, top: 0, width: 200, height: 200 },
    });

    const staleState = { time: 4, geom: "stale" };
    renderer._videoNodes = [remote];
    renderer._videoFrameState.set(remote, staleState);

    const updateSpy = vi
      .spyOn(renderer, "_updateDynamicVideos")
      .mockImplementation(function (this: VideoRebuildRenderer) {
        expect(this._videoFrameState.get(remote)).toBeUndefined();
      });

    renderer._rebuildDynamicVideoTexture();

    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
