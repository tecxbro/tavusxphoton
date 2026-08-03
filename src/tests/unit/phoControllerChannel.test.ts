import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PHO_CONTROLLER_CHANNEL,
  createPhoControllerChannel,
} from "../../lib/phoControllerChannel";

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  readonly name: string;
  readonly postMessage = vi.fn();
  readonly close = vi.fn();
  private listeners = new Set<(event: MessageEvent) => void>();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.delete(listener);
  }

  emit(data: unknown) {
    const event = { data } as MessageEvent;
    this.listeners.forEach((listener) => listener(event));
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

describe("createPhoControllerChannel", () => {
  afterEach(() => {
    FakeBroadcastChannel.instances = [];
    vi.unstubAllGlobals();
  });

  it("delivers valid messages and ignores malformed ones", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const onMessage = vi.fn();
    const channel = createPhoControllerChannel(onMessage);
    const fake = FakeBroadcastChannel.instances[0];

    expect(fake.name).toBe(PHO_CONTROLLER_CHANNEL);

    fake.emit({ type: "answer", sentAt: 123 });
    fake.emit({ type: "nope", sentAt: 123 });
    fake.emit({ type: "end" });
    fake.emit(null);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ type: "answer", sentAt: 123 });

    channel.close();
  });

  it("posts answer with a numeric timestamp", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const channel = createPhoControllerChannel();
    const fake = FakeBroadcastChannel.instances[0];

    channel.post("answer");

    expect(fake.postMessage).toHaveBeenCalledTimes(1);
    const payload = fake.postMessage.mock.calls[0][0] as {
      type: string;
      sentAt: number;
    };
    expect(payload.type).toBe("answer");
    expect(typeof payload.sentAt).toBe("number");
  });

  it("removes the listener and closes the channel", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const onMessage = vi.fn();
    const channel = createPhoControllerChannel(onMessage);
    const fake = FakeBroadcastChannel.instances[0];

    expect(fake.listenerCount).toBe(1);
    channel.close();
    expect(fake.listenerCount).toBe(0);
    expect(fake.close).toHaveBeenCalledTimes(1);
  });
});
