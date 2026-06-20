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
            playlist TEXT,
            track_name TEXT,
            artists TEXT,
            album TEXT
        )
    """)

    conn.commit()
    conn.close()


def clear_tracks():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM tracks")

    conn.commit()
    conn.close()


def save_tracks(tracks):
    conn = get_connection()
    cursor = conn.cursor()

    for track in tracks:
        cursor.execute(
            """
            INSERT INTO tracks (playlist, track_name, artists, album)
            VALUES (?, ?, ?, ?)
            """,
            (
                track["playlist"],
                track["track_name"],
                ", ".join(track["artists"]),
                track["album"],
            )
        )

    conn.commit()
    conn.close()

    
def get_all_tracks():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT playlist, track_name, artists, album FROM tracks")
    rows = cursor.fetchall()

    conn.close()

    tracks = []

    for row in rows:
        tracks.append({
            "playlist": row[0],
            "track_name": row[1],
            "artists": row[2].split(", "),
            "album": row[3],
        })

    return tracks