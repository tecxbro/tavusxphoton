---
name: start-the-server
description: >-
  Start the Mini Pho Vite dev server for tavusxphoton and open the call UI plus
  Pho picker. Use when the user asks to start the server, run npm run dev, boot
  local Mini Pho, open the call screen, or open the Pho controller/picker.
---

# Start the server

Mini Pho uses **one Vite process**. That single server hosts both surfaces:

| Surface | URL |
| --- | --- |
| Call (camera / FaceTime UI) | `http://127.0.0.1:5173/call/demo` |
| Pho picker / test controller | `http://127.0.0.1:5173/pho-controller` |

Do **not** start two Vite processes. Two ports (e.g. 5173 + 5174) means a stale or bumped server — kill the extras first.

## 1. Free the ports

```bash
lsof -tiTCP:5173 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
```

Confirm both are free before starting.

## 2. Env

From the repo root, ensure `.env.local` exists (copy from `.env.example` if missing). Local defaults that must be present for the Pho picker:

```bash
VITE_ENABLE_PHO_TEST_CONTROLLER=true
ENABLE_PHO_TEST_CONTROLLER=true
TEST_CONTROLLER_SECRET=local-dev-controller-secret
PHO_TEST_USE_MEMORY_STORE=true
```

`vite.config.ts` also injects these when unset, but prefer an explicit `.env.local`.

## 3. Start command

From `/Users/darshan/Documents/tavusxphoton` (or the workspace root):

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Run it in the background with unrestricted permissions (`required_permissions: ["all"]`). Sandboxed shells fail Vite's `os.networkInterfaces()` lookup.

Wait until the log shows ready, then report both URLs.

Equivalent scripts already in the repo:

- `package.json` → `"dev": "vite"`
- Playwright webServer → `npm run dev -- --host 127.0.0.1` on port `5173`

## 4. How to use the two surfaces

1. Open the **call** URL in one browser/profile/device.
2. Open the **Pho picker** URL in another browser/profile/device (cross-device needs the HTTP API + shared session id + controller secret).
3. Match the session id (default `demo`).
4. On the picker, enter `TEST_CONTROLLER_SECRET`, confirm API reachable, then use Pick Up / End / Reset.

Same-origin same-profile tabs also work for local smoke checks.

## 5. Optional debug

LiquidGL diagnostics (dev only):

`http://127.0.0.1:5173/call/demo?debugGlass=1`

## Anti-patterns

- Do not run a second `npm run dev` when 5173 is already serving this app.
- Do not treat `/pho-controller` as a separate Node server — it is a route on the same Vite app.
- Do not expose `TEST_CONTROLLER_SECRET` via any `VITE_*` variable.
