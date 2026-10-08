---
"@realtalk-ai/embed": minor
---

Restyle the embed widget, add theme attributes and move the controls into menus.

- `accent-color` sets the accent from a hex color. The launcher, the buttons and the visitor's messages use it, and the text color and a readable darker shade are derived from it so light accents stay legible. The default accent is now black.
- `rounding` picks `small`, `medium` or `large` corners.
- The header has an end conversation button that asks for confirmation, and a menu with the microphone and audio toggles and an about page.
- Ending a conversation shows a start new conversation button in place of the message field, and the launcher shows a pulsing dot while a conversation is in progress.
- The icons now match the Real Talk web app, and internal sub tasks are no longer shown to visitors.

**Breaking:** voice is off by default, so the widget is a text chat until voice is enabled for the agent. With voice enabled, the message field has a phone button that turns the microphone and the agent's audio on and off together, and the menu switches them separately.
