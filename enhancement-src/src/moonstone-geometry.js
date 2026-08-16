import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './random.js';

export function createMoonstoneGeometry({ radius = 2, detail = 4, seed = 1, craterCount = 18 }) {
  const sourceGeometry = new THREE.IcosahedronGeometry(radius, detail);
  sourceGeometry.deleteAttribute('normal');
  sourceGeometry.deleteAttribute('uv');
  const geometry = mergeVertices(sourceGeometry);
  const random = mulberry32(seed);
  const craters = Array.from({ length: craterCount }, () => ({
    direction: new THREE.Vector3(
      random() * 2 - 1,
      random() * 2 - 1,
      random() * 2 - 1
    ).normalize(),
    width: 0.08 + random() * 0.22,
    depth: 0.025 + random() * 0.09
  }));
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    normal.copy(vertex).normalize();
    const grain = Math.sin(normal.x * 17 + seed) * Math.sin(normal.y * 23 - seed) * 0.035;
    let scale = 1 + grain + (random() - 0.5) * 0.045;

    for (const crater of craters) {
      const angle = Math.acos(THREE.MathUtils.clamp(normal.dot(crater.direction), -1, 1));
      const distance = angle / Math.PI;
      if (distance < crater.width) {
        const normalizedDistance = distance / crater.width;
        scale -= Math.pow(1 - normalizedDistance, 2) * crater.depth;
        scale += Math.exp(-Math.pow((normalizedDistance - 0.86) * 8, 2)) * crater.depth * 0.34;
      }
    }

    vertex.copy(normal).multiplyScalar(radius * scale);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createFragmentGeometries({ count, detail, seed }) {
  return Array.from({ length: count }, (_, index) => createMoonstoneGeometry({
    radius: 0.28 + index * 0.035,
    detail,
    seed: seed + index * 97,
    craterCount: 3 + (index % 5)
  }));
}
