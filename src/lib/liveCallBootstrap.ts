/**
 * Home → live CallScreen handoff: warm getUserMedia inside the tap handler so
 * user activation is preserved across the SPA navigate to CallScreen.
 */

let warmedMedia: Promise<MediaStream | null> | null = null;

function getMediaFromGesture(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: true,
  });
}

/** Call synchronously from the Home live-agent click handler. */
export function armLiveCallFromGesture(): void {
  if (!warmedMedia) {
    warmedMedia = getMediaFromGesture().catch(() => null);
  }
}

/**
 * Take the gesture-warmed media promise (if any). useMediaDevices adopts it so
 * CallScreen does not open a second getUserMedia after navigation.
 */
export function takeWarmedLocalMedia(): Promise<MediaStream | null> | null {
  const pending = warmedMedia;
  warmedMedia = null;
  return pending;
}

/** Test helper. */
export function resetLiveCallBootstrap(): void {
  warmedMedia = null;
}
