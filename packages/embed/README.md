# @realtalk-ai/embed

[![CI](https://github.com/realtalk-ai/js-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/realtalk-ai/js-sdk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@realtalk-ai/embed)](https://www.npmjs.com/package/@realtalk-ai/embed)

Add your [Real Talk](https://realtalk.ml/home) agent to any website as a floating chat widget by pasting two lines of HTML:

```html
<realtalk-embed agent-id="YOUR_AGENT_ID"></realtalk-embed>
<script src="https://cdn.jsdelivr.net/npm/@realtalk-ai/embed" async></script>
```

There is nothing to install or build. The script is a single self-contained file served from [jsDelivr](https://www.jsdelivr.com/) (unpkg also works), and the snippet always loads the newest release: improvements and fixes reach your site automatically, and you never need to touch the snippet again. If your organization requires strict change control, you can pin an exact version instead, e.g. `@realtalk-ai/embed@0.1.1`.

The script registers the `<realtalk-embed>` element and renders into a shadow root, so the widget's styles and your site's styles can't interfere with each other.

## Enabling embedding for your agent

Embedding is enabled per agent, together with an allowlist of the sites that may embed it. Visitors chat directly with Real Talk, so your site needs no backend integration and no keys or secrets appear in your page.

If the widget doesn't render, the most common cause is that the page's origin isn't on your agent's allowlist. The widget logs an error message to the browser console when this happens.

## Attributes

| Attribute      | Required | Description                                                                                                            |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `agent-id`     | yes      | The agent to embed.                                                                                                    |
| `server-url`   | no       | Alternative Real Talk server origin. Defaults to the production server and is only needed for development and testing. |
| `accent-color` | no       | Hex color for the launcher, buttons and the visitor's messages, e.g. `#1d4ed8`. Defaults to black.                     |
| `rounding`     | no       | How rounded the corners are: `small`, `medium` or `large`. Defaults to `medium`.                                       |

## Conversations and tabs

The widget keeps the conversation in `sessionStorage`, so a chat survives page reloads and navigation within the same tab, while each browser tab gets its own conversation.

## Placement and styling

By default the widget floats in the bottom-right corner. The `<realtalk-embed>` element lives in your page's normal DOM, so you can position it with your own CSS (`position`, `bottom`, `right`, `z-index`, etc.). The widget's look is set through attributes, and its internals stay isolated inside the shadow root.

## Voice conversations

The widget supports both text chat and voice. Every conversation starts as text, and when voice is enabled for the agent the message field has a phone button that turns voice mode on and off, so the visitor speaks with the agent and hears the replies on the same connection. Turning voice on asks the visitor for microphone permission via the browser's standard prompt, so the page must be served over HTTPS (or localhost) for voice to work.

The microphone and the agent's audio can also be switched separately from the widget's menu. The two are independent, so with the microphone on and the audio off a visitor can dictate messages and read the replies as text.

## Demo

Try the widget on a live stand-in website at [realtalk-ai.github.io/embed-demo](https://realtalk-ai.github.io/embed-demo/). See [`examples/embed-demo`](../../examples/embed-demo) for a minimal page using the snippet.

## Development

For contributors working in this repo:

```bash
pnpm --filter @realtalk-ai/embed build   # bundle to dist/embed.js (CDN) and dist/embed.es.js (bundlers)
pnpm --filter @realtalk-ai/embed test    # unit tests
pnpm embed-demo                          # build + serve the demo page
```
