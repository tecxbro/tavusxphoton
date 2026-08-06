/**
 * Photon Spectrum launch snippet for Mini Pho V1.
 *
 * Opens the hosted Mini Pho URL as a standard Photon app card inside
 * the Spectrum iMessage App (expanded sheet). Do not use `live: true`
 * for the full call interface.
 *
 * @example
 * ```ts
 * import { Spectrum } from "spectrum-ts";
 * // ...
 * await space.send(
 *   app("https://mini-pho.example.com/")
 * );
 * ```
 */
export const MINI_PHO_APP_URL = "https://mini-pho.example.com/";

export function buildMiniPhoAppUrl(agentId = "garry-tan"): string {
  return `https://mini-pho.example.com/call/${agentId}`;
}
