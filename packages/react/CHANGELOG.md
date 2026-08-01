# @realtalk-ai/react

## 0.4.0

### Minor Changes

- 596cc09: Play caller and agent audio as two independently scheduled streams. Media frames can carry `media.source` ("user" or "agent", missing defaults to "agent"), the transport passes it through the audio callback, and the AudioPlayer keeps one playback timeline per source so simultaneous streams mix in the browser instead of queuing behind each other. The caller stream schedules frames gaplessly on arrival after an initial jitter buffer, rebuffering after underruns, and fires no playback callbacks. Playback callbacks and `clear()` apply to the agent stream only, so participant behavior is unchanged. Needed for observer listen-in on live phone calls, where caller audio streams continuously alongside agent speech.

## 0.3.1

### Patch Changes

- a3239f1: Widen the core peer dependency range to `>=0.3.0 <1.0.0` so new core 0.x minors no longer force a wrapper release.
