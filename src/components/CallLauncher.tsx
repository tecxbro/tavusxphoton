interface CallLauncherProps {
  onCall: () => void;
  starting?: boolean;
}

export function CallLauncher({ onCall, starting = false }: CallLauncherProps) {
  return (
    <main className="call-launcher" data-testid="call-launcher">
      <h1 className="call-launcher__title">Talk to Gary</h1>
      <button
        type="button"
        className="call-launcher__call"
        onClick={onCall}
        disabled={starting}
        data-testid="call-button"
      >
        Call
      </button>
    </main>
  );
}
