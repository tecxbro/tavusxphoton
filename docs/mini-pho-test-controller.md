# Mini Pho Test Controller

Temporary cross-device helper for answering the FaceTime prototype without production signaling.

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

Copy `.env.example` to `.env.local` for local development.

## Local setup

1. `cp .env.example .env.local` and set `TEST_CONTROLLER_SECRET`.
2. Keep `PHO_TEST_USE_MEMORY_STORE=true` for local work (no Redis required).
3. Run `npm run dev`.
4. Open `/call/demo` on one device/browser.
5. Open `/pho-controller` on another device/browser/profile.
6. Enter the same session ID (default `demo`).
7. Enter the controller secret (stored only in `sessionStorage`).
8. Confirm **Connection: API reachable**.
9. Use **Pick Up Call**, **End Call**, and **Reset Test**.

## Vercel setup

1. Deploy the Vite app with an `api/` directory (Vercel Functions).
2. Add the Upstash Redis Marketplace integration.
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

Each record expires after 60 minutes. Records contain only command/acknowledgement metadata — never media, tokens, or personal data.

## Entering the controller secret

1. Open `/pho-controller`.
2. Paste the secret into the password field.
3. The value is stored in `sessionStorage` only.
4. Use **Clear Secret** to remove it.
5. Never put the secret in the URL or local storage.

## Separate-device flow

1. Call device: `https://<origin>/call/<sessionId>`
2. Controller device: `https://<origin>/pho-controller`
3. Match the session ID on both sides.
4. Enter the server secret on the controller only.
5. Issue commands from the controller and watch acknowledgements.

## Status meanings

| Status | Meaning |
|--------|---------|
| Idle | No command in flight |
| Sending | Command POST in progress |
| Queued revision N | Command stored; waiting for call client ack |
| Applied: phase | Call client acknowledged revision N with resulting phase |
| Error: message | Safe error (auth, validation, network) |
| Queued, call client has not acknowledged | No matching ack within 15 seconds |

The controller never claims a call was answered/ended/reset merely because the command POST succeeded.

## Clearing a stuck session

1. Click **Reset Test** from the controller, or
2. Wait for the 60-minute Redis TTL, or
3. Change to a fresh session ID.

## Disabling after testing

1. Set `ENABLE_PHO_TEST_CONTROLLER=false`.
2. Set `VITE_ENABLE_PHO_TEST_CONTROLLER=false`.
3. Remove or rotate `TEST_CONTROLLER_SECRET`.
4. Redeploy.

The API returns 404 and the controller route reports disabled when the flags are off.
