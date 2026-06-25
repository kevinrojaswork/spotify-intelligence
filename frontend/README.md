# Spotify Intelligence

Spotify Intelligence es una aplicación web que analiza una biblioteca de Spotify y genera estadísticas, ADN Musical e insights inteligentes.

## Estado

MVP v1.0 publicado.

## Tecnologías

- Frontend: React, TypeScript, Vite
- Backend: Python, FastAPI
- Base de datos: SQLite
- API: Spotify Web API
- Deploy frontend: Vercel
- Deploy backend: Railway

## Funciones actuales

- Login con Spotify
- Sincronización de playlists
- Dashboard con datos reales
- Top artistas
- Top canciones
- Top álbumes
- Canciones duplicadas
- ADN Musical
- Insights inteligentes

## Iniciar frontend

```bash
cd frontend
npm install
npm run dev


Iniciar backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload


Variables de entorno del backend

Crear un archivo .env dentro de backend:

SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/auth/callback

Producción

Frontend:
https://spotify-intelligence.vercel.app

Backend:
https://spotify-intelligence-production.up.railway.app

Roadmap
Mejorar diseño móvil
Agregar gráficos
Agregar análisis por géneros
Agregar décadas favoritas
Agregar recomendaciones
Integrar IA