// The city of Solmara: a road grid, sidewalk blocks, a few hundred
// buildings with lit windows, neon signs, street lamps and a skyline ring.
// Everything is built once from the seed; the meshes never move. Static
// parts are merged into a handful of draw calls (see merge.js).
import * as THREE from 'three';
import { WORLD, COLORS } from './config.js';
import { pick, range } from './rng.js';
import { mergeColored, at } from './merge.js';

// A small canvas texture of lit windows, reused by every building so the
// city glows without hundreds of materials.
function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#101018';
  g.fillRect(0, 0, 64, 128);
  const lit = ['#ffd319', '#05d9e8', '#ff9a5c', '#b967ff', '#fff2cc'];
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      if (rng() < 0.42) {
        g.fillStyle = pick(rng, lit);
        g.globalAlpha = 0.55 + rng() * 0.45;
        g.fillRect(x, y, 6, 8);
      }
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    // Solid boxes the player and cars collide with: {minX,maxX,minZ,maxZ}.
    this.solids = [];
    this.buildings = [];
    this.build();
  }

  build() {
    const { blocks, block, road, pitch, half } = WORLD;
    const rng = this.rng;
    const scene = this.scene;

    // Ground: dark asphalt slab for the whole city.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 80, half * 2 + 80),
      new THREE.MeshLambertMaterial({ color: 0x14141a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    scene.add(ground);

    // Roads, dashes and sidewalks, merged into one vertex-coloured mesh.
    const flat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const roadParts = [];
    const roadLen = half * 2;
    for (let i = 0; i <= blocks; i += 1) {
      const c = -half + road / 2 + i * pitch;
      const stripH = new THREE.PlaneGeometry(roadLen, road);
      roadParts.push({ geo: stripH, matrix: new THREE.Matrix4().makeTranslation(0, 0.02, c).multiply(flat), color: COLORS.asphalt });
      const stripV = new THREE.PlaneGeometry(roadLen, road);
      roadParts.push({ geo: stripV, matrix: new THREE.Matrix4().makeTranslation(c, 0.02, 0).multiply(flat).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)), color: COLORS.asphalt });
      // Dashes down the middle of each road.
      for (let d = -half + 6; d < half - 4; d += 8) {
        const dashH = new THREE.PlaneGeometry(3, 0.35);
        roadParts.push({ geo: dashH, matrix: new THREE.Matrix4().makeTranslation(d, 0.03, c).multiply(flat), color: 0x8a8a5a });
        const dashV = new THREE.PlaneGeometry(3, 0.35);
        const rotZ = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
        roadParts.push({ geo: dashV, matrix: new THREE.Matrix4().makeTranslation(c, 0.03, d).multiply(flat).multiply(rotZ), color: 0x8a8a5a });
      }
    }
    for (let bx = 0; bx < blocks; bx += 1) {
      for (let bz = 0; bz < blocks; bz += 1) {
        const cx = -half + road + block / 2 + bx * pitch;
        const cz = -half + road + block / 2 + bz * pitch;
        const pad = new THREE.PlaneGeometry(block + 4, block + 4);
        roadParts.push({ geo: pad, matrix: new THREE.Matrix4().makeTranslation(cx, 0.015, cz).multiply(flat), color: COLORS.sidewalk });
      }
    }
    const roads = new THREE.Mesh(
      mergeColored(roadParts),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    scene.add(roads);

    // Buildings: 1–4 per block, boxes with the window texture, some with
    // a neon sign strip. Materials are shared per base colour, not one
    // per building. Heights vary; the centre blocks go taller.
    const winTex = windowTexture(rng);
    const buildingMats = new Map();
    const buildingMat = (color) => {
      if (!buildingMats.has(color)) {
        buildingMats.set(color, new THREE.MeshLambertMaterial({
          color,
          roughness: 0.85,
          emissive: 0xffffff,
          emissiveMap: winTex,
          emissiveIntensity: 0.55,
          map: winTex,
        }));
      }
      return buildingMats.get(color);
    };
    const neonMats = COLORS.neon.map((c) => new THREE.MeshBasicMaterial({ color: c }));
    let signIndex = 0;
    for (let bx = 0; bx < blocks; bx += 1) {
      for (let bz = 0; bz < blocks; bz += 1) {
        const cx = -half + road + block / 2 + bx * pitch;
        const cz = -half + road + block / 2 + bz * pitch;
        const centre = Math.abs(bx - 2) + Math.abs(bz - 2);
        const count = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < count; k += 1) {
          const w = range(rng, 10, 18);
          const d = range(rng, 10, 18);
          const h = range(rng, 10, centre === 0 ? 58 : 34);
          const ox = (k % 2 === 0 ? -1 : 1) * range(rng, 2, 9);
          const oz = (k < 2 ? -1 : 1) * range(rng, 2, 9);
          const x = cx + ox;
          const z = cz + oz;
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat(pick(rng, COLORS.buildingBase)));
          b.position.set(x, h / 2, z);
          scene.add(b);
          this.buildings.push(b);
          this.solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
          // Neon sign on the roof edge of every third building.
          if ((bx * blocks + bz + k) % 3 === 0) {
            const sign = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.7, 1.1, 0.5),
              neonMats[signIndex % neonMats.length],
            );
            signIndex += 1;
            sign.position.set(x, h + 0.6, z - d / 2 - 0.2);
            scene.add(sign);
          }
        }
      }
    }

    // Street lamps at intersections, merged into one mesh: pole + head.
    const lampParts = [];
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
    const headGeo = new THREE.SphereGeometry(0.45, 8, 6);
    for (let i = 0; i <= blocks; i += 1) {
      for (let j = 0; j <= blocks; j += 1) {
        if ((i + j) % 2 === 1) continue;
        const x = -half + road / 2 + i * pitch + 5;
        const z = -half + road / 2 + j * pitch + 5;
        lampParts.push({ geo: poleGeo, matrix: at(x, 3.5, z), color: 0x222226 });
        lampParts.push({ geo: headGeo, matrix: at(x, 7.1, z), color: 0xffe9a8 });
      }
    }
    const lamps = new THREE.Mesh(
      mergeColored(lampParts),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    scene.add(lamps);

    // Distant skyline ring: dark silhouettes outside the playable city.
    const skyParts = [];
    for (let i = 0; i < 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      const r = half + 55 + rng() * 40;
      const h = range(rng, 25, 90);
      const w = range(rng, 12, 26);
      skyParts.push({ geo: new THREE.BoxGeometry(w, h, w), matrix: at(Math.cos(a) * r, h / 2, Math.sin(a) * r), color: 0x0d0d18 });
    }
    const skyline = new THREE.Mesh(
      mergeColored(skyParts),
      new THREE.MeshBasicMaterial({ vertexColors: true }),
    );
    scene.add(skyline);
  }

  // True when the circle at (x,z) with radius r hits a building or leaves
  // the city bounds.
  collides(x, z, r) {
    const { half } = WORLD;
    if (Math.abs(x) > half + 30 || Math.abs(z) > half + 30) return true;
    for (const s of this.solids) {
      if (x + r > s.minX && x - r < s.maxX && z + r > s.minZ && z - r < s.maxZ) return true;
    }
    return false;
  }

  // Snap a position to the nearest road centre line (for spawning cars).
  nearestRoad(x, z) {
    const { road, pitch, half } = WORLD;
    const snap = (v) => {
      const rel = v + half - road / 2;
      const idx = Math.round(rel / pitch);
      return -half + road / 2 + idx * pitch;
    };
    return Math.abs(x - snap(x)) < Math.abs(z - snap(z))
      ? { x: snap(x), z, alongX: true }
      : { x, z: snap(z), alongX: false };
  }
}
