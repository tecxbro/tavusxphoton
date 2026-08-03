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

```bash
npm run dev
npm run lint
npm test
npm run build
npm run check
```

This project uses Vitest for unit tests. Visual LiquidGL and icon rendering are checked manually in the target browser and Photon environment.

## Route

`/call/:sessionId`

Optional query params: `name`, `avatar`, `remoteVideo`.
