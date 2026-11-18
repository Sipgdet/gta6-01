// The HUD: cash, health bar, wanted stars, speed, mission objective,
// dialogue line, centre messages, and a canvas minimap that draws the
// street grid, the player, the mission marker and police.
import { WORLD } from './config.js';

export class Hud {
  constructor() {
    this.cashEl = document.getElementById('hud-cash');
    this.healthFill = document.getElementById('hud-health-fill');
    this.starsEl = document.getElementById('hud-stars');
    this.speedEl = document.getElementById('hud-speed');
    this.objectiveEl = document.getElementById('hud-objective');
    this.dialogueEl = document.getElementById('hud-dialogue');
    this.messageEl = document.getElementById('hud-message');
    this.timerEl = document.getElementById('hud-timer');
    this.minimap = document.getElementById('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.messageTimer = 0;
  }

  showMessage(text, seconds) {
    this.messageEl.textContent = text;
    this.messageEl.style.opacity = '1';
    this.messageTimer = seconds || 3;
  }

  update(dt, state) {
    this.cashEl.textContent = `$${Math.floor(state.cash)}`;
    this.healthFill.style.width = `${Math.max(0, state.health)}%`;
    this.healthFill.style.background = state.health > 50 ? '#39ff88' : state.health > 25 ? '#ffd319' : '#ff2a6d';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.stars ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.style.color = state.stars > 0 ? '#ff2a6d' : '#8888aa';
    this.speedEl.textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 3.6)} km/h` : 'ON FOOT';
    this.objectiveEl.textContent = state.objective;
    this.dialogueEl.textContent = state.dialogue || '';
    this.dialogueEl.style.opacity = state.dialogue ? '1' : '0';
    this.timerEl.textContent = state.timer > 0 ? `⏱ ${Math.ceil(state.timer)}s` : '';
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageEl.style.opacity = '0';
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const size = this.minimap.width;
    const { half, pitch, road, blocks } = WORLD;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(8, 8, 18, 0.85)';
    ctx.fillRect(0, 0, size, size);
    const scale = size / (half * 2 + 20);
    const toMap = (x, z) => [(x + half + 10) * scale, (z + half + 10) * scale];
    // Roads.
    ctx.strokeStyle = '#555566';
    ctx.lineWidth = Math.max(2, road * scale);
    for (let i = 0; i <= blocks; i += 1) {
      const c = -half + road / 2 + i * pitch;
      const [x1, y1] = toMap(c, -half - 10);
      const [x2, y2] = toMap(c, half + 10);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(-half - 10, c);
      const [x4, y4] = toMap(half + 10, c);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // Mission marker.
    if (state.target) {
      const [mx, my] = toMap(state.target.x, state.target.z);
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      ctx.fillStyle = '#05d9e8';
      ctx.beginPath(); ctx.arc(mx, my, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // Police dots.
    ctx.fillStyle = '#2244ff';
    for (const p of state.police) {
      const [px, py] = toMap(p.x, p.z);
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-state.playerHeading);
    ctx.fillStyle = '#39ff88';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
