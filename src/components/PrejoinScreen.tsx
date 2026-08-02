interface PrejoinScreenProps {
  name: string;
  avatar: string;
  onStart: () => void;
  onCancel: () => void;
}

export function PrejoinScreen({
  name,
  avatar,
  onStart,
  onCancel,
}: PrejoinScreenProps) {
  return (
    <section className="prejoin" data-testid="prejoin">
      <img
        className="prejoin__avatar"
        src={avatar}
        alt=""
        width={96}
        height={96}
      />
      <h1 className="prejoin__title">{name}</h1>
      <p className="prejoin__subtitle">Video call with {name}</p>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onStart}
          data-testid="start-call"
        >
          Start Call
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onCancel}
          data-testid="not-now"
        >
          Not Now
        </button>
      </div>
    </section>
  );
}
