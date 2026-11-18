// Merge small geometries into one draw call. Each part brings its own
// geometry, transform and flat colour; the colour is baked as a vertex
// colour, so the merged mesh needs a single vertex-coloured material.
// This keeps the scene at ~150 draw calls instead of ~800, which matters
// on software renderers.
import * as THREE from 'three';

export function mergeColored(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const color = new THREE.Color();
  for (const part of parts) {
    const geo = part.geo.clone();
    if (part.matrix) geo.applyMatrix4(part.matrix);
    const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
    const pos = nonIndexed.getAttribute('position');
    const nor = nonIndexed.getAttribute('normal');
    color.setHex(part.color);
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(color.r, color.g, color.b);
    }
    geo.dispose();
    if (nonIndexed !== geo) nonIndexed.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return out;
}

// Convenience: a translation matrix.
export function at(x, y, z) {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

// Convenience: a rotation about Y then a translation.
export function atYaw(x, y, z, yaw) {
  return new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
}
