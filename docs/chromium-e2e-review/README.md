# Chromium / Playwright E2E — parked for later review

These browser e2e specs were implemented for the LiquidGL + Pho controller PRD, then **disabled** so the app can ship/build while Chromium/WebKit is verified manually.

**Do not delete this folder.** Re-enable by moving the specs back to `tests/e2e/` and restoring `npm run check` to include e2e.

## What was implemented

### Cross-context controller tests (`specs/pho-controller.spec.ts`)

- Two **isolated Playwright browser contexts** (call + controller), not same-context pages.
- Unique session IDs per test to avoid shared in-memory Redis/store collisions.
- Covers: stay ringing until answer → connecting/joining/live → ack → end from each active phase → reset → invalid secret → no “Applied” until ack → controller reload recovery.

### Call stability (`specs/call-stability.spec.ts`)

- Isolated call/controller contexts.
- Mic/camera toggles, control show/hide cycles, resize storms.
- Asserts no DOM leak, ≤1 LiquidGL canvas when active, `packageVersion === "2.0.1"`, active mode `backdrop-filter: none`.
- Reset/answer/end loops.

### LiquidGL browser check (`specs/liquid-gl.spec.ts`)

- `?debugGlass=1` debug HUD + `window.__miniPhoLiquidGlassDebug__`.
- Active vs forced fallback (`__miniPhoForceGlassFallback__`).

### Harness / config notes

- Vite middleware serves `/api/test-call/*` locally (`scripts/phoTestApiPlugin.ts`) with in-memory store when Redis is unset (`PHO_TEST_USE_MEMORY_STORE=true`).
- Playwright `webServer` env enables controller flags + secret.
- Agent environment needed `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac14-arm64` (Cursor sandbox resolved `mac-x64` on Apple Silicon).
- Chromium headless sometimes **SEGV** inside the Cursor sandbox; runs outside sandbox were needed.
- WebKit binary was missing under the sandbox Playwright cache (`webkit_mac14_arm64_special-…`).

## Last observed Chromium results (agent run)

Before parking:

| Result | Count |
|--------|-------|
| Passed | 5 |
| Failed | 2 |

Failures at that time:

1. **call-stability** — after `pho-reset` in the loop, expected `ringing`, got `ended` (reset briefly went through `END`; later fixed in app to `RESTART` without flashing ended; re-verify manually).
2. **pho-controller happy path** — expected `ringing`, got `live` early (shared `demo` session pollution across parallel tests; later fixed with unique session IDs + `workers: 1`).

WebKit: all failed to launch (browser binary missing in that environment).

## How to re-enable

```bash
mv docs/chromium-e2e-review/specs/*.spec.ts tests/e2e/
# helpers already live under tests/e2e/helpers
# restore package.json check script to include test:e2e
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac14-arm64 npx playwright install
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac14-arm64 npm run test:e2e:chromium
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac14-arm64 npm run test:e2e:webkit
```

## Manual website verification (preferred now)

1. `cp .env.example .env.local` and set secrets/flags.
2. `npm run dev`
3. Call: `/call/demo?debugGlass=1`
4. Controller (other browser/device): `/pho-controller` — same session ID + secret.
5. Confirm LiquidGL debug: mode `active`, canvases `1`, backdrop none.
6. Pick Up / End / Reset and confirm controller status goes Queued → Applied.
