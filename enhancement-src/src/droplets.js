import * as THREE from 'three';
import { createLiquidChromeMaterial } from './liquid-chrome.js';

const sdfVertexShader = `
  varying vec3 vLocalPosition;
  varying vec3 vLocalCamera;

  void main() {
    vLocalPosition = position;
    vLocalCamera = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sdfFragmentShader = `
  precision highp float;

  uniform mat4 modelMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uPhase;
  uniform float uGather;
  uniform vec2 uPointer;
  varying vec3 vLocalPosition;
  varying vec3 vLocalCamera;

  float sdfSmoothMin(float a, float b, float width) {
    float blend = max(width - abs(a - b), 0.0) / width;
    return min(a, b) - blend * blend * width * 0.25;
  }

  float sceneSdf(vec3 point) {
    float rhythm = uTime * 0.78539816339 + uPhase;
    float settle = 1.0 - uGather * 0.72;
    vec3 first = vec3(sin(rhythm) * 0.17, cos(rhythm * 0.75) * 0.12, 0.015) * settle;
    vec3 second = vec3(-0.22 + uPointer.x * 0.018, 0.08 + uPointer.y * 0.018, 0.06) * settle;
    vec3 third = mix(vec3(0.24, -0.16, 0.12), vec3(0.07, -0.035, 0.0), uGather);
    float firstDrop = length(point - first) - 0.27;
    float secondDrop = length(point - second) - 0.23;
    float thirdDrop = length(point - third) - 0.20;
    return sdfSmoothMin(sdfSmoothMin(firstDrop, secondDrop, 0.24), thirdDrop, 0.22);
  }

  vec3 normalAt(vec3 point) {
    float epsilon = 0.002;
    vec2 offset = vec2(epsilon, 0.0);
    return normalize(vec3(
      sceneSdf(point + offset.xyy) - sceneSdf(point - offset.xyy),
      sceneSdf(point + offset.yxy) - sceneSdf(point - offset.yxy),
      sceneSdf(point + offset.yyx) - sceneSdf(point - offset.yyx)
    ));
  }

  vec3 proceduralEnvironment(vec3 direction) {
    vec3 ray = normalize(direction);
    float sky = smoothstep(-0.7, 0.85, ray.y);
    float horizon = pow(max(0.0, 1.0 - abs(ray.y)), 5.0);
    float coolCard = pow(max(dot(ray, normalize(vec3(0.48, 0.72, 0.50))), 0.0), 56.0);
    float warmCard = pow(max(dot(ray, normalize(vec3(-0.62, -0.24, 0.75))), 0.0), 72.0);
    vec3 environment = mix(vec3(0.012, 0.016, 0.021), vec3(0.105, 0.135, 0.155), sky);
    environment += vec3(0.16, 0.22, 0.25) * horizon;
    environment += vec3(0.55, 0.86, 1.0) * coolCard * 1.65;
    environment += vec3(1.0, 0.39, 0.22) * warmCard * 0.76;
    return environment;
  }

  void main() {
    vec3 rayDirection = normalize(vLocalPosition - vLocalCamera);
    vec3 point = vLocalPosition;
    float travelled = 0.0;
    bool hit = false;

    for (int stepIndex = 0; stepIndex < 52; stepIndex += 1) {
      float distanceToSurface = sceneSdf(point);
      if (abs(distanceToSurface) < 0.0018) {
        hit = true;
        break;
      }
      float stepLength = max(distanceToSurface * 0.76, 0.0025);
      point += rayDirection * stepLength;
      travelled += stepLength;
      if (travelled > 1.8 || any(greaterThan(abs(point), vec3(0.76)))) break;
    }

    if (!hit) discard;

    vec3 localNormal = normalAt(point);
    vec3 worldPoint = (modelMatrix * vec4(point, 1.0)).xyz;
    vec3 worldNormal = normalize(mat3(modelMatrix) * localNormal);
    vec3 viewDirection = normalize(cameraPosition - worldPoint);
    vec3 reflectionDirection = reflect(-viewDirection, worldNormal);
    float fresnel = pow(1.0 - max(dot(worldNormal, viewDirection), 0.0), 3.0);
    float highlight = pow(max(dot(worldNormal, normalize(vec3(0.42, 0.72, 0.55))), 0.0), 42.0);
    vec3 chrome = proceduralEnvironment(reflectionDirection) * mix(0.92, 1.42, fresnel);
    chrome += vec3(0.55, 0.84, 1.0) * highlight * 0.65;

    vec4 clipPosition = projectionMatrix * viewMatrix * vec4(worldPoint, 1.0);
    float hitDepth = clipPosition.z / clipPosition.w * 0.5 + 0.5;
    if (hitDepth < 0.0 || hitDepth > 1.0) discard;
    gl_FragDepth = hitDepth;
    gl_FragColor = vec4(chrome, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createSdfMaterial(index, tier) {
  return new THREE.ShaderMaterial({
    name: `Moonstone ${tier} SDF droplets ${index + 1}`,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: index * 2.09439510239 },
      uGather: { value: 0 },
      uPointer: { value: new THREE.Vector2() }
    },
    vertexShader: sdfVertexShader,
    fragmentShader: sdfFragmentShader
  });
}

function createInstancedDroplets() {
  const count = 12;
  const geometry = new THREE.SphereGeometry(0.12, 14, 10);
  const material = createLiquidChromeMaterial({ simplified: true, solid: true });
  material.name = 'Moonstone low instanced droplets';
  const instances = new THREE.InstancedMesh(geometry, material, count);
  instances.name = 'Moonstone deterministic droplet field';
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.39996322973;
    const radius = 2.45 + (index % 4) * 0.18;
    const size = 0.72 + (index % 5) * 0.11;
    position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * (1.12 + (index % 3) * 0.13),
      Math.sin(angle * 1.7) * 0.84 - 0.18
    );
    scale.set(size, size * (0.9 + (index % 2) * 0.16), size);
    matrix.compose(position, quaternion, scale);
    instances.setMatrixAt(index, matrix);
  }
  instances.instanceMatrix.needsUpdate = true;
  instances.computeBoundingSphere();
  return instances;
}

export function createDropletField({ tier, groups }) {
  const object = new THREE.Group();
  object.name = `Moonstone ${tier} droplets`;
  const materials = [];
  const geometries = [];
  const disposableObjects = [];
  const groupCount = Math.max(0, Math.floor(Number.isFinite(groups) ? groups : 0));

  if (groupCount > 0) {
    const geometry = new THREE.BoxGeometry(1.34, 1.34, 1.34);
    geometries.push(geometry);
    for (let index = 0; index < groupCount; index += 1) {
      const material = createSdfMaterial(index, tier);
      const proxy = new THREE.Mesh(geometry, material);
      const angle = index * 2.25 + 0.34;
      proxy.name = `Moonstone SDF droplet proxy ${index + 1}`;
      proxy.position.set(
        Math.cos(angle) * (2.55 + index * 0.12),
        Math.sin(angle) * (1.18 + index * 0.09),
        -0.18 - index * 0.22
      );
      proxy.scale.setScalar(0.88 + index * 0.06);
      materials.push(material);
      object.add(proxy);
    }
  } else {
    const instances = createInstancedDroplets();
    geometries.push(instances.geometry);
    materials.push(instances.material);
    disposableObjects.push(instances);
    object.add(instances);
  }

  let disposed = false;
  return {
    object,
    update(time, pointer = {}, scroll = {}) {
      if (disposed) return;
      const seconds = Number.isFinite(time) ? time : 0;
      const pointerX = Number.isFinite(pointer.x) ? pointer.x : 0;
      const pointerY = Number.isFinite(pointer.y) ? pointer.y : 0;
      const gather = Number.isFinite(scroll.gather)
        ? Math.min(1, Math.max(0, scroll.gather))
        : 0;
      for (const material of materials) {
        material.uniforms.uTime.value = seconds;
        material.uniforms.uPointer.value.set(pointerX, pointerY);
        if (material.uniforms.uGather) material.uniforms.uGather.value = gather;
        if (material.uniforms.uFlow) material.uniforms.uFlow.value = 1 - gather * 0.64;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const disposableObject of disposableObjects) disposableObject.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
