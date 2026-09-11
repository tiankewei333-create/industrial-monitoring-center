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

RUN npm ci -w @imc/realtime -w @imc/shared-types

COPY packages/shared-types packages/shared-types
COPY apps/realtime apps/realtime
COPY deploy/sql deploy/sql

ENV NODE_ENV=production
ENV IMC_EMBED_MQTT=false
ENV PORT=3002
EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3002/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "-w", "@imc/realtime"]
