// Cars: a boxy low-poly build (body, cabin, wheels, headlights, tail
// lights) merged into ONE vertex-coloured mesh per car, plus the arcade
// driving model and the traffic AI that keeps the streets alive.
import * as THREE from 'three';
import { WORLD, CAR, COLORS } from './config.js';
import { pick, range } from './rng.js';
import { mergeColored, at } from './merge.js';

const CAR_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

export function buildCarMesh(paint, isPolice) {
  const group = new THREE.Group();
  const bodyColor = isPolice ? 0x14142a : paint;
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const parts = [
    { geo: new THREE.BoxGeometry(2.0, 0.62, 4.4), matrix: at(0, 0.62, 0), color: bodyColor },
    { geo: new THREE.BoxGeometry(1.7, 0.58, 2.2), matrix: at(0, 1.18, -0.25), color: 0x0a1420 },
    { geo: new THREE.BoxGeometry(0.34, 0.16, 0.08), matrix: at(-0.65, 0.66, 2.21), color: 0xfff2b0 },
    { geo: new THREE.BoxGeometry(0.34, 0.16, 0.08), matrix: at(0.65, 0.66, 2.21), color: 0xfff2b0 },
    { geo: new THREE.BoxGeometry(0.34, 0.14, 0.08), matrix: at(-0.65, 0.66, -2.21), color: 0xff2222 },
    { geo: new THREE.BoxGeometry(0.34, 0.14, 0.08), matrix: at(0.65, 0.66, -2.21), color: 0xff2222 },
  ];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    parts.push({ geo: wheelGeo, matrix: at(x, 0.36, z), color: 0x0a0a0a });
  }
  if (isPolice) {
    parts.push({ geo: new THREE.BoxGeometry(2.02, 0.2, 4.42), matrix: at(0, 0.62, 0), color: 0xffffff });
  }
  const car = new THREE.Mesh(mergeColored(parts), CAR_MATERIAL);
  group.add(car);
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.56, -0.25);
    bar.name = 'lightbar';
    group.add(bar);
  }
  return group;
}

// One car in the world: mesh, position, heading, speed, and a driver
// flag (traffic cars have one, parked cars do not).
export class Car {
  constructor(scene, x, z, heading, paint, isPolice) {
    this.mesh = buildCarMesh(paint, isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.isPolice = !!isPolice;
    this.hasDriver = !isPolice;
    this.alive = true;
    this.stopped = false;
    this.waitTimer = 0;
  }

  // Arcade driving: throttle/brake/steer inputs, speed-scaled steering,
  // handbrake kills grip for a sharper turn.
  drive(dt, input, handbrake) {
    const forward = input.forward ? 1 : input.back ? -1 : 0;
    if (forward > 0) this.speed += CAR.accel * dt;
    else if (forward < 0) this.speed -= (this.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerAmount = CAR.steer * (handbrake ? CAR.handbrakeTurn / CAR.steer : 1)
      * Math.min(1, Math.abs(this.speed) / 12);
    this.heading += steerInput * steerAmount * Math.sign(this.speed || 1) * dt;
    if (handbrake) this.speed *= Math.max(0, 1 - 1.6 * dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  remove(scene) {
    scene.remove(this.mesh);
    this.alive = false;
  }
}

// Traffic: cars that cruise the road grid, pick a new direction at
// intersections, and pause briefly at random so the flow feels alive.
export class Traffic {
  constructor(scene, city, rng, count) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.count = count;
    this.cars = [];
    for (let i = 0; i < count; i += 1) this.spawn();
  }

  spawn() {
    const rng = this.rng;
    const { half } = WORLD;
    const x = range(rng, -half + 10, half - 10);
    const z = range(rng, -half + 10, half - 10);
    const road = this.city.nearestRoad(x, z);
    const heading = road.alongX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = new Car(this.scene, road.x, road.z, heading, pick(rng, COLORS.carPaint), false);
    car.speed = range(rng, 8, 14);
    car.hasDriver = true;
    this.cars.push(car);
    return car;
  }

  update(dt, playerCar) {
    const { pitch, half } = WORLD;
    // Keep the streets full: a stolen car is replaced by a fresh one.
    while (this.cars.length < this.count) this.spawn();
    for (const car of this.cars) {
      if (!car.alive) continue;
      // Simple car-car separation: slow down when another car is ahead.
      let ahead = false;
      for (const other of this.cars) {
        if (other === car || !other.alive) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 9) {
          const fwd = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
          if (fwd > 0 && Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading)) < 2.5) ahead = true;
        }
      }
      if (playerCar && playerCar.alive) {
        const dx = playerCar.x - car.x;
        const dz = playerCar.z - car.z;
        if (Math.hypot(dx, dz) < 9) {
          const fwd = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
          if (fwd > 0) ahead = true;
        }
      }
      if (car.waitTimer > 0) {
        car.waitTimer -= dt;
        car.speed = 0;
      } else if (ahead) {
        car.speed = Math.max(0, car.speed - 20 * dt);
      } else {
        car.speed = Math.min(14, car.speed + 6 * dt);
      }
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // At an intersection, sometimes turn; wrap around at the city edge.
      const onRoadX = Math.abs(car.x - this.city.nearestRoad(car.x, car.z).x) < 1.2;
      const onRoadZ = Math.abs(car.z - this.city.nearestRoad(car.x, car.z).z) < 1.2;
      if (onRoadX && onRoadZ && this.rng() < dt * 0.25) {
        car.heading += (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        if (this.rng() < 0.15) car.waitTimer = range(this.rng, 1, 2.5);
      }
      if (Math.abs(car.x) > half + 20 || Math.abs(car.z) > half + 20) {
        car.heading += Math.PI;
        car.x = Math.max(-half, Math.min(half, car.x));
        car.z = Math.max(-half, Math.min(half, car.z));
      }
      car.sync();
    }
  }
}
