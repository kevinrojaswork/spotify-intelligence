import logging

from app.database.db import mark_sync_failed, touch_sync_heartbeat
from app.engine.music_engine import engine
from app.services.spotify_service import get_spotify_client

logger = logging.getLogger(__name__)


def run_spotify_sync(spotify_user_id: str):
    """Ejecuta una sincronización ya reservada por el bloqueo atómico."""
    try:
        touch_sync_heartbeat(spotify_user_id)

        sp = get_spotify_client(spotify_user_id)

        if not sp:
            mark_sync_failed(
                spotify_user_id,
                "Tu conexión con Spotify expiró. Vuelve a conectar tu cuenta para actualizar.",
            )
            return

        engine.sync(
            sp,
            spotify_user_id,
            progress_callback=lambda: touch_sync_heartbeat(spotify_user_id),
        )

    except Exception as error:
        logger.exception(
            "Error sincronizando Spotify para el usuario %s",
            spotify_user_id,
        )

        http_status = getattr(error, "http_status", None)

        if http_status == 401:
            user_message = (
                "Tu conexión con Spotify expiró. "
                "Vuelve a conectar tu cuenta para actualizar."
            )
        elif http_status == 429:
            user_message = (
                "Spotify limitó temporalmente las solicitudes. "
                "Tus datos anteriores siguen disponibles; intenta nuevamente más tarde."
            )
        else:
            user_message = (
                "No pudimos completar la actualización. "
                "Tus datos anteriores siguen disponibles; intenta nuevamente más tarde."
            )

        mark_sync_failed(spotify_user_id, user_message)
