---
"@realtalk-ai/core": minor
"@realtalk-ai/react": minor
---

Play caller and agent audio as two independently scheduled streams. Media frames can carry `media.source` ("user" or "agent", missing defaults to "agent"), the transport passes it through the audio callback, and the AudioPlayer keeps one playback timeline per source so simultaneous streams mix in the browser instead of queuing behind each other. Playback callbacks and `clear()` apply to the agent stream only, so participant behavior is unchanged. Needed for observer listen-in on live phone calls, where caller audio streams continuously alongside agent speech.
