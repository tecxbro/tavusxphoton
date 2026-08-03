# Agent Instructions

## Read order

1. `README.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. Target source file
5. Related tests
6. Relevant subsystem doc (`docs/liquid-gl-verification.md` or `docs/mini-pho-test-controller.md`)

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
| Routes / query config | `src/App.tsx`, `src/lib/callState.ts` | `ARCHITECTURE.md` |
| Call phases / flow | `src/lib/callState.ts`, `src/components/CallScreen.tsx` | `src/tests/unit/callState.test.ts` |
| Local media | `src/hooks/useMediaDevices.ts` | `src/tests/unit/hooks.test.ts` |
| Self-view drag | `src/hooks/useDraggableSelfView.ts`, `LocalCameraSurface.tsx` | CallScreen drag wiring |
| LiquidGL | `src/lib/liquidGlass.ts`, `src/hooks/useLiquidGlass.ts` | `patches/`, `docs/liquid-gl-verification.md` |
| Call chrome / symbols | `CallControlRail.tsx`, `SymbolIcon.tsx`, `src/assets/call-symbols/` | `callControls.test.tsx` |
| Pho controller | `PhoController.tsx`, `usePhoTestCommands.ts`, `phoTestControllerClient.ts` | `api/`, `docs/mini-pho-test-controller.md` |
| Styles | `src/styles/` | Avoid reordering LiquidGL/CSS stacking rules |

## Protected rules

- Inspect imports before editing — many components in `src/components/` are not mounted.
- Do not run multiple Vite servers.
- Do not expose server secrets through `VITE_*`.
- Do not replace or rename Apple SVG assets under `src/assets/call-symbols/`.
- Do not upgrade `liquid-gl` without reviewing `patches/liquid-gl+2.0.1.patch`.
- Keep exactly one LiquidGL renderer canvas.
- Do not persist self-view pixel coordinates — store corner names only.
- Do not bypass the call reducer for phase changes.
- Do not claim a controller command succeeded before acknowledgement.
- Update docs when routes, phases, env vars, ownership, or behavior change.

## External References

| Need | File |
|------|------|
| Runtime architecture | `ARCHITECTURE.md` |
| Setup / PR checklist | `CONTRIBUTING.md` |
| LiquidGL verification | `docs/liquid-gl-verification.md` |
| Pho test controller | `docs/mini-pho-test-controller.md` |
| Env template | `.env.example` |
