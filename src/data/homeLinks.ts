/** Fixed CTA destination for the Hire me control. */
export const HIRE_ME_URL = "https://pleasegivemeaninternship.com";

/**
 * Only approved external destination in this app. Menu LinkedIn / Twitter
 * entries reuse it — do not invent profile URLs.
 */
export const APPROVED_EXTERNAL_URL = HIRE_ME_URL;

export type HomeMenuItemId = "calls" | "home" | "linkedin" | "twitter";

export interface HomeMenuItem {
  id: HomeMenuItemId;
  label: string;
  /** When set, selection opens this approved URL. */
  href?: string;
  /** Marks the current directory context (Calls). */
  selected?: boolean;
}

/** Expanding home menu destinations — local data only, no dynamic fetch. */
export const HOME_LINKS: readonly HomeMenuItem[] = [
  {
    id: "calls",
    label: "Calls",
    selected: true,
  },
  {
    id: "home",
    label: "Home",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: APPROVED_EXTERNAL_URL,
  },
  {
    id: "twitter",
    label: "Twitter",
    href: APPROVED_EXTERNAL_URL,
  },
] as const;
