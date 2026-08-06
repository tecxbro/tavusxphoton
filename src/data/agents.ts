import type { CallConfig } from "../lib/callState";

export type AgentAvailability = "live" | "busy";
export type AgentImageMode = "circle" | "full-bleed";

export interface AgentProfile {
  id: string;
  displayName: string;
  participantName: string;
  avatarSrc: string;
  imageMode: AgentImageMode;
  objectPosition?: string;
  statusLabel: string;
  availability: AgentAvailability;
  ringDurationMs?: number;
}

const agentAvatar = (id: string) => `/avatars/agents/${id}.webp`;

export const AGENTS: readonly AgentProfile[] = [
  {
    id: "garry-tan",
    displayName: "Garry Tan",
    participantName: "Garry Tan",
    avatarSrc: agentAvatar("garry-tan"),
    imageMode: "full-bleed",
    objectPosition: "50% 18%",
    statusLabel: "Video",
    availability: "live",
  },
  {
    id: "mark-andreessen",
    displayName: "Mark Andreessen",
    participantName: "Mark Andreessen",
    avatarSrc: agentAvatar("mark-andreessen"),
    imageMode: "circle",
    statusLabel: "Video Tuesday",
    availability: "busy",
    ringDurationMs: 10_000,
  },
  {
    id: "hassaan-raza",
    displayName: "Hassaan Raza",
    participantName: "Hassaan Raza",
    avatarSrc: agentAvatar("hassaan-raza"),
    imageMode: "full-bleed",
    objectPosition: "50% 30%",
    statusLabel: "Video Monday",
    availability: "busy",
    ringDurationMs: 11_000,
  },
  {
    id: "darshan-golchha",
    displayName: "Darshan Golchha",
    participantName: "Darshan Golchha",
    avatarSrc: agentAvatar("darshan-golchha"),
    imageMode: "circle",
    statusLabel: "08:26",
    availability: "busy",
    ringDurationMs: 12_000,
  },
  {
    id: "roy-lee",
    displayName: "Roy Lee",
    participantName: "Roy Lee",
    avatarSrc: agentAvatar("roy-lee"),
    imageMode: "full-bleed",
    objectPosition: "50% 22%",
    statusLabel: "Video Sunday",
    availability: "busy",
    ringDurationMs: 14_000,
  },
  {
    id: "narendra-modi",
    displayName: "Narendra Modi",
    participantName: "Narendra Modi",
    avatarSrc: agentAvatar("narendra-modi"),
    imageMode: "circle",
    statusLabel: "Video Friday",
    availability: "busy",
    ringDurationMs: 15_000,
  },
  {
    id: "jared",
    displayName: "Jared",
    participantName: "Jared",
    avatarSrc: agentAvatar("jared"),
    imageMode: "full-bleed",
    objectPosition: "50% 28%",
    statusLabel: "Video Thursday",
    availability: "busy",
    ringDurationMs: 16_000,
  },
  {
    id: "hasan",
    displayName: "Hasan",
    participantName: "Hasan",
    avatarSrc: agentAvatar("hasan"),
    imageMode: "circle",
    statusLabel: "09:14",
    availability: "busy",
    ringDurationMs: 18_000,
  },
  {
    id: "lena",
    displayName: "Lena",
    participantName: "Lena",
    avatarSrc: agentAvatar("lena"),
    imageMode: "circle",
    statusLabel: "Video Wednesday",
    availability: "busy",
    ringDurationMs: 19_000,
  },
  {
    id: "daniel-tian",
    displayName: "Daniel Tian",
    participantName: "Daniel Tian",
    avatarSrc: agentAvatar("daniel-tian"),
    imageMode: "full-bleed",
    objectPosition: "50% 20%",
    statusLabel: "Video Saturday",
    availability: "busy",
    ringDurationMs: 20_000,
  },
] as const;

export function getAgentById(id: string | undefined): AgentProfile | null {
  if (!id) return null;
  return AGENTS.find((agent) => agent.id === id) ?? null;
}

/** Call identity comes only from fixed agent data — never from query params. */
export function callConfigFromAgent(agent: AgentProfile): CallConfig {
  return {
    sessionId: agent.id,
    participantName: agent.participantName,
    participantAvatar: agent.avatarSrc,
  };
}
