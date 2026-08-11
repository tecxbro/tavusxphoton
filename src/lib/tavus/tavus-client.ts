/**
 * Browser client for the server-side `/api/tavus` route.
 * The Tavus API key stays on the server — see `tavus-api-vite-ssr.ts`.
 *
 * Create params are accepted for API symmetry with the generated helper, but
 * the server ignores them and applies its fixed configuration.
 */

const ENDPOINT = "/api/tavus";

/** Browser create body — ignored server-side; kept for helper API symmetry. */
export type CreateConversationParams = {
  pal_id?: string;
  face_id?: string;
  audio_only?: boolean;
  callback_url?: string;
  conversation_name?: string;
  conversational_context?: string;
  custom_greeting?: string;
  memory_stores?: string[];
  document_ids?: string[];
  document_retrieval_strategy?: "speed" | "quality" | "balanced";
  document_tags?: string[];
  test_mode?: boolean;
  require_auth?: boolean;
  max_participants?: number;
  properties?: {
    max_call_duration?: number;
    participant_left_timeout?: number;
    participant_absent_timeout?: number;
    enable_recording?: boolean;
    enable_closed_captions?: boolean;
    apply_greenscreen?: boolean;
    language?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Successful create payload from Tavus via `/api/tavus`. */
export type CreateConversationResponse = {
  conversation_id: string;
  conversation_url: string;
  meeting_token?: string;
  [key: string]: unknown;
};

/**
 * Create a Tavus CVI conversation through the server proxy.
 *
 * @param params - Optional create fields (ignored by the server).
 * @returns Conversation id, Daily URL, and optional meeting token.
 * @throws {Error} When the proxy responds non-OK.
 */
export async function createTavusConversation(
  params: CreateConversationParams = {},
): Promise<CreateConversationResponse> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", params }),
  });
  if (!res.ok) {
    throw new Error(`Tavus create failed: ${res.status}`);
  }
  return res.json();
}

/**
 * End a Tavus conversation through the server proxy.
 * Do not call from `beforeunload` / `pagehide` / `sendBeacon`.
 *
 * @param conversationId - Server-issued conversation id.
 * @throws {Error} When the proxy responds non-OK.
 */
export async function endTavusConversation(
  conversationId: string,
): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "end", conversationId }),
  });
  if (!res.ok) {
    throw new Error(`Tavus end failed: ${res.status}`);
  }
}
