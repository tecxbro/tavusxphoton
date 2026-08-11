# C4 Dynamic — Live Garry call

Numbered request / event flow for the happy-path live call
(`/` → `/call/garry-tan` → auto-start).

Phase machine details: [`ARCHITECTURE.md`](../../ARCHITECTURE.md) and
`src/lib/callState.ts`.

```mermaid
C4Dynamic
  title Dynamic Diagram - Live Garry Call

  Person(user, "Caller", "Spectrum / browser")
  Container(spa, "Web SPA", "React", "CallScreen + useTavusCall")
  Container(proxy, "Tavus API Proxy", "Node", "handleTavusRequest")
  System_Ext(tavus, "Tavus CVI", "Conversations API")
  System_Ext(daily, "Daily", "WebRTC room")

  Rel(user, spa, "1. Land on /call/garry-tan (autoStart)")
  Rel(spa, spa, "2. getUserMedia + START_CALL / ringing")
  Rel(spa, proxy, "3. POST /api/tavus create", "JSON")
  Rel(proxy, tavus, "4. Create conversation (fixed PAL)", "HTTPS")
  Rel(tavus, proxy, "5. conversation_url + meeting_token")
  Rel(proxy, spa, "6. Return create payload")
  Rel(spa, daily, "7. Daily join with URL + token")
  Rel(daily, spa, "8. Gary participant-joined → PAL_JOINED")
  Rel(daily, spa, "9. Remote video frame → joining → live")
  Rel(user, spa, "10. End call")
  Rel(spa, proxy, "11. POST /api/tavus end", "JSON")
  Rel(proxy, tavus, "12. End conversation")
  Rel(spa, daily, "13. leave + destroy")
```

## Phase mapping

| Step | Reducer signal |
|------|----------------|
| Permissions OK | `PERMISSIONS_GRANTED` → `ringing` |
| Gary joins Daily | `PAL_JOINED` → `connecting` |
| First remote frame | `REMOTE_FRAME` → `joining` |
| Morph complete | `JOIN_COMPLETE` → `live` |
| User hangs up | `END` → teardown → hire-me redirect |
