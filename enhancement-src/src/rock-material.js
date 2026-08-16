import * as THREE from 'three';

const vertexDeclarations = 'varying vec3 vRockWorldPosition;';

const worldPositionAssignment = `
#include <worldpos_vertex>
vec4 rockWorldPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
  rockWorldPosition = batchingMatrix * rockWorldPosition;
#endif
#ifdef USE_INSTANCING
  rockWorldPosition = instanceMatrix * rockWorldPosition;
#endif
vRockWorldPosition = (modelMatrix * rockWorldPosition).xyz;
`;

const fragmentDeclarations = `
varying vec3 vRockWorldPosition;

float rockHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float rockNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  return mix(
    mix(rockHash(cell), rockHash(cell + vec2(1.0, 0.0)), blend.x),
    mix(rockHash(cell + vec2(0.0, 1.0)), rockHash(cell + vec2(1.0)), blend.x),
    blend.y
  );
}

float triplanarNoise(vec3 point) {
  return (rockNoise(point.xy) + rockNoise(point.yz) + rockNoise(point.zx)) / 3.0;
}
`;

function injectRockShader(shader) {
  shader.vertexShader = `${vertexDeclarations}\n${shader.vertexShader}`
    .replace('#include <worldpos_vertex>', worldPositionAssignment);
  shader.fragmentShader = `${fragmentDeclarations}\n${shader.fragmentShader}`
    .replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nfloat rockDust = triplanarNoise(vRockWorldPosition * 9.0);\ndiffuseColor.rgb *= mix(0.84, 1.08, rockDust);'
    )
    .replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor *= 0.86 + rockDust * 0.18;'
    );
}

class MoonstoneRockMaterial extends THREE.MeshStandardMaterial {
  constructor() {
    super({ color: '#34383d', roughness: 0.82, metalness: 0.08 });
  }

  onBeforeCompile(shader) {
    injectRockShader(shader);
  }

  customProgramCacheKey() {
    return 'moonstone-rock-v1';
  }
}

export function createRockMaterial() {
  return new MoonstoneRockMaterial();
}
