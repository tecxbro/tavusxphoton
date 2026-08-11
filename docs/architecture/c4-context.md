# C4 Context — Mini Pho

System context for Mini Pho: FaceTime-style video UI inside Photon Spectrum /
iMessage, connected to Tavus CVI (Gary) over Daily.

Runtime ownership and call phases: [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

```mermaid
C4Context
  title System Context - Mini Pho

  Person(user, "Caller", "Joins a FaceTime-style call from Spectrum / browser")
  System(miniPho, "Mini Pho", "React SPA + Tavus proxy for Garry live / busy sims")

  System_Ext(tavus, "Tavus CVI API", "Creates and ends PAL conversations")
  System_Ext(daily, "Daily", "WebRTC media transport for CVI rooms")
  System_Ext(hireMe, "Hire-me site", "pleasegivemeaninternship.com exit destination")

  Rel(user, miniPho, "Starts / ends call, toggles camera and mic")
  Rel(miniPho, tavus, "Create / end conversation", "HTTPS JSON via /api/tavus")
  Rel(miniPho, daily, "Join room, publish local / receive remote A/V", "Daily JS SDK")
  Rel(tavus, daily, "Provisions conversation room", "Tavus-managed")
  Rel(miniPho, hireMe, "Redirects after call exit", "window.location.replace")
```

## Notes

- Browser never receives `TAVUS_API_KEY`, PAL IDs, face IDs, or room URLs as
  trusted client input — create payload is server-fixed.
- Unexpected disconnect cleanup is owned by Tavus `participant_left_timeout`
  (no End Conversation from `beforeunload` / beacon).
