// The staged screenshot scenes behind ?shot=cover|onfoot|mission|night.
// Each one plays the real rules forward from a fresh world for a fixed
// number of fixed steps, steered by a simple autopilot, so the frame is
// what a short game really looks like and the same seed always gives the
// same frame. The game freezes after staging; only the camera renders.
// After staging, one police car is parked inside the frame where the shot
// needs it, and the welcome banner is cleared so it never covers the view.
import { WORLD, WANTED } from './config.js';

const STEP = 1 / 60;

function stepWorld(game, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (drive) drive(game);
    game.step(STEP);
  }
}

// Autopilot: hold W, steer toward the road ahead, handbrake on hard turns.
function driveForward(game) {
  const input = game.input;
  input.keys.add('KeyW');
  const car = game.player.inCar;
  if (!car) return;
  // Steer toward the nearest road centre ahead of the car.
  const road = game.city.nearestRoad(car.x + Math.sin(car.heading) * 12, car.z + Math.cos(car.heading) * 12);
  const tx = road.alongX ? car.x + Math.sin(car.heading) * 12 : road.x;
  const tz = road.alongX ? road.z : car.z + Math.cos(car.heading) * 12;
  const want = Math.atan2(tx - car.x, tz - car.z);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.keys.delete('KeyA');
  input.keys.delete('KeyD');
  if (diff > 0.12) input.keys.add('KeyD');
  else if (diff < -0.12) input.keys.add('KeyA');
}

function putPlayerInCar(game, x, z) {
  // Find the closest traffic car, steal it (driver flees), and drive.
  const p = game.player;
  p.x = x; p.z = z;
  let best = null; let bestD = Infinity;
  for (const car of game.traffic.cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  best.hasDriver = false;
  best.speed = 0;
  // As in the real steal path, the car leaves the traffic flow.
  game.traffic.cars = game.traffic.cars.filter((c) => c !== best);
  p.enterCar(best);
  game.camYaw = best.heading;
}

// Park the nearest police car in the frame, relative to the player's car:
// fwd units ahead, side units to the right (negative = left).
function placeCopInView(game, fwd, side) {
  const car = game.player.inCar;
  if (!car || game.police.cars.length === 0) return;
  let best = null; let bestD = Infinity;
  for (const cop of game.police.cars) {
    const d = Math.hypot(cop.x - car.x, cop.z - car.z);
    if (d < bestD) { best = cop; bestD = d; }
  }
  if (!best) return;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const rx = Math.cos(car.heading);
  const rz = -Math.sin(car.heading);
  best.x = car.x + fx * fwd + rx * side;
  best.z = car.z + fz * fwd + rz * side;
  best.heading = car.heading;
  best.speed = 0;
  best.sync();
  const bar = best.mesh.getObjectByName('lightbar');
  if (bar) bar.material.color.setHex(0xff2222);
}

// Clear the welcome banner and refresh the HUD for the frozen frame.
function finishStaging(game) {
  game.hud.messageTimer = 0;
  game.hud.messageEl.style.opacity = '0';
  game.hud.update(0, hudState(game));
}

function stageCover(game) {
  // Driving chase: player car with police in the frame, 4 stars.
  game.newGame();
  game.setLighting('dusk', true);
  putPlayerInCar(game, -40, 60);
  game.police.addHeat(3);
  game.police.update(0, game.player, null, null);
  stepWorld(game, 5, driveForward);
  game.camYaw = game.player.inCar.heading + 0.15;
  placeCopInView(game, 18, -6);
  finishStaging(game);
}

function stageOnFoot(game) {
  // On foot in a busy street: traffic and pedestrians around the player.
  game.newGame();
  game.setLighting('dusk', true);
  game.player.x = 10; game.player.z = -30;
  game.player.heading = 0.4;
  game.camYaw = 0.4;
  stepWorld(game, 4, null);
  finishStaging(game);
}

function stageMission(game) {
  // Mission 1, drop leg, dawn: beacon ahead, 2 stars, police in view.
  game.newGame();
  game.setLighting('dawn', true);
  game.missions.stage = 'drop';
  game.missions.currentLine = 'MARA: Parcel secured. Get to the drop — marker updated.';
  putPlayerInCar(game, 70, -70);
  game.police.addHeat(2);
  game.police.update(0, game.player, null, null);
  stepWorld(game, 4, driveForward);
  // Aim the camera at the drop beacon so it stands in the frame.
  const t = game.missions.target;
  const p = game.player;
  if (t) game.camYaw = Math.atan2(t.x - p.x, t.z - p.z);
  placeCopInView(game, 16, 5);
  finishStaging(game);
}

function stageNight(game) {
  // Night driving into a police roadblock: two cop cars across the road.
  game.newGame();
  game.setLighting('night', true);
  putPlayerInCar(game, -70, 20);
  game.police.addHeat(1);
  stepWorld(game, 3, driveForward);
  // Place the roadblock after the sim stops, so the wanted trim cannot
  // remove the extra cars: two cop cars across the road ahead.
  const p = game.player;
  const aheadX = p.inCar.x + Math.sin(p.inCar.heading) * 18;
  const aheadZ = p.inCar.z + Math.cos(p.inCar.heading) * 18;
  const rx = Math.cos(p.inCar.heading);
  const rz = -Math.sin(p.inCar.heading);
  let placed = 0;
  for (const cop of game.police.cars) {
    if (placed >= 2) break;
    const side = placed === 0 ? -3.5 : 3.5;
    cop.x = aheadX + rx * side;
    cop.z = aheadZ + rz * side;
    cop.speed = 0;
    cop.heading = p.inCar.heading + Math.PI / 2;
    cop.sync();
    const bar = cop.mesh.getObjectByName('lightbar');
    if (bar) bar.material.color.setHex(placed === 0 ? 0xff2222 : 0x2244ff);
    placed += 1;
  }
  // If only one cop car existed, spawn a second from the pool.
  if (placed < 2) {
    const cop = game.police.spawnCopCar(aheadX, aheadZ);
    cop.x = aheadX + rx * 3.5;
    cop.z = aheadZ + rz * 3.5;
    cop.speed = 0;
    cop.heading = p.inCar.heading + Math.PI / 2;
    cop.sync();
  }
  game.camYaw = game.player.inCar.heading;
  finishStaging(game);
}

function hudState(game) {
  const p = game.player;
  return {
    cash: p.cash,
    health: p.health,
    stars: game.police.stars,
    speed: p.inCar ? p.inCar.speed : 0,
    inCar: !!p.inCar,
    objective: game.missions.objective,
    dialogue: game.missions.currentLine,
    timer: game.missions.timer,
    target: game.missions.target,
    police: [...game.police.cars, ...game.police.footCops],
    playerX: p.x,
    playerZ: p.z,
    playerHeading: p.inCar ? p.inCar.heading : game.camYaw,
  };
}

export function stageShot(name, game) {
  if (name === 'onfoot') stageOnFoot(game);
  else if (name === 'mission') stageMission(game);
  else if (name === 'night') stageNight(game);
  else stageCover(game);
}
