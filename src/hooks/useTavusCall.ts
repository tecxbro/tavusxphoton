import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, {
  type DailyCall,
  type DailyEventObjectParticipant,
  type DailyEventObjectParticipantLeft,
  type DailyEventObjectTrack,
  type DailyParticipant,
} from "@daily-co/daily-js";
import type { CameraFacing } from "../lib/callState";
import {
  createTavusConversation,
  endTavusConversation,
} from "../lib/tavus/tavus-client";
import {
  useMediaDevices,
  type CameraFlipResult,
  type FlipBeforeAttach,
} from "./useMediaDevices";

export interface UseTavusCallResult {
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  resetCall: () => Promise<void>;
  localStream: MediaStream | null;
  remoteVideoStream: MediaStream | null;
  remoteAudioStream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  facingMode: CameraFacing;
  isFlippingCamera: boolean;
  toggleVideo: () => boolean;
  toggleAudio: () => boolean;
  /** Pass the exact acquired track to Daily. Does not stop tracks. */
  replaceVideoTrack: (track: MediaStreamTrack) => Promise<void>;
  /**
   * Runs the media-owned flip transaction. CallScreen may supply
   * `replaceVideoTrack`; defaults to the Daily attachment from this hook.
   */
  flipCamera: (
    replaceVideoTrack?: FlipBeforeAttach,
  ) => Promise<CameraFlipResult>;
  palJoined: boolean;
  /** Fatal connection / permission / Daily errors only. */
  error: string | null;
  /** Recoverable camera-action failures; must not end the call. */
  cameraActionError: string | null;
  starting: boolean;
}

type DailyHandlers = {
  onParticipantJoined: (event: DailyEventObjectParticipant) => void;
  onParticipantUpdated: (event: DailyEventObjectParticipant) => void;
  onParticipantLeft: (event: DailyEventObjectParticipantLeft) => void;
  onTrackStarted: (event: DailyEventObjectTrack) => void;
  onTrackStopped: (event: DailyEventObjectTrack) => void;
  onDailyError: (event: { errorMsg?: string } | undefined) => void;
  onLeftMeeting: () => void;
};

function trackFromParticipant(
  participant: DailyParticipant,
  kind: "video" | "audio",
): MediaStreamTrack | null {
  const trackState = participant.tracks[kind];
  if (!trackState) return null;
  if (trackState.state !== "playable" && trackState.state !== "loading") {
    return null;
  }
  return trackState.persistentTrack ?? trackState.track ?? null;
}

function isRemoteParticipant(participant: DailyParticipant): boolean {
  return !participant.local;
}

/**
 * Serialize Daily leave/destroy so Strict Mode remount (autoStart) cannot
 * createCallObject while a previous instance is still tearing down.
 */
let dailyTeardownChain: Promise<void> = Promise.resolve();

function enqueueDailyTeardown(call: DailyCall): Promise<void> {
  dailyTeardownChain = dailyTeardownChain
    .catch(() => undefined)
    .then(async () => {
      try {
        if (!call.isDestroyed()) {
          await call.leave();
        }
      } catch {
        // ignore
      }
      try {
        if (!call.isDestroyed()) {
          await call.destroy();
        }
      } catch {
        // ignore
      }
    });
  return dailyTeardownChain;
}

/**
 * Orchestrates Tavus create/join/end and Daily media for the live Garry call.
 * Local tracks stay owned by {@link useMediaDevices}; this hook attaches them
 * to Daily and maps remote participant / track events into call state inputs.
 *
 * @returns Media streams, toggles, flip helpers, and fatal vs recoverable errors.
 */
export function useTavusCall(): UseTavusCallResult {
  const {
    stream: localStream,
    videoEnabled,
    audioEnabled,
    facingMode,
    isFlippingCamera,
    error: mediaError,
    cameraActionError,
    requestPermissions,
    toggleVideo: toggleMediaVideo,
    toggleAudio: toggleMediaAudio,
    flipCamera: flipMediaCamera,
    stopAll,
  } = useMediaDevices();

  const [remoteVideoStream, setRemoteVideoStream] =
    useState<MediaStream | null>(null);
  const [remoteAudioStream, setRemoteAudioStream] =
    useState<MediaStream | null>(null);
  const [palJoined, setPalJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const callRef = useRef<DailyCall | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const startInFlightRef = useRef<Promise<void> | null>(null);
  const endInFlightRef = useRef<Promise<void> | null>(null);
  const endingRef = useRef(false);
  const generationRef = useRef(0);
  const palJoinedRef = useRef(false);
  const handlersRef = useRef<DailyHandlers | null>(null);

  const clearRemoteStreams = useCallback(() => {
    setRemoteVideoStream(null);
    setRemoteAudioStream(null);
  }, []);

  const markPalJoined = useCallback(() => {
    if (palJoinedRef.current) return;
    palJoinedRef.current = true;
    setPalJoined(true);
  }, []);

  const applyRemoteVideoTrack = useCallback((track: MediaStreamTrack) => {
    setRemoteVideoStream(new MediaStream([track]));
  }, []);

  const applyRemoteAudioTrack = useCallback((track: MediaStreamTrack) => {
    setRemoteAudioStream(new MediaStream([track]));
  }, []);

  const syncRemoteFromParticipant = useCallback(
    (participant: DailyParticipant) => {
      if (!isRemoteParticipant(participant)) return;
      markPalJoined();

      const videoTrack = trackFromParticipant(participant, "video");
      if (videoTrack) applyRemoteVideoTrack(videoTrack);

      const audioTrack = trackFromParticipant(participant, "audio");
      if (audioTrack) applyRemoteAudioTrack(audioTrack);
    },
    [applyRemoteAudioTrack, applyRemoteVideoTrack, markPalJoined],
  );

  const removeListeners = useCallback((call: DailyCall) => {
    const handlers = handlersRef.current;
    if (!handlers) return;
    call.off("participant-joined", handlers.onParticipantJoined);
    call.off("participant-updated", handlers.onParticipantUpdated);
    call.off("participant-left", handlers.onParticipantLeft);
    call.off("track-started", handlers.onTrackStarted);
    call.off("track-stopped", handlers.onTrackStopped);
    call.off("error", handlers.onDailyError as never);
    call.off("left-meeting", handlers.onLeftMeeting);
    handlersRef.current = null;
  }, []);

  const attachListeners = useCallback(
    (call: DailyCall) => {
      const onParticipantJoined = (event: DailyEventObjectParticipant) => {
        syncRemoteFromParticipant(event.participant);
      };

      const onParticipantUpdated = (event: DailyEventObjectParticipant) => {
        syncRemoteFromParticipant(event.participant);
      };

      const onParticipantLeft = (event: DailyEventObjectParticipantLeft) => {
        if (!isRemoteParticipant(event.participant)) return;
        palJoinedRef.current = false;
        setPalJoined(false);
        clearRemoteStreams();
      };

      const onTrackStarted = (event: DailyEventObjectTrack) => {
        const participant = event.participant;
        if (!participant || !isRemoteParticipant(participant)) return;
        markPalJoined();
        if (event.type === "video") {
          applyRemoteVideoTrack(event.track);
        } else if (event.type === "audio") {
          applyRemoteAudioTrack(event.track);
        }
      };

      const onTrackStopped = (event: DailyEventObjectTrack) => {
        const participant = event.participant;
        if (!participant || !isRemoteParticipant(participant)) return;
        if (event.type === "video") {
          setRemoteVideoStream(null);
        } else if (event.type === "audio") {
          setRemoteAudioStream(null);
        }
      };

      const onDailyError = (event: { errorMsg?: string } | undefined) => {
        setError(event?.errorMsg || "Daily connection error");
      };

      const onLeftMeeting = () => {
        // Unexpected disconnect: do not call End Conversation.
        // Tavus participant_left_timeout owns cleanup.
      };

      handlersRef.current = {
        onParticipantJoined,
        onParticipantUpdated,
        onParticipantLeft,
        onTrackStarted,
        onTrackStopped,
        onDailyError,
        onLeftMeeting,
      };

      call.on("participant-joined", onParticipantJoined);
      call.on("participant-updated", onParticipantUpdated);
      call.on("participant-left", onParticipantLeft);
      call.on("track-started", onTrackStarted);
      call.on("track-stopped", onTrackStopped);
      call.on("error", onDailyError as never);
      call.on("left-meeting", onLeftMeeting);
    },
    [
      applyRemoteAudioTrack,
      applyRemoteVideoTrack,
      clearRemoteStreams,
      markPalJoined,
      syncRemoteFromParticipant,
    ],
  );

  const cleanupCallObject = useCallback(async (call?: DailyCall | null) => {
    const target = call ?? callRef.current;
    if (callRef.current === target) {
      callRef.current = null;
    }
    if (!target) return;
    removeListeners(target);
    await enqueueDailyTeardown(target);
  }, [removeListeners]);

  const startCall = useCallback(async () => {
    if (startInFlightRef.current) {
      return startInFlightRef.current;
    }

    setStarting(true);
    setError(null);
    setPalJoined(false);
    palJoinedRef.current = false;
    clearRemoteStreams();

    const generation = ++generationRef.current;

    const run = (async () => {
      let createdConversationId: string | null = null;

      try {
        // Wait for any in-flight end + Daily leave/destroy before creating
        // another call object — Retry must not race teardown against callRef.
        await endInFlightRef.current?.catch(() => undefined);
        await dailyTeardownChain.catch(() => undefined);
        if (generation !== generationRef.current) {
          return;
        }
        endingRef.current = false;

        const call = DailyIframe.createCallObject();
        if (generation !== generationRef.current) {
          await enqueueDailyTeardown(call);
          return;
        }
        callRef.current = call;
        attachListeners(call);

        // Start media and Tavus create together so the ringing UI can appear
        // as soon as permissions succeed while Gary's conversation prepares.
        const mediaPromise = requestPermissions();
        const conversationPromise = createTavusConversation();

        const media = await mediaPromise;
        if (generation !== generationRef.current) {
          const abandoned = await conversationPromise.catch(() => null);
          if (abandoned?.conversation_id) {
            try {
              await endTavusConversation(abandoned.conversation_id);
            } catch {
              // ignore
            }
          }
          return;
        }

        // Unlock the launcher button / allow ringing once local media is ready.
        setStarting(false);

        if (!media) {
          const created = await conversationPromise.catch(() => null);
          if (created?.conversation_id) {
            try {
              await endTavusConversation(created.conversation_id);
            } catch {
              // ignore
            }
          }
          conversationIdRef.current = null;
          await cleanupCallObject(call);
          setError(mediaError || "Permission denied");
          return;
        }

        const conversation = await conversationPromise;
        if (generation !== generationRef.current) {
          if (conversation.conversation_id) {
            try {
              await endTavusConversation(conversation.conversation_id);
            } catch {
              // ignore
            }
          }
          return;
        }

        createdConversationId = conversation.conversation_id;
        conversationIdRef.current = createdConversationId;

        const conversationUrl = conversation.conversation_url;
        const meetingToken =
          typeof conversation.meeting_token === "string"
            ? conversation.meeting_token
            : undefined;

        if (!conversationUrl) {
          throw new Error("Missing conversation URL");
        }

        const videoTrack = media.getVideoTracks()[0];
        const audioTrack = media.getAudioTracks()[0];

        await call.join({
          url: conversationUrl,
          token: meetingToken,
          videoSource: videoTrack ?? true,
          audioSource: audioTrack ?? true,
        });

        if (generation !== generationRef.current) {
          return;
        }

        const participants = call.participants();
        for (const participant of Object.values(participants)) {
          if (participant && isRemoteParticipant(participant)) {
            syncRemoteFromParticipant(participant);
          }
        }
      } catch (err) {
        if (generation !== generationRef.current) return;

        const message =
          err instanceof Error ? err.message : "Unable to start call";
        setError(message);

        const id = createdConversationId || conversationIdRef.current;
        conversationIdRef.current = null;
        if (id) {
          try {
            await endTavusConversation(id);
          } catch {
            // ignore
          }
        }

        stopAll();
        await cleanupCallObject();
      } finally {
        if (generation === generationRef.current) {
          setStarting(false);
          startInFlightRef.current = null;
        }
      }
    })();

    startInFlightRef.current = run;
    return run;
  }, [
    attachListeners,
    cleanupCallObject,
    clearRemoteStreams,
    mediaError,
    requestPermissions,
    stopAll,
    syncRemoteFromParticipant,
  ]);

  const endCall = useCallback((): Promise<void> => {
    if (endInFlightRef.current) {
      return endInFlightRef.current;
    }

    endingRef.current = true;
    generationRef.current += 1;
    startInFlightRef.current = null;
    setStarting(false);

    // Capture the exact session being torn down so a concurrent Retry cannot
    // redirect cleanup onto a newly created Daily call / conversation.
    const callToEnd = callRef.current;
    callRef.current = null;
    const conversationToEnd = conversationIdRef.current;
    conversationIdRef.current = null;

    // Publish the in-flight promise before any work so concurrent startCall
    // awaits it even when teardown has no async steps.
    let settle!: () => void;
    const run = new Promise<void>((resolve) => {
      settle = resolve;
    });
    endInFlightRef.current = run;

    void (async () => {
      try {
        if (conversationToEnd) {
          try {
            await endTavusConversation(conversationToEnd);
          } catch {
            // Best-effort end; unexpected disconnect uses Tavus timeout.
          }
        }
        if (callToEnd) {
          removeListeners(callToEnd);
          await enqueueDailyTeardown(callToEnd);
        }
        stopAll();
        clearRemoteStreams();
        setPalJoined(false);
        palJoinedRef.current = false;
      } finally {
        endingRef.current = false;
        endInFlightRef.current = null;
        settle();
      }
    })();

    return run;
  }, [clearRemoteStreams, removeListeners, stopAll]);

  const resetCall = useCallback(async () => {
    await endCall();
    setError(null);
  }, [endCall]);

  const toggleVideo = useCallback(() => {
    const enabled = toggleMediaVideo();
    const call = callRef.current;
    if (call && !call.isDestroyed()) {
      call.setLocalVideo(enabled);
    }
    return enabled;
  }, [toggleMediaVideo]);

  const toggleAudio = useCallback(() => {
    const enabled = toggleMediaAudio();
    const call = callRef.current;
    if (call && !call.isDestroyed()) {
      call.setLocalAudio(enabled);
    }
    return enabled;
  }, [toggleMediaAudio]);

  const replaceVideoTrack = useCallback(
    async (track: MediaStreamTrack): Promise<void> => {
      const call = callRef.current;
      if (!call || call.isDestroyed()) {
        return;
      }
      // Pass the supplied track directly — do not acquire or stop tracks here.
      // Let Daily rejection reach the camera transaction; do not end the call.
      await call.setInputDevicesAsync({
        videoSource: track,
      });
    },
    [],
  );

  const flipCamera = useCallback(
    (attach: FlipBeforeAttach = replaceVideoTrack) => {
      // Transaction lives in useMediaDevices; Daily attachment is supplied.
      return flipMediaCamera(attach);
    },
    [flipMediaCamera, replaceVideoTrack],
  );

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      startInFlightRef.current = null;
      const call = callRef.current;
      callRef.current = null;
      if (call) {
        removeListeners(call);
        void enqueueDailyTeardown(call);
      }
      // Do not end Tavus on unmount / unexpected close — participant_left_timeout.
      conversationIdRef.current = null;
      stopAll();
    };
  }, [removeListeners, stopAll]);

  return {
    startCall,
    endCall,
    resetCall,
    localStream,
    remoteVideoStream,
    remoteAudioStream,
    videoEnabled,
    audioEnabled,
    facingMode,
    isFlippingCamera,
    toggleVideo,
    toggleAudio,
    replaceVideoTrack,
    flipCamera,
    palJoined,
    // Never fold cameraActionError into fatal call error.
    error: error || mediaError,
    cameraActionError,
    starting,
  };
}
