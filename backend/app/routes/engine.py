from typing import Optional
import json

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends

from app.services.spotify_service import get_spotify_client
from app.security import get_authenticated_spotify_user_id
from app.engine.music_engine import engine
from app.database.db import (
    init_db,
    get_metadata,
    save_metadata,
    get_spotify_user,
    save_spotify_user,
    get_user_playlists,
    save_user_playlists,
    get_all_tracks,
)

router = APIRouter()


def get_user_image_url(user):
    images = user.get("images", [])

    if images and len(images) > 0:
        return images[0].get("url")

    return None


def get_all_spotify_playlists(sp):
    playlists = []
    results = sp.current_user_playlists(limit=50)

    while results:
        playlists.extend(results["items"])

        if results["next"]:
            results = sp.next(results)
        else:
            break

    return playlists

def get_cached_playlists_from_tracks(spotify_user_id: str):
    tracks = get_all_tracks(spotify_user_id)

    playlist_map = {}

    for track in tracks:
        playlist_id = track.get("spotify_playlist_id")
        playlist_name = track.get("playlist") or "Sin nombre"

        if not playlist_id:
            continue

        if playlist_id not in playlist_map:
            playlist_map[playlist_id] = {
                "spotify_playlist_id": playlist_id,
                "name": playlist_name,
                "total_tracks": 0,
                "owner_name": "Desconocido",
                "is_public": False,
                "snapshot_id": None,
            }

        playlist_map[playlist_id]["total_tracks"] += 1

    return sorted(
        playlist_map.values(),
        key=lambda playlist: playlist["name"].lower(),
    )


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
            save_metadata(f"sync_result:{spotify_user_id}", "")
            return

        result = engine.sync(sp, spotify_user_id)

        save_metadata(f"sync_status:{spotify_user_id}", "completed")
        save_metadata(
            f"sync_result:{spotify_user_id}",
            json.dumps(result, ensure_ascii=False),
        )
        save_metadata(f"sync_error:{spotify_user_id}", "")

    except Exception as error:
        save_metadata(f"sync_status:{spotify_user_id}", "error")
        save_metadata(f"sync_error:{spotify_user_id}", str(error))
        save_metadata(f"sync_result:{spotify_user_id}", "")


@router.get("/load")
def load_engine(
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_authenticated_spotify_user_id),
):

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
def get_dashboard(
    playlist_id: Optional[str] = None,
    user_id: str = Depends(get_authenticated_spotify_user_id),
):

    return engine.analyze(
        spotify_user_id=user_id,
        spotify_playlist_id=playlist_id,
    )


@router.get("/analysis-playlists")
def get_analysis_playlists(
    user_id: str = Depends(get_authenticated_spotify_user_id),
):

    init_db()

    playlists = get_user_playlists(user_id)

    if playlists:
        return {
            "spotify_user_id": user_id,
            "playlists": playlists,
            "source": "database",
            "needs_reconnect": False,
        }

    cached_playlists = get_cached_playlists_from_tracks(user_id)

    if cached_playlists:
        return {
            "spotify_user_id": user_id,
            "playlists": cached_playlists,
            "source": "tracks_cache",
            "needs_reconnect": False,
        }

    sp = get_spotify_client(user_id)

    if not sp:
        return {
            "spotify_user_id": user_id,
            "playlists": [],
            "source": "empty_cache",
            "needs_reconnect": True,
            "message": (
                "La sesión de Spotify expiró, pero esto no debe bloquear "
                "el análisis guardado."
            ),
        }

    try:
        spotify_playlists = get_all_spotify_playlists(sp)
        save_user_playlists(user_id, spotify_playlists)

        playlists = get_user_playlists(user_id)

        return {
            "spotify_user_id": user_id,
            "playlists": playlists,
            "source": "spotify",
            "needs_reconnect": False,
        }

    except Exception as error:
        cached_playlists = get_cached_playlists_from_tracks(user_id)

        return {
            "spotify_user_id": user_id,
            "playlists": cached_playlists,
            "source": "spotify_error",
            "needs_reconnect": True,
            "message": str(error),
        }


@router.get("/sync-status")
def get_sync_status(
    user_id: str = Depends(get_authenticated_spotify_user_id),
):

    status = get_metadata(f"sync_status:{user_id}") or "idle"
    error = get_metadata(f"sync_error:{user_id}") or ""

    sync_result_raw = get_metadata(f"sync_result:{user_id}")
    sync_result = None

    if sync_result_raw:
        try:
            sync_result = json.loads(sync_result_raw)
        except json.JSONDecodeError:
            sync_result = None


    return {
        "spotify_user_id": user_id,
        "status": status,
        "error": error,
        "result": sync_result,
    }


@router.get("/me")
def get_connected_user(
    user_id: str = Depends(get_authenticated_spotify_user_id),
):

    init_db()

    saved_user = get_spotify_user(user_id)

    if saved_user:
        return saved_user

    sp = get_spotify_client(user_id)

    if not sp:
        return {
            "spotify_user_id": user_id,
            "display_name": user_id,
            "email": None,
            "image_url": None,
            "last_login": None,
        }

    user = sp.current_user()

    display_name = user.get("display_name") or user_id
    email = user.get("email")
    image_url = get_user_image_url(user)

    save_spotify_user(
        spotify_user_id=user_id,
        display_name=display_name,
        email=email,
        image_url=image_url,
    )

    return get_spotify_user(user_id)