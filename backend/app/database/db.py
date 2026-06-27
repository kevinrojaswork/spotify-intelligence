import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).resolve().parent / "spotify_intelligence.db"


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spotify_user_id TEXT,
            playlist TEXT,
            track_name TEXT,
            artists TEXT,
            album TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spotify_tokens (
            spotify_user_id TEXT PRIMARY KEY,
            access_token TEXT,
            refresh_token TEXT,
            expires_at INTEGER
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spotify_users (
            spotify_user_id TEXT PRIMARY KEY,
            display_name TEXT,
            email TEXT,
            image_url TEXT,
            last_login TEXT
        )
    """)

    conn.commit()
    conn.close()

    migrate_tracks_table()
    migrate_spotify_tokens_table()
    migrate_spotify_users_table()


def migrate_tracks_table():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(tracks)")
    columns = [column[1] for column in cursor.fetchall()]

    if "spotify_user_id" not in columns:
        cursor.execute("ALTER TABLE tracks ADD COLUMN spotify_user_id TEXT")

    conn.commit()
    conn.close()


def migrate_spotify_tokens_table():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spotify_tokens (
            spotify_user_id TEXT PRIMARY KEY,
            access_token TEXT,
            refresh_token TEXT,
            expires_at INTEGER
        )
    """)

    cursor.execute("PRAGMA table_info(spotify_tokens)")
    columns = [column[1] for column in cursor.fetchall()]

    if "access_token" not in columns:
        cursor.execute("ALTER TABLE spotify_tokens ADD COLUMN access_token TEXT")

    if "refresh_token" not in columns:
        cursor.execute("ALTER TABLE spotify_tokens ADD COLUMN refresh_token TEXT")

    if "expires_at" not in columns:
        cursor.execute("ALTER TABLE spotify_tokens ADD COLUMN expires_at INTEGER")

    conn.commit()
    conn.close()


def migrate_spotify_users_table():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spotify_users (
            spotify_user_id TEXT PRIMARY KEY,
            display_name TEXT,
            email TEXT,
            image_url TEXT,
            last_login TEXT
        )
    """)

    cursor.execute("PRAGMA table_info(spotify_users)")
    columns = [column[1] for column in cursor.fetchall()]

    if "display_name" not in columns:
        cursor.execute("ALTER TABLE spotify_users ADD COLUMN display_name TEXT")

    if "email" not in columns:
        cursor.execute("ALTER TABLE spotify_users ADD COLUMN email TEXT")

    if "image_url" not in columns:
        cursor.execute("ALTER TABLE spotify_users ADD COLUMN image_url TEXT")

    if "last_login" not in columns:
        cursor.execute("ALTER TABLE spotify_users ADD COLUMN last_login TEXT")

    conn.commit()
    conn.close()


def clear_tracks(spotify_user_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM tracks WHERE spotify_user_id = ?",
        (spotify_user_id,)
    )

    conn.commit()
    conn.close()


def save_tracks(spotify_user_id, tracks):
    conn = get_connection()
    cursor = conn.cursor()

    for track in tracks:
        cursor.execute(
            """
            INSERT INTO tracks (
                spotify_user_id,
                playlist,
                track_name,
                artists,
                album
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                spotify_user_id,
                track["playlist"],
                track["track_name"],
                ", ".join(track["artists"]),
                track["album"],
            )
        )

    conn.commit()
    conn.close()


def get_all_tracks(spotify_user_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT playlist, track_name, artists, album
        FROM tracks
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,)
    )

    rows = cursor.fetchall()
    conn.close()

    tracks = []

    for row in rows:
        tracks.append({
            "playlist": row[0],
            "track_name": row[1],
            "artists": row[2].split(", ") if row[2] else [],
            "album": row[3],
        })

    return tracks


def save_metadata(key, value):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT OR REPLACE INTO metadata (key, value)
        VALUES (?, ?)
        """,
        (key, value)
    )

    conn.commit()
    conn.close()


def get_metadata(key):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT value FROM metadata WHERE key = ?", (key,))
    row = cursor.fetchone()

    conn.close()

    return row[0] if row else None


def save_spotify_token(
    spotify_user_id,
    access_token,
    refresh_token,
    expires_at,
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT refresh_token
        FROM spotify_tokens
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,)
    )

    existing_row = cursor.fetchone()
    existing_refresh_token = existing_row[0] if existing_row else None
    final_refresh_token = refresh_token or existing_refresh_token

    cursor.execute(
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
        )
    )

    conn.commit()
    conn.close()


def get_spotify_token(spotify_user_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT access_token, refresh_token, expires_at
        FROM spotify_tokens
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,)
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "access_token": row[0],
        "refresh_token": row[1],
        "expires_at": row[2],
    }


def delete_spotify_token(spotify_user_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM spotify_tokens WHERE spotify_user_id = ?",
        (spotify_user_id,)
    )

    conn.commit()
    conn.close()


def save_spotify_user(
    spotify_user_id,
    display_name=None,
    email=None,
    image_url=None,
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT OR REPLACE INTO spotify_users (
            spotify_user_id,
            display_name,
            email,
            image_url,
            last_login
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            spotify_user_id,
            display_name,
            email,
            image_url,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
    )

    conn.commit()
    conn.close()


def get_spotify_user(spotify_user_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT spotify_user_id, display_name, email, image_url, last_login
        FROM spotify_users
        WHERE spotify_user_id = ?
        """,
        (spotify_user_id,)
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "spotify_user_id": row[0],
        "display_name": row[1],
        "email": row[2],
        "image_url": row[3],
        "last_login": row[4],
    }