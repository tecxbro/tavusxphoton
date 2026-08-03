# Mini Pho Test Controller

Temporary same-origin helper for answering the FaceTime prototype without production signaling.

## Local flow

1. Run `npm run dev`.
2. Open `/call/demo` in one tab.
3. Open `/pho-controller` in another tab on the same origin and browser profile.
4. Grant camera and microphone access in the call tab.
5. Verify the call remains in `ringing` and the remote mock is not mounted.
6. Click **Pick Up Call**.
7. Verify the remote mock loads and the join transition runs to live.
8. Use **End Call** and **Reset Test** as needed.

## How it works

The controller posts `answer`, `end`, and `reset` messages over `BroadcastChannel` (`mini-pho-test-call`). BroadcastChannel works between same-origin browsing contexts in the same browser profile. It does not work across devices, browsers, or profiles.

This controller is temporary. Lemon Slice events will replace it later for real call signaling.
