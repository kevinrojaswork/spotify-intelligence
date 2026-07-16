import logging
import os

from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import RedirectResponse

from app.database.db import init_db, try_acquire_sync_lock
from app.security import create_session_token
from app.services.spotify_service import save_token
from app.services.sync_service import run_spotify_sync
from app.spotify import spotify_oauth

router = APIRouter()
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://spotify-intelligence.vercel.app",
)


def get_sync_stale_after_seconds() -> int:
    raw_value = os.getenv("SYNC_STALE_AFTER_SECONDS", "900")

    try:
        return max(60, int(raw_value))
    except ValueError:
        return 900


@router.get("/login")
def spotify_login():
    auth_url = spotify_oauth.get_authorize_url()
    return {"auth_url": auth_url}


@router.get("/callback")
def spotify_callback(
    background_tasks: BackgroundTasks,
    code: Optional[str] = None,
    error: Optional[str] = None,
):
    if error or not code:
        query = urlencode(
            {
                "spotify_cancelled": "true",
                "spotify_error": error or "authorization_cancelled",
            }
        )
        return RedirectResponse(url=f"{FRONTEND_URL}/?{query}")

    try:
        token_data = save_token(code)
        spotify_user_id = token_data["spotify_user_id"]

        init_db()

        lock = try_acquire_sync_lock(
            spotify_user_id,
            stale_after_seconds=get_sync_stale_after_seconds(),
        )

        if lock["acquired"]:
            background_tasks.add_task(run_spotify_sync, spotify_user_id)
            sync_value = "started"
        else:
            sync_value = "already_running"

        session_token = create_session_token(spotify_user_id)

        query = urlencode(
            {
                "spotify_connected": "true",
                "spotify_user_id": spotify_user_id,
                "session_token": session_token,
                "sync": sync_value,
            }
        )

        return RedirectResponse(url=f"{FRONTEND_URL}/?{query}")

    except Exception as callback_error:
        logger.exception("Error en callback de Spotify")

        normalized_error = str(callback_error).lower()

        if "not registered for this application" in normalized_error:
            error_code = "user_not_registered"
        else:
            error_code = "spotify_connection_failed"

        query = urlencode(
            {
                "spotify_auth_failed": "true",
                "spotify_error": error_code,
            }
        )

        return RedirectResponse(url=f"{FRONTEND_URL}/?{query}")

