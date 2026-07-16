import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Any

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "spotify_intelligence.db"

DB_PATH = Path(
    os.getenv("SQLITE_DB_PATH", str(DEFAULT_DB_PATH))
)

DB_PATH.parent.mkdir(parents=True, exist_ok=True)
 
 


def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000")
    return conn


def column_exists(conn, table_name: str, column_name: str) -> bool:
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    return any(column["name"] == column_name for column in columns)


def add_column_if_missing(conn, table_name: str, column_name: str, column_definition: str):
    if not column_exists(conn, table_name, column_name):
        conn.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
        )


def migrate_tracks_table():
    conn = get_connection()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spotify_user_id TEXT,
            spotify_playlist_id TEXT,
            playlist TEXT,
            track_name TEXT,
            artists TEXT,
            album TEXT
        )
        """
    )

    add_column_if_missing(conn, "tracks", "spotify_user_id", "TEXT")
    add_column_if_missing(conn, "tracks", "spotify_playlist_id", "TEXT")
    add_column_if_missing(conn, "tracks", "playlist", "TEXT")
    add_column_if_missing(conn, "tracks", "track_name", "TEXT")
    add_column_if_missing(conn, "tracks", "artists", "TEXT")
    add_column_if_missing(conn, "tracks", "album", "TEXT")

    conn.commit()
    conn.close()


def migrate_spotify_playlists_table():
    conn = get_connection()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS spotify_playlists (
            spotify_user_id TEXT,
            spotify_playlist_id TEXT,
            name TEXT,
            total_tracks INTEGER,
            owner_name TEXT,
            is_public INTEGER,
            snapshot_id TEXT,
            PRIMARY KEY (spotify_user_id, spotify_playlist_id)
        )
        """
    )

    add_column_if_missing(conn, "spotify_playlists", "spotify_user_id", "TEXT")
    add_column_if_missing(conn, "spotify_playlists", "spotify_playlist_id", "TEXT")
    add_column_if_missing(conn, "spotify_playlists", "name", "TEXT")
    add_column_if_missing(conn, "spotify_playlists", "total_tracks", "INTEGER")
    add_column_if_missing(conn, "spotify_playlists", "owner_name", "TEXT")
    add_column_if_missing(conn, "spotify_playlists", "is_public", "INTEGER")
    add_column_if_missing(conn, "spotify_playlists", "snapshot_id", "TEXT")

    conn.commit()
    conn.close()


def migrate_metadata_table():
    conn = get_connection()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """
    )

    conn.commit()
    conn.close()


def migrate_spotify_tokens_table():
    conn = get_connection()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS spotify_tokens (
            spotify_user_id TEXT PRIMARY KEY,
            access_token TEXT,
            refresh_token TEXT,
            expires_at INTEGER
        )
        """
    )

    conn.commit()
    conn.close()


def migrate_spotify_users_table():
    conn = get_connection()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS spotify_users (
            spotify_user_id TEXT PRIMARY KEY,
            display_name TEXT,
            email TEXT,
            image_url TEXT,
            last_login TEXT
        )
        """
    )

    conn.commit()
    conn.close()


def init_db():
    migrate_tracks_table()
    migrate_spotify_playlists_table()
    migrate_metadata_table()
    migrate_spotify_tokens_table()
    migrate_spotify_users_table()


def normalize_artists(artists: Any) -> str:
    if isinstance(artists, list):
        clean_artists = [
            str(artist).strip()
            for artist in artists
            if artist is not None and str(artist).strip()
        ]

        return ", ".join(clean_artists)

    if isinstance(artists, str):
        return artists.strip()

    return ""


def clear_tracks(spotify_user_id: str):
    conn = get_connection()

    conn.execute(
        """
        DELETE FROM tracks
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,),
    )

    conn.commit()
    conn.close()


def delete_tracks_for_playlist(spotify_user_id: str, spotify_playlist_id: str):
    conn = get_connection()

    conn.execute(
        """
        DELETE FROM tracks
        WHERE spotify_user_id = ?
        AND spotify_playlist_id = ?
        """,
        (spotify_user_id, spotify_playlist_id),
    )

    conn.commit()
    conn.close()


def delete_tracks_not_in_playlists(spotify_user_id: str, playlist_ids: list[str]):
    conn = get_connection()

    if not playlist_ids:
        conn.execute(
            """
            DELETE FROM tracks
            WHERE spotify_user_id = ?
            """,
            (spotify_user_id,),
        )
    else:
        placeholders = ",".join(["?"] * len(playlist_ids))

        conn.execute(
            f"""
            DELETE FROM tracks
            WHERE spotify_user_id = ?
            AND spotify_playlist_id NOT IN ({placeholders})
            """,
            [spotify_user_id, *playlist_ids],
        )

    conn.commit()
    conn.close()


def count_tracks_for_playlist(spotify_user_id: str, spotify_playlist_id: str) -> int:
    conn = get_connection()

    cursor = conn.execute(
        """
        SELECT COUNT(*) AS total
        FROM tracks
        WHERE spotify_user_id = ?
        AND spotify_playlist_id = ?
        """,
        (spotify_user_id, spotify_playlist_id),
    )

    row = cursor.fetchone()
    conn.close()

    return int(row["total"]) if row else 0


def update_tracks_playlist_name(
    spotify_user_id: str,
    spotify_playlist_id: str,
    playlist_name: str,
):
    conn = get_connection()

    conn.execute(
        """
        UPDATE tracks
        SET playlist = ?
        WHERE spotify_user_id = ?
        AND spotify_playlist_id = ?
        """,
        (playlist_name, spotify_user_id, spotify_playlist_id),
    )

    conn.commit()
    conn.close()


def save_tracks(spotify_user_id: str, tracks: list[dict]):
    if not tracks:
        return

    conn = get_connection()

    rows = []

    for track in tracks:
        rows.append(
            (
                spotify_user_id,
                track.get("spotify_playlist_id"),
                track.get("playlist"),
                track.get("track_name"),
                normalize_artists(track.get("artists")),
                track.get("album"),
            )
        )

    conn.executemany(
        """
        INSERT INTO tracks (
            spotify_user_id,
            spotify_playlist_id,
            playlist,
            track_name,
            artists,
            album
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        rows,
    )

    conn.commit()
    conn.close()


def get_all_tracks(
    spotify_user_id: str,
    spotify_playlist_id: str | None = None,
) -> list[dict]:
    conn = get_connection()

    if spotify_playlist_id:
        cursor = conn.execute(
            """
            SELECT spotify_playlist_id, playlist, track_name, artists, album
            FROM tracks
            WHERE spotify_user_id = ?
            AND spotify_playlist_id = ?
            """,
            (spotify_user_id, spotify_playlist_id),
        )
    else:
        cursor = conn.execute(
            """
            SELECT spotify_playlist_id, playlist, track_name, artists, album
            FROM tracks
            WHERE spotify_user_id = ?
            """,
            (spotify_user_id,),
        )

    rows = cursor.fetchall()
    conn.close()

    tracks = []

    for row in rows:
        artists_text = row["artists"] or ""

        tracks.append(
            {
                "spotify_playlist_id": row["spotify_playlist_id"],
                "playlist": row["playlist"],
                "track_name": row["track_name"],
                "artists": [
                    artist.strip()
                    for artist in artists_text.split(",")
                    if artist.strip()
                ],
                "album": row["album"],
            }
        )

    return tracks


def save_user_playlists(spotify_user_id: str, playlists: list[dict]):
    conn = get_connection()

    playlist_ids = [
        playlist.get("id")
        for playlist in playlists
        if playlist.get("id")
    ]

    if playlist_ids:
        placeholders = ",".join(["?"] * len(playlist_ids))

        conn.execute(
            f"""
            DELETE FROM spotify_playlists
            WHERE spotify_user_id = ?
            AND spotify_playlist_id NOT IN ({placeholders})
            """,
            [spotify_user_id, *playlist_ids],
        )
    else:
        conn.execute(
            """
            DELETE FROM spotify_playlists
            WHERE spotify_user_id = ?
            """,
            (spotify_user_id,),
        )

    for playlist in playlists:
        playlist_id = playlist.get("id")

        if not playlist_id:
            continue

        owner = playlist.get("owner") or {}
        tracks = playlist.get("tracks") or {}

        conn.execute(
            """
            INSERT OR REPLACE INTO spotify_playlists (
                spotify_user_id,
                spotify_playlist_id,
                name,
                total_tracks,
                owner_name,
                is_public,
                snapshot_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                spotify_user_id,
                playlist_id,
                playlist.get("name", "Sin nombre"),
                tracks.get("total", 0),
                owner.get("display_name") or owner.get("id") or "Desconocido",
                1 if playlist.get("public") else 0,
                playlist.get("snapshot_id"),
            ),
        )

    conn.commit()
    conn.close()


def get_user_playlists(spotify_user_id: str) -> list[dict]:
    conn = get_connection()

    cursor = conn.execute(
        """
        SELECT
            spotify_playlist_id,
            name,
            total_tracks,
            owner_name,
            is_public,
            snapshot_id
        FROM spotify_playlists
        WHERE spotify_user_id = ?
        ORDER BY name COLLATE NOCASE ASC
        """,
        (spotify_user_id,),
    )

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "spotify_playlist_id": row["spotify_playlist_id"],
            "name": row["name"],
            "total_tracks": row["total_tracks"],
            "owner_name": row["owner_name"],
            "is_public": bool(row["is_public"]),
            "snapshot_id": row["snapshot_id"],
        }
        for row in rows
    ]


def get_playlist_snapshot_map(spotify_user_id: str) -> dict[str, str | None]:
    playlists = get_user_playlists(spotify_user_id)

    return {
        playlist["spotify_playlist_id"]: playlist.get("snapshot_id")
        for playlist in playlists
    }


def save_metadata(key: str, value: str):
    conn = get_connection()

    conn.execute(
        """
        INSERT OR REPLACE INTO metadata (key, value)
        VALUES (?, ?)
        """,
        (key, value),
    )

    conn.commit()
    conn.close()


def get_metadata(key: str) -> str | None:
    conn = get_connection()

    cursor = conn.execute(
        """
        SELECT value
        FROM metadata
        WHERE key = ?
        """,
        (key,),
    )

    row = cursor.fetchone()
    conn.close()

    return row["value"] if row else None



def _get_metadata_with_connection(conn, key: str) -> str | None:
    cursor = conn.execute(
        """
        SELECT value
        FROM metadata
        WHERE key = ?
        """,
        (key,),
    )
    row = cursor.fetchone()
    return row["value"] if row else None


def _save_metadata_with_connection(conn, key: str, value: str):
    conn.execute(
        """
        INSERT OR REPLACE INTO metadata (key, value)
        VALUES (?, ?)
        """,
        (key, value),
    )


def _safe_int(value: str | None, default: int = 0) -> int:
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def try_acquire_sync_lock(
    spotify_user_id: str,
    stale_after_seconds: int = 900,
) -> dict:
    """
    Reserva de forma atómica la sincronización de un usuario.

    Dos solicitudes simultáneas no pueden adquirir el mismo bloqueo.
    Un bloqueo sin actividad durante demasiado tiempo se considera abandonado.
    """
    now = int(time.time())
    stale_after_seconds = max(60, int(stale_after_seconds))

    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")

        status_key = f"sync_status:{spotify_user_id}"
        heartbeat_key = f"sync_heartbeat:{spotify_user_id}"

        current_status = _get_metadata_with_connection(conn, status_key) or "idle"
        heartbeat = _safe_int(
            _get_metadata_with_connection(conn, heartbeat_key),
            default=0,
        )

        active_sync = (
            current_status == "syncing"
            and heartbeat > 0
            and now - heartbeat < stale_after_seconds
        )

        if active_sync:
            started_at = _get_metadata_with_connection(
                conn,
                f"sync_started_at:{spotify_user_id}",
            )
            conn.commit()
            return {
                "acquired": False,
                "status": "syncing",
                "recovered_stale": False,
                "started_at": started_at,
            }

        recovered_stale = current_status == "syncing"

        _save_metadata_with_connection(conn, status_key, "syncing")
        _save_metadata_with_connection(
            conn,
            f"sync_error:{spotify_user_id}",
            "",
        )
        _save_metadata_with_connection(
            conn,
            f"sync_result:{spotify_user_id}",
            "",
        )
        _save_metadata_with_connection(
            conn,
            f"sync_started_at:{spotify_user_id}",
            str(now),
        )
        _save_metadata_with_connection(conn, heartbeat_key, str(now))
        _save_metadata_with_connection(
            conn,
            f"sync_finished_at:{spotify_user_id}",
            "",
        )

        conn.commit()

        return {
            "acquired": True,
            "status": "syncing",
            "recovered_stale": recovered_stale,
            "started_at": str(now),
        }

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def touch_sync_heartbeat(spotify_user_id: str):
    now = int(time.time())
    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")

        current_status = _get_metadata_with_connection(
            conn,
            f"sync_status:{spotify_user_id}",
        )

        if current_status == "syncing":
            _save_metadata_with_connection(
                conn,
                f"sync_heartbeat:{spotify_user_id}",
                str(now),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def mark_sync_failed(
    spotify_user_id: str,
    user_message: str,
):
    now = int(time.time())
    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")
        _save_metadata_with_connection(
            conn,
            f"sync_status:{spotify_user_id}",
            "error",
        )
        _save_metadata_with_connection(
            conn,
            f"sync_error:{spotify_user_id}",
            user_message,
        )
        _save_metadata_with_connection(
            conn,
            f"sync_result:{spotify_user_id}",
            "",
        )
        _save_metadata_with_connection(
            conn,
            f"sync_finished_at:{spotify_user_id}",
            str(now),
        )
        _save_metadata_with_connection(
            conn,
            f"sync_heartbeat:{spotify_user_id}",
            str(now),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def recover_stale_sync(
    spotify_user_id: str,
    stale_after_seconds: int = 900,
) -> bool:
    now = int(time.time())
    stale_after_seconds = max(60, int(stale_after_seconds))

    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")

        status_key = f"sync_status:{spotify_user_id}"
        heartbeat_key = f"sync_heartbeat:{spotify_user_id}"

        current_status = _get_metadata_with_connection(conn, status_key) or "idle"

        if current_status != "syncing":
            conn.commit()
            return False

        heartbeat = _safe_int(
            _get_metadata_with_connection(conn, heartbeat_key),
            default=0,
        )

        is_stale = heartbeat <= 0 or now - heartbeat >= stale_after_seconds

        if not is_stale:
            conn.commit()
            return False

        _save_metadata_with_connection(conn, status_key, "error")
        _save_metadata_with_connection(
            conn,
            f"sync_error:{spotify_user_id}",
            (
                "La actualización anterior se interrumpió. "
                "Tus datos guardados siguen disponibles; intenta actualizar nuevamente."
            ),
        )
        _save_metadata_with_connection(
            conn,
            f"sync_result:{spotify_user_id}",
            "",
        )
        _save_metadata_with_connection(
            conn,
            f"sync_finished_at:{spotify_user_id}",
            str(now),
        )
        _save_metadata_with_connection(conn, heartbeat_key, str(now))

        conn.commit()
        return True

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_sync_state(
    spotify_user_id: str,
    stale_after_seconds: int = 900,
) -> dict:
    recover_stale_sync(
        spotify_user_id,
        stale_after_seconds=stale_after_seconds,
    )

    status = get_metadata(f"sync_status:{spotify_user_id}") or "idle"
    error = get_metadata(f"sync_error:{spotify_user_id}") or ""
    result_raw = get_metadata(f"sync_result:{spotify_user_id}") or ""

    result = None

    if result_raw:
        try:
            result = json.loads(result_raw)
        except json.JSONDecodeError:
            result = None

    return {
        "status": status,
        "error": error,
        "result": result,
        "started_at": get_metadata(f"sync_started_at:{spotify_user_id}"),
        "finished_at": get_metadata(f"sync_finished_at:{spotify_user_id}"),
    }


def apply_music_sync(
    spotify_user_id: str,
    playlists: list[dict],
    tracks_by_playlist: dict[str, list[dict]],
    sync_result: dict,
    synced_at: str,
):
    """
    Aplica toda la sincronización en una sola transacción.

    Nada se elimina ni se reemplaza hasta que Spotify terminó de entregar
    todas las playlists que necesitaban actualizarse. Si esta transacción
    falla, SQLite revierte los cambios y conserva el análisis anterior.
    """
    current_playlist_ids = [
        playlist.get("id")
        for playlist in playlists
        if playlist.get("id")
    ]

    now = int(time.time())
    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")

        if current_playlist_ids:
            placeholders = ",".join(["?"] * len(current_playlist_ids))

            conn.execute(
                f"""
                DELETE FROM spotify_playlists
                WHERE spotify_user_id = ?
                AND spotify_playlist_id NOT IN ({placeholders})
                """,
                [spotify_user_id, *current_playlist_ids],
            )

            conn.execute(
                f"""
                DELETE FROM tracks
                WHERE spotify_user_id = ?
                AND spotify_playlist_id NOT IN ({placeholders})
                """,
                [spotify_user_id, *current_playlist_ids],
            )
        else:
            conn.execute(
                """
                DELETE FROM spotify_playlists
                WHERE spotify_user_id = ?
                """,
                (spotify_user_id,),
            )
            conn.execute(
                """
                DELETE FROM tracks
                WHERE spotify_user_id = ?
                """,
                (spotify_user_id,),
            )

        for playlist in playlists:
            playlist_id = playlist.get("id")

            if not playlist_id:
                continue

            owner = playlist.get("owner") or {}
            tracks_info = playlist.get("tracks") or {}
            playlist_name = playlist.get("name", "Sin nombre")

            conn.execute(
                """
                INSERT OR REPLACE INTO spotify_playlists (
                    spotify_user_id,
                    spotify_playlist_id,
                    name,
                    total_tracks,
                    owner_name,
                    is_public,
                    snapshot_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    spotify_user_id,
                    playlist_id,
                    playlist_name,
                    tracks_info.get("total", 0),
                    owner.get("display_name")
                    or owner.get("id")
                    or "Desconocido",
                    1 if playlist.get("public") else 0,
                    playlist.get("snapshot_id"),
                ),
            )

            conn.execute(
                """
                UPDATE tracks
                SET playlist = ?
                WHERE spotify_user_id = ?
                AND spotify_playlist_id = ?
                """,
                (playlist_name, spotify_user_id, playlist_id),
            )

        for playlist_id, tracks in tracks_by_playlist.items():
            conn.execute(
                """
                DELETE FROM tracks
                WHERE spotify_user_id = ?
                AND spotify_playlist_id = ?
                """,
                (spotify_user_id, playlist_id),
            )

            rows = []

            for track in tracks:
                rows.append(
                    (
                        spotify_user_id,
                        track.get("spotify_playlist_id"),
                        track.get("playlist"),
                        track.get("track_name"),
                        normalize_artists(track.get("artists")),
                        track.get("album"),
                    )
                )

            if rows:
                conn.executemany(
                    """
                    INSERT INTO tracks (
                        spotify_user_id,
                        spotify_playlist_id,
                        playlist,
                        track_name,
                        artists,
                        album
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    rows,
                )

        _save_metadata_with_connection(
            conn,
            f"last_sync:{spotify_user_id}",
            synced_at,
        )
        _save_metadata_with_connection(
            conn,
            f"sync_status:{spotify_user_id}",
            "completed",
        )
        _save_metadata_with_connection(
            conn,
            f"sync_error:{spotify_user_id}",
            "",
        )
        _save_metadata_with_connection(
            conn,
            f"sync_result:{spotify_user_id}",
            json.dumps(sync_result, ensure_ascii=False),
        )
        _save_metadata_with_connection(
            conn,
            f"sync_finished_at:{spotify_user_id}",
            str(now),
        )
        _save_metadata_with_connection(
            conn,
            f"sync_heartbeat:{spotify_user_id}",
            str(now),
        )

        conn.commit()

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_spotify_token(
    spotify_user_id: str,
    access_token: str,
    refresh_token: str | None,
    expires_at: int,
):
    conn = get_connection()

    cursor = conn.execute(
        """
        SELECT refresh_token
        FROM spotify_tokens
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,),
    )

    existing = cursor.fetchone()
    final_refresh_token = refresh_token

    if not final_refresh_token and existing:
        final_refresh_token = existing["refresh_token"]

    conn.execute(
        """
        INSERT OR REPLACE INTO spotify_tokens (
            spotify_user_id,
            access_token,
            refresh_token,
            expires_at
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            spotify_user_id,
            access_token,
            final_refresh_token,
            expires_at,
        ),
    )

    conn.commit()
    conn.close()


def get_spotify_token(spotify_user_id: str) -> dict | None:
    conn = get_connection()

    cursor = conn.execute(
        """
        SELECT spotify_user_id, access_token, refresh_token, expires_at
        FROM spotify_tokens
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "spotify_user_id": row["spotify_user_id"],
        "access_token": row["access_token"],
        "refresh_token": row["refresh_token"],
        "expires_at": row["expires_at"],
    }


def delete_spotify_token(spotify_user_id: str):
    conn = get_connection()

    conn.execute(
        """
        DELETE FROM spotify_tokens
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,),
    )

    conn.commit()
    conn.close()


def save_spotify_user(
    spotify_user_id: str,
    display_name: str | None,
    email: str | None,
    image_url: str | None,
):
    conn = get_connection()

    conn.execute(
        """
        INSERT OR REPLACE INTO spotify_users (
            spotify_user_id,
            display_name,
            email,
            image_url,
            last_login
        )
        VALUES (?, ?, ?, ?, datetime('now'))
        """,
        (
            spotify_user_id,
            display_name,
            email,
            image_url,
        ),
    )

    conn.commit()
    conn.close()


def get_spotify_user(spotify_user_id: str) -> dict | None:
    conn = get_connection()

    cursor = conn.execute(
        """
        SELECT spotify_user_id, display_name, email, image_url, last_login
        FROM spotify_users
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "spotify_user_id": row["spotify_user_id"],
        "display_name": row["display_name"],
        "email": row["email"],
        "image_url": row["image_url"],
        "last_login": row["last_login"],
    }
