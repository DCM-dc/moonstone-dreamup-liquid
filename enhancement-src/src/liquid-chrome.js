import * as THREE from 'three';

export function smoothMin(a, b, k) {
  if (!Number.isFinite(k) || k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 localPosition = vec4(position, 1.0);
    vec3 localNormal = normal;
    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
      localNormal = mat3(transpose(inverse(instanceMatrix))) * localNormal;
    #endif
    vec4 worldPosition = modelMatrix * localPosition;
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uFlow;
  uniform float uOpacity;
  uniform float uUseDynamicEnvironment;
  uniform vec2 uPointer;
  uniform vec3 uColdLight;
  uniform vec3 uWarmLight;
  uniform samplerCube uEnvironment;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  float liquidHash(vec3 point) {
    return fract(sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float liquidNoise(vec3 point) {
    vec3 cell = floor(point);
    vec3 blend = fract(point);
    blend = blend * blend * (3.0 - 2.0 * blend);
    return mix(
      mix(
        mix(liquidHash(cell), liquidHash(cell + vec3(1.0, 0.0, 0.0)), blend.x),
        mix(liquidHash(cell + vec3(0.0, 1.0, 0.0)), liquidHash(cell + vec3(1.0, 1.0, 0.0)), blend.x),
        blend.y
      ),
      mix(
        mix(liquidHash(cell + vec3(0.0, 0.0, 1.0)), liquidHash(cell + vec3(1.0, 0.0, 1.0)), blend.x),
        mix(liquidHash(cell + vec3(0.0, 1.0, 1.0)), liquidHash(cell + vec3(1.0, 1.0, 1.0)), blend.x),
        blend.y
      ),
      blend.z
    );
  }

  vec3 proceduralEnvironment(vec3 direction) {
    vec3 ray = normalize(direction);
    float sky = smoothstep(-0.7, 0.85, ray.y);
    float horizon = pow(max(0.0, 1.0 - abs(ray.y)), 5.0);
    float coolCard = pow(max(dot(ray, normalize(vec3(0.48, 0.72, 0.50))), 0.0), 56.0);
    float warmCard = pow(max(dot(ray, normalize(vec3(-0.62, -0.24, 0.75))), 0.0), 72.0);
    float strip = pow(max(dot(ray, normalize(vec3(-0.18, 0.94, -0.28))), 0.0), 140.0);
    vec3 environment = mix(vec3(0.012, 0.016, 0.021), vec3(0.105, 0.135, 0.155), sky);
    environment += vec3(0.16, 0.22, 0.25) * horizon;
    environment += uColdLight * coolCard * 1.55;
    environment += uWarmLight * warmCard * 0.82;
    environment += vec3(0.78, 0.88, 0.92) * strip;
    return environment;
  }

  vec3 reflectedEnvironment(vec3 direction) {
    vec3 fallback = proceduralEnvironment(direction);
    if (uUseDynamicEnvironment < 0.5) return fallback;
    return mix(fallback, textureCube(uEnvironment, direction).rgb, 0.82);
  }

  void main() {
    float phase = uTime * 0.78539816339;
    vec3 normal = normalize(vWorldNormal);
    float flowMask;

    #ifdef LIQUID_LOW
      float ripple = sin(dot(vWorldPosition, vec3(2.3, 2.9, 1.7)) + sin(phase) * 1.4);
      normal = normalize(normal + vec3(ripple * 0.035, cos(phase) * 0.025, ripple * 0.02));
      flowMask = smoothstep(-0.38, 0.24, ripple + normal.y * 0.28);
    #else
      vec3 drift = vec3(sin(phase), cos(phase), sin(phase * 0.5)) * 0.34 * uFlow;
      float broadNoise = liquidNoise(vWorldPosition * 1.38 + drift + vec3(uPointer * 0.012, 0.0));
      float fineNoise = liquidNoise(vWorldPosition * 3.4 - drift.yzx * 0.6);
      normal = normalize(normal + (fineNoise - 0.5) * 0.17);
      flowMask = smoothstep(0.34, 0.63, broadNoise + normal.y * 0.075);
    #endif

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 reflectionDirection = reflect(-viewDirection, normal);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, 3.0);
    vec3 environment = reflectedEnvironment(reflectionDirection);
    float coldHighlight = pow(max(dot(normal, normalize(vec3(0.42, 0.72, 0.55))), 0.0), 46.0);
    float warmHighlight = pow(max(dot(normal, normalize(vec3(-0.58, -0.12, 0.80))), 0.0), 64.0);
    vec3 chrome = environment * mix(0.88, 1.34, fresnel);
    chrome += uColdLight * coldHighlight * 0.45;
    chrome += uWarmLight * warmHighlight * 0.30;
    chrome += vec3(0.28) * pow(facing, 34.0);

    #ifdef LIQUID_SOLID
      gl_FragColor = vec4(chrome, uOpacity);
    #else
      vec3 film = mix(vec3(0.018, 0.022, 0.026), chrome, flowMask);
      gl_FragColor = vec4(film, smoothstep(0.18, 0.72, flowMask) * uOpacity);
    #endif
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createLiquidChromeMaterial({
  environment = null,
  simplified = false,
  solid = false,
  flow = 1,
  opacity = 1
} = {}) {
  const defines = {};
  if (simplified) defines.LIQUID_LOW = 1;
  if (solid) defines.LIQUID_SOLID = 1;

  return new THREE.ShaderMaterial({
    name: solid ? 'Moonstone solid chrome' : 'Moonstone liquid chrome film',
    defines,
    transparent: !solid,
    depthWrite: solid,
    depthTest: true,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: flow },
      uOpacity: { value: opacity },
      uPointer: { value: new THREE.Vector2() },
      uColdLight: { value: new THREE.Color('#8ddcff') },
      uWarmLight: { value: new THREE.Color('#ff8b5d') },
      uEnvironment: { value: environment },
      uUseDynamicEnvironment: { value: environment ? 1 : 0 }
    },
    vertexShader,
    fragmentShader
  });
}
