# Mini Pho V1

FaceTime-style video-call mini app for Photon Spectrum inside iMessage.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173/call/demo](http://localhost:5173/call/demo).

## Photon Spectrum launch

```ts
await space.send(
  app("https://mini-pho.example.com/call/demo")
);
```

Do not use `live: true` for the full call UI — Photon app cards open the site in the Spectrum iMessage App sheet.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Local Vite server |
| `npm run build` | Typecheck + production build |
| `npm test` | Vitest unit tests (no browser) |

## Manual verification

Use your existing browser or Safari on iPhone against the Vite dev server. Do not install Playwright, Chromium, or other browser automation tools.

## Route

`/call/:sessionId`

Optional query params: `name`, `avatar`, `remoteVideo`.
