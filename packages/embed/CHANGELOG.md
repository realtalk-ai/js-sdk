# @realtalk-ai/embed

## 0.3.0

### Minor Changes

- 341a1c6: Restyle the embed widget, add theme attributes and move the controls into menus.
  - `accent-color` sets the accent from a hex color. The launcher, the buttons and the visitor's messages use it, and the text color and a readable darker shade are derived from it so light accents stay legible. The default accent is now black.
  - `rounding` picks `small`, `medium` or `large` corners.
  - The header has an end conversation button that asks for confirmation, and a menu with the microphone and audio toggles and an about page.
  - Ending a conversation shows a start new conversation button in place of the message field, and the launcher shows a pulsing dot while a conversation is in progress.
  - The icons now match the Real Talk web app, and internal sub tasks are no longer shown to visitors.

  **Breaking:** voice is off by default, so the widget is a text chat until voice is enabled for the agent. With voice enabled, the message field has a phone button that turns the microphone and the agent's audio on and off together, and the menu switches them separately.

## 0.2.1

### Patch Changes

- Updated dependencies [bec4f70]
  - @realtalk-ai/react@0.6.0

## 0.2.0

### Minor Changes

- 9083a9e: Add conversation modes. A mode is two independent flags, `userAudio` and `agentAudio`, that say which audio the conversation carries. Text always goes both ways. The mode is sent when connecting and can be changed on the open connection with the new `set_conversation_mode` event (`setMode` in `useConversation`), which the server confirms with a `conversation_mode` event.

  **Breaking:** `mode` is now an object instead of `"voice"` or `"text"`. Pass `{ userAudio: true, agentAudio: true }` where you passed `"voice"`. A conversation with both flags off is a real text-only conversation and the new default, also when no mode is given. Use `{ userAudio: false, agentAudio: true }` to keep hearing the agent in a typed conversation, which is what `"text"` and no mode used to do. `{ userAudio: true, agentAudio: false }` lets the user speak and read the replies.

  `@realtalk-ai/react` and `@realtalk-ai/react-native` now need `@realtalk-ai/core` 0.6.0 or later, which sends the mode when connecting.

  The embed widget starts as a text chat and switches mode with its speaker and microphone buttons instead of playing muted audio.

### Patch Changes

- Updated dependencies [9083a9e]
  - @realtalk-ai/core@0.6.0
  - @realtalk-ai/react@0.5.0

## 0.1.3

### Patch Changes

- 89c49ad: Grow the embed widget text input box with its content up to five lines.

## 0.1.2

### Patch Changes

- 7371981: Recommend jsDelivr with an always-latest URL in the embed docs.
- Updated dependencies [596cc09]
  - @realtalk-ai/core@0.5.0
  - @realtalk-ai/react@0.4.0

## 0.1.1

### Patch Changes

- cbe4154: Declare the bundled `@realtalk-ai/core` and `@realtalk-ai/react` packages as exact dependencies so every release of either automatically triggers an embed rebuild and release.
- 3a1e467: Move `hasPendingSubTasks` from the embed package into core so any SDK consumer can tell whether the agent is still working on sub-tasks.
- Updated dependencies [3a1e467]
- Updated dependencies [a3239f1]
  - @realtalk-ai/core@0.4.0
  - @realtalk-ai/react@0.3.1
