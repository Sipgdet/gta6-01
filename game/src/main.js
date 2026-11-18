// SOLMARA — entry point. Boots the game, stages a deterministic
// screenshot scene when ?shot= is given, otherwise runs the live loop.
import { Game } from './game.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 1) || 1;

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas, { seed });
window.__solmara = game; // playtest hooks read the live state from here

if (shot) {
  stageShot(shot, game);
  game.frozen = true;
  game.showScreen('playing');
  game.render();
  window.__shotReady = true;
} else {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
