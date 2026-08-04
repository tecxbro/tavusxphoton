// Runtime-agnostic Tavus API handler for Vite projects with a server.
// Pair with `tavus-client.ts` (which calls POST /api/tavus from the browser).
//
// Browser-supplied create params are ignored. The server always applies the
// fixed PAL / Face / timeout configuration from environment variables.
//
// Set `TAVUS_API_KEY`, `TAVUS_PAL_ID`, and optionally `TAVUS_FACE_ID` /
// `TAVUS_TEST_MODE` in the server environment — never on the client.

const TAVUS_API_BASE = "https://tavusapi.com/v2";

type Body =
  | { action: "create"; params?: Record<string, unknown> }
  | { action: "end"; conversationId: string };

const SAFE_CONVERSATION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Fixed create payload — never trust browser-supplied create fields. */
export function buildServerCreatePayload(): Record<string, unknown> {
  const palId = process.env.TAVUS_PAL_ID?.trim();
  if (!palId) {
    throw new Error("TAVUS_PAL_ID is not set in the server environment.");
  }

  const faceId = process.env.TAVUS_FACE_ID?.trim();
  const testMode = process.env.TAVUS_TEST_MODE === "true";

  const payload: Record<string, unknown> = {
    pal_id: palId,
    conversation_name: "Gary Call",
    require_auth: true,
    max_participants: 2,
    properties: {
      participant_left_timeout: 10,
      participant_absent_timeout: 60,
      max_call_duration: 900,
    },
  };

  if (faceId) {
    payload.face_id = faceId;
  }

  if (testMode) {
    payload.test_mode = true;
  }

  return payload;
}

function safeError(status: number, fallback: string): Response {
  return Response.json({ error: fallback }, { status });
}

export async function handleTavusRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) {
    return safeError(500, "Tavus is not configured.");
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return safeError(400, "Invalid request.");
  }

  if (body.action === "create") {
    let payload: Record<string, unknown>;
    try {
      payload = buildServerCreatePayload();
    } catch {
      return safeError(500, "Tavus is not configured.");
    }

    const r = await fetch(`${TAVUS_API_BASE}/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      return safeError(
        r.status >= 400 && r.status < 600 ? r.status : 502,
        "Unable to create conversation.",
      );
    }

    return Response.json(await r.json());
  }

  if (body.action === "end") {
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    if (!SAFE_CONVERSATION_ID.test(conversationId)) {
      return safeError(400, "Invalid conversation id.");
    }

    const r = await fetch(
      `${TAVUS_API_BASE}/conversations/${conversationId}/end`,
      {
        method: "POST",
        headers: { "x-api-key": apiKey },
      },
    );

    if (!r.ok) {
      return safeError(
        r.status >= 400 && r.status < 600 ? r.status : 502,
        "Unable to end conversation.",
      );
    }

    return new Response(null, { status: 204 });
  }

  return safeError(400, "Unknown action.");
}
