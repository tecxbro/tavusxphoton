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

  const attachStream = useCallback((next: MediaStream) => {
    streamRef.current = next;
    setStream(next);
  }, []);

  const stopTracks = useCallback((target: MediaStream | null) => {
    target?.getTracks().forEach((track) => track.stop());
  }, []);

  const requestPermissions = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      const media = await getMedia("user", true);
      stopTracks(streamRef.current);
      attachStream(media);
      setFacingMode("user");
      setVideoEnabled(true);
      setAudioEnabled(true);
      return media;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Permission denied";
      setError(message);
      return null;
    } finally {
      setRequesting(false);
    }
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
    const audioTrack = current.getAudioTracks()[0];
    const oldVideo = current.getVideoTracks()[0];
    oldVideo?.stop();

    try {
      const videoOnly = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
        audio: false,
      });
      const newVideo = videoOnly.getVideoTracks()[0];
      const tracks: MediaStreamTrack[] = [];
      if (newVideo) tracks.push(newVideo);
      if (audioTrack) tracks.push(audioTrack);
      const combined = new MediaStream(tracks);
      attachStream(combined);
      setFacingMode(nextFacing);
      setVideoEnabled(Boolean(newVideo?.enabled));
      return nextFacing;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to flip camera";
      setError(message);
      return null;
    }
  }, [attachStream, facingMode]);

  const stopAll = useCallback(() => {
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, [stopTracks]);

  useEffect(() => {
    return () => {
      stopTracks(streamRef.current);
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
