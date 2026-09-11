# Build static web assets
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/realtime/package.json apps/realtime/
COPY apps/simulator/package.json apps/simulator/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/ingest/package.json apps/ingest/
COPY packages/config/package.json packages/config/

RUN npm ci -w @imc/web -w @imc/shared-types

COPY packages/shared-types packages/shared-types
COPY apps/web apps/web

# Same-origin /ws via nginx (see deploy/nginx/default.conf)
RUN npm run build -w @imc/web

# Serve with nginx (SPA + WS proxy)
FROM nginx:1.27-alpine
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
  CMD wget -qO- http://127.0.0.1/ || exit 1
