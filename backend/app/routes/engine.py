import logging
import os
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.constants import (
    LIKED_SONGS_COLLECTION_ID,
    LIKED_SONGS_COLLECTION_TYPE,
)
from app.database.db import (
    get_all_tracks,
    get_spotify_user,
    get_sync_state,
    get_user_playlists,
    init_db,
    save_spotify_user,
    save_user_playlists,
    try_acquire_sync_lock,
)
from app.engine.music_engine import engine
from app.security import get_authenticated_spotify_user_id
from app.services.spotify_service import get_spotify_client
from app.services.sync_service import run_spotify_sync

router = APIRouter()
logger = logging.getLogger(__name__)


def get_sync_stale_after_seconds() -> int:
    raw_value = os.getenv("SYNC_STALE_AFTER_SECONDS", "900")

    try:
        return max(60, int(raw_value))
    except ValueError:
        return 900


def get_user_image_url(user):
    images = user.get("images", [])

    if images:
        return images[0].get("url")

    return None


def get_all_spotify_playlists(sp):
    playlists = []
    results = sp.current_user_playlists(limit=50)

    while results:
        playlists.extend(results.get("items", []))

        if results.get("next"):
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


def separate_analysis_collections(playlists: list[dict]):
    regular_playlists = []
    liked_songs = None

    for playlist in playlists:
        if playlist.get("spotify_playlist_id") == LIKED_SONGS_COLLECTION_ID:
            liked_songs = {
                **playlist,
                "collection_type": LIKED_SONGS_COLLECTION_TYPE,
                "is_special_collection": True,
            }
            continue

        regular_playlists.append(playlist)

    return regular_playlists, liked_songs


def build_analysis_playlists_response(
    spotify_user_id: str,
    playlists: list[dict],
    source: str,
    needs_reconnect: bool,
    message: str | None = None,
):
    regular_playlists, liked_songs = separate_analysis_collections(playlists)

    response = {
        "spotify_user_id": spotify_user_id,
        "playlists": regular_playlists,
        "liked_songs": liked_songs,
        "source": source,
        "needs_reconnect": needs_reconnect,
    }

    if message:
        response["message"] = message

    return response


@router.get("/load")
@router.post("/load")
def load_engine(
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_authenticated_spotify_user_id),
):
    init_db()

    # Validamos la conexión antes de reservar el trabajo. Los datos guardados
    # no se modifican si Spotify necesita una nueva autorización.
    sp = get_spotify_client(user_id)

    if not sp:
        raise HTTPException(
            status_code=401,
            detail=(
                "Tu conexión con Spotify expiró. "
                "Vuelve a conectar tu cuenta para actualizar."
            ),
        )

    lock = try_acquire_sync_lock(
        user_id,
        stale_after_seconds=get_sync_stale_after_seconds(),
    )

    if not lock["acquired"]:
        return {
            "message": "La sincronización ya está en progreso.",
            "spotify_user_id": user_id,
            "status": "syncing",
            "already_running": True,
        }

    background_tasks.add_task(run_spotify_sync, user_id)

    return {
        "message": "Sincronización iniciada en segundo plano.",
        "spotify_user_id": user_id,
        "status": "syncing",
        "already_running": False,
        "recovered_stale": lock["recovered_stale"],
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
        return build_analysis_playlists_response(
            spotify_user_id=user_id,
            playlists=playlists,
            source="database",
            needs_reconnect=False,
        )

    cached_playlists = get_cached_playlists_from_tracks(user_id)

    if cached_playlists:
        return build_analysis_playlists_response(
            spotify_user_id=user_id,
            playlists=cached_playlists,
            source="tracks_cache",
            needs_reconnect=False,
        )

    sp = get_spotify_client(user_id)

    if not sp:
        return build_analysis_playlists_response(
            spotify_user_id=user_id,
            playlists=[],
            source="empty_cache",
            needs_reconnect=True,
            message=(
                "La conexión con Spotify expiró, pero el análisis guardado "
                "continúa disponible."
            ),
        )

    try:
        spotify_playlists = get_all_spotify_playlists(sp)
        save_user_playlists(user_id, spotify_playlists)
        playlists = get_user_playlists(user_id)

        return build_analysis_playlists_response(
            spotify_user_id=user_id,
            playlists=playlists,
            source="spotify",
            needs_reconnect=False,
        )

    except Exception:
        logger.exception(
            "No se pudieron cargar las playlists de Spotify para %s",
            user_id,
        )

        cached_playlists = get_cached_playlists_from_tracks(user_id)

        return build_analysis_playlists_response(
            spotify_user_id=user_id,
            playlists=cached_playlists,
            source="spotify_error",
            needs_reconnect=False,
            message=(
                "No pudimos consultar Spotify en este momento. "
                "Mostramos los datos guardados disponibles."
            ),
        )


@router.get("/sync-status")
def get_sync_status(
    user_id: str = Depends(get_authenticated_spotify_user_id),
):
    state = get_sync_state(
        user_id,
        stale_after_seconds=get_sync_stale_after_seconds(),
    )

    return {
        "spotify_user_id": user_id,
        **state,
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
