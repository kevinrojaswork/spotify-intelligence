import traceback

from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import RedirectResponse

from app.spotify import spotify_oauth
from app.services.spotify_service import save_token, get_spotify_client
from app.engine.music_engine import engine
from app.database.db import init_db, save_metadata

router = APIRouter()

FRONTEND_URL = "https://spotify-intelligence.vercel.app"


def sync_user_in_background(spotify_user_id: str):
    try:
        init_db()

        save_metadata(f"sync_status:{spotify_user_id}", "syncing")
        save_metadata(f"sync_error:{spotify_user_id}", "")

        sp = get_spotify_client(spotify_user_id)

        if not sp:
            save_metadata(f"sync_status:{spotify_user_id}", "error")
            save_metadata(
                f"sync_error:{spotify_user_id}",
                "No se pudo crear el cliente de Spotify.",
            )
            return

        engine.sync(sp, spotify_user_id)

        save_metadata(f"sync_status:{spotify_user_id}", "completed")
        save_metadata(f"sync_error:{spotify_user_id}", "")

    except Exception as error:
        save_metadata(f"sync_status:{spotify_user_id}", "error")
        save_metadata(f"sync_error:{spotify_user_id}", str(error))


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
    # Spotify envía error=access_denied cuando el usuario cancela.
    # En ese caso regresamos al frontend sin borrar la cuenta anterior.
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
        save_metadata(f"sync_status:{spotify_user_id}", "syncing")
        save_metadata(f"sync_error:{spotify_user_id}", "")

        background_tasks.add_task(sync_user_in_background, spotify_user_id)

        query = urlencode(
            {
                "spotify_connected": "true",
                "spotify_user_id": spotify_user_id,
                "sync": "started",
            }
        )

        return RedirectResponse(url=f"{FRONTEND_URL}/?{query}")

    except Exception as callback_error:
        print("ERROR EN CALLBACK DE SPOTIFY:")
        print(repr(callback_error))
        traceback.print_exc()

        query = urlencode(
            {
                "spotify_auth_failed": "true",
                "spotify_error": str(callback_error),
            }
        )

        return RedirectResponse(
            url=f"{FRONTEND_URL}/?{query}"
        )