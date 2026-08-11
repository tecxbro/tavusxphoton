interface CameraActivationFallbackProps {
  onStart: () => void;
}

/**
 * One-time gesture fallback when auto media access requires a user tap.
 *
 * @param props.onStart - Resume call bootstrap after the gesture.
 */
export function CameraActivationFallback({
  onStart,
}: CameraActivationFallbackProps) {
  return (
    <section className="camera-activation" data-testid="camera-activation">
      <h1 className="camera-activation__title">Start camera</h1>
      <p className="camera-activation__body">
        Allow camera and microphone access to join the call.
      </p>
      <button
        type="button"
        className="btn btn--primary"
        onClick={onStart}
        data-testid="start-camera"
      >
        Start camera
      </button>
    </section>
  );
}
