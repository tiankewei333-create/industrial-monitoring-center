/**
 * Generate low-poly stand-in glTF (.gltf + .bin) for Workshop Twin.
 * No browser APIs — pure Node buffers.
 *
 * Run: node scripts/generate-twin-models.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../apps/web/public/models");

const TYPES = ["CNC", "ROBOT", "CONVEYOR", "SENSOR", "WAREHOUSE", "ENERGY"];

/** @typedef {{ x:number,y:number,z:number }} Vec3 */
/** @typedef {{ min:Vec3, max:Vec3 }} Box */

function boxMesh(w, h, d, cx, cy, cz) {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  // 8 corners relative to center
  const c = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, hy, -hz],
    [-hx, hy, -hz],
    [-hx, -hy, hz],
    [hx, -hy, hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ].map(([x, y, z]) => [x + cx, y + cy, z + cz]);

  // 6 faces, each 2 tris, with flat normals
  const faces = [
    { idx: [0, 1, 2, 0, 2, 3], n: [0, 0, -1] }, // -Z
    { idx: [5, 4, 7, 5, 7, 6], n: [0, 0, 1] }, // +Z
    { idx: [4, 0, 3, 4, 3, 7], n: [-1, 0, 0] }, // -X
    { idx: [1, 5, 6, 1, 6, 2], n: [1, 0, 0] }, // +X
    { idx: [3, 2, 6, 3, 6, 7], n: [0, 1, 0] }, // +Y
    { idx: [4, 5, 1, 4, 1, 0], n: [0, -1, 0] }, // -Y
  ];

  const positions = [];
  const normals = [];
  const indices = [];
  let base = 0;
  for (const f of faces) {
    for (const i of f.idx) {
      positions.push(...c[i]);
      normals.push(...f.n);
    }
    indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
    base += 6;
  }
  return { positions, normals, indices };
}

function cylMesh(r, h, cx, cy, cz, segments = 12) {
  const positions = [];
  const normals = [];
  const indices = [];
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;

  // side
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * r;
    const z0 = cz + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const z1 = cz + Math.sin(a1) * r;
    const nx0 = Math.cos(a0);
    const nz0 = Math.sin(a0);
    const nx1 = Math.cos(a1);
    const nz1 = Math.sin(a1);
    const base = positions.length / 3;
    positions.push(x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0);
    normals.push(nx0, 0, nz0, nx1, 0, nz1, nx1, 0, nz1, nx0, 0, nz0);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // caps
  for (const [y, ny] of [
    [y0, -1],
    [y1, 1],
  ]) {
    const center = positions.length / 3;
    positions.push(cx, y, cz);
    normals.push(0, ny, 0);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      positions.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      normals.push(0, ny, 0);
    }
    for (let i = 0; i < segments; i++) {
      const i0 = center;
      const i1 = center + 1 + i;
      const i2 = center + 1 + ((i + 1) % segments);
      if (ny > 0) indices.push(i0, i1, i2);
      else indices.push(i0, i2, i1);
    }
  }

  return { positions, normals, indices };
}

function mergeMeshes(parts) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (const p of parts) {
    const base = positions.length / 3;
    positions.push(...p.positions);
    normals.push(...p.normals);
    for (const i of p.indices) indices.push(i + base);
  }
  return { positions, normals, indices };
}

function buildGeometry(type) {
  switch (type) {
    case "CNC":
      return mergeMeshes([
        boxMesh(1.0, 0.25, 0.75, 0, 0.125, 0),
        boxMesh(0.85, 0.55, 0.55, 0, 0.525, 0),
        boxMesh(0.35, 0.2, 0.35, 0, 0.9, 0),
        cylMesh(0.08, 0.35, 0.25, 0.7, 0),
      ]);
    case "ROBOT":
      return mergeMeshes([
        cylMesh(0.3, 0.2, 0, 0.1, 0),
        cylMesh(0.13, 0.55, 0, 0.475, 0),
        boxMesh(0.55, 0.14, 0.14, 0.2, 0.85, 0),
        boxMesh(0.14, 0.14, 0.4, 0.45, 0.85, 0.1),
        boxMesh(0.12, 0.12, 0.12, 0.45, 0.85, 0.28),
      ]);
    case "CONVEYOR":
      return mergeMeshes([
        boxMesh(1.0, 0.12, 0.35, 0, 0.06, 0),
        boxMesh(0.95, 0.06, 0.28, 0, 0.16, 0),
        cylMesh(0.07, 0.32, -0.42, 0.12, 0),
        cylMesh(0.07, 0.32, 0.42, 0.12, 0),
      ]);
    case "SENSOR":
      return mergeMeshes([
        cylMesh(0.14, 0.15, 0, 0.075, 0),
        cylMesh(0.06, 0.45, 0, 0.375, 0),
        cylMesh(0.1, 0.08, 0, 0.64, 0),
      ]);
    case "WAREHOUSE":
      return mergeMeshes([
        boxMesh(1.0, 0.08, 0.7, 0, 0.04, 0),
        boxMesh(0.92, 0.05, 0.62, 0, 0.25, 0),
        boxMesh(0.92, 0.05, 0.62, 0, 0.5, 0),
        boxMesh(0.92, 0.05, 0.62, 0, 0.75, 0),
        boxMesh(0.05, 0.9, 0.05, -0.42, 0.5, -0.28),
        boxMesh(0.05, 0.9, 0.05, 0.42, 0.5, -0.28),
        boxMesh(0.05, 0.9, 0.05, -0.42, 0.5, 0.28),
        boxMesh(0.05, 0.9, 0.05, 0.42, 0.5, 0.28),
      ]);
    case "ENERGY":
      return mergeMeshes([
        boxMesh(0.7, 0.9, 0.45, 0, 0.45, 0),
        boxMesh(0.55, 0.15, 0.12, 0, 0.75, 0.2),
        boxMesh(0.2, 0.25, 0.08, -0.15, 0.35, 0.2),
        boxMesh(0.2, 0.25, 0.08, 0.15, 0.35, 0.2),
      ]);
    default:
      return boxMesh(1, 1, 1, 0, 0.5, 0);
  }
}

function bounds(positions) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    min.x = Math.min(min.x, x);
    min.y = Math.min(min.y, y);
    min.z = Math.min(min.z, z);
    max.x = Math.max(max.x, x);
    max.y = Math.max(max.y, y);
    max.z = Math.max(max.z, z);
  }
  return { min, max };
}

function normalize(positions) {
  const b = bounds(positions);
  const sx = b.max.x - b.min.x || 1;
  const sy = b.max.y - b.min.y || 1;
  const sz = b.max.z - b.min.z || 1;
  const maxDim = Math.max(sx, sy, sz);
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = (positions[i] - cx) / maxDim;
    out[i + 1] = (positions[i + 1] - b.min.y) / maxDim;
    out[i + 2] = (positions[i + 2] - cz) / maxDim;
  }
  return out;
}

function alignBytes(n) {
  return (n + 3) & ~3;
}

function writeGlb(positions, normals, indices, filePath) {
  const pos = normalize(positions);
  const nor = new Float32Array(normals);
  const idx = new Uint16Array(indices);

  const posBytes = pos.byteLength;
  const norBytes = nor.byteLength;
  const idxBytes = idx.byteLength;
  const norOffset = alignBytes(posBytes);
  const idxOffset = alignBytes(norOffset + norBytes);
  const binSize = alignBytes(idxOffset + idxBytes);
  const bin = Buffer.alloc(binSize);
  Buffer.from(pos.buffer, pos.byteOffset, posBytes).copy(bin, 0);
  Buffer.from(nor.buffer, nor.byteOffset, norBytes).copy(bin, norOffset);
  Buffer.from(idx.buffer, idx.byteOffset, idxBytes).copy(bin, idxOffset);

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]);
    minY = Math.min(minY, pos[i + 1]);
    minZ = Math.min(minZ, pos[i + 2]);
    maxX = Math.max(maxX, pos[i]);
    maxY = Math.max(maxY, pos[i + 1]);
    maxZ = Math.max(maxZ, pos[i + 2]);
  }

  const gltf = {
    asset: { version: "2.0", generator: "imc-generate-twin-models" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1 },
            indices: 2,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: "body",
        pbrMetallicRoughness: {
          baseColorFactor: [0.45, 0.5, 0.58, 1],
          metallicFactor: 0.35,
          roughnessFactor: 0.45,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: pos.length / 3,
        type: "VEC3",
        max: [maxX, maxY, maxZ],
        min: [minX, minY, minZ],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: nor.length / 3,
        type: "VEC3",
      },
      {
        bufferView: 2,
        componentType: 5123,
        count: idx.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: norOffset, byteLength: norBytes, target: 34962 },
      { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes, target: 34963 },
    ],
    buffers: [{ byteLength: binSize }],
  };

  const json = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPad = alignBytes(json.length);
  const jsonChunk = Buffer.alloc(jsonPad, 0x20);
  json.copy(jsonChunk);

  const total = 12 + 8 + jsonPad + 8 + binSize;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0); // glTF
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonPad, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // JSON
  jsonChunk.copy(out, 20);
  const binHeader = 20 + jsonPad;
  out.writeUInt32LE(binSize, binHeader);
  out.writeUInt32LE(0x004e4942, binHeader + 4); // BIN
  bin.copy(out, binHeader + 8);

  fs.writeFileSync(filePath, out);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const type of TYPES) {
    const geo = buildGeometry(type);
    const file = path.join(OUT_DIR, `${type.toLowerCase()}.glb`);
    writeGlb(geo.positions, geo.normals, geo.indices, file);
    const st = fs.statSync(file);
    console.log(`[models] wrote ${file} (${st.size} bytes)`);
  }
  console.log(`[models] done → ${OUT_DIR}`);
}

main();
