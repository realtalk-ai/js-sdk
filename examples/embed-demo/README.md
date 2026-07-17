# Embed widget demo

A minimal page showing how to add the [`@realtalk-ai/embed`](../../packages/embed) widget to a website: paste the `<realtalk-embed>` tag plus a script tag, and a chat bubble appears in the corner of the page.

## Try it

1. In `index.html`, replace `YOUR_AGENT_ID` with the id of an agent that has embedding enabled, with this page's origin (`http://127.0.0.1:4173`) on its allowlist.
2. From the repo root:

   ```bash
   pnpm embed-demo
   ```

   Then open http://127.0.0.1:4173/examples/embed-demo/

The demo loads the widget bundle from the locally built `packages/embed/dist/`, so rebuilding the package picks up changes on reload. On a real site you'd load the bundle from the CDN instead, as described in the [package README](../../packages/embed/README.md).

## Development

For contributors working in this repo, the widget can be pointed to a local server instead of the default Real Talk production server. Add a `server-url` attribute to the tag (e.g. `server-url="http://127.0.0.1:8000"`) and allowlist `http://127.0.0.1:4173` for your agent on the local server.
