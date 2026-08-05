import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraFacing } from "../lib/callState";

export type FlipBeforeAttach = (
  track: MediaStreamTrack,
) => void | Promise<void>;

export interface MediaDevicesState {
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  facingMode: CameraFacing;
  error: string | null;
  requesting: boolean;
  flippingCamera: boolean;
  requestPermissions: () => Promise<MediaStream | null>;
  toggleVideo: () => boolean;
  toggleAudio: () => boolean;
  setAudioEnabled: (enabled: boolean) => void;
  flipCamera: (
    beforeAttach?: FlipBeforeAttach,
  ) => Promise<CameraFacing | null>;
  stopAll: () => void;
}

async function getMedia(
  facingMode: CameraFacing,
  withAudio: boolean,
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode },
    audio: withAudio,
  });
}

export function useMediaDevices(): MediaDevicesState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<CameraFacing>("user");
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [flippingCamera, setFlippingCamera] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  // Invalidates overlapping getUserMedia / stopAll work so a superseded
  // permission grant cannot attach after the caller moved on.
  const requestGeneration = useRef(0);
  // Coalesce concurrent requestPermissions callers onto one in-flight promise.
  const requestInFlight = useRef<Promise<MediaStream | null> | null>(null);
  // Camera flip generation + single-flight — late replacements after stopAll
  // / unmount must not attach, and rapid Flip presses share one promise.
  const flipGenerationRef = useRef(0);
  const flipInFlightRef = useRef<Promise<CameraFacing | null> | null>(null);
  const videoEnabledRef = useRef(videoEnabled);
  const facingModeRef = useRef(facingMode);

  videoEnabledRef.current = videoEnabled;
  facingModeRef.current = facingMode;

  const attachStream = useCallback((next: MediaStream) => {
    streamRef.current = next;
    setStream(next);
  }, []);

  const stopTracks = useCallback((target: MediaStream | null) => {
    target?.getTracks().forEach((track) => track.stop());
  }, []);

  const requestPermissions = useCallback(async () => {
    if (requestInFlight.current) {
      return requestInFlight.current;
    }

    setRequesting(true);
    setError(null);
    const generation = ++requestGeneration.current;

    const pending = (async (): Promise<MediaStream | null> => {
      try {
        const media = await getMedia("user", true);
        if (generation !== requestGeneration.current) {
          media.getTracks().forEach((track) => track.stop());
          return null;
        }
        stopTracks(streamRef.current);
        attachStream(media);
        setFacingMode("user");
        setVideoEnabled(true);
        setAudioEnabled(true);
        return media;
      } catch (err) {
        if (generation !== requestGeneration.current) {
          return null;
        }
        const message =
          err instanceof Error ? err.message : "Permission denied";
        setError(message);
        return null;
      } finally {
        if (requestInFlight.current === pending) {
          requestInFlight.current = null;
          setRequesting(false);
        }
      }
    })();

    requestInFlight.current = pending;
    return pending;
  }, [attachStream, stopTracks]);

  const toggleVideo = useCallback(() => {
    const current = streamRef.current;
    if (!current) return false;
    const track = current.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
    return track.enabled;
  }, []);

  const toggleAudio = useCallback(() => {
    const current = streamRef.current;
    if (!current) return false;
    const track = current.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
    return track.enabled;
  }, []);

  const setAudio = useCallback((enabled: boolean) => {
    const current = streamRef.current;
    if (!current) return;
    const track = current.getAudioTracks()[0];
    if (!track) return;
    track.enabled = enabled;
    setAudioEnabled(enabled);
  }, []);

  const flipCamera = useCallback(
    (beforeAttach?: FlipBeforeAttach): Promise<CameraFacing | null> => {
      if (flipInFlightRef.current) {
        return flipInFlightRef.current;
      }

      const current = streamRef.current;
      if (!current) return Promise.resolve(null);

      const generation = ++flipGenerationRef.current;
      const nextFacing: CameraFacing =
        facingModeRef.current === "user" ? "environment" : "user";

      setFlippingCamera(true);

      const pending = (async (): Promise<CameraFacing | null> => {
        let replacementTrack: MediaStreamTrack | null = null;
        try {
          // 1. Request the new video track.
          const replacement = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: nextFacing },
            audio: false,
          });

          const newVideo = replacement.getVideoTracks()[0];
          if (!newVideo) {
            replacement.getTracks().forEach((track) => track.stop());
            throw new Error("Replacement camera did not provide a video track");
          }
          replacementTrack = newVideo;

          // 2. Confirm the generation is current.
          if (generation !== flipGenerationRef.current) {
            newVideo.stop();
            return null;
          }

          newVideo.enabled = videoEnabledRef.current;

          // 3. Pass that exact track to Daily (optional caller hook).
          if (beforeAttach) {
            await beforeAttach(newVideo);
          }

          // 4. Confirm the generation again.
          if (generation !== flipGenerationRef.current) {
            newVideo.stop();
            return null;
          }

          const oldVideo = current.getVideoTracks()[0];
          const audioTracks = current.getAudioTracks();
          const combined = new MediaStream([newVideo, ...audioTracks]);

          // 5–7. Attach new stream, preserve audio, stop old video.
          attachStream(combined);
          oldVideo?.stop();

          // 8–9. Update facing and clear prior camera errors.
          setFacingMode(nextFacing);
          setVideoEnabled(newVideo.enabled);
          setError(null);
          replacementTrack = null;

          return nextFacing;
        } catch (err) {
          replacementTrack?.stop();
          if (generation === flipGenerationRef.current) {
            setError(
              err instanceof Error ? err.message : "Unable to flip camera",
            );
          }
          return null;
        } finally {
          if (flipInFlightRef.current === pending) {
            flipInFlightRef.current = null;
            setFlippingCamera(false);
          }
        }
      })();

      flipInFlightRef.current = pending;
      return pending;
    },
    [attachStream],
  );

  const stopAll = useCallback(() => {
    requestGeneration.current += 1;
    // Invalidate in-flight flips so late replacement tracks cannot attach.
    flipGenerationRef.current += 1;
    flipInFlightRef.current = null;
    setFlippingCamera(false);
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, [stopTracks]);

  useEffect(() => {
    return () => {
      flipGenerationRef.current += 1;
      flipInFlightRef.current = null;
      stopTracks(streamRef.current);
      streamRef.current = null;
    };
  }, [stopTracks]);

  return {
    stream,
    videoEnabled,
    audioEnabled,
    facingMode,
    error,
    requesting,
    flippingCamera,
    requestPermissions,
    toggleVideo,
    toggleAudio,
    setAudioEnabled: setAudio,
    flipCamera,
    stopAll,
  };
}
