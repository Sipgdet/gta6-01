// The wanted system and the police. Heat rises with crimes and decays
// when the player lies low; stars are ceil(heat). Police cars spawn at a
// distance, chase, and ram the player's car. On-foot cops spawn near the
// player, run them down, and hold them for 2 seconds to make an arrest.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { Car } from './vehicles.js';

function makeFootCopMesh() {
  const group = new THREE.Group();
  const uniform = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.8, 3, 8), uniform);
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.8;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x0a0a18 }));
  cap.position.y = 2.0;
  group.add(cap);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xffd319 }));
  badge.position.set(0.15, 1.25, 0.38);
  group.add(badge);
  return group;
}

export class FootCop {
  constructor(scene, x, z) {
    this.mesh = makeFootCopMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = 0;
    this.alive = true;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt, px, pz) {
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.5) {
      this.heading = Math.atan2(dx, dz);
      const speed = 6.5;
      this.x += Math.sin(this.heading) * speed * dt;
      this.z += Math.cos(this.heading) * speed * dt;
      this.phase += dt * 9;
      this.mesh.position.y = Math.abs(Math.sin(this.phase)) * 0.06;
    }
    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;
    this.mesh.rotation.y = this.heading;
    return dist;
  }

  remove(scene) {
    scene.remove(this.mesh);
    this.alive = false;
  }
}

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.heat = 0;
    this.cars = [];
    this.footCops = [];
    this.arrestTimer = 0;
    this.sirenPhase = 0;
  }

  get stars() {
    return Math.max(0, Math.min(WANTED.max, Math.ceil(this.heat - 0.001)));
  }

  addHeat(amount) {
    this.heat = Math.min(WANTED.max, this.heat + amount);
  }

  clear() {
    this.heat = 0;
    for (const c of this.cars) c.remove(this.scene);
    for (const c of this.footCops) c.remove(this.scene);
    this.cars = [];
    this.footCops = [];
    this.arrestTimer = 0;
  }

  spawnCopCar(px, pz) {
    const rng = this.rng;
    const angle = rng() * Math.PI * 2;
    const x = px + Math.cos(angle) * 55;
    const z = pz + Math.sin(angle) * 55;
    const car = new Car(this.scene, x, z, Math.atan2(px - x, pz - z), 0, true);
    car.speed = 20;
    car.hasDriver = true;
    this.cars.push(car);
    return car;
  }

  spawnFootCop(px, pz) {
    const rng = this.rng;
    const angle = rng() * Math.PI * 2;
    const cop = new FootCop(this.scene, px + Math.cos(angle) * 14, pz + Math.sin(angle) * 14);
    this.footCops.push(cop);
    return cop;
  }

  update(dt, player, onArrest, onRam) {
    const stars = this.stars;
    if (stars === 0) this.heat = Math.max(0, this.heat - WANTED.decayPerSec * dt);
    const wantCars = WANTED.copsForStars[stars];
    while (this.cars.length < wantCars) this.spawnCopCar(player.x, player.z);
    while (this.cars.length > wantCars) {
      const c = this.cars.pop();
      c.remove(this.scene);
    }
    // Foot cops only matter when the player is on foot; one per 2 stars.
    const wantFoot = player.inCar ? 0 : Math.floor(stars / 2);
    while (this.footCops.length < wantFoot) this.spawnFootCop(player.x, player.z);
    while (this.footCops.length > wantFoot) {
      const c = this.footCops.pop();
      c.remove(this.scene);
    }
    this.sirenPhase += dt * 6;

    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    for (const cop of this.cars) {
      if (!cop.alive) continue;
      const dx = px - cop.x;
      const dz = pz - cop.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz) + Math.sin(this.sirenPhase * 0.3 + cop.x) * 0.12;
      let diff = wantHeading - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = Math.min(34 + stars * 3, 12 + dist * 0.55);
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, 1.8 * dt);
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      if (player.inCar && dist < 4.6) {
        player.inCar.speed *= 0.82;
        player.inCar.x += Math.sin(cop.heading) * 1.2;
        player.inCar.z += Math.cos(cop.heading) * 1.2;
        if (onRam) onRam();
      }
      const bar = cop.mesh.getObjectByName('lightbar');
      if (bar) bar.material.color.setHex(Math.sin(this.sirenPhase) > 0 ? 0xff2222 : 0x2244ff);
      cop.sync();
    }

    // Foot cops run the player down; close contact builds the arrest.
    let nearestFoot = Infinity;
    for (const cop of this.footCops) {
      if (!cop.alive) continue;
      nearestFoot = Math.min(nearestFoot, cop.update(dt, player.x, player.z));
    }
    if (!player.inCar && stars > 0 && nearestFoot < 2.2) {
      this.arrestTimer += dt;
      if (this.arrestTimer > 2 && onArrest) {
        this.arrestTimer = 0;
        onArrest();
      }
    } else {
      this.arrestTimer = Math.max(0, this.arrestTimer - dt * 2);
    }
  }
}
