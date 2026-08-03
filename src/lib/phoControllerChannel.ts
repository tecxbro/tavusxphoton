export type PhoControllerMessageType = "answer" | "end" | "reset";

export interface PhoControllerMessage {
  type: PhoControllerMessageType;
  sentAt: number;
}

export const PHO_CONTROLLER_CHANNEL = "mini-pho-test-call";

export interface PhoControllerChannel {
  post: (type: PhoControllerMessageType) => void;
  close: () => void;
}

function isPhoControllerMessage(value: unknown): value is PhoControllerMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PhoControllerMessage>;
  return (
    (candidate.type === "answer" ||
      candidate.type === "end" ||
      candidate.type === "reset") &&
    typeof candidate.sentAt === "number"
  );
}

export function createPhoControllerChannel(
  onMessage?: (message: PhoControllerMessage) => void,
): PhoControllerChannel {
  if (typeof BroadcastChannel === "undefined") {
    return {
      post: () => undefined,
      close: () => undefined,
    };
  }

  const channel = new BroadcastChannel(PHO_CONTROLLER_CHANNEL);
  const listener = (event: MessageEvent) => {
    if (!onMessage) return;
    if (!isPhoControllerMessage(event.data)) return;
    onMessage(event.data);
  };

  if (onMessage) {
    channel.addEventListener("message", listener);
  }

  return {
    post: (type) => {
      channel.postMessage({ type, sentAt: Date.now() } satisfies PhoControllerMessage);
    },
    close: () => {
      if (onMessage) {
        channel.removeEventListener("message", listener);
      }
      channel.close();
    },
  };
}
