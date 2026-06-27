from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks

from app.services.spotify_service import (
    get_spotify_client,
    get_current_spotify_user_id,
)
from app.engine.music_engine import engine
from app.database.db import init_db, get_metadata, save_metadata

router = APIRouter()


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
                "Necesitas conectar Spotify nuevamente."
            )
            return

        engine.sync(sp, spotify_user_id)

        save_metadata(f"sync_status:{spotify_user_id}", "completed")
        save_metadata(f"sync_error:{spotify_user_id}", "")

    except Exception as error:
        save_metadata(f"sync_status:{spotify_user_id}", "error")
        save_metadata(f"sync_error:{spotify_user_id}", str(error))


@router.get("/load")
def load_engine(
    background_tasks: BackgroundTasks,
    spotify_user_id: Optional[str] = None,
):
    user_id = spotify_user_id or get_current_spotify_user_id()

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="No hay usuario de Spotify conectado."
        )

    init_db()

    sp = get_spotify_client(user_id)

    if not sp:
        save_metadata(f"sync_status:{user_id}", "error")
        save_metadata(
            f"sync_error:{user_id}",
            "Tu sesión de Spotify expiró. Conecta Spotify nuevamente."
        )

        raise HTTPException(
            status_code=401,
            detail="Tu sesión de Spotify expiró. Conecta Spotify nuevamente."
        )

    current_status = get_metadata(f"sync_status:{user_id}")

    if current_status == "syncing":
        return {
            "message": "La sincronización ya está en progreso.",
            "spotify_user_id": user_id,
            "status": "syncing",
        }

    save_metadata(f"sync_status:{user_id}", "syncing")
    save_metadata(f"sync_error:{user_id}", "")

    background_tasks.add_task(sync_user_in_background, user_id)

    return {
        "message": "Sincronización iniciada en segundo plano.",
        "spotify_user_id": user_id,
        "status": "syncing",
    }


@router.get("/dashboard")
def get_dashboard(spotify_user_id: Optional[str] = None):
    user_id = spotify_user_id or get_current_spotify_user_id()

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="No hay usuario de Spotify conectado."
        )

    return engine.analyze(user_id)


@router.get("/sync-status")
def get_sync_status(spotify_user_id: Optional[str] = None):
    user_id = spotify_user_id or get_current_spotify_user_id()

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="No hay usuario de Spotify conectado."
        )

    status = get_metadata(f"sync_status:{user_id}") or "idle"
    error = get_metadata(f"sync_error:{user_id}") or ""

    return {
        "spotify_user_id": user_id,
        "status": status,
        "error": error,
    }