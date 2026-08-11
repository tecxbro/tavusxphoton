# Mini Pho

FaceTime-style video-call UI for Photon Spectrum inside iMessage, connected to
Tavus CVI (Gary) over Daily.

## What is real vs mocked

| Piece | Status |
|-------|--------|
| Local camera and microphone | Real — browser `getUserMedia` |
| Remote video / audio | Real — Tavus CVI via Daily |
| Call phases / UI chrome | Real — client reducer and React UI |
| LiquidGL call controls | Real — `liquid-gl@2.0.1` with CSS frosted fallback |
| Conversation create / end | Real — server `/api/tavus` (API key stays server-side) |

## Quick start

```bash
npm ci
cp .env.example .env.local
# Fill TAVUS_API_KEY and TAVUS_PAL_ID
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) — you land on the Garry
call (mic/camera prompt, then connect). Ending the call leaves for
[pleasegivemeaninternship.com](https://pleasegivemeaninternship.com).

Use one Vite server on port `5173` — do not start multiple copies.

Start with `TAVUS_TEST_MODE=false` for a live Gary join (start-the-server does
this). When unset, Vite defaults to `true` so creates skip the PAL join.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Redirects to `/call/garry-tan` (direct Garry landing) |
| `/call/:agentId` | Garry → real Tavus call (auto-start); other agents → busy simulation. Exit replaces the page with `https://pleasegivemeaninternship.com` |
| `*` | Redirects to `/` |

## Environment variables

See `.env.example`. Summary:

| Variable | Where | Purpose |
|----------|-------|---------|
| `TAVUS_API_KEY` | Server only (`.env.local`) | Tavus REST auth — never `VITE_*` |
| `TAVUS_PAL_ID` | Server only (`.env.local`) | Fixed PAL id for Gary |
| `TAVUS_FACE_ID` | Server only (`.env.local`) | Optional face override |
| `TAVUS_TEST_MODE` | Shell env / default | `true` skips PAL join; start-the-server runs with `false` |

Full CVI notes: [`docs/tavus-cvi.md`](docs/tavus-cvi.md).

## npm commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite on `5173` (includes local `/api/tavus` middleware) |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | oxlint |
| `npm test` | Vitest once |
| `npm run test:watch` | Vitest watch |
| `npm run check` | lint + test + build |
| `npm run postinstall` | Applies `patch-package` (LiquidGL patch) |

## Project structure

```text
src/
  main.tsx, App.tsx          # Bootstrap and routes
  components/                # Call UI (live + busy)
  data/                      # Fixed agent directory + home links
  hooks/                     # Media, Daily/Tavus, drag, LiquidGL
  lib/                       # Call state, LiquidGL, tavus helpers
  styles/                    # Tokens and home/call CSS
api/tavus.ts                 # Vercel adapter for Tavus helper
scripts/tavusApiPlugin.ts    # Vite middleware for the same API
patches/                     # liquid-gl@2.0.1 patch
docs/                        # Subsystem guides
```

## Documentation

| Doc | Contents |
|-----|----------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Runtime map, call flow, ownership |
| [`AGENTS.md`](AGENTS.md) | Instructions for coding agents |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Local workflow and PR checklist |
| [`docs/liquid-gl-verification.md`](docs/liquid-gl-verification.md) | LiquidGL manual verification |
| [`docs/tavus-cvi.md`](docs/tavus-cvi.md) | Tavus CVI + Daily integration |
| [`docs/architecture/`](docs/architecture/) | C4 context / containers / dynamic / deployment |
