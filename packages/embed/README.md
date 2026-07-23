# @realtalk-ai/embed

[![CI](https://github.com/realtalk-ai/js-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/realtalk-ai/js-sdk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@realtalk-ai/embed)](https://www.npmjs.com/package/@realtalk-ai/embed)

Add your [Real Talk](https://realtalk.ml/home) agent to any website as a floating chat widget, with both text and voice, by pasting two lines of HTML:

```html
<realtalk-embed agent-id="YOUR_AGENT_ID"></realtalk-embed>
<script src="https://cdn.jsdelivr.net/npm/@realtalk-ai/embed@0" async></script>
```

There is nothing to install or build. The script is a single self-contained file served from [jsDelivr](https://www.jsdelivr.com/) (unpkg also works). The `@0` in the URL means the page always loads the newest 0.x release: improvements and fixes reach your site automatically without touching the snippet, while a future breaking 1.0 will never load until you opt in by updating the URL. New releases roll out as the CDN's cache refreshes, typically within about 12 hours. If your organization requires strict change control, you can pin an exact version instead, e.g. `@realtalk-ai/embed@0.1.1`.

The script registers the `<realtalk-embed>` element and renders into a shadow root, so the widget's styles and your site's styles can't interfere with each other.

## Enabling embedding for your agent

Embedding is enabled per agent, together with an allowlist of the sites that may embed it. Visitors chat directly with Real Talk, so your site needs no backend integration and no keys or secrets appear in your page.

If the widget doesn't render, the most common cause is that the page's origin isn't on your agent's allowlist. The widget logs an error message to the browser console when this happens.

## Attributes

| Attribute    | Required | Description                                                                                                            |
| ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `agent-id`   | yes      | The agent to embed.                                                                                                    |
| `server-url` | no       | Alternative Real Talk server origin. Defaults to the production server and is only needed for development and testing. |

## Conversations and tabs

The widget keeps the conversation in `sessionStorage`, so a chat survives page reloads and navigation within the same tab, while each browser tab gets its own conversation.

## Placement and styling

By default the widget floats in the bottom-right corner. The `<realtalk-embed>` element lives in your page's normal DOM, so you can position it with your own CSS (`position`, `bottom`, `right`, `z-index`, etc.). The widget's internals stay isolated inside the shadow root.

## Voice conversations

The widget supports both text chat and voice. Voice is started with the microphone button in the widget header, which asks the visitor for microphone permission via the browser's standard prompt, so the page must be served over HTTPS (or localhost) for voice to work.

The agent's audio playback starts muted and is unmuted with the speaker button. The microphone and the speaker are independent toggles, so a visitor can for example dictate messages with the microphone while keeping audio muted to read the replies as text.

## Demo

See [`examples/embed-demo`](../../examples/embed-demo) for a minimal page using the snippet.

## Development

For contributors working in this repo:

```bash
pnpm --filter @realtalk-ai/embed build   # bundle to dist/embed.js (CDN) and dist/embed.es.js (bundlers)
pnpm --filter @realtalk-ai/embed test    # unit tests
pnpm embed-demo                          # build + serve the demo page
```
