# LiquidGL Verification

## Installed package

- Package: `liquid-gl`
- Version: `2.0.1` (exact pin in `package.json`)

## Import and initialization

- Import: `src/lib/liquidGlass.ts` → `import liquidGL from "liquid-gl"`
- React lifecycle: `src/hooks/useLiquidGlass.ts`
- Mount site: `src/components/CallScreen.tsx` while the call is in an active phase and the visual background is ready

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
  resolution: isMobile ? 1.25 : 1.5, // reduced mode uses 1.0
  refraction: 0.018, // reduced: 0.012
  aberration: 0.004, // reduced: 0.002
  bevelDepth: 0.085,
  bevelWidth: 0.17,
  frost: 0.25, // reduced: 0.35
  shadow: true,
  specular: true, // disabled in reduced mode
  reveal: "none",
  tilt: false,
  magnify: 1.012, // reduced: 1.008
}
```

Active mode must retain nonzero refraction and low frost. Runtime success is confirmed only through `on.init`, not by the presence of the `.liquidGL` class.

## Apple call symbols

Files in `src/assets/call-symbols/` (do not rename or replace):

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

SVGs are imported with `?raw` and rendered inline in `SymbolIcon` with per-symbol optical metrics from `src/lib/symbolMetrics.ts`. Symbols inherit their foreground color from the control's `data-control` / `data-active` state rules.

## Fallback conditions

CSS frosted fallback is used when:

- WebGL is unavailable
- LiquidGL initialization throws
- `window.__miniPhoForceGlassFallback__ === true`
- `prefers-reduced-transparency: reduce`

Fallback styles live under:

```css
html[data-liquid-gl="fallback"] .liquidGL
html[data-liquid-gl="error"] .liquidGL
```

Active mode forces `backdrop-filter: none`.

## Debug query parameter

Append `?debugGlass=1` in development (or explicitly in production builds when intentionally testing).

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

## Manual verification checklist

1. Run `npm run build` and confirm the production bundle contains `liquid-gl` source (`rg -l "liquidGL" dist/assets`).
2. Open `/call/demo?debugGlass=1` in the target browser / Photon environment.
3. Grant camera permission and wait for ringing.
4. Confirm debug mode reaches `active` (or `reduced`) on WebGL-capable browsers.
5. Confirm refraction is visible (not a flat frosted overlay) and LiquidGL shadows are not clipped.
6. Confirm call icons (camera, mic, end, more, flip, effects, chevron) render above glass lenses in the correct color.
7. Confirm exactly one LiquidGL renderer canvas (`window.__miniPhoLiquidGlassDebug__.canvasCount === 1`).
8. In DevTools, confirm `.liquidGL` computed `backdrop-filter` is `none` while active.
9. Force fallback with `window.__miniPhoForceGlassFallback__ = true` + reload and confirm CSS blur returns.
10. Toggle mic/camera and hide/show controls repeatedly — canvas count must stay at 1.
11. Navigate away from the call route and confirm the LiquidGL canvas is removed.

## Detecting duplicate canvases

```js
window.__miniPhoLiquidGlassDebug__?.canvasCount
```

Development builds assert when more than one LiquidGL canvas exists.

## Safari / webview notes

- Prefer real device checks on iPhone Safari and Photon webviews.
- Snapshot capture must include the fullscreen local camera during ringing.
- Reduced mode drops resolution to `1.0` and disables specular while keeping nonzero refraction and low frost.
- If FPS stays below 45 for four continuous seconds, reduced mode should engage.
