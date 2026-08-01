# @realtalk-ai/core

## 0.5.0

### Minor Changes

- 596cc09: Play caller and agent audio as two independently scheduled streams. Media frames can carry `media.source` ("user" or "agent", missing defaults to "agent"), the transport passes it through the audio callback, and the AudioPlayer keeps one playback timeline per source so simultaneous streams mix in the browser instead of queuing behind each other. The caller stream schedules frames gaplessly on arrival after an initial jitter buffer, rebuffering after underruns, and fires no playback callbacks. Playback callbacks and `clear()` apply to the agent stream only, so participant behavior is unchanged. Needed for observer listen-in on live phone calls, where caller audio streams continuously alongside agent speech.

## 0.4.0

### Minor Changes

- 3a1e467: Move `hasPendingSubTasks` from the embed package into core so any SDK consumer can tell whether the agent is still working on sub-tasks.
