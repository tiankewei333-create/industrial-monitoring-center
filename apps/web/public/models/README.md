# Twin 3D models

Stand-in low-poly **glTF (GLB)** assets for Workshop Twin.

| File | Asset type |
|---|---|
| `cnc.glb` | CNC |
| `robot.glb` | ROBOT |
| `conveyor.glb` | CONVEYOR |
| `sensor.glb` | SENSOR |
| `warehouse.glb` | WAREHOUSE |
| `energy.glb` | ENERGY |

Regenerate:

```bash
npm run models:twin
```

Replace any file with a Blender export of the **same name** (unit ~1×1×1, origin at floor center). Placement scale still comes from `twinLayout.ts`.
