interface CaptureToastProps {
  message?: string;
  visible: boolean;
}

export function CaptureToast({
  message = "You took a FaceTime photo.",
  visible,
}: CaptureToastProps) {
  return (
    <div
      className={`capture-toast liquidGL ${visible ? "is-visible" : ""}`}
      role="status"
      aria-live="polite"
      data-testid="capture-toast"
      hidden={!visible}
    >
      <span className="content">{message}</span>
    </div>
  );
}

export function CaptureFlash({ active }: { active: boolean }) {
  return (
    <div
      className={`capture-flash ${active ? "is-active" : ""}`}
      aria-hidden
      data-testid="capture-flash"
    />
  );
}
