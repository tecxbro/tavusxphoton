# Mini Pho

FaceTime-style video-call UI prototype for Photon Spectrum inside iMessage.

## What is real vs mocked

| Piece | Status |
|-------|--------|
| Local camera and microphone | Real — browser `getUserMedia` |
| Remote video | Mock — same-origin asset (default `/videos/mock-agent.mp4`) |
| Call phases / UI chrome | Real — client reducer and React UI |
| LiquidGL call controls | Real — `liquid-gl@2.0.1` with CSS frosted fallback |
| Pho answer / end / reset | Temporary test controller (`/pho-controller` + `/api/test-call/*`) |
| Production RTC | Not implemented |
| Production signaling | Not implemented |

## Quick start

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:5173/call/demo](http://localhost:5173/call/demo).

Use one Vite server on port `5173` — do not start multiple copies.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Redirects to `/call/demo` |
| `/call/:sessionId` | Call UI (`name`, `avatar`, `remoteVideo`, `selfAvatar` query params) |
| `/pho-controller` | Temporary Pho test controller (requires client flag) |

## Environment variables

See `.env.example`. Summary:

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_ENABLE_PHO_TEST_CONTROLLER` | Client | Enable controller route and call-side polling |
| `ENABLE_PHO_TEST_CONTROLLER` | Server / Vite middleware | Enable `/api/test-call/*` |
| `TEST_CONTROLLER_SECRET` | Server only | Bearer secret for command writes — never `VITE_*` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Server | Redis store for deployed controller |
| `PHO_TEST_USE_MEMORY_STORE` | Server | `true` for local in-memory store |

Full controller setup: [`docs/mini-pho-test-controller.md`](docs/mini-pho-test-controller.md).

## npm commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite on `5173` (includes local `/api/test-call` middleware) |
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
  components/                # Call UI + Pho controller
  hooks/                     # Media, drag, LiquidGL, Pho poll
  lib/                       # Call state, LiquidGL, Pho client
  contracts/                 # Shared Pho test types
  styles/                    # Tokens and call/controller CSS
api/                         # Vercel Functions for Pho test API
scripts/phoTestApiPlugin.ts  # Vite middleware for the same API
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
| [`docs/mini-pho-test-controller.md`](docs/mini-pho-test-controller.md) | Temporary Pho test controller |
