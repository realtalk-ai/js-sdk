---
"@realtalk-ai/core": minor
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
"@realtalk-ai/embed": minor
---

Add explicit conversation modes: `text`, `text_with_agent_audio` and `voice`. The mode is sent when connecting and can be changed on the open connection with the new `set_conversation_mode` event (`setMode` in `useConversation`), which the server confirms with a `conversation_mode` event.

`mode: "text"` is now a real text-only conversation: the server generates no speech, so replies arrive faster. Use `mode: "text_with_agent_audio"` (the new default) to keep hearing the agent in a typed conversation, which is what `"text"` used to do.

The embed widget starts as a text chat and switches mode with its speaker and microphone buttons instead of playing muted audio.
