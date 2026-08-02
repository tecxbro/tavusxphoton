interface EndedScreenProps {
  duration: string;
  onCallAgain: () => void;
  onClose: () => void;
}

export function EndedScreen({
  duration,
  onCallAgain,
  onClose,
}: EndedScreenProps) {
  return (
    <section className="ended" data-testid="ended">
      <div className="ended__icon" aria-hidden />
      <h1 className="ended__title">Call Ended</h1>
      <p className="ended__duration" data-testid="call-duration">
        {duration}
      </p>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onCallAgain}
          data-testid="call-again"
        >
          Call Again
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onClose}
          data-testid="close-ended"
        >
          Close
        </button>
      </div>
    </section>
  );
}
