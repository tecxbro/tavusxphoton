import { Redis } from "@upstash/redis";
import {
  PHO_TEST_TTL_SECONDS,
  isCallResultPhase,
  isPhoTestAction,
  isSafeSessionId,
  phoTestRedisKey,
  type CallResultPhase,
  type PhoTestAcknowledgement,
  type PhoTestAction,
  type PhoTestCommand,
  type PhoTestState,
} from "../../src/contracts/phoTestController.js";

export interface PhoTestStore {
  getState(sessionId: string): Promise<PhoTestState>;
  issueCommand(
    sessionId: string,
    action: PhoTestAction,
  ): Promise<PhoTestCommand>;
  acknowledge(input: {
    sessionId: string;
    revision: number;
    resultingPhase: CallResultPhase;
    clientId: string;
  }): Promise<
    | { ok: true; acknowledgement: PhoTestAcknowledgement }
    | { ok: false; reason: "missing" | "stale" | "future" }
  >;
  clear(sessionId: string): Promise<void>;
}

interface StoredRecord {
  command: PhoTestCommand | null;
  acknowledgement: PhoTestAcknowledgement | null;
}

function emptyState(): PhoTestState {
  return { command: null, acknowledgement: null };
}

function parseStored(value: unknown): StoredRecord {
  if (!value || typeof value !== "object") {
    return { command: null, acknowledgement: null };
  }
  const record = value as Partial<StoredRecord>;
  const command =
    record.command &&
    typeof record.command === "object" &&
    isSafeSessionId(record.command.sessionId) &&
    isPhoTestAction(record.command.action) &&
    typeof record.command.revision === "number" &&
    typeof record.command.issuedAt === "string"
      ? record.command
      : null;
  const acknowledgement =
    record.acknowledgement &&
    typeof record.acknowledgement === "object" &&
    typeof record.acknowledgement.revision === "number" &&
    typeof record.acknowledgement.appliedAt === "string" &&
    isCallResultPhase(record.acknowledgement.resultingPhase) &&
    typeof record.acknowledgement.clientId === "string"
      ? record.acknowledgement
      : null;
  return { command, acknowledgement };
}

class MemoryPhoTestStore implements PhoTestStore {
  private readonly records = new Map<
    string,
    { value: StoredRecord; expiresAt: number }
  >();

  private touch(sessionId: string, value: StoredRecord): StoredRecord {
    this.records.set(sessionId, {
      value,
      expiresAt: Date.now() + PHO_TEST_TTL_SECONDS * 1000,
    });
    return value;
  }

  private read(sessionId: string): StoredRecord {
    const entry = this.records.get(sessionId);
    if (!entry) return { command: null, acknowledgement: null };
    if (entry.expiresAt <= Date.now()) {
      this.records.delete(sessionId);
      return { command: null, acknowledgement: null };
    }
    return entry.value;
  }

  async getState(sessionId: string): Promise<PhoTestState> {
    const value = this.read(sessionId);
    return { command: value.command, acknowledgement: value.acknowledgement };
  }

  async issueCommand(
    sessionId: string,
    action: PhoTestAction,
  ): Promise<PhoTestCommand> {
    const current = this.read(sessionId);
    const revision = (current.command?.revision ?? 0) + 1;
    const command: PhoTestCommand = {
      sessionId,
      action,
      revision,
      issuedAt: new Date().toISOString(),
    };
    this.touch(sessionId, { command, acknowledgement: null });
    return command;
  }

  async acknowledge(input: {
    sessionId: string;
    revision: number;
    resultingPhase: CallResultPhase;
    clientId: string;
  }): Promise<
    | { ok: true; acknowledgement: PhoTestAcknowledgement }
    | { ok: false; reason: "missing" | "stale" | "future" }
  > {
    const current = this.read(input.sessionId);
    if (!current.command) {
      return { ok: false, reason: "missing" };
    }
    if (input.revision < current.command.revision) {
      return { ok: false, reason: "stale" };
    }
    if (input.revision > current.command.revision) {
      return { ok: false, reason: "future" };
    }
    const acknowledgement: PhoTestAcknowledgement = {
      revision: input.revision,
      appliedAt: new Date().toISOString(),
      resultingPhase: input.resultingPhase,
      clientId: input.clientId,
    };
    this.touch(input.sessionId, {
      command: current.command,
      acknowledgement,
    });
    return { ok: true, acknowledgement };
  }

  async clear(sessionId: string): Promise<void> {
    this.records.delete(sessionId);
  }

  /** Test helper */
  __dump(): Map<string, { value: StoredRecord; expiresAt: number }> {
    return this.records;
  }
}

class RedisPhoTestStore implements PhoTestStore {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async getState(sessionId: string): Promise<PhoTestState> {
    const raw = await this.redis.get<StoredRecord | string>(
      phoTestRedisKey(sessionId),
    );
    const parsed =
      typeof raw === "string" ? parseStored(JSON.parse(raw)) : parseStored(raw);
    return {
      command: parsed.command,
      acknowledgement: parsed.acknowledgement,
    };
  }

  async issueCommand(
    sessionId: string,
    action: PhoTestAction,
  ): Promise<PhoTestCommand> {
    const key = phoTestRedisKey(sessionId);
    const currentRaw = await this.redis.get<StoredRecord | string>(key);
    const current =
      typeof currentRaw === "string"
        ? parseStored(JSON.parse(currentRaw))
        : parseStored(currentRaw);
    const revision = (current.command?.revision ?? 0) + 1;
    const command: PhoTestCommand = {
      sessionId,
      action,
      revision,
      issuedAt: new Date().toISOString(),
    };
    const next: StoredRecord = { command, acknowledgement: null };
    await this.redis.set(key, next, { ex: PHO_TEST_TTL_SECONDS });
    return command;
  }

  async acknowledge(input: {
    sessionId: string;
    revision: number;
    resultingPhase: CallResultPhase;
    clientId: string;
  }): Promise<
    | { ok: true; acknowledgement: PhoTestAcknowledgement }
    | { ok: false; reason: "missing" | "stale" | "future" }
  > {
    const key = phoTestRedisKey(input.sessionId);
    const currentRaw = await this.redis.get<StoredRecord | string>(key);
    const current =
      typeof currentRaw === "string"
        ? parseStored(JSON.parse(currentRaw))
        : parseStored(currentRaw);
    if (!current.command) {
      return { ok: false, reason: "missing" };
    }
    if (input.revision < current.command.revision) {
      return { ok: false, reason: "stale" };
    }
    if (input.revision > current.command.revision) {
      return { ok: false, reason: "future" };
    }
    const acknowledgement: PhoTestAcknowledgement = {
      revision: input.revision,
      appliedAt: new Date().toISOString(),
      resultingPhase: input.resultingPhase,
      clientId: input.clientId,
    };
    await this.redis.set(
      key,
      { command: current.command, acknowledgement },
      { ex: PHO_TEST_TTL_SECONDS },
    );
    return { ok: true, acknowledgement };
  }

  async clear(sessionId: string): Promise<void> {
    await this.redis.del(phoTestRedisKey(sessionId));
  }
}

let memorySingleton: MemoryPhoTestStore | null = null;
let redisSingleton: PhoTestStore | null = null;

export function createMemoryPhoTestStore(): MemoryPhoTestStore {
  return new MemoryPhoTestStore();
}

export function getPhoTestStore(): PhoTestStore {
  if (process.env.PHO_TEST_USE_MEMORY_STORE === "true") {
    if (!memorySingleton) {
      memorySingleton = new MemoryPhoTestStore();
    }
    return memorySingleton;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!memorySingleton) {
      memorySingleton = new MemoryPhoTestStore();
    }
    return memorySingleton;
  }

  if (!redisSingleton) {
    redisSingleton = new RedisPhoTestStore(Redis.fromEnv());
  }
  return redisSingleton;
}

export function __resetPhoTestStoreForTests(): void {
  memorySingleton = createMemoryPhoTestStore();
  redisSingleton = null;
  process.env.PHO_TEST_USE_MEMORY_STORE = "true";
}

export { emptyState };
