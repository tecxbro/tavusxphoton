import { useEffect, useRef, type RefObject } from "react";

type VideoFrameCallback = (
  now: number,
  metadata: { width: number; height: number },
) => void;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Fires once when the video has a decoded frame ready to present.
 * Prefer `requestVideoFrameCallback`; fall back to `loadeddata` + `readyState`.
 *
 * @param videoRef - Target `<video>` element.
 * @param enabled - When false, resets and does not fire.
 * @param onFirstFrame - Invoked once per enabled cycle.
 */
export function useFirstVideoFrame(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onFirstFrame: () => void,
): void {
  const fired = useRef(false);
  const callback = useRef(onFirstFrame);
  callback.current = onFirstFrame;

  useEffect(() => {
    fired.current = false;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current as VideoWithFrameCallback | null;
    if (!video) return;

    const fire = () => {
      if (fired.current) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
      fired.current = true;
      callback.current();
    };

    let frameHandle: number | null = null;
    const onLoaded = () => fire();

    if (typeof video.requestVideoFrameCallback === "function") {
      frameHandle = video.requestVideoFrameCallback(() => fire());
    }

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("canplay", onLoaded);
    fire();

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("canplay", onLoaded);
      if (
        frameHandle != null &&
        typeof video.cancelVideoFrameCallback === "function"
      ) {
        video.cancelVideoFrameCallback(frameHandle);
      }
    };
  }, [enabled, videoRef]);
}
