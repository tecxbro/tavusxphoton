# Agent Instructions

## Read order

1. `README.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. Target source file
5. Related tests
6. Relevant subsystem doc (`docs/liquid-gl-verification.md` or `docs/tavus-cvi.md`)

## Package Manager

- Use **npm**: `npm ci`

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (one instance, port `5173`) |
| Unit tests | `npm test` |
| File / focused test | `npx vitest run path/to/file.test.ts` |
| Lint | `npm run lint` |
| Full gate | `npm run check` |

## Task → file map

| Task | Primary files | Also check |
|------|---------------|------------|
| Routes / agent call | `src/App.tsx`, `src/data/agents.ts` | `ARCHITECTURE.md` |
| Home directory | `HomeScreen.tsx`, `AgentGrid.tsx`, `AgentCard.tsx`, `src/data/agents.ts`, `src/data/homeLinks.ts` | `src/styles/home.css`, `public/avatars/agents/` |
| Call phases / flow | `src/lib/callState.ts`, `src/components/CallScreen.tsx` | `src/tests/unit/callState.test.ts` |
| Tavus + Daily call | `src/hooks/useTavusCall.ts`, `src/lib/tavus/` | `docs/tavus-cvi.md`, `api/tavus.ts` |
| Local media | `src/hooks/useMediaDevices.ts` | `src/tests/unit/hooks.test.ts` |
| Self-view drag | `src/hooks/useDraggableSelfView.ts`, `LocalCameraSurface.tsx` | CallScreen drag wiring |
| LiquidGL | `src/lib/liquidGlass.ts`, `src/hooks/useLiquidGlass.ts`, `src/hooks/useHomeLiquidGlass.ts` | `patches/`, `docs/liquid-gl-verification.md` |
| Call chrome / symbols | `CallControlRail.tsx`, `SymbolIcon.tsx`, `src/assets/call-symbols/` | `callControls.test.tsx` |
| Home menu | `HomeMenu.tsx`, `src/data/homeLinks.ts` | Morphing LiquidGL shell |
| Busy call sim | `BusyCallScreen.tsx` | Local media ring → busy; no Tavus/Daily |
| Styles | `src/styles/` | Avoid reordering LiquidGL/CSS stacking rules |

## Protected rules

- Inspect imports before editing — many components in `src/components/` are not mounted.
- Do not run multiple Vite servers.
- Do not expose server secrets through `VITE_*` (especially `TAVUS_API_KEY`).
- Do not replace or rename Apple SVG assets under `src/assets/call-symbols/`.
- Do not upgrade `liquid-gl` without reviewing `patches/liquid-gl+2.0.1.patch`.
- Keep exactly one LiquidGL renderer canvas.
- Do not persist self-view pixel coordinates — store corner names only.
- Do not bypass the call reducer for phase changes.
- Do not call Tavus End Conversation from `beforeunload` / `pagehide` / `sendBeacon`.
- Do not accept PAL IDs, face IDs, timeouts, or room URLs from the browser.
- Default `TAVUS_TEST_MODE` to true when unset. The start-the-server skill starts Vite as `TAVUS_TEST_MODE=false npm run dev` (shell env; do not write the flag into `.env.local`).
- Update docs when routes, phases, env vars, ownership, or behavior change.

## External References

| Need | File |
|------|------|
| Runtime architecture | `ARCHITECTURE.md` |
| C4 diagrams | `docs/architecture/` |
| Setup / PR checklist | `CONTRIBUTING.md` |
| LiquidGL verification | `docs/liquid-gl-verification.md` |
| Tavus CVI + Daily | `docs/tavus-cvi.md` |
| Env template | `.env.example` |
