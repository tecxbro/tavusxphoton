import { describe, expect, it } from "vitest";
import {
  AGENTS,
  callConfigFromAgent,
  getAgentById,
} from "../../data/agents";
import { HIRE_ME_URL } from "../../data/homeLinks";

describe("agents", () => {
  it("keeps the fixed directory order and Garry as the only live agent", () => {
    expect(AGENTS.map((agent) => agent.id)).toEqual([
      "garry-tan",
      "mark-andreessen",
      "hassaan-raza",
      "darshan-golchha",
      "roy-lee",
      "narendra-modi",
      "jared",
      "hasan",
      "lena",
      "daniel-tian",
    ]);

    const live = AGENTS.filter((agent) => agent.availability === "live");
    expect(live).toHaveLength(1);
    expect(live[0]?.id).toBe("garry-tan");
  });

  it("uses fixed busy ring durations without randomness", () => {
    const busy = AGENTS.filter((agent) => agent.availability === "busy");
    expect(busy.length).toBe(AGENTS.length - 1);
    for (const agent of busy) {
      expect(agent.ringDurationMs).toBeGreaterThanOrEqual(10_000);
      expect(agent.ringDurationMs).toBeLessThanOrEqual(20_000);
      expect(agent.avatarSrc.startsWith("/avatars/agents/")).toBe(true);
      expect(agent.avatarSrc.endsWith(".webp")).toBe(true);
    }
  });

  it("resolves agents by id", () => {
    expect(getAgentById("garry-tan")?.displayName).toBe("Garry Tan");
    expect(getAgentById("missing")).toBeNull();
    expect(getAgentById(undefined)).toBeNull();
  });

  it("builds CallConfig only from fixed profile fields", () => {
    const garry = getAgentById("garry-tan");
    expect(garry).not.toBeNull();
    expect(callConfigFromAgent(garry!)).toEqual({
      sessionId: "garry-tan",
      participantName: "Garry Tan",
      participantAvatar: "/avatars/agents/garry-tan.webp",
    });
  });
});

describe("homeLinks", () => {
  it("keeps hangup exit on the fixed internship URL", () => {
    expect(HIRE_ME_URL).toBe("https://pleasegivemeaninternship.com");
  });
});
