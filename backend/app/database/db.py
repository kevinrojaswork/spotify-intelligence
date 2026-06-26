import sqlite3
from pathlib import Path

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

    conn.commit()
    conn.close()

    migrate_tracks_table()


def migrate_tracks_table():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(tracks)")
    columns = [column[1] for column in cursor.fetchall()]

    if "spotify_user_id" not in columns:
        cursor.execute("ALTER TABLE tracks ADD COLUMN spotify_user_id TEXT")

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