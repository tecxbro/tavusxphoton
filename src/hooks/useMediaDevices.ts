import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraFacing } from "../lib/callState";
export type FlipBeforeAttach = (
  track: MediaStreamTrack,
) => void | Promise<void>;

export type CameraFlipResult =
  | { status: "switched" }
  | {
      status: "noop";
      reason: "no-second-camera" | "same-camera";
    }
  | {
      status: "failed";
      error: Error;
    };

export interface MediaDevicesState {
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  facingMode: CameraFacing;
  /** Fatal media / permission acquisition error only. */
  error: string | null;
  /** Recoverable camera-action (flip) failure; never fatal to the call. */
  cameraActionError: string | null;
  requesting: boolean;
  isFlippingCamera: boolean;
  requestPermissions: () => Promise<MediaStream | null>;
  toggleVideo: () => boolean;
  toggleAudio: () => boolean;
  setAudioEnabled: (enabled: boolean) => void;
  flipCamera: (
    replaceVideoTrack?: FlipBeforeAttach,
  ) => Promise<CameraFlipResult>;
  stopAll: () => void;
}

type CameraIdentity = {
  deviceId: string | null;
  groupId: string | null;
  facingMode: CameraFacing | null;
};

function readTrackSettings(
  track: MediaStreamTrack,
): MediaTrackSettings {
  try {
    return track.getSettings?.() ?? {};
  } catch {
    return {};
  }
}

function identityFromTrack(track: MediaStreamTrack): CameraIdentity {
  const settings = readTrackSettings(track);
  const facing = settings.facingMode;
  return {
    deviceId: settings.deviceId || null,
    groupId: settings.groupId || null,
    facingMode:
      facing === "user" || facing === "environment" ? facing : null,
  };
}

/**
 * Same physical camera when both expose nonempty deviceId and they match;
 * otherwise matching groupId + facingMode. FacingMode alone is not enough.
 */
export function isSameCamera(
  current: MediaStreamTrack,
  replacement: MediaStreamTrack,
): boolean {
  const a = identityFromTrack(current);
  const b = identityFromTrack(replacement);

  if (a.deviceId && b.deviceId) {
    return a.deviceId === b.deviceId;
  }

  if (a.groupId && b.groupId && a.facingMode && b.facingMode) {
    return a.groupId === b.groupId && a.facingMode === b.facingMode;
  }

  return false;
}

function toError(err: unknown, fallback: string): Error {
  return err instanceof Error ? err : new Error(fallback);
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

async function listVideoInputDeviceIds(): Promise<string[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "videoinput" && device.deviceId)
    .map((device) => device.deviceId);
}

async function acquireReplacementVideoTrack(
  nextFacing: CameraFacing,
  currentDeviceId: string | null,
): Promise<
  | { status: "track"; track: MediaStreamTrack }
  | { status: "noop"; reason: "no-second-camera" }
> {
  const deviceIds = await listVideoInputDeviceIds();

  // Known single-camera device list → nonfatal no-op (skip getUserMedia).
  if (deviceIds.length === 1) {
    return { status: "noop", reason: "no-second-camera" };
  }

  const alternateDeviceId =
    deviceIds.length >= 2
      ? (deviceIds.find((id) => id !== currentDeviceId) ?? null)
      : null;

  const constraints: MediaTrackConstraints = alternateDeviceId
    ? { deviceId: { exact: alternateDeviceId } }
    : { facingMode: nextFacing };

  let replacement: MediaStream;
  try {
    replacement = await navigator.mediaDevices.getUserMedia({
      video: constraints,
      audio: false,
    });
  } catch (err) {
    // FacingMode-only fallback when exact deviceId fails (common on desktop).
    if (alternateDeviceId) {
      replacement = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
        audio: false,
      });
    } else {
      throw err;
    }
  }

  const track = replacement.getVideoTracks()[0];
  if (!track) {
    replacement.getTracks().forEach((t) => t.stop());
    throw new Error("Replacement camera did not provide a video track");
  }

  // Stop any extra tracks from the temporary stream; we own `track`.
  replacement.getTracks().forEach((t) => {
    if (t !== track) t.stop();
  });

  return { status: "track", track };
}

/**
 * Browser local camera/mic ownership for call screens.
 *
 * @returns Stream, toggles, flip transaction, and fatal vs recoverable errors.
 */
export function useMediaDevices(): MediaDevicesState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<CameraFacing>("user");
  const [error, setError] = useState<string | null>(null);
  const [cameraActionError, setCameraActionError] = useState<string | null>(
    null,
  );
  const [requesting, setRequesting] = useState(false);
  const [isFlippingCamera, setIsFlippingCamera] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  // Invalidates overlapping getUserMedia / stopAll work so a superseded
  // permission grant cannot attach after the caller moved on.
  const requestGeneration = useRef(0);
  // Coalesce concurrent requestPermissions callers onto one in-flight promise.
  const requestInFlight = useRef<Promise<MediaStream | null> | null>(null);
  // Camera flip generation + single-flight — late replacements after stopAll
  // / unmount must not attach, and rapid Flip presses share one promise.
  const flipGenerationRef = useRef(0);
  const flipInFlightRef = useRef<Promise<CameraFlipResult> | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);
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

  const commitSelectedDevice = useCallback((track: MediaStreamTrack) => {
    selectedDeviceIdRef.current = identityFromTrack(track).deviceId;
  }, []);

  const requestPermissions = useCallback(async () => {
    if (requestInFlight.current) {
      return requestInFlight.current;
    }

    setRequesting(true);
    setError(null);
    setCameraActionError(null);
    const generation = ++requestGeneration.current;

    const pending = (async (): Promise<MediaStream | null> => {
      try {
        const media = await getMedia("user", true);
        if (!media) {
          if (generation !== requestGeneration.current) return null;
          setError("Permission denied");
          return null;
        }
        if (generation !== requestGeneration.current) {
          media.getTracks().forEach((track) => track.stop());
          return null;
        }
        stopTracks(streamRef.current);
        attachStream(media);
        const video = media.getVideoTracks()[0];
        if (video) commitSelectedDevice(video);
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
  }, [attachStream, commitSelectedDevice, stopTracks]);

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
    (replaceVideoTrack?: FlipBeforeAttach): Promise<CameraFlipResult> => {
      // Reject duplicate flips while one is already running (share in-flight).
      if (flipInFlightRef.current) {
        return flipInFlightRef.current;
      }

      const current = streamRef.current;
      if (!current) {
        return Promise.resolve({
          status: "failed",
          error: new Error("No local stream"),
        });
      }

      const oldVideo = current.getVideoTracks()[0];
      if (!oldVideo) {
        return Promise.resolve({
          status: "failed",
          error: new Error("No local video track"),
        });
      }

      const generation = ++flipGenerationRef.current;
      const retainedFacing = facingModeRef.current;
      const retainedDeviceId =
        selectedDeviceIdRef.current ?? identityFromTrack(oldVideo).deviceId;
      const nextFacing: CameraFacing =
        retainedFacing === "user" ? "environment" : "user";

      setIsFlippingCamera(true);
      setCameraActionError(null);

      const pending = (async (): Promise<CameraFlipResult> => {
        let replacementTrack: MediaStreamTrack | null = null;
        try {
          // Retain current stream / track / facing / selected identity.
          // Find or request an alternate camera; acquire one replacement track.
          const acquired = await acquireReplacementVideoTrack(
            nextFacing,
            retainedDeviceId,
          );

          if (generation !== flipGenerationRef.current) {
            if (acquired.status === "track") {
              acquired.track.stop();
            }
            return {
              status: "failed",
              error: new Error("Camera flip superseded"),
            };
          }

          if (acquired.status === "noop") {
            return acquired;
          }

          replacementTrack = acquired.track;
          replacementTrack.enabled = videoEnabledRef.current;

          // Same-camera detection before touching Daily / local preview.
          if (isSameCamera(oldVideo, replacementTrack)) {
            replacementTrack.stop();
            replacementTrack = null;
            return { status: "noop", reason: "same-camera" };
          }

          // Candidate preview stream — do not mutate or stop the old stream yet.
          const audioTracks = current.getAudioTracks();
          const candidate = new MediaStream([
            replacementTrack,
            ...audioTracks,
          ]);

          // Pass that exact replacement track to Daily; wait for success.
          if (replaceVideoTrack) {
            await replaceVideoTrack(replacementTrack);
          }

          if (generation !== flipGenerationRef.current) {
            replacementTrack.stop();
            replacementTrack = null;
            return {
              status: "failed",
              error: new Error("Camera flip superseded"),
            };
          }

          // Daily accepted — commit local preview.
          try {
            attachStream(candidate);
            commitSelectedDevice(replacementTrack);
            setFacingMode(
              identityFromTrack(replacementTrack).facingMode ?? nextFacing,
            );
            setVideoEnabled(replacementTrack.enabled);
            oldVideo.stop();
            replacementTrack = null;
            return { status: "switched" };
          } catch (commitErr) {
            // Preview commit failed after Daily accepted — attempt rollback.
            const commitError = toError(
              commitErr,
              "Unable to update local camera preview",
            );
            try {
              if (replaceVideoTrack) {
                await replaceVideoTrack(oldVideo);
              }
              replacementTrack.stop();
              replacementTrack = null;
              // Retain old local stream / facing / selected identity.
              setCameraActionError(commitError.message);
              return { status: "failed", error: commitError };
            } catch {
              // Rollback failed — keep replacement as Daily-owned track;
              // retain candidate for the preview’s next committed update.
              try {
                attachStream(candidate);
                commitSelectedDevice(replacementTrack);
                setFacingMode(
                  identityFromTrack(replacementTrack).facingMode ??
                    nextFacing,
                );
                setVideoEnabled(replacementTrack.enabled);
              } catch {
                // Last resort: stop tracks that no longer have an owner.
                replacementTrack.stop();
              }
              oldVideo.stop();
              replacementTrack = null;
              setCameraActionError(commitError.message);
              return { status: "failed", error: commitError };
            }
          }
        } catch (err) {
          replacementTrack?.stop();
          replacementTrack = null;
          if (generation !== flipGenerationRef.current) {
            return {
              status: "failed",
              error: new Error("Camera flip superseded"),
            };
          }
          // Daily rejection / acquisition failure — retain old everything.
          const actionError = toError(err, "Unable to flip camera");
          setCameraActionError(actionError.message);
          return { status: "failed", error: actionError };
        } finally {
          if (flipInFlightRef.current === pending) {
            flipInFlightRef.current = null;
            setIsFlippingCamera(false);
          }
        }
      })();

      flipInFlightRef.current = pending;
      return pending;
    },
    [attachStream, commitSelectedDevice],
  );

  const stopAll = useCallback(() => {
    requestGeneration.current += 1;
    // Invalidate in-flight flips so late replacement tracks cannot attach.
    flipGenerationRef.current += 1;
    flipInFlightRef.current = null;
    setIsFlippingCamera(false);
    selectedDeviceIdRef.current = null;
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
    cameraActionError,
    requesting,
    isFlippingCamera,
    requestPermissions,
    toggleVideo,
    toggleAudio,
    setAudioEnabled: setAudio,
    flipCamera,
    stopAll,
  };
}
