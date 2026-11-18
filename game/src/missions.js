// The story: three chained jobs for the fixer Mara Quinn. Each mission
// has a pickup and/or a drop marker, a timer where the job demands one,
// dialogue lines shown one at a time, and a cash payout on completion.
// Progress is saved so Continue resumes the chain.
import * as THREE from 'three';

export class Missions {
  constructor(scene, defs) {
    this.scene = scene;
    this.defs = defs;
    this.index = 0; // 0-based mission in progress
    this.stage = 'pickup'; // pickup -> drop -> done
    this.timer = 0;
    this.done = false;
    this.lineIndex = 0;
    this.lineTimer = 0;
    this.currentLine = '';
    // A tall glowing beacon marks the active objective in the world.
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 70, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x05d9e8, transparent: true, opacity: 0.45,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 30;
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.2, 3.0, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x05d9e8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.1;
    scene.add(this.ring);
    this.setMission(0);
  }

  // Reset the chain without rebuilding the beacon meshes (newGame reuses
  // this instance so the scene never collects duplicate beacons).
  reset() {
    this.done = false;
    this.beacon.visible = true;
    this.ring.visible = true;
    this.setMission(0);
  }

  get current() { return this.defs[this.index]; }

  get objective() {
    if (this.done) return 'All jobs done — Solmara is yours. Free roam!';
    const m = this.current;
    if (this.stage === 'pickup') return `M${m.id} ${m.title}: pick up the parcel`;
    return `M${m.id} ${m.title}: reach the drop-off`;
  }

  get target() {
    if (this.done) return null;
    const m = this.current;
    return this.stage === 'pickup' && m.pickup ? m.pickup : m.drop;
  }

  setMission(i) {
    this.index = i;
    this.stage = this.current.pickup ? 'pickup' : 'drop';
    this.timer = this.current.timeLimit || 0;
    this.lineIndex = 0;
    this.lineTimer = 0;
    this.currentLine = this.current.lines[0] || '';
    if (this.current.heatOnStart) this.pendingHeat = this.current.heatOnStart;
    else this.pendingHeat = 0;
  }

  // Returns 'advance' | 'complete' | 'timeout' | null.
  update(dt, px, pz) {
    if (this.done) return null;
    const m = this.current;
    // Dialogue lines advance every 5 seconds.
    if (this.lineIndex < m.lines.length) {
      this.lineTimer += dt;
      if (this.lineTimer > 5) {
        this.lineTimer = 0;
        this.lineIndex += 1;
        this.currentLine = m.lines[this.lineIndex] || '';
      }
    }
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) return 'timeout';
    }
    const t = this.target;
    if (t) {
      this.beacon.position.set(t.x, 30, t.z);
      this.ring.position.set(t.x, 0.1, t.z);
      this.beacon.visible = true;
      this.ring.visible = true;
      this.ring.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.12);
      const d = Math.hypot(px - t.x, pz - t.z);
      if (d < 5) {
        if (this.stage === 'pickup') {
          this.stage = 'drop';
          this.lineIndex = 0;
          this.lineTimer = 0;
          this.currentLine = 'Parcel secured. Get to the drop — marker updated.';
          return 'advance';
        }
        // Drop reached: mission complete.
        const pay = m.pay;
        if (this.index + 1 < this.defs.length) {
          this.setMission(this.index + 1);
          return 'complete';
        }
        this.done = true;
        this.beacon.visible = false;
        this.ring.visible = false;
        this.currentLine = 'MARA: That\'s the last one. Solmara is yours, Dax.';
        return 'complete';
      }
    }
    return null;
  }

  // Save/load: which mission, which stage, whether the chain is done.
  saveState() { return { index: this.index, stage: this.stage, done: this.done }; }

  loadState(s) {
    if (!s) return;
    if (s.done) {
      this.done = true;
      this.beacon.visible = false;
      this.ring.visible = false;
      return;
    }
    this.index = Math.min(s.index || 0, this.defs.length - 1);
    this.stage = s.stage === 'drop' ? 'drop' : (this.current.pickup ? 'pickup' : 'drop');
    this.timer = this.current.timeLimit || 0;
    this.lineIndex = 0;
    this.currentLine = this.current.lines[0] || '';
  }
}
