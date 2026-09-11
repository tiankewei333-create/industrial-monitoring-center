import { ShaderMaterial, Vector3 } from "three";
import { DEFAULT_THRESHOLDS } from "@imc/shared-types";

/** Heat map range (°C): green → yellow → red (plan Q2 acceptance 40→90). */
export const HEAT_TEMP_MIN_C = 40;
export const HEAT_TEMP_MAX_C = 90;
export const HEAT_THRESHOLD_C = DEFAULT_THRESHOLDS.temperatureMaxC;

const vertexShader = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosW = worldPos.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTemp;
uniform float uMinTemp;
uniform float uMaxTemp;
uniform float uThreshold;
uniform float uOffline;
uniform float uSelected;
uniform float uAlarmed;
uniform float uTime;
uniform vec3 uLightDir;

varying vec3 vNormalW;
varying vec3 vPosW;

vec3 heatRamp(float t) {
  vec3 cold = vec3(0.18, 0.62, 0.38);
  vec3 mid  = vec3(0.92, 0.78, 0.16);
  vec3 hot  = vec3(0.90, 0.18, 0.14);
  if (t < 0.5) {
    return mix(cold, mid, t * 2.0);
  }
  return mix(mid, hot, (t - 0.5) * 2.0);
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDir);
  float ndl = clamp(dot(N, L), 0.0, 1.0);
  float ambient = 0.28;
  float diffuse = 0.72 * ndl;

  float tNorm = clamp((uTemp - uMinTemp) / max(uMaxTemp - uMinTemp, 0.001), 0.0, 1.0);
  vec3 base = heatRamp(tNorm);

  vec3 offlineCol = vec3(0.22, 0.25, 0.30);
  base = mix(base, offlineCol, clamp(uOffline, 0.0, 1.0));

  float heightBias = clamp(vPosW.y * 0.08, 0.0, 0.25);
  base = mix(base, heatRamp(min(tNorm + 0.15, 1.0)), heightBias * (1.0 - uOffline));

  vec3 color = base * (ambient + diffuse);

  float over = step(uThreshold, uTemp) * (1.0 - uOffline);
  float pulse = 0.15 + 0.15 * sin(uTime * 6.0);
  color += vec3(0.55, 0.08, 0.05) * over * pulse;

  float fres = pow(1.0 - abs(dot(N, vec3(0.0, 1.0, 0.0))), 2.0);
  color += vec3(0.15, 0.40, 0.85) * uSelected * (0.25 + 0.35 * fres);
  color += vec3(0.75, 0.12, 0.10) * uAlarmed * (0.2 + 0.3 * fres);

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createHeatMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTemp: { value: 60 },
      uMinTemp: { value: HEAT_TEMP_MIN_C },
      uMaxTemp: { value: HEAT_TEMP_MAX_C },
      uThreshold: { value: HEAT_THRESHOLD_C },
      uOffline: { value: 1 },
      uSelected: { value: 0 },
      uAlarmed: { value: 0 },
      uTime: { value: 0 },
      uLightDir: { value: new Vector3(0.4, 0.85, 0.35) },
    },
    vertexShader,
    fragmentShader,
  });
}

export function setHeatUniforms(
  mat: ShaderMaterial,
  opts: {
    tempC: number;
    offline: boolean;
    selected: boolean;
    alarmed: boolean;
    time: number;
  },
) {
  mat.uniforms.uTemp.value = opts.tempC;
  mat.uniforms.uOffline.value = opts.offline ? 1 : 0;
  mat.uniforms.uSelected.value = opts.selected ? 1 : 0;
  mat.uniforms.uAlarmed.value = opts.alarmed ? 1 : 0;
  mat.uniforms.uTime.value = opts.time;
}
