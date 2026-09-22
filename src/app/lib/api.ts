// Base URL for backend API calls.
//
// Defaults to the same-origin "/api" path, which next.config.ts rewrites
// server-side to the FastAPI backend (see API_INTERNAL_URL there). Because
// the browser only ever talks to the Next.js origin, there's no CORS to
// configure and no separate public URL to keep in sync.
//
// Set NEXT_PUBLIC_API_URL explicitly only when the frontend and backend are
// built and deployed as separate, differently-hosted services (e.g. the
// two-container docker-compose setup) - it overrides the same-origin default
// with a direct, absolute URL to the backend.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
