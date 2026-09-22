# Single-container build: the Next.js frontend and FastAPI backend ship
# together and run as two processes in one Railway service (see start.sh).
# The frontend proxies "/api/*" to the backend over localhost (see
# next.config.ts), so the browser only ever talks to one origin - no CORS,
# no separate public backend URL to keep in sync.
#
# Debian-slim (glibc) is used throughout, not Alpine, because the backend's
# psycopg2-binary dependency ships glibc-only wheels and doesn't install
# cleanly against Alpine's musl libc.

FROM node:20-bookworm-slim AS web-deps
WORKDIR /web
COPY package*.json ./
RUN npm ci

FROM node:20-bookworm-slim AS web-builder
WORKDIR /web
COPY --from=web-deps /web/node_modules ./node_modules
COPY . .
# Same-origin default - the browser calls "/api/*" on its own origin, which
# next.config.ts rewrites server-side to the FastAPI backend.
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM python:3.11-slim AS api-deps
WORKDIR /api
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
# The backend listens only on localhost; Next.js proxies to it (see
# next.config.ts). Only Next.js's port is exposed to the outside world.
ENV API_INTERNAL_URL=http://127.0.0.1:8000
ENV HOSTNAME=0.0.0.0

# Node.js runtime, to run the Next.js standalone server alongside the backend.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y curl gnupg \
    && rm -rf /var/lib/apt/lists/*

# Backend: installed packages plus the app's own source files.
COPY --from=api-deps /install /usr/local
COPY backend/main.py backend/auth.py backend/database.py backend/mailer.py backend/models.py ./backend/

# Frontend: standalone server output.
COPY --from=web-builder /web/.next/standalone ./
COPY --from=web-builder /web/public ./public
COPY --from=web-builder /web/.next/static ./.next/static

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000
CMD ["./start.sh"]
