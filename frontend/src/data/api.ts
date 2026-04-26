// Base URL for backend HTTP calls. In dev, leave VITE_API_URL unset so the
// Vite `/api` proxy (see vite.config.ts) handles routing — `API_BASE` is `''`
// and fetches like `${API_BASE}/api/cases` stay relative. In production
// builds, set VITE_API_URL to the backend's absolute URL.
export const API_BASE = import.meta.env.VITE_API_URL || '';
