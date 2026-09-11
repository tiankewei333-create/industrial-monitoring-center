# Feasibility: Four Portfolio Projects

> Mapped against the 24-month Industrial Digital Twin Engineer plan and the current IMC repo.

## Verdict

**Feasible — if treated as one capability line with four portfolio packages, not four unrelated greenfield repos.**

| Project | Rating | Recommendation |
|---|---|---|
| P1 CNC Configurator | Medium–High | Doable; commercial showcase for US remote work |
| P2 Machine Monitoring | **High** | **Main line** — already overlapping with IMC |
| P3 Smart Factory Twin | Medium | Upgrade of P2; single workshop + extensible twin engine only |
| P4 Robot Twin | Medium | 2-month MVP; attach as a workshop module |

Excel: `Industrial-Digital-Twin-Engineer-24个月执行路线表.xlsx`  
Personal Chinese notes: [../zh/feasibility-assessment.zh.md](../zh/feasibility-assessment.zh.md)

---

## P1 — CNC Machine Configurator (M1–M6)

**Why feasible:** Clear stack (R3F + Blender + config state); six months is enough for a deployable demo that matches “3D Product Configurator” keywords.

**Risks:** Becomes a spinning model without config state, quote logic, or performance evidence; steals time from MQTT/alarm skills.

**Must ship:** GLB load, part select, explode view, 2–3 config options, English README, public deploy.  
**Can cut:** Full quoting engine, ERP integration.

---

## P2 — Industrial Machine Monitoring (M7–M12)

**Why high confidence:** IMC already has MQTT → realtime → WS → UI, mock login, and docs. Rebuilding another monitoring repo is waste.

**Do this:** Treat IMC as Portfolio Project 2; deepen assets → alarms → history → 3D/shader → Docker; use conventional English commits.

---

## P3 — Smart Factory Digital Twin (M13–M18)

**Why constrained:** Full “smart factory + OPC-UA + energy + multi-line twin” exceeds one person in six months.

**Feasible definition:** Extract Twin Engine (asset registry + data binding + scene mapping) from P2, add OPC-UA **simulator**, enhance line-level scene — not Omniverse-scale plant.

| Do | Don't |
|---|---|
| Asset / twin binding layer | Multi-plant federation |
| Single workshop + 2D/3D link | Full physics simulation |
| OPC-UA simulation | Safety-certified field integration |
| Stronger energy panel | Full APS / MES |

---

## P4 — Robot Digital Twin (M19–M20)

**Feasible MVP:** Six-axis model + joint FK + simple trajectory + status panel.  
**Not realistic:** Full ROS2 ecosystem — concepts only; keep data on WS/MQTT.

Ship as `Robot-01` inside the workshop, reusing P2/P3 pipelines.

---

## Execution risks

1. 6h/day × 24 months is optimistic — if capacity drops, cut P1 quoting, ROS2, and P3 energy depth.  
2. DE + EN language tracks compete with greenfield repos — keep one engineering main line.  
3. US remote rates need a clickable demo more than another library.  
4. German hiring cares about runnable industrial closed loops more than shader fireworks.

## Recommended shape

```
Now     → deepen IMC as P2
Side    → P1 in a separate repo (weekends)
M13+    → evolve P2 into P3 (twin engine + OPC-UA sim)
M19-20  → P4 robot module
M21-24  → portfolio site + DE/EN job search
```
