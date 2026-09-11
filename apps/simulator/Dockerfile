FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/realtime/package.json apps/realtime/
COPY apps/simulator/package.json apps/simulator/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/ingest/package.json apps/ingest/
COPY packages/config/package.json packages/config/

RUN npm ci -w @imc/simulator -w @imc/shared-types

COPY packages/shared-types packages/shared-types
COPY apps/simulator apps/simulator

ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@imc/simulator"]
