# Contributing

## Setup

```bash
npm ci
cp .env.example .env.local
```

Edit `.env.local` as needed. Variable meanings: [`.env.example`](.env.example) and [`docs/mini-pho-test-controller.md`](docs/mini-pho-test-controller.md).

## Development server

```bash
npm run dev
```

One Vite instance on port `5173`. Do not start a second copy.

### Local routes

- Call UI: [http://localhost:5173/call/demo](http://localhost:5173/call/demo)
- Pho controller: [http://localhost:5173/pho-controller](http://localhost:5173/pho-controller)

Architecture and ownership: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Checks

Before opening a PR:

```bash
npm run check
```

Runs lint, unit tests, and production build.

## Manual browser verification

Required when changing:

- LiquidGL init, fallback, or stacking → follow [`docs/liquid-gl-verification.md`](docs/liquid-gl-verification.md)
- Call chrome, self-view drag, camera flip, or phase transitions → exercise `/call/demo` in the target browser / Photon webview
- Pho controller polling, ack, or API → exercise call + `/pho-controller` together ([guide](docs/mini-pho-test-controller.md))

## Pull request checklist

- [ ] `npm run check` passes
- [ ] Imports inspected; unused components not treated as active
- [ ] No secrets in `VITE_*` or committed env files
- [ ] Apple call-symbol SVGs not renamed or replaced
- [ ] LiquidGL still pinned/patched if glass code changed
- [ ] Docs updated if routes, phases, env vars, ownership, or behavior changed
- [ ] Manual verification done for UI / glass / controller changes above
