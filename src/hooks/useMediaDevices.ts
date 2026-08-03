import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraFacing } from "../lib/callState";

export interface MediaDevicesState {
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  facingMode: CameraFacing;
  error: string | null;
  requesting: boolean;
  requestPermissions: () => Promise<MediaStream | null>;
  toggleVideo: () => boolean;
  toggleAudio: () => boolean;
  setAudioEnabled: (enabled: boolean) => void;
  flipCamera: () => Promise<CameraFacing | null>;
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
  const streamRef = useRef<MediaStream | null>(null);
  // Invalidates overlapping getUserMedia / stopAll work so a superseded
  // permission grant cannot attach after the caller moved on.
  const requestGeneration = useRef(0);
  // Coalesce concurrent requestPermissions callers onto one in-flight promise.
  const requestInFlight = useRef<Promise<MediaStream | null> | null>(null);

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

  const flipCamera = useCallback(async () => {
    const current = streamRef.current;
    if (!current) return null;

    const nextFacing: CameraFacing =
      facingMode === "user" ? "environment" : "user";

    try {
      // Replace video only; keep existing audio tracks so mute state survives.
      const replacement = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
        audio: false,
      });

      const newVideo = replacement.getVideoTracks()[0];
      if (!newVideo) {
        replacement.getTracks().forEach((track) => track.stop());
        throw new Error("Replacement camera did not provide a video track");
      }

      newVideo.enabled = videoEnabled;
      const oldVideo = current.getVideoTracks()[0];
      const audioTracks = current.getAudioTracks();
      const combined = new MediaStream([newVideo, ...audioTracks]);

      // Stop the old track only after the new stream is attached so preview
      // never goes black on a failed flip mid-swap.
      attachStream(combined);
      setFacingMode(nextFacing);
      setVideoEnabled(newVideo.enabled);
      oldVideo?.stop();

      return nextFacing;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to flip camera");
      return null;
    }
  }, [attachStream, facingMode, videoEnabled]);

  const stopAll = useCallback(() => {
    requestGeneration.current += 1;
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, [stopTracks]);

  useEffect(() => {
    return () => {
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
    requestPermissions,
    toggleVideo,
    toggleAudio,
    setAudioEnabled: setAudio,
    flipCamera,
    stopAll,
  };
}
