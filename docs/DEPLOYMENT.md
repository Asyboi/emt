# Deployment

## Frontend — Cloudflare Pages

- **Provider:** Cloudflare Pages
- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 18+

### Environment variables (Cloudflare Pages → Settings → Environment variables)

- `VITE_API_URL` — fully qualified URL of the deployed backend (e.g. `https://sentinel-api.example.com`). When unset, the frontend assumes a same-origin/`/api` proxy (used in local dev via Vite).

### Static asset config

- `frontend/_headers` — custom HTTP headers per route
- `frontend/_redirects` — redirect/rewrite rules (add SPA fallback once client routing is introduced)

## Backend — self-hosted

The backend is a FastAPI app and can run on any Python 3.11+ host (Fly.io, Railway, a VPS, etc.).

### Setup

```bash
cd backend
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### CORS

Set `FRONTEND_ORIGIN` in the backend env to the Cloudflare Pages domain (e.g. `https://sentinel.pages.dev`) so the API accepts cross-origin requests from the deployed frontend.

### Required env vars

See `.env.example` at the repo root.
