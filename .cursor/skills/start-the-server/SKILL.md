---
name: start-the-server
description: >-
  Start the Mini Pho Vite dev server for tavusxphoton and open the call UI.
  Use when the user asks to start the server, run npm run dev, boot local Mini
  Pho, or open the Gary FaceTime call screen. Always starts with
  TAVUS_TEST_MODE=false in the shell environment.
---

# Start the server

Mini Pho uses **one Vite process** on port `5173`:

| Surface | URL |
| --- | --- |
| Call (launcher + FaceTime UI) | `http://127.0.0.1:5173/call/demo` |

Do **not** start two Vite processes. Two ports (e.g. 5173 + 5174) means a stale or bumped server — kill the extras first.

## 1. Free the ports

```bash
lsof -tiTCP:5173 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
```

Confirm both are free before starting.

## 2. Env

Secrets stay in `.env.local` (user-maintained; may be unreadable to agents):

```bash
TAVUS_API_KEY=...
TAVUS_PAL_ID=...
# optional:
# TAVUS_FACE_ID=...
```

Never expose `TAVUS_API_KEY` via any `VITE_*` variable.

**Test mode is not edited in a file.** This skill enables a real Gary call by
setting `TAVUS_TEST_MODE=false` on the start command (shell env). That wins
over `.env.local` because Vite only fills missing keys.

While building / self-testing without this skill, omit the override (Vite
defaults `TAVUS_TEST_MODE` to `true`).

## 3. Start command

From `/Users/darshan/Documents/tavusxphoton` (or the workspace root):

```bash
TAVUS_TEST_MODE=false npm run dev -- --host 127.0.0.1 --port 5173
```

Always include `TAVUS_TEST_MODE=false` when using this skill.

Run it in the background with unrestricted permissions (`required_permissions: ["all"]`). Sandboxed shells fail Vite's `os.networkInterfaces()` lookup.

Wait until the log shows ready, then report the call URL.

## 4. How to use

1. Open the call URL.
2. Press **Call** on the Talk to Gary launcher.
3. Allow camera / microphone.
4. Wait for Gary (needs `TAVUS_TEST_MODE=false` from the start command and valid Tavus credentials in `.env.local`).
5. End from the FaceTime controls.

## 5. Optional debug

LiquidGL diagnostics (dev only):

`http://127.0.0.1:5173/call/demo?debugGlass=1`

## Anti-patterns

- Do not run a second `npm run dev` when 5173 is already serving this app.
- Do not start without `TAVUS_TEST_MODE=false` when using this skill.
- Do not call Tavus End Conversation from browser unload handlers.
- Do not expose `TAVUS_API_KEY` via any `VITE_*` variable.
- Do not write `TAVUS_TEST_MODE` into `.env.local` or a runtime JSON file from this skill — use the shell env on the start command.
