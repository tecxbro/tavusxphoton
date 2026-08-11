# C4 Deployment — Mini Pho

Production and local deployment nodes.

```mermaid
C4Deployment
  title Deployment Diagram - Mini Pho

  Deployment_Node(clientDevice, "Caller device", "iOS Spectrum / desktop browser") {
    Container(spaBrowser, "Mini Pho SPA", "React + Daily JS", "Static assets + WebRTC")
  }

  Deployment_Node(vercel, "Vercel", "Fluid Compute / static") {
    Container(staticHost, "Static hosting", "Vite build output", "index.html + assets")
    Container(apiFn, "api/tavus", "Vercel Node Function", "Tavus create/end proxy")
  }

  Deployment_Node(localDev, "Local developer machine", "optional") {
    Container(viteDev, "Vite dev server :5173", "Vite + tavusApiPlugin", "SPA + /api/tavus middleware")
  }

  Deployment_Node(tavusCloud, "Tavus", "SaaS") {
    System_Ext(tavusApi, "Tavus CVI API", "Conversations")
  }

  Deployment_Node(dailyCloud, "Daily", "SaaS") {
    System_Ext(dailySfu, "Daily SFU", "Media")
  }

  Rel(spaBrowser, staticHost, "Loads app", "HTTPS")
  Rel(spaBrowser, apiFn, "POST /api/tavus", "HTTPS")
  Rel(apiFn, tavusApi, "Create / end", "HTTPS x-api-key")
  Rel(spaBrowser, dailySfu, "join / tracks", "WebRTC / Daily")
  Rel(viteDev, tavusApi, "Dev proxy create / end", "HTTPS x-api-key")
```

## Environment

| Variable | Where | Notes |
|----------|-------|-------|
| `TAVUS_API_KEY` | Server only | Never `VITE_*` |
| `TAVUS_PAL_ID` | Server only | Fixed Gary PAL |
| `TAVUS_FACE_ID` | Server only | Optional |
| `TAVUS_TEST_MODE` | Shell / server | Defaults `true` when unset in Vite |

See [`.env.example`](../../.env.example) and [`docs/tavus-cvi.md`](../tavus-cvi.md).
