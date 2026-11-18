// Keyboard + mouse input. Keys are tracked by code so layouts do not
// matter; mouse movement orbits the camera and the pointer locks on
// click during play.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.locked = false;
    this.canvas = canvas;
    this.onKey = null; // (code, down) => void, for one-shot actions
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code, true);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (this.onKey) this.onKey(e.code, false);
    });
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      if (e.button === 0 && document.pointerLockElement !== canvas) {
        try {
          const p = canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => { /* headless or denied: mouse still aims via keys */ });
        } catch (err) { /* pointer lock unavailable */ }
      }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
  }

  get forward() { return this.keys.has('KeyW') || this.keys.has('ArrowUp'); }
  get back() { return this.keys.has('KeyS') || this.keys.has('ArrowDown'); }
  get left() { return this.keys.has('KeyA') || this.keys.has('ArrowLeft'); }
  get right() { return this.keys.has('KeyD') || this.keys.has('ArrowRight'); }
  get shift() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get space() { return this.keys.has('Space'); }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }
}
