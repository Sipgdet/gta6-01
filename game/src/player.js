// The player: on foot (WASD walk/run, mouse-look heading) or in a car
// (arcade driving). Punch and pistol fire from the same hand; entering a
// car is E near a door, exiting is E again.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { Car } from './vehicles.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2a9d8f, roughness: 0.7 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.8, 3, 8), jacket);
    body.position.y = 1.0;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
    head.position.y = 1.82;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    cap.position.y = 2.02;
    group.add(cap);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.32), new THREE.MeshLambertMaterial({ color: 0x1a1a24 }));
    legs.position.y = 0.28;
    group.add(legs);
    // A short pistol in the right hand, visible when firing.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.45, 1.05, 0.25);
    gun.name = 'gun';
    group.add(gun);
    scene.add(group);
    this.mesh = group;
    // Spawn on the sidewalk beside the road at x=30, clear of buildings
    // (the old spawn at the city centre sat inside a building solid and
    // the player could not move at all).
    this.x = 37; this.z = 8;
    this.heading = 0;
    this.health = PLAYER.maxHealth;
    this.cash = 0;
    this.inCar = null;
    this.walkPhase = 0;
    this.punchCooldown = 0;
    this.shotCooldown = 0;
    this.ammo = 24;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = !this.inCar;
  }

  // On-foot movement, camera-relative: forward is the camera heading.
  walk(dt, input, camHeading) {
    const run = input.shift ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = 0; let mz = 0;
    if (input.forward) { mx += Math.sin(camHeading); mz += Math.cos(camHeading); }
    if (input.back) { mx -= Math.sin(camHeading); mz -= Math.cos(camHeading); }
    if (input.left) { mx -= Math.cos(camHeading); mz += Math.sin(camHeading); }
    if (input.right) { mx += Math.cos(camHeading); mz -= Math.sin(camHeading); }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      this.x += mx * run * dt;
      this.z += mz * run * dt;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * run * 1.4;
      this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.07;
    } else {
      this.mesh.position.y = 0;
    }
    this.sync();
  }

  // Try to enter the nearest car within reach; returns the car or null.
  tryEnterCar(cars) {
    let best = null; let bestD = 3.2;
    for (const car of cars) {
      if (!car.alive) continue;
      const d = Math.hypot(car.x - this.x, car.z - this.z);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  }

  enterCar(car) {
    this.inCar = car;
    this.x = car.x; this.z = car.z;
    this.sync();
  }

  exitCar() {
    const car = this.inCar;
    if (!car) return;
    this.inCar = null;
    // Step out to the driver's side.
    this.x = car.x - Math.cos(car.heading) * 2.2;
    this.z = car.z + Math.sin(car.heading) * 2.2;
    this.heading = car.heading;
    this.sync();
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  heal(amount) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }
}
