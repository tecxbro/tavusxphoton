import { useState } from "react";
import { Link } from "react-router-dom";

const GARRY_AVATAR = "/avatars/agents/garry-tan.webp";
const CALL_DEMO_PATH = "/call/demo";

/**
 * Compact Live Mini App decision surface for an incoming Garry FaceTime.
 * Does not request camera or microphone — media starts only after Accept
 * navigates to `/call/demo`.
 *
 * Accept uses a real document navigation (`reloadDocument`) so the Spectrum
 * Mini App Hub can promote the live transcript card into the expanded sheet.
 * Photon does not document a browser API for forcing `.expanded`.
 */
export function IncomingCallCard() {
  const [declined, setDeclined] = useState(false);

  return (
    <main
      className="incoming-call-card"
      data-testid="incoming-call-card"
      data-state={declined ? "declined" : "incoming"}
    >
      <img
        className="incoming-call-card__avatar"
        src={GARRY_AVATAR}
        alt=""
        width={64}
        height={64}
      />
      <h1 className="incoming-call-card__name">Garry Tan</h1>
      {declined ? (
        <p className="incoming-call-card__status">Call Declined</p>
      ) : (
        <>
          <p className="incoming-call-card__status">FaceTime Video…</p>
          <div className="incoming-call-card__actions">
            <button
              type="button"
              className="incoming-call-card__btn incoming-call-card__btn--decline"
              onClick={() => setDeclined(true)}
              data-testid="incoming-decline"
            >
              Decline
            </button>
            <Link
              className="incoming-call-card__btn incoming-call-card__btn--accept"
              to={CALL_DEMO_PATH}
              reloadDocument
              data-testid="incoming-accept"
            >
              Accept
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
