import os

import httpx
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

REALTALK_API_KEY = os.environ.get("REALTALK_API_KEY", "")
REALTALK_AGENT_ID = os.environ.get("REALTALK_AGENT_ID", "")
REALTALK_API_URL = os.environ.get("REALTALK_API_URL", "https://api.realtalk.ml/api/v1")


@app.get("/api/token")
async def get_token():
    if not REALTALK_API_KEY:
        raise HTTPException(status_code=500, detail="REALTALK_API_KEY not configured")
    if not REALTALK_AGENT_ID:
        raise HTTPException(
            status_code=500, detail="REALTALK_AGENT_ID not configured"
        )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{REALTALK_API_URL}/sessions/",
            headers={"X-Realtalk-Api-Key": REALTALK_API_KEY},
            json={"agent_id": REALTALK_AGENT_ID},
        )

    if not response.is_success:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"RealTalk API error: {response.text}",
        )

    data = response.json()
    return {
        "token": data["token"],
        "conversation_id": data["conversation_id"],
        "agent_id": data.get("agent_id"),
        "expires_at": data.get("expires_at"),
    }
