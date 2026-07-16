import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError


SESSION_ALGORITHM = "HS256"
SESSION_DURATION_DAYS = 30
bearer_scheme = HTTPBearer(auto_error=False)


def _get_session_secret() -> str:
    secret = os.getenv("SESSION_SECRET", "").strip()

    if len(secret) < 32:
        raise RuntimeError(
            "SESSION_SECRET debe existir y tener al menos 32 caracteres."
        )

    return secret


def create_session_token(spotify_user_id: str) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": spotify_user_id,
        "iat": now,
        "exp": now + timedelta(days=SESSION_DURATION_DAYS),
        "type": "spotify_session",
    }

    return jwt.encode(
        payload,
        _get_session_secret(),
        algorithm=SESSION_ALGORITHM,
    )


def get_authenticated_spotify_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no válida. Conecta Spotify nuevamente.",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            _get_session_secret(),
            algorithms=[SESSION_ALGORITHM],
        )
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión expiró o no es válida. Conecta Spotify nuevamente.",
        )

    spotify_user_id = payload.get("sub")
    token_type = payload.get("type")

    if not spotify_user_id or token_type != "spotify_session":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión no contiene una identidad válida.",
        )

    return str(spotify_user_id)
