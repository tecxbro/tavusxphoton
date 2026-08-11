# C4 Containers — Mini Pho

Deployable / runtime containers inside Mini Pho.

```mermaid
C4Container
  title Container Diagram - Mini Pho

  Person(user, "Caller", "Uses FaceTime-style UI")

  System_Boundary(miniPho, "Mini Pho") {
    Container(spa, "Web SPA", "React 19, Vite, TypeScript", "Routes, call chrome, LiquidGL, Daily join")
    Container(tavusProxy, "Tavus API Proxy", "Vite middleware / Vercel Function", "Server-fixed create/end; holds API key")
  }

  System_Ext(tavus, "Tavus CVI API", "Conversation REST")
  System_Ext(daily, "Daily", "WebRTC SFU")
  System_Ext(hireMe, "Hire-me site", "Exit destination")

  Rel(user, spa, "Uses", "HTTPS")
  Rel(spa, tavusProxy, "POST create / end", "JSON /api/tavus")
  Rel(tavusProxy, tavus, "Create / end conversation", "HTTPS x-api-key")
  Rel(spa, daily, "join / leave / tracks", "@daily-co/daily-js")
  Rel(spa, hireMe, "Exit redirect", "location.replace")
```

## Container map

| Container | Code | Role |
|-----------|------|------|
| Web SPA | `src/` | Routes (`App.tsx`), `CallScreen` / `BusyCallScreen`, hooks, LiquidGL |
| Tavus API Proxy | `src/lib/tavus/tavus-api-vite-ssr.ts`, `scripts/tavusApiPlugin.ts`, `api/tavus.ts` | Shared handler; Vite in dev, Vercel in prod |

## Out of scope here

Agent directory data (`src/data/agents.ts`) drives `/call/:agentId` only —
there is no mounted home grid UI. See [`ARCHITECTURE.md`](../../ARCHITECTURE.md).
