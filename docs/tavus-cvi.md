# Tavus CVI integration

Mini Pho uses Tavus Conversational Video Interface with a custom FaceTime UI.
The browser never receives `TAVUS_API_KEY`. Media transport is Daily
(`@daily-co/daily-js`); the existing React call chrome stays owned by this app.

## Final call flow

C4 dynamic diagram: [`docs/architecture/c4-dynamic-live-call.md`](architecture/c4-dynamic-live-call.md).

```text
/incoming/garry Accept → /call/demo (auto-start)
or / → /call/demo (auto-start)
→ camera / microphone permission
→ create Tavus conversation (server)
→ ringing UI (local camera fullscreen)
→ join Daily room with conversation_url + meeting_token
→ Gary joins (Daily participant-joined)
→ first rendered remote video frame
→ FaceTime pickup morph
→ live conversation
→ End → Tavus End Conversation + Daily leave/destroy → hire-me redirect
```

Unexpected tab / webview close does **not** call End Conversation from the
browser. Daily disconnects; Tavus ends the room after
`participant_left_timeout: 10`.

## Environment variables

Server only (never `VITE_*`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `TAVUS_API_KEY` | yes | Tavus REST auth (`.env.local` / Vercel) |
| `TAVUS_PAL_ID` | yes | Fixed PAL for Gary |
| `TAVUS_FACE_ID` | no | Face override; omit when the PAL already has a default face |
| `TAVUS_TEST_MODE` | no | Shell env preferred; Vite defaults to `true` when unset |

Local Vite loads secrets from `.env.local` into `process.env` for
`scripts/tavusApiPlugin.ts`. Shell-provided `TAVUS_TEST_MODE` wins over
`.env.local` (loadEnv only fills missing keys). The start-the-server skill runs:

```bash
TAVUS_TEST_MODE=false npm run dev -- --host 127.0.0.1 --port 5173
```

Vercel Functions use env vars for secrets and optional `TAVUS_TEST_MODE`.

## Create payload (server-fixed)

Browser create params are ignored. The server always sends:

```json
{
  "pal_id": "<TAVUS_PAL_ID>",
  "face_id": "<TAVUS_FACE_ID if set>",
  "conversation_name": "Gary Call",
  "require_auth": true,
  "max_participants": 2,
  "properties": {
    "participant_left_timeout": 10,
    "participant_absent_timeout": 60,
    "max_call_duration": 900
  }
}
```

When `TAVUS_TEST_MODE=true` (the Vite default when unset), create also sends
`test_mode: true`. The start-the-server skill starts with `TAVUS_TEST_MODE=false`
in the shell.

## Daily readiness

`useTavusCall` listens for:

- `participant-joined` / `participant-updated` / `participant-left`
- `track-started` / `track-stopped`
- `error` / `left-meeting`

The non-local participant is Gary. `PAL_JOINED` advances the reducer to
`connecting`. The FaceTime morph starts only after `useFirstVideoFrame`
sees Gary’s first rendered frame (`REMOTE_FRAME` → `joining` → `live`).

## Explicit End

End immediately:

1. Dispatch `END`
2. `endTavusConversation(conversationId)` via `POST /api/tavus`
3. Daily `leave()` + `destroy()`
4. Clear streams and in-memory conversation id

Meeting tokens stay in memory only — never in `localStorage`, URLs, or query params.

## Camera flip

Flip is a recoverable media transaction owned by `useMediaDevices`.
`useTavusCall.replaceVideoTrack` passes the exact replacement track to Daily
via `setInputDevicesAsync({ videoSource: track })` and does not stop tracks or
end the conversation on failure.

Failures (no second camera, same camera, Daily rejection, preview commit) set
`cameraActionError` only. They must not enter `connection-error`, tear down the
local stream, or permanently disable Flip (`isFlippingCamera` clears in
`finally`).

## Timeouts

| Property | Value | Meaning |
|----------|-------|---------|
| `participant_left_timeout` | 10 | Seconds after the human leaves before Tavus ends the conversation |
| `participant_absent_timeout` | 60 | Seconds to end if nobody successfully joins |
| `max_call_duration` | 900 | Hard cap (15 minutes) |

Do not add `beforeunload` / `pagehide` / `sendBeacon` End calls.

## Call Again

Every Call / Call Again / Retry creates:

- a new Tavus conversation
- a new meeting token
- a new Daily call object

Ended conversations are never reused.

## Manual verification

1. Set real `TAVUS_API_KEY` + `TAVUS_PAL_ID` in `.env.local`.
2. Start with `TAVUS_TEST_MODE=false` (start-the-server does this).
3. `npm run dev` → open `/` (redirects to `/call/demo`) or open `/call/demo` directly.
4. Allow camera/mic → ringing UI while waiting.
5. When Gary’s video appears, pickup morph runs (no fixed 2–3s timer).
6. Controls, flip, drag, LiquidGL, timer, and End still work.
7. End redirects to `https://photon.codes`.
8. Closing the tab does not fire a custom End request (Network panel).
