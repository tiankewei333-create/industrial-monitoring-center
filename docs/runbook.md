# Runbook（骨架）

## 启动基础设施

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml --env-file .env up -d
docker compose -f deploy/docker-compose.yml --env-file .env ps
```

## 停止

```bash
docker compose -f deploy/docker-compose.yml --env-file .env down
```

## 健康检查（应用落地后）

- API：`GET http://localhost:3001/health`
- Realtime：`GET http://localhost:3002/health`

## 备份 / 恢复

TODO（Q3）：Postgres dump / restore 脚本。
