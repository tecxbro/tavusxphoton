# LiquidGL Verification

Companion to [`ARCHITECTURE.md`](../ARCHITECTURE.md). Run this guide when changing LiquidGL init, fallback, canvas adoption, control targets, symbol rendering above glass, or the `liquid-gl` pin/patch.

## Installed package

- Package: `liquid-gl`
- Version: `2.0.1` (exact pin in `package.json`)
- Patch: `patches/liquid-gl+2.0.1.patch` (applied by `postinstall` / `patch-package`)

## Import and initialization

- Import: `src/lib/liquidGlass.ts` → `import liquidGL from "liquid-gl"`
- React lifecycle: `src/hooks/useLiquidGlass.ts`
- Mount site: `src/components/CallScreen.tsx` while the call is in an active phase and the visual background is ready

Controller creation currently mounts **active** options when WebGL is available. Reduced option presets exist in `buildOptions("reduced")` for remount/refresh paths; automatic FPS-based switching is not implemented.

## Snapshot and targets

- Snapshot selector: `#liquid-gl-snapshot`
- Target selector: `.liquidGL`
- Snapshot DOM: remote stage + local camera surface inside `.call-visual-stage`
- Control chrome remains outside the snapshot
- Interactive controls themselves are the `.liquidGL` targets; symbols and labels live in a `.content` child above the glass
- Camera/mic buttons keep the `liquidGL` class in every state and fade a `.control-btn__solid` white surface for enabled states
- The shared WebGL canvas is adopted into `.liquid-canvas-layer` inside `.call-screen`: video < canvas < controls < content < sheets

## Active configuration (baseline)

Matches `buildOptions("active")` in `src/lib/liquidGlass.ts`:

```ts
{
  snapshot: "#liquid-gl-snapshot",
  target: ".liquidGL",
  resolution: isMobile ? 1.25 : 1.5, // reduced preset uses 1.0
  refraction: 0.024, // reduced: 0.014
  aberration: 0.005, // reduced: 0.002
  bevelDepth: 0.12,
  bevelWidth: 0.22,
  frost: 0.16, // reduced: 0.32
  shadow: true,
  specular: true, // disabled in reduced preset
  reveal: "none",
  tilt: false,
  magnify: 1.02, // reduced: 1.01
}
```

Active mode must retain nonzero refraction and low frost. Runtime success is confirmed only through `on.init`, not by the presence of the `.liquidGL` class.

## Apple call symbols

Files in `src/assets/call-symbols/` (do not rename):

```text
camera-on.svg
camera-off.svg
microphone-on.svg
microphone-off.svg
end-call.svg
flip-camera.svg
effects.svg
contact-chevron.svg
more.svg
```

`SymbolIcon` names (unchanged):

```text
camera-on
camera-off
microphone-on
microphone-off
end-call
flip-camera
effects
contact-chevron
more
```

Arbitrary SVG path editing remains prohibited. `effects.svg` may be replaced with another untouched SF Symbols export of `f.cursive`; the selected weight, path, and `viewBox` must remain unmodified. Optical translation for the Effects control may not exceed 1px.

SVGs are imported with `?raw` and rendered inline in `SymbolIcon` with per-symbol optical metrics from `src/lib/symbolMetrics.ts`. Metrics keep each glyph’s aspect ratio (`renderedWidth = renderedHeight * (viewBoxWidth / viewBoxHeight)`). Symbols inherit their foreground color from the control's `data-control` / `data-active` state rules.

## Fallback conditions

CSS frosted fallback is used when:

- WebGL is unavailable
- LiquidGL initialization throws
- Init watchdog times out without `on.init`
- `window.__miniPhoForceGlassFallback__ === true`
- `prefers-reduced-transparency: reduce`

Fallback styles live under:

```css
html[data-liquid-gl="fallback"] .liquidGL
html[data-liquid-gl="error"] .liquidGL
```

Active mode forces `backdrop-filter: none`.

## Debug query parameter

Append `?debugGlass=1` in a Vite **development** build (`import.meta.env.DEV`). Production builds ignore this flag.

The HUD shows:

```text
LiquidGL 2.0.1
Mode: active
Snapshot: found
Targets: <count>
Canvases: 1
WebGL: available
```

It is marked `data-liquid-ignore` and must not be used alone as proof — also check the WebGL canvas and `window.__miniPhoLiquidGlassDebug__`.

## Dynamic video path (patched)

The `liquid-gl@2.0.1` patch (`patches/liquid-gl+2.0.1.patch`) changes how live `<video>` elements are composited into the shared texture:

- **Automatic rescan** — each `_syncDynamicVideos()` pass rescans `snapshotTarget.querySelectorAll("video")` without filtering ignored, hidden, disabled, or not-ready videos. Newly added or newly activated videos are discovered without application-layer help.
- **One shared canvas** — videos are drawn into the single renderer texture / canvas (not a second LiquidGL instance).
- **Renderer-owned stale cleanup** — `_lastVideoDestinations` stores each video’s last successfully drawn **clipped** texture rectangle. Before any redraw, Pass 1 restores previous destinations from `staticSnapshotCanvas` when geometry changes, a video becomes ignored / not ready / ineligible, is removed, or loses valid geometry. Restored regions become dirty rectangles that invalidate otherwise unchanged overlapping videos (Pass 2).
- **Successful-draw gating** — `_videoFrameState` and `_lastVideoDestinations` update only after WebGL blit or canvas fallback upload succeeds.
- **CSS opacity** — effective computed opacity is part of the dynamic-video cache key. Opacity below `1` forces the compositing path (not opaque blit) so glass follows the visible DOM fade (e.g. `.remote-video-surface` reveal). Do not remove that DOM fade when changing this path.
- **Not a layout animation tracker** — LiquidGL does **not** automatically sample arbitrary CSS layout animation frames. Geometry is read each sync/render tick; continuous layout animation still needs explicit synchronization (refresh / recapture) when the DOM moves without a video frame or eligibility change.
- **Snapshot / destroy** — a complete `captureSnapshot()` texture replacement and renderer `destroy()` clear destination, dirty-region, and frame-tracking state.

App code may call `syncVideoLayout()` → `_syncDynamicVideos()` plus one immediate lens-metric pass after committed phase / layout / camera changes (`useLayoutEffect`). It must not own previous destinations, assign `_videoNodes`, or wait on the debounced recapture timer for that sync. Debounced `recapture()` remains for settled static DOM changes.

## Manual verification checklist

1. Run `npm run build` and confirm the production bundle contains `liquid-gl` source (`rg -l "liquidGL" dist/assets`).
2. Open `/call/demo?debugGlass=1` with `npm run dev` in the target browser / Photon environment.
3. Grant camera permission and wait for ringing.
4. Confirm debug mode reaches `active` on WebGL-capable browsers (or `fallback` / `error` when forced).
5. Confirm refraction is visible (not a flat frosted overlay) and LiquidGL shadows are not clipped.
6. Confirm call icons (camera, mic, end, more, flip, effects, chevron) render above glass lenses in the correct color.
7. Confirm exactly one LiquidGL renderer canvas (`window.__miniPhoLiquidGlassDebug__.canvasCount === 1`).
8. In DevTools, confirm `.liquidGL` computed `backdrop-filter` is `none` while active.
9. Force fallback with `window.__miniPhoForceGlassFallback__ = true` + reload and confirm CSS blur returns.
10. Toggle mic/camera and hide/show controls repeatedly — canvas count must stay at 1.
11. Navigate away from the call route and confirm the LiquidGL canvas is removed.
12. Fullscreen → PiP: old local-camera pixels disappear immediately; remote video stays visible behind glass with no black glass / one-frame flicker.
13. Confirm remote glass rendering follows the visible opacity transition on join.
14. Confirm a remote video that appears after LiquidGL init (e.g. ignored during ringing, then activated) is discovered by the renderer rescan alone.

## Detecting duplicate canvases

```js
window.__miniPhoLiquidGlassDebug__?.canvasCount
```

Development builds assert when more than one LiquidGL canvas exists.

## Safari / webview notes

- Prefer real device checks on iPhone Safari and Photon webviews.
- Snapshot capture must include the fullscreen local camera during ringing.
- Reduced option presets drop resolution to `1.0` and disable specular while keeping nonzero refraction and low frost; they are not auto-selected by FPS today.
