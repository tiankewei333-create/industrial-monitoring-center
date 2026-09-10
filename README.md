# Industrial Monitoring Center (IMC)

单车间工业监控数字孪生：**采集 → 存储 → 推送 → 3D/告警**。

当前已打通 MVP 主路径：

```
imc-simulator ──MQTT──► (embedded Aedes / Mosquitto) ──MQTT──► imc-realtime ──WS──► imc-web
```

> `imc-ingest` 暂由 realtime 兼任订阅；后续再拆独立接入网关。

## 1. 环境要求

- Node.js ≥ 20
- 可选：Docker（外部 Mosquitto / Postgres；本地开发默认不需要）

## 2. 30 秒启动实时链路（推荐）

```bash
cd D:\projects\industrial-monitoring-center
cp .env.example .env
npm install
npm run dev:live
```

然后打开：http://127.0.0.1:3000

应看到：

- 顶栏 **WS open**
- **MQTT live**
- `Machine001` 温度/转速/功率约每秒刷新

### 验收 Checklist

- [ ] 页面温度数字在变
- [ ] 状态会出现 `RUNNING` / 偶尔 `FAULT`
- [ ] 停掉 simulator 后，页面不再更新（链路真实，非前端假刷新）
- [ ] `curl http://127.0.0.1:3002/health` 返回 `"ok": true`

## 3. 分进程启动

```bash
npm run dev:realtime    # :3002  WS + 可选内嵌 MQTT :1883
npm run dev:simulator   # 发布 Machine001
npm run dev:web         # :3000
```

关闭内嵌 Broker、改用 Compose Mosquitto：

```bash
# terminal A
docker compose -f deploy/docker-compose.yml --env-file .env up -d mosquitto

# .env 中设置
IMC_EMBED_MQTT=false
MQTT_URL=mqtt://127.0.0.1:1883

npm run dev:realtime
npm run dev:simulator
npm run dev:web
```

## 4. 仓库结构

```
apps/web          实时面板（React + Vite）
apps/realtime     MQTT→WebSocket 桥（可内嵌 Broker）
apps/simulator    假设备发布器
apps/api          业务 API（尚未初始化）
apps/ingest       独立接入（占位，MVP 由 realtime 兼任）
packages/shared-types  协议类型
deploy/           docker-compose 空壳
```

## 5. 协议

见 `docs/protocol.md` 与 `packages/shared-types/src/index.ts`。

## 6. 文档索引（建议阅读顺序）

1. **[docs/business-logic.md](docs/business-logic.md)** ← 先看：业务逻辑总图与流程  
2. [docs/project-plan.md](docs/project-plan.md)（中文文件名同内容：[docs/项目需求与规划书.md](docs/项目需求与规划书.md)）  
3. [docs/ui-designs/](docs/ui-designs/) UI 设计稿 8 张  
4. [docs/architecture.md](docs/architecture.md) · [docs/protocol.md](docs/protocol.md) · [docs/runbook.md](docs/runbook.md)

## 7. Year 1 冻结

1. 单车间 Workshop A  
2. React + Three.js（3D 后续）  
3. 接入优先 MQTT  
4. 前端走自有 WS，不直连 Broker  
5. 每季度可运行验收  
