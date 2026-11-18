// SOLMARA — the game itself: screens, the main loop, the chase camera,
// stealing, combat, collisions, wanted heat, busted/wasted, and saving.
import * as THREE from 'three';
import { WORLD, MISSIONS, DAY, CAR, WANTED, PLAYER } from './config.js';
import { makeRng, range, pick } from './rng.js';
import { City } from './city.js';
import { Traffic, Car } from './vehicles.js';
import { Crowd } from './peds.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Effects } from './effects.js';
import { SoundBank } from './audio.js';
import { Hud } from './hud.js';
import { Input } from './input.js';

const SAVE_KEY = 'solmara-save-v1';

export class Game {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.seed = (opts && opts.seed) || 1;
    this.rng = makeRng(this.seed);
    this.frozen = false; // staged screenshots stop the sim after staging
    this.screen = 'title';
    this.time = 0;
    this.saveTimer = 0;
    this.crimeCooldown = 0;
    this.sirenTimer = 0;
    this.lightPhase = 0; // slow day cycle: dusk -> night -> dawn -> dusk
    this.lightPreset = 'dusk';
    this.hasSave = false;
    try { this.hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) { this.hasSave = false; }

    // Software rasterisers (headless Chrome) crawl with MSAA on; real
    // GPUs keep it for a cleaner image.
    const headless = /HeadlessChrome/.test(navigator.userAgent || '');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !headless });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(DAY.dusk.sky);
    this.scene.fog = new THREE.Fog(DAY.dusk.fog, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camYaw = 0;
    this.camPitch = 0.32;

    this.sun = new THREE.DirectionalLight(DAY.dusk.sun, DAY.dusk.sunI);
    this.sun.position.set(80, 120, 40);
    this.scene.add(this.sun);
    this.amb = new THREE.AmbientLight(DAY.dusk.amb, DAY.dusk.ambI);
    this.scene.add(this.amb);
    // Neon street glow: a few coloured point lights over the centre.
    for (const [x, z, c] of [[-60, -60, 0xff2a6d], [60, 60, 0x05d9e8], [0, 0, 0xb967ff]]) {
      const p = new THREE.PointLight(c, 900, 90, 1.8);
      p.position.set(x, 14, z);
      this.scene.add(p);
    }

    this.city = new City(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.city, this.rng, 20);
    this.crowd = new Crowd(this.scene, this.city, this.rng, 30);
    this.player = new Player(this.scene);
    this.police = new Police(this.scene, this.city, this.rng);
    this.missions = new Missions(this.scene, MISSIONS);
    this.effects = new Effects(this.scene);
    this.sound = new SoundBank();
    this.hud = new Hud();
    this.input = new Input(canvas);
    this.input.onKey = (code, down) => this.onKey(code, down);

    // Parked cars the player can take without a driver to eject.
    this.parked = [];
    for (let i = 0; i < 8; i += 1) {
      const x = range(this.rng, -WORLD.half + 12, WORLD.half - 12);
      const z = range(this.rng, -WORLD.half + 12, WORLD.half - 12);
      const road = this.city.nearestRoad(x, z);
      const heading = road.alongX ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car(this.scene, road.x, road.z, heading, pick(this.rng, [0xd7263d, 0x1b9aaa, 0xf4d35e, 0x06d6a0]), false);
      car.hasDriver = false;
      this.parked.push(car);
    }

    this.bindScreens();
    window.addEventListener('resize', () => this.onResize());
  }

  // ---- screens ---------------------------------------------------------
  bindScreens() {
    const show = (id, on) => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? 'flex' : 'none';
    };
    this.showScreen = (name) => {
      this.screen = name;
      show('screen-title', name === 'title');
      show('screen-pause', name === 'paused');
      show('screen-busted', name === 'busted');
      show('screen-wasted', name === 'wasted');
      show('screen-complete', name === 'complete');
      document.getElementById('hud').style.display = name === 'playing' ? 'block' : 'none';
      const cont = document.getElementById('btn-continue');
      if (cont) cont.style.display = this.hasSave ? 'inline-block' : 'none';
    };
    const newBtn = document.getElementById('btn-new');
    if (newBtn) newBtn.addEventListener('click', () => this.newGame());
    const contBtn = document.getElementById('btn-continue');
    if (contBtn) contBtn.addEventListener('click', () => this.continueGame());
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.showScreen('playing'));
    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) retryBtn.addEventListener('click', () => this.respawn());
    const freeBtn = document.getElementById('btn-freeroam');
    if (freeBtn) freeBtn.addEventListener('click', () => this.showScreen('playing'));
    const againBtn = document.getElementById('btn-again');
    if (againBtn) againBtn.addEventListener('click', () => this.newGame());
    this.showScreen('title');
  }

  onKey(code, down) {
    if (!down) return;
    this.sound.ensure();
    if (code === 'Enter' && this.screen === 'title') { this.newGame(); return; }
    if (code === 'KeyP' && (this.screen === 'playing' || this.screen === 'paused')) {
      this.showScreen(this.screen === 'playing' ? 'paused' : 'playing');
      return;
    }
    if (code === 'KeyM') { this.sound.setMuted(!this.sound.muted); return; }
    if (code === 'KeyR' && this.screen === 'playing') { this.respawn(); return; }
    if (this.screen !== 'playing') return;
    if (code === 'KeyE') this.tryEnterExit();
  }

  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* no storage */ }
    this.player.cash = 0;
    this.player.health = PLAYER.maxHealth;
    this.player.x = 37; this.player.z = 8;
    this.player.heading = 0;
    if (this.player.inCar) this.player.exitCar();
    this.missions.reset();
    this.police.clear();
    this.lightLocked = false;
    this.setLighting('dusk');
    this.hasSave = false;
    this.hud.showMessage('Welcome to Solmara. Mara Quinn is on the line.', 5);
    this.showScreen('playing');
  }

  continueGame() {
    let save = null;
    try { save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { save = null; }
    if (!save) { this.newGame(); return; }
    this.player.cash = save.cash || 0;
    this.player.health = save.health || PLAYER.maxHealth;
    this.player.x = save.x || 0;
    this.player.z = save.z || 8;
    this.missions.loadState(save.mission);
    this.police.clear();
    this.showScreen('playing');
  }

  respawn() {
    const lost = Math.floor(this.player.cash * 0.2);
    this.player.cash -= lost;
    this.player.health = PLAYER.maxHealth;
    this.player.x = 37; this.player.z = 8;
    if (this.player.inCar) { this.player.inCar.speed = 0; this.player.exitCar(); }
    this.police.clear();
    this.hud.showMessage(lost > 0 ? `You lost $${lost} in the bust.` : 'Back on the streets.', 4);
    this.showScreen('playing');
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.player.cash,
        health: this.player.health,
        x: this.player.x,
        z: this.player.z,
        mission: this.missions.saveState(),
      }));
      this.hasSave = true;
    } catch (e) { /* storage unavailable */ }
  }

  // ---- stealing / combat ----------------------------------------------
  tryEnterExit() {
    if (this.player.inCar) {
      this.player.exitCar();
      this.sound.blip(300, 0.08, 'sine', 0.15);
      return;
    }
    const allCars = [...this.traffic.cars, ...this.parked, ...this.police.cars];
    const car = this.player.tryEnterCar(allCars);
    if (!car) return;
    if (car.hasDriver) {
      // The driver is thrown out and runs; stealing is a crime.
      car.hasDriver = false;
      const ped = this.crowd.spawn();
      ped.x = car.x - Math.cos(car.heading) * 2.5;
      ped.z = car.z + Math.sin(car.heading) * 2.5;
      ped.scare(car.x, car.z);
      this.police.addHeat(WANTED.stealCar);
      this.hud.showMessage('Car stolen! The driver ran — and someone called it in.', 3);
      this.sound.denied();
    } else {
      this.sound.blip(500, 0.08, 'sine', 0.15);
    }
    // A stolen car leaves the traffic flow: the traffic AI must not keep
    // driving it (it used to clamp the player's speed and steer the car).
    this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
    this.parked = this.parked.filter((c) => c !== car);
    this.player.enterCar(car);
  }

  fire() {
    const p = this.player;
    if (p.shotCooldown > 0) return;
    p.shotCooldown = 0.28;
    const aimX = Math.sin(this.camYaw);
    const aimZ = Math.cos(this.camYaw);
    const ox = p.inCar ? p.inCar.x : p.x;
    const oz = p.inCar ? p.inCar.z : p.z;
    // Nearest target inside a narrow cone in front of the aim direction.
    let best = null; let bestD = 30;
    const consider = (x, z, obj) => {
      const dx = x - ox; const dz = z - oz;
      const d = Math.hypot(dx, dz);
      if (d < 1.5 || d > bestD) return;
      const dot = (dx * aimX + dz * aimZ) / d;
      if (dot > 0.86) { best = obj; bestD = d; }
    };
    for (const ped of this.crowd.peds) if (ped.alive) consider(ped.x, ped.z, { kind: 'ped', ref: ped });
    for (const cop of this.police.footCops) if (cop.alive) consider(cop.x, cop.z, { kind: 'cop', ref: cop });
    for (const car of this.traffic.cars) if (car.alive) consider(car.x, car.z, { kind: 'car', ref: car });
    this.sound.shot();
    this.effects.muzzle(ox + aimX * 1.5, 1.3, oz + aimZ * 1.5);
    if (!best) return;
    if (best.kind === 'ped') {
      best.ref.remove(this.scene);
      this.crowd.scareNear(best.ref.x, best.ref.z, 18);
      this.police.addHeat(WANTED.hitPed);
      this.hud.showMessage('You shot a pedestrian. The city saw that.', 2.5);
    } else if (best.kind === 'cop') {
      best.ref.remove(this.scene);
      this.police.footCops = this.police.footCops.filter((c) => c.alive);
      this.police.addHeat(WANTED.shoot);
      this.hud.showMessage('You shot a cop. Every unit in Solmara is coming.', 3);
    } else {
      this.effects.sparks(best.ref.x, best.ref.z);
      this.police.addHeat(WANTED.shoot * 0.5);
    }
    if (p.ammo > 0) p.ammo -= 1;
  }

  punch() {
    const p = this.player;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.45;
    this.sound.punch();
    const ox = p.x; const oz = p.z;
    for (const ped of this.crowd.peds) {
      if (!ped.alive) continue;
      if (Math.hypot(ped.x - ox, ped.z - oz) < 2.4) {
        ped.remove(this.scene);
        this.crowd.scareNear(ox, oz, 14);
        this.police.addHeat(WANTED.hitPed * 0.5);
        this.hud.showMessage('You knocked someone down. Witnesses everywhere.', 2.5);
        return;
      }
    }
  }

  // ---- per-frame --------------------------------------------------------
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setLighting(preset, locked) {
    const d = DAY[preset] || DAY.dusk;
    this.lightPreset = preset;
    // A locked preset (staged shots) is never overridden by the day cycle.
    this.lightLocked = !!locked;
    this.scene.background.setHex(d.sky);
    this.scene.fog.color.setHex(d.fog);
    this.sun.color.setHex(d.sun);
    this.sun.intensity = d.sunI;
    this.amb.color.setHex(d.amb);
    this.amb.intensity = d.ambI;
  }

  step(dt) {
    if (this.screen !== 'playing') return;
    this.time += dt;
    this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);
    const p = this.player;
    p.shotCooldown = Math.max(0, p.shotCooldown - dt);
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);

    // Mouse orbits the camera; driving eases the camera behind the car.
    const mouse = this.input.consumeMouse();
    this.camYaw -= mouse.dx * 0.0032;
    this.camPitch = Math.max(0.08, Math.min(0.9, this.camPitch + mouse.dy * 0.002));

    const input = this.input;
    if (p.inCar) {
      const car = p.inCar;
      const before = { x: car.x, z: car.z };
      car.drive(dt, input, input.space);
      // Building collision: slide along the wall (try x-only, then z-only)
      // instead of cancelling the whole move, so the car never gets stuck.
      if (this.city.collides(car.x, car.z, 2.1)) {
        const nx = car.x; const nz = car.z;
        car.x = nx; car.z = before.z;
        if (this.city.collides(car.x, car.z, 2.1)) {
          car.x = before.x; car.z = nz;
          if (this.city.collides(car.x, car.z, 2.1)) {
            car.x = before.x; car.z = before.z;
            if (Math.abs(car.speed) > 12) {
              this.effects.sparks(car.x, car.z);
              this.sound.crash();
              car.speed *= -0.25;
            } else {
              car.speed *= 0.5;
            }
          }
        }
        car.sync();
      }
      p.x = car.x; p.z = car.z;
      this.camYaw += (car.heading - this.camYaw) * Math.min(1, 1.2 * dt) * 0.4;
      // Speeding past a cop adds heat.
      if (Math.abs(car.speed) > 30) {
        for (const cop of this.police.cars) {
          if (Math.hypot(cop.x - car.x, cop.z - car.z) < 26) {
            this.police.addHeat(WANTED.speedNearCop * dt);
            break;
          }
        }
      }
      this.sound.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
    } else {
      const before = { x: p.x, z: p.z };
      p.walk(dt, input, this.camYaw);
      // Building collision: slide along the wall (x-only, then z-only)
      // instead of cancelling the whole move.
      if (this.city.collides(p.x, p.z, PLAYER.radius)) {
        const nx = p.x; const nz = p.z;
        p.x = nx; p.z = before.z;
        if (this.city.collides(p.x, p.z, PLAYER.radius)) {
          p.x = before.x; p.z = nz;
          if (this.city.collides(p.x, p.z, PLAYER.radius)) { p.x = before.x; p.z = before.z; }
        }
        p.sync();
      }
      this.sound.setEngine(0, false);
      if ((input.mouseDown || input.space) && p.shotCooldown <= 0) {
        // Punch when someone is right in front, otherwise shoot.
        let near = false;
        for (const ped of this.crowd.peds) {
          if (ped.alive && Math.hypot(ped.x - p.x, ped.z - p.z) < 2.4) { near = true; break; }
        }
        if (near) this.punch(); else this.fire();
      }
    }

    // Player car vs traffic: bump, sparks, heat when the player is fast.
    if (p.inCar) {
      const car = p.inCar;
      for (const other of this.traffic.cars) {
        if (!other.alive || other === car) continue;
        const d = Math.hypot(other.x - car.x, other.z - car.z);
        if (d < 3.6 && d > 0.01) {
          const push = (3.6 - d) / 2;
          const nx = (other.x - car.x) / d; const nz = (other.z - car.z) / d;
          other.x += nx * push; other.z += nz * push;
          car.x -= nx * push; car.z -= nz * push;
          if (Math.abs(car.speed) > 8 && this.crimeCooldown <= 0) {
            this.crimeCooldown = 1;
            this.effects.sparks(car.x, car.z);
            this.sound.crash();
            this.police.addHeat(WANTED.hitCar);
            other.speed *= 0.4;
          }
          other.sync(); car.sync();
        }
      }
      // Running over pedestrians.
      for (const ped of this.crowd.peds) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.3 && Math.abs(car.speed) > 3) {
          ped.remove(this.scene);
          this.crowd.scareNear(car.x, car.z, 20);
          this.effects.smoke(car.x, car.z);
          this.sound.crash();
          this.police.addHeat(WANTED.hitPed);
          car.speed *= 0.7;
        }
      }
    } else {
      // On foot, a traffic car can clip the player.
      for (const other of this.traffic.cars) {
        if (!other.alive) continue;
        if (Math.hypot(other.x - p.x, other.z - p.z) < 1.9 && Math.abs(other.speed) > 4) {
          p.damage(12);
          p.x += Math.sin(other.heading) * 2;
          p.z += Math.cos(other.heading) * 2;
          this.effects.sparks(p.x, p.z);
          this.sound.crash();
          break;
        }
      }
    }

    this.traffic.update(dt, p.inCar);
    this.crowd.update(dt);
    this.police.update(dt, p, () => this.showScreen('busted'), () => {
      if (this.crimeCooldown <= 0) { this.crimeCooldown = 0.6; this.sound.crash(); this.effects.sparks(p.x, p.z); }
    });
    this.effects.update(dt);

    // Missions.
    const result = this.missions.update(dt, p.x, p.z);
    if (this.missions.pendingHeat) {
      this.police.addHeat(this.missions.pendingHeat);
      this.missions.pendingHeat = 0;
    }
    if (result === 'complete') {
      const m = this.missions.defs[this.missions.index - 1] || this.missions.current;
      const pay = this.missions.done ? MISSIONS[MISSIONS.length - 1].pay : 0;
      const paid = this.missions.done ? pay : (this.missions.defs[this.missions.index - 1] || {}).pay || 0;
      p.cash += paid;
      this.effects.cashPop(p.x, p.z);
      this.sound.chime();
      this.hud.showMessage(this.missions.done
        ? `All jobs done! +$${paid}. Solmara is yours — free roam.`
        : `Job complete! +$${paid}. Mara has another one for you.`, 5);
      this.save();
      if (this.missions.done) this.showScreen('complete');
    } else if (result === 'timeout') {
      this.missions.setMission(this.missions.index);
      this.hud.showMessage('Too slow — Mara gave the job to someone else. Try again.', 4);
    } else if (result === 'advance') {
      this.sound.pickup();
      this.hud.showMessage('Parcel secured. Get to the drop-off.', 3);
    }

    // Slow health regen while the heat is off.
    if (this.police.stars === 0 && p.health > 0) p.heal(2 * dt);
    if (p.health <= 0) { this.showScreen('wasted'); return; }

    // Siren blips while wanted.
    this.sirenTimer -= dt;
    if (this.police.stars > 0 && this.sirenTimer <= 0) {
      this.sirenTimer = 1.1;
      this.sound.sirenTick(this.police.stars);
    }

    // Slow day cycle, paused while a shot is staged or a preset is locked.
    if (!this.frozen && !this.lightLocked) {
      this.lightPhase += dt / 120;
      const phase = this.lightPhase % 1;
      const preset = phase < 0.45 ? 'dusk' : phase < 0.75 ? 'night' : 'dawn';
      if (preset !== this.lightPreset) this.setLighting(preset);
    }

    // Autosave every 15 seconds.
    this.saveTimer += dt;
    if (this.saveTimer > 15) { this.saveTimer = 0; this.save(); }

    this.hud.update(dt, {
      cash: p.cash,
      health: p.health,
      stars: this.police.stars,
      speed: p.inCar ? p.inCar.speed : 0,
      inCar: !!p.inCar,
      objective: this.missions.objective,
      dialogue: this.missions.currentLine,
      timer: this.missions.timer,
      target: this.missions.target,
      police: [...this.police.cars, ...this.police.footCops],
      playerX: p.x,
      playerZ: p.z,
      playerHeading: p.inCar ? p.inCar.heading : this.camYaw,
    });
  }

  render() {
    const p = this.player;
    const fx = p.inCar ? p.inCar.x : p.x;
    const fz = p.inCar ? p.inCar.z : p.z;
    const heading = p.inCar ? p.inCar.heading : this.camYaw;
    // Chase camera: behind the heading, height by pitch, looking ahead.
    const dist = p.inCar ? 10.5 : 7.5;
    const height = p.inCar ? 4.2 : 3.4;
    const cx = fx - Math.sin(this.camYaw) * dist * Math.cos(this.camPitch);
    const cz = fz - Math.cos(this.camYaw) * dist * Math.cos(this.camPitch);
    const cy = height + Math.sin(this.camPitch) * dist * 0.6;
    this.camera.position.set(cx, cy, cz);
    // Look where the camera faces (camYaw), not where the car points: the
    // two agree while driving, but the camera may be turned to aim or to
    // frame an objective.
    this.camera.lookAt(fx + Math.sin(this.camYaw) * 6, 1.4, fz + Math.cos(this.camYaw) * 6);
    this.renderer.render(this.scene, this.camera);
  }

  frame(dt) {
    if (!this.frozen) this.step(dt);
    this.render();
  }
}
