import { useEffect, useRef, useState } from "react";
import {
  createPhoControllerChannel,
  type PhoControllerChannel,
} from "../lib/phoControllerChannel";

const channelSupported =
  typeof BroadcastChannel !== "undefined";

export function PhoController() {
  const channelRef = useRef<PhoControllerChannel | null>(null);
  const [status, setStatus] = useState("Waiting");

  useEffect(() => {
    const channel = createPhoControllerChannel();
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  return (
    <main className="pho-controller" data-testid="pho-controller">
      <h1 className="pho-controller__title">Pho Test Controller</h1>
      <p
        className="pho-controller__status"
        data-testid="pho-controller-status"
      >
        Status: {status}
      </p>
      {!channelSupported ? (
        <p className="pho-controller__unsupported">
          BroadcastChannel is unavailable in this browser
        </p>
      ) : null}
      <div className="pho-controller__actions">
        <button
          type="button"
          className="pho-controller__btn pho-controller__btn--answer"
          data-testid="pho-answer"
          disabled={!channelSupported}
          onClick={() => {
            channelRef.current?.post("answer");
            setStatus("Answer sent");
          }}
        >
          Pick Up Call
        </button>
        <button
          type="button"
          className="pho-controller__btn pho-controller__btn--end"
          data-testid="pho-end"
          disabled={!channelSupported}
          onClick={() => {
            channelRef.current?.post("end");
            setStatus("End sent");
          }}
        >
          End Call
        </button>
        <button
          type="button"
          className="pho-controller__btn pho-controller__btn--reset"
          data-testid="pho-reset"
          disabled={!channelSupported}
          onClick={() => {
            channelRef.current?.post("reset");
            setStatus("Reset sent");
          }}
        >
          Reset Test
        </button>
      </div>
    </main>
  );
}
