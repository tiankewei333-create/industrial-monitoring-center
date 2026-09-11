import type { AssetType } from "@imc/shared-types";

/** Workshop A floor positions (meters). Models: `/models/{type}.glb`. */
export interface TwinPlacement {
  assetId: string;
  name: string;
  type: AssetType;
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

export function modelUrlForType(type: AssetType): string {
  return `/models/${type.toLowerCase()}.glb`;
}

export const TWIN_MODEL_URLS = [
  "CNC",
  "ROBOT",
  "CONVEYOR",
  "SENSOR",
  "WAREHOUSE",
  "ENERGY",
].map((t) => modelUrlForType(t as AssetType));

export const TWIN_PLACEMENTS: TwinPlacement[] = [
  {
    assetId: "Machine001",
    name: "CNC Lathe A1",
    type: "CNC",
    x: -5,
    z: -2,
    width: 2.2,
    height: 1.6,
    depth: 1.5,
  },
  {
    assetId: "Machine002",
    name: "CNC Mill A2",
    type: "CNC",
    x: -2,
    z: -2,
    width: 2.2,
    height: 1.6,
    depth: 1.5,
  },
  {
    assetId: "Robot001",
    name: "Six-Axis Arm B1",
    type: "ROBOT",
    x: 1.5,
    z: -1.5,
    width: 1.1,
    height: 2.2,
    depth: 1.1,
  },
  {
    assetId: "Robot002",
    name: "Pick-Place Arm B2",
    type: "ROBOT",
    x: 4,
    z: -1.5,
    width: 1.1,
    height: 2.2,
    depth: 1.1,
  },
  {
    assetId: "Conveyor001",
    name: "Main Belt C1",
    type: "CONVEYOR",
    x: 0,
    z: 1.5,
    width: 8,
    height: 0.45,
    depth: 1.1,
  },
  {
    assetId: "Sensor001",
    name: "Temp Node T1",
    type: "SENSOR",
    x: -5,
    z: 1.2,
    width: 0.5,
    height: 0.8,
    depth: 0.5,
  },
  {
    assetId: "Warehouse001",
    name: "Buffer Rack W1",
    type: "WAREHOUSE",
    x: 6.5,
    z: 2,
    width: 2.4,
    height: 2.4,
    depth: 1.6,
  },
  {
    assetId: "Energy001",
    name: "Workshop PDU E1",
    type: "ENERGY",
    x: -7.5,
    z: 2.5,
    width: 1.4,
    height: 1.8,
    depth: 0.9,
  },
];
