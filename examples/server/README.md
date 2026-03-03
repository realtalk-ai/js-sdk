# Example Token Server

A minimal FastAPI server that proxies token creation for the Real Talk SDK. It keeps your API key on the server side and exposes a single endpoint for the client to fetch session tokens.

## Setup

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

- `REALTALK_API_KEY` — your Real Talk API key
- `REALTALK_AGENT_ID` — the agent ID to create sessions for
- `REALTALK_API_URL` — API base URL (defaults to `https://api.realtalk.ml/api/v1`)

## Run

```bash
uv venv && source .venv/bin/activate && uv pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0
```

The server starts on `http://localhost:8000`.

## API

### `GET /api/token`

Creates a new Real Talk session and returns the token, conversation ID, agent ID, and expiration.
