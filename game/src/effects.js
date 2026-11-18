// Particles and floating feedback: sparks on crashes, muzzle flashes,
// smoke puffs and the little cash popups when a job pays out.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  }

  burst(x, y, z, color, count, speed) {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i += 1) {
      const m = new THREE.Mesh(this.geo, mat);
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2 + 1;
      this.particles.push({
        mesh: m, vx: Math.cos(a) * speed * Math.random(), vy: up,
        vz: Math.sin(a) * speed * Math.random(), life: 0.5 + Math.random() * 0.4,
      });
      this.scene.add(m);
    }
  }

  sparks(x, z) { this.burst(x, 0.8, z, 0xffd319, 14, 6); }
  smoke(x, z) { this.burst(x, 1.0, z, 0x888888, 8, 2.5); }
  muzzle(x, y, z) { this.burst(x, y, z, 0xffe9a8, 5, 3); }
  cashPop(x, z) { this.burst(x, 1.5, z, 0x39ff88, 18, 4); }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 6 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.1, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(Math.max(0.1, p.life * 2));
    }
  }
}
