from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import auth, profile, playlists, artists, songs, engine

app = FastAPI(title="Spotify Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://spotify-intelligence.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(profile.router, tags=["Profile"])
app.include_router(playlists.router, tags=["Playlists"])
app.include_router(artists.router, tags=["Artists"])
app.include_router(songs.router, tags=["Songs"])
app.include_router(engine.router, tags=["Engine"])

@app.get("/")
def home():
    return {"message": "Spotify Intelligence API funcionando"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "spotify-intelligence-backend"
    }