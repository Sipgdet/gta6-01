// Pedestrians: capsule people who stroll the sidewalks, cross roads at
// intersections, and run away from gunfire, speeding cars and the player.
// Each pedestrian is one merged vertex-coloured mesh.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { pick, range } from './rng.js';
import { mergeColored, at } from './merge.js';

const SHIRTS = [0xd7263d, 0x1b9aaa, 0xf4d35e, 0x5a189a, 0x06d6a0, 0xff7b00, 0xe8e8e8, 0x3a86ff];
const PED_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

export class Ped {
  constructor(scene, x, z, rng) {
    this.rng = rng;
    const shirt = pick(rng, SHIRTS);
    const skin = pick(rng, [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0]);
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(mergeColored([
      { geo: new THREE.CapsuleGeometry(0.34, 0.75, 3, 8), matrix: at(0, 0.95, 0), color: shirt },
      { geo: new THREE.SphereGeometry(0.26, 10, 8), matrix: at(0, 1.72, 0), color: skin },
      { geo: new THREE.BoxGeometry(0.5, 0.5, 0.3), matrix: at(0, 0.25, 0), color: 0x22222e },
    ]), PED_MATERIAL);
    group.add(mesh);
    group.position.set(x, 0, z);
    scene.add(group);
    this.mesh = group;
    this.x = x; this.z = z;
    this.heading = rng() * Math.PI * 2;
    this.speed = range(rng, 1.2, 2.4);
    this.fleeing = 0;
    this.alive = true;
    this.walkPhase = rng() * Math.PI * 2;
  }

  scare(fromX, fromZ) {
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    this.heading = Math.atan2(dx, dz);
    this.fleeing = 3 + this.rng() * 2;
    this.speed = 5.5;
  }

  update(dt, city) {
    if (!this.alive) return;
    if (this.fleeing > 0) {
      this.fleeing -= dt;
      if (this.fleeing <= 0) this.speed = range(this.rng, 1.2, 2.4);
    } else if (this.rng() < dt * 0.08) {
      // Wander: small heading change, or a 90-degree turn at a corner.
      this.heading += (this.rng() < 0.5 ? 1 : -1) * (this.rng() < 0.3 ? Math.PI / 2 : 0.5);
    }
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    if (!city.collides(nx, nz, 0.5)) {
      this.x = nx; this.z = nz;
    } else {
      this.heading += Math.PI / 2;
    }
    const { half } = WORLD;
    if (Math.abs(this.x) > half + 25 || Math.abs(this.z) > half + 25) this.heading += Math.PI;
    this.walkPhase += dt * this.speed * 3;
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.06, this.z);
    this.mesh.rotation.y = this.heading;
  }

  remove(scene) {
    scene.remove(this.mesh);
    this.alive = false;
  }
}

export class Crowd {
  constructor(scene, city, rng, count) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < count; i += 1) this.spawn();
  }

  spawn() {
    const { half } = WORLD;
    const ped = new Ped(this.scene, range(this.rng, -half, half), range(this.rng, -half, half), this.rng);
    this.peds.push(ped);
    return ped;
  }

  update(dt) {
    for (const ped of this.peds) ped.update(dt, this.city);
  }

  scareNear(x, z, radius) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.scare(x, z);
    }
  }
}
