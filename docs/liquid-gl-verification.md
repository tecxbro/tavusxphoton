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

## Active configuration (baseline)

```ts
{
  snapshot: "#liquid-gl-snapshot",
  target: ".liquidGL",
  resolution: isMobile ? 1.25 : 1.5, // reduced mode uses 1.0
  refraction: 0.018,
  aberration: 0.004,
  bevelDepth: 0.085,
  bevelWidth: 0.17,
  frost: 0.25,
  shadow: true,
  specular: true, // disabled in reduced mode
  reveal: "none",
  tilt: false,
  magnify: 1.012,
}
```

Runtime success is confirmed only through `on.init`, not by the presence of the `.liquidGL` class.

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

## Browser verification procedure

1. Run `npm run build` and confirm the production bundle contains `liquid-gl` source (`rg -l "liquidGL" dist/assets`).
2. Open `/call/demo?debugGlass=1`.
3. Grant camera permission and wait for ringing.
4. Confirm debug mode reaches `active` (or `reduced`) on WebGL-capable browsers.
5. Confirm exactly one `canvas[data-liquid-ignore]`.
6. In DevTools, confirm `.liquidGL` computed `backdrop-filter` is `none` while active.
7. Force fallback with `window.__miniPhoForceGlassFallback__ = true` + reload and confirm CSS blur returns.
8. Toggle mic/camera and hide/show controls repeatedly — canvas count must stay at 1.
9. Reset/end cycles must not duplicate controls or canvases.
10. Navigate away from the call route and confirm the LiquidGL canvas is removed.

## Detecting duplicate canvases

```js
document.querySelectorAll('canvas[data-liquid-ignore]').length
```

Development builds assert when more than one LiquidGL canvas exists.

## Safari / webview notes

- Prefer real device checks on iPhone Safari and Photon webviews.
- Snapshot capture must include the fullscreen local camera during ringing.
- Reduced mode drops resolution to `1.0` and disables specular while keeping refraction.
- If FPS stays below 45 for four continuous seconds, reduced mode should engage.
