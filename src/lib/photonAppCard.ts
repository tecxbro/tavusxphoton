/**
 * Photon Spectrum launch snippet for Mini Pho.
 *
 * Send the incoming FaceTime Live Mini App into the iMessage transcript.
 * Do not use `live: true` for `/call/demo` itself — that URL is the expanded
 * FaceTime experience after Accept.
 *
 * Credentials stay on the Spectrum sender (`PROJECT_ID` / `PROJECT_SECRET`).
 * Never put them in frontend `VITE_*` variables.
 *
 * @example
 * ```ts
 * import { Spectrum, app } from "spectrum-ts";
 * import { imessage } from "spectrum-ts/providers/imessage";
 *
 * const spectrum = await Spectrum({
 *   projectId: process.env.PROJECT_ID!,
 *   projectSecret: process.env.PROJECT_SECRET!,
 *   providers: [imessage.config()],
 * });
 *
 * await space.send(
 *   app("https://tavusxphoton.vercel.app/incoming/garry", {
 *     live: true,
 *   }),
 * );
 * ```
 */
export const MINI_PHO_INCOMING_URL =
  "https://tavusxphoton.vercel.app/incoming/garry";

export const MINI_PHO_CALL_URL = "https://tavusxphoton.vercel.app/call/demo";

export function buildMiniPhoIncomingUrl(): string {
  return MINI_PHO_INCOMING_URL;
}

export function buildMiniPhoAppUrl(agentId = "demo"): string {
  return `https://tavusxphoton.vercel.app/call/${agentId}`;
}
