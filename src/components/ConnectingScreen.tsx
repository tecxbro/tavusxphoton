interface ConnectingScreenProps {
  message?: string;
}

export function ConnectingScreen({
  message = "Starting camera…",
}: ConnectingScreenProps) {
  return (
    <div className="connecting-banner" data-testid="connecting">
      <div className="connecting-banner__chip" role="status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}
