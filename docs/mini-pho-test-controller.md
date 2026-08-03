# Mini Pho Test Controller

Temporary cross-device helper for answering the FaceTime prototype without production signaling. Not part of the product call path.

Architecture context: [`ARCHITECTURE.md`](../ARCHITECTURE.md).

> **Security warning:** This controller is test-only. Disable it after testing. Never expose `TEST_CONTROLLER_SECRET` through `VITE_*` variables or the browser bundle.

## Required environment variables

| Variable | Runtime | Purpose |
|----------|---------|---------|
| `VITE_ENABLE_PHO_TEST_CONTROLLER` | Browser | Show `/pho-controller` and enable call-side polling |
| `ENABLE_PHO_TEST_CONTROLLER` | Server / Vite API middleware | Enable `/api/test-call/*` |
| `TEST_CONTROLLER_SECRET` | Server only | Bearer token required for command writes |
| `UPSTASH_REDIS_REST_URL` | Server | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Upstash Redis REST token |
| `PHO_TEST_USE_MEMORY_STORE` | Server | `true` for local/e2e in-memory store |

Copy `.env.example` to `.env.local` for local development. Vite defaults `ENABLE_PHO_TEST_CONTROLLER`, `PHO_TEST_USE_MEMORY_STORE`, and a local `TEST_CONTROLLER_SECRET` when unset (`vite.config.ts`) so local polling works without Redis.

## Local setup

1. `cp .env.example .env.local` and set `TEST_CONTROLLER_SECRET` (or rely on the Vite local default).
2. Keep `PHO_TEST_USE_MEMORY_STORE=true` for local work (no Redis required).
3. Run `npm run dev` (serves `/api/test-call/*` via `scripts/phoTestApiPlugin.ts`).
4. Open `/call/demo` on one device/browser.
5. Open `/pho-controller` on another device/browser/profile.
6. Enter the same session ID (default `demo`).
7. Enter the controller secret (stored only in `sessionStorage` under `mini-pho:controller-secret`).
8. Confirm **Connection: API reachable**.
9. Use **Pick Up Call**, **End Call**, and **Reset Test**.

## Routes and API

| Surface | Path |
|---------|------|
| Controller UI | `/pho-controller` |
| Read state | `GET /api/test-call/state?sessionId=` |
| Issue command | `POST /api/test-call/command` (Bearer secret) |
| Acknowledge | `POST /api/test-call/ack` |

Actions: `answer` | `end` | `reset`. Shared types: `src/contracts/phoTestController.ts`.

When `VITE_ENABLE_PHO_TEST_CONTROLLER` is not `"true"`, the controller route renders disabled. When `ENABLE_PHO_TEST_CONTROLLER` is not `"true"`, the API returns 404.

## Command acknowledgement flow

1. Controller POSTs a command → store increments `revision` and clears prior ack.
2. Call client (`usePhoTestCommands`) polls every ~350ms, applies each new revision once (last revision in `sessionStorage`: `mini-pho:last-applied-revision:<sessionId>`).
3. Call client POSTs ack with `resultingPhase` and `clientId`.
4. Controller polls until ack revision matches (15s), then shows `Applied: <phase>`.

The controller never claims a call was answered/ended/reset merely because the command POST succeeded.

## Status meanings

| Status | Meaning |
|--------|---------|
| Idle | No command in flight |
| Sending | Command POST in progress |
| Queued revision N | Command stored; waiting for call client ack |
| Applied: phase | Call client acknowledged revision N with resulting phase |
| Error: message | Safe error (auth, validation, network) |
| Queued, call client has not acknowledged | No matching ack within 15 seconds |

## Vercel setup

The `api/test-call/*.ts` handlers are Vercel Functions. This branch has no checked-in `vercel.json`; deploy with Vercel’s default `api/` convention when hosting.

1. Deploy with the `api/` directory present.
2. Add the Upstash Redis Marketplace integration when not using memory store.
3. Set `ENABLE_PHO_TEST_CONTROLLER=true` and `VITE_ENABLE_PHO_TEST_CONTROLLER=true`.
4. Set a long random `TEST_CONTROLLER_SECRET`.
5. Set `PHO_TEST_USE_MEMORY_STORE=false` (or omit it) so Redis is used.
6. Confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present.
7. Redeploy.

## Redis integration

State is stored at:

```text
mini-pho:test-call:<sessionId>
```

Each record expires after 60 minutes (`PHO_TEST_TTL_SECONDS`). Records contain only command/acknowledgement metadata — never media, tokens, or personal data.

## Entering the controller secret

1. Open `/pho-controller`.
2. Paste the secret into the password field.
3. The value is stored in `sessionStorage` only.
4. Use **Clear Secret** to remove it.
5. Never put the secret in the URL or local storage.

## Clearing a stuck session

1. Click **Reset Test** from the controller, or
2. Wait for the 60-minute TTL, or
3. Change to a fresh session ID.

## Disabling after testing

1. Set `ENABLE_PHO_TEST_CONTROLLER=false`.
2. Set `VITE_ENABLE_PHO_TEST_CONTROLLER=false`.
3. Remove or rotate `TEST_CONTROLLER_SECRET`.
4. Redeploy (if hosted).

The API returns 404 and the controller route reports disabled when the flags are off.
