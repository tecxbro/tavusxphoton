# LiquidGL Verification

Companion to [`ARCHITECTURE.md`](../ARCHITECTURE.md). Run this guide when changing LiquidGL init, fallback, canvas adoption, control targets, symbol rendering above glass, or the `liquid-gl` pin/patch.

## Installed package

- Package: `liquid-gl`
- Version: `2.0.1` (exact pin in `package.json`)
- Patch: `patches/liquid-gl+2.0.1.patch` (applied by `postinstall` / `patch-package`)

## Import and initialization

- Import: `src/lib/liquidGlass.ts` → `import liquidGL from "liquid-gl"`
- Call React lifecycle: `src/hooks/useLiquidGlass.ts` (CallScreen / BusyCallScreen active phases)
- Mount site (call): `src/components/CallScreen.tsx` / `BusyCallScreen.tsx` while the call is in an active phase and the visual background is ready

Controller creation currently mounts **active** options when WebGL is available. Reduced option presets exist in `buildOptions("reduced")` for remount/refresh paths; automatic FPS-based switching is not implemented.

## Snapshot and targets

- Snapshot selector: `#liquid-gl-snapshot` (call styles scoped as `.call-screen #liquid-gl-snapshot`)
- Target selector: `.liquidGL`
- Call snapshot DOM: remote stage + local camera surface inside `.call-visual-stage`
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

- **Automatic rescan** — each `_updateDynamicVideos()` pass (including the RAF render loop) rescans `snapshotTarget.querySelectorAll("video")` and keeps non-ignored nodes. Newly eligible remotes (after pickup) and camera-off local ignore are discovered without application-layer `_videoNodes` assignment.
- **One shared canvas** — videos are drawn into the single renderer texture / canvas (not a second LiquidGL instance).
- **Deterministic rebuild** — `_rebuildDynamicVideoTexture()` uploads `staticSnapshotCanvas` over the full texture at `(0,0)`, clears `_videoFrameState`, rescans, and redraws eligible videos. Used after a completed `captureSnapshot()`, not during FLIP morph frames.
- **CSS opacity** — effective computed opacity is part of the dynamic-video cache key. Opacity below `1` forces the compositing path (not opaque blit) so glass follows the visible DOM fade (e.g. `.remote-video-surface` reveal). Do not remove that DOM fade when changing this path.
- **Remote Tavus video exception** — the remote `<video>` is marked with `data-liquid-video-upload="canvas"` and always uses the Canvas2D staging path. A browser/WebRTC video-to-WebGL texture runtime A/B test showed that the direct opaque WebGL video blit could produce black texture pixels after a settled snapshot rebuild. Local and other unmarked videos retain the normal eligibility rules. The staged path composites `staticSnapshotCanvas` behind the remote frame first — dropping it leaves the remote rectangle's background transparent (renders as a white flash against the page during / after the morph).
- **Not a layout animation tracker** — LiquidGL does **not** follow FLIP transforms into the shared texture mid-morph. Morph `onStart` / `onFrame` update lens metrics only (`refreshImmediate`). Morph `onFinish` schedules one settled `recapture()` which awaits snapshot then rebuilds videos at final geometry.

App flow:

```text
normal RAF render
→ rescan eligible videos
→ update live video frames

phase / layout / camera commit
→ refreshImmediate (lens metrics only)

self-view morph
→ refreshImmediate on start and each frame

morph finish
→ one settled recapture
→ captureSnapshot then _rebuildDynamicVideoTexture
```

Do not call `_rebuildDynamicVideoTexture()` or `recapture()` during morph start/frame. Do not add joining/live phase recaptures that race the morph-finish capture. Debounced `recapture()` remains for camera-off, visibility, orientation, and morph settle.

## Manual verification checklist

1. Run `npm run build` and confirm the production bundle contains `liquid-gl` source (`rg -l "liquidGL" dist/assets`).
2. Open plain `/call/garry-tan` with `npm run dev` in the target browser / Photon environment.
3. Grant camera permission, start Gary, and wait for ringing.
4. Wait at least two seconds after pickup (fullscreen-to-PiP completion).
5. Keep controls visible and confirm contact pill, Effects, and More continue refracting the remote video.
6. Confirm Flip continues refracting the local PiP.
7. Confirm the baseline white-blast fix remains intact: no white blast during the fullscreen-to-PiP morph.
8. Confirm exactly one LiquidGL renderer canvas (`window.__miniPhoLiquidGlassDebug__.canvasCount === 1`, or `?debugGlass=1`).
9. In DevTools, confirm `.liquidGL` computed `backdrop-filter` is `none` while active.
10. Toggle camera off and on once — glass remains correct and canvas count stays at 1.
11. Force fallback with `window.__miniPhoForceGlassFallback__ = true` + reload and confirm CSS blur returns.
12. Navigate away from the call route and confirm the LiquidGL canvas is removed.
13. Confirm remote glass rendering follows the visible opacity transition on join.
14. Confirm a remote video that appears after LiquidGL init (e.g. ignored during ringing, then activated) is discovered by the renderer rescan alone.
15. End the call immediately after the checks above.

## Detecting duplicate canvases

```js
window.__miniPhoLiquidGlassDebug__?.canvasCount
```

Development builds assert when more than one LiquidGL canvas exists.

## Safari / webview notes

- Prefer real device checks on iPhone Safari and Photon webviews.
- Snapshot capture must include the fullscreen local camera during ringing.
- Reduced option presets drop resolution to `1.0` and disable specular while keeping nonzero refraction and low frost; they are not auto-selected by FPS today.
