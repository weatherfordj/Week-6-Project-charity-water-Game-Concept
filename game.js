/* =============================================
   charity: water Drop Catcher – Game Logic
   ============================================= */

'use strict';

// ── DOM refs ──────────────────────────────────
const canvas         = document.getElementById('game-canvas');
const ctx            = canvas.getContext('2d');
const scoreDisplay   = document.getElementById('score-display');
const levelDisplay   = document.getElementById('level-display');
const livesDisplay   = document.getElementById('lives-display');
const startScreen    = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const finalScoreMsg  = document.getElementById('final-score-msg');
const startBtn       = document.getElementById('start-btn');
const restartBtn     = document.getElementById('restart-btn');

// ── Config ────────────────────────────────────
const MAX_LIVES       = 3;
const BASE_DROP_SPEED = 2.5;   // px/frame at level 1
const SPEED_INCREMENT = 0.35;  // extra px/frame per level
const DROPS_PER_LEVEL = 10;    // catches needed to level up
const BUCKET_W        = 80;
const BUCKET_H        = 44;
const DROP_R          = 12;
const BASE_SPAWN_RATE = 80;    // frames between spawns
const BUCKET_SPEED    = 7;
const SPEED_VARIANCE  = 0.8;   // random extra speed added to each drop
const WOBBLE_RANGE    = 1.2;   // max horizontal drift (±) per frame
const BANNER_FADE_RATE= 0.018; // alpha reduction per frame for level-up banner

// ── Brand colours ─────────────────────────────
const CLR_YELLOW = '#FFC907';
const CLR_NAVY   = '#1A3C5E';
const CLR_WATER  = '#4ab3e8';
const CLR_WATER2 = '#1e90d6';
const CLR_SKY1   = '#0a1f3d';
const CLR_SKY2   = '#1a4a7a';

// ── Game state ────────────────────────────────
let score, lives, level, dropsThisLevel, frameCount, spawnRate;
let drops      = [];
let particles  = [];
let bucketX    = 0;
let gameRunning= false;
let animId     = null;
let bannerAlpha= 0;
let bannerText = '';
const keys     = {};

// ── Canvas sizing ─────────────────────────────
function resizeCanvas() {
  const hud      = document.getElementById('hud');
  canvas.width   = window.innerWidth;
  canvas.height  = window.innerHeight - hud.offsetHeight;
  bucketX = Math.min(Math.max(bucketX || canvas.width / 2, BUCKET_W / 2),
                     canvas.width - BUCKET_W / 2);
}

// ── Init ──────────────────────────────────────
function initGame() {
  score          = 0;
  lives          = MAX_LIVES;
  level          = 1;
  dropsThisLevel = 0;
  frameCount     = 0;
  spawnRate      = BASE_SPAWN_RATE;
  drops          = [];
  particles      = [];
  bannerAlpha    = 0;
  bucketX        = canvas.width / 2;
  updateHUD();
}

// ── HUD ───────────────────────────────────────
function updateHUD() {
  scoreDisplay.textContent = score;
  levelDisplay.textContent = level;
  const lifeEls = livesDisplay.querySelectorAll('.life');
  lifeEls.forEach((el, i) => el.classList.toggle('lost', i >= lives));
}

// ── Spawn drop ────────────────────────────────
function spawnDrop() {
  const margin = DROP_R + 5;
  drops.push({
    x:      margin + Math.random() * (canvas.width - margin * 2),
    y:      -DROP_R,
    speed:  BASE_DROP_SPEED + SPEED_INCREMENT * (level - 1) + Math.random() * SPEED_VARIANCE,
    wobble: (Math.random() - 0.5) * WOBBLE_RANGE,
    golden: Math.random() < 0.15,
  });
}

// ── Particles ─────────────────────────────────
function spawnParticles(x, y, golden) {
  const colour = golden ? CLR_YELLOW : CLR_WATER;
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
    const spd   = 2 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 2,
      life: 1, decay: 0.04 + Math.random() * 0.03,
      r: 3 + Math.random() * 3, colour,
    });
  }
}

function spawnSplash(x) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * Math.PI;
    const spd   = 1.5 + Math.random() * 2.5;
    particles.push({
      x, y: canvas.height - 4,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1, decay: 0.06 + Math.random() * 0.04,
      r: 2 + Math.random() * 2, colour: '#6699bb',
    });
  }
}

// ── Level up ──────────────────────────────────
function checkLevelUp() {
  if (dropsThisLevel >= DROPS_PER_LEVEL) {
    level++;
    dropsThisLevel = 0;
    spawnRate = Math.max(30, BASE_SPAWN_RATE - (level - 1) * 8);
    bannerText  = `Level ${level}!`;
    bannerAlpha = 1;
    updateHUD();
  }
}

// ── Draw: background ──────────────────────────
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, CLR_SKY1);
  grad.addColorStop(1, CLR_SKY2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decorative wave
  ctx.save();
  ctx.strokeStyle = 'rgba(74,179,232,0.12)';
  ctx.lineWidth   = 40;
  const t = frameCount * 0.01;
  ctx.beginPath();
  for (let x = 0; x <= canvas.width; x += 6) {
    const y = canvas.height * 0.18 + Math.sin(x * 0.018 + t) * 10;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// ── Draw: single water drop ───────────────────
function drawDrop(drop) {
  const { x, y, golden } = drop;
  ctx.save();
  ctx.shadowColor = golden ? 'rgba(255,201,7,0.6)' : 'rgba(74,179,232,0.5)';
  ctx.shadowBlur  = 14;

  const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, DROP_R);
  grad.addColorStop(0, golden ? '#ffe680' : '#8fd8f8');
  grad.addColorStop(1, golden ? CLR_YELLOW : CLR_WATER2);

  ctx.beginPath();
  ctx.moveTo(x, y - DROP_R * 1.5);
  ctx.bezierCurveTo(x + DROP_R, y - DROP_R * 0.2, x + DROP_R, y + DROP_R * 0.5, x, y + DROP_R);
  ctx.bezierCurveTo(x - DROP_R, y + DROP_R * 0.5, x - DROP_R, y - DROP_R * 0.2, x, y - DROP_R * 1.5);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

// ── Draw: bucket ──────────────────────────────
function drawBucket() {
  const bx = bucketX - BUCKET_W / 2;
  const by = canvas.height - BUCKET_H - 6;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur  = 10;

  // Trapezoid body
  ctx.beginPath();
  ctx.moveTo(bx + 4,           by);
  ctx.lineTo(bx + BUCKET_W - 4, by);
  ctx.lineTo(bx + BUCKET_W - 12, by + BUCKET_H);
  ctx.lineTo(bx + 12,          by + BUCKET_H);
  ctx.closePath();
  ctx.fillStyle   = CLR_YELLOW;
  ctx.fill();
  ctx.strokeStyle = '#c49500';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Top rim
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + BUCKET_W, by);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 3;
  ctx.stroke();

  // Water inside
  const waterH = BUCKET_H * 0.45;
  const waterY = by + BUCKET_H - waterH;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bx + 12,           by + BUCKET_H);
  ctx.lineTo(bx + BUCKET_W - 12, by + BUCKET_H);
  ctx.lineTo(bx + BUCKET_W - 12 - (BUCKET_W - 24) * 0.15, waterY);
  ctx.lineTo(bx + 12 + (BUCKET_W - 24) * 0.15,           waterY);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = CLR_WATER2;
  ctx.fillRect(bx, waterY, BUCKET_W, waterH);

  // Animated surface inside bucket
  ctx.strokeStyle = CLR_WATER;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  const t = frameCount * 0.08;
  for (let i = 0; i <= BUCKET_W; i += 4) {
    const wx = bx + i;
    const wy = waterY + Math.sin(i * 0.3 + t) * 2;
    i === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
  }
  ctx.stroke();
  ctx.restore();

  // Label
  ctx.shadowBlur   = 0;
  ctx.fillStyle    = CLR_NAVY;
  ctx.font         = 'bold 9px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('charity: water', bucketX, by + BUCKET_H * 0.3);

  ctx.restore();
}

// ── Draw: particles ───────────────────────────
function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.colour;
    ctx.fill();
    ctx.restore();
  });
}

// ── Draw: level-up banner ─────────────────────
function drawBanner() {
  if (bannerAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha  = bannerAlpha;
  ctx.font         = `bold ${Math.floor(canvas.width * 0.1)}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = CLR_YELLOW;
  ctx.shadowColor  = 'rgba(255,201,7,0.6)';
  ctx.shadowBlur   = 20;
  ctx.fillText(bannerText, canvas.width / 2, canvas.height / 2);
  ctx.restore();
  bannerAlpha -= BANNER_FADE_RATE;
}

// ── Collision ─────────────────────────────────
function collides(drop) {
  const bLeft = bucketX - BUCKET_W / 2;
  const bRight= bucketX + BUCKET_W / 2;
  const bTop  = canvas.height - BUCKET_H - 6;
  return drop.x > bLeft && drop.x < bRight &&
         drop.y + DROP_R >= bTop &&
         drop.y - DROP_R <= canvas.height;
}

// ── Keyboard input ────────────────────────────
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup',   e => { keys[e.key] = false; });

function applyKeyboard() {
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) {
    bucketX = Math.max(BUCKET_W / 2, bucketX - BUCKET_SPEED);
  }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) {
    bucketX = Math.min(canvas.width - BUCKET_W / 2, bucketX + BUCKET_SPEED);
  }
}

// ── Mouse input ───────────────────────────────
canvas.addEventListener('mousemove', e => {
  if (!gameRunning) return;
  const rect = canvas.getBoundingClientRect();
  bucketX = Math.min(
    Math.max(e.clientX - rect.left, BUCKET_W / 2),
    canvas.width - BUCKET_W / 2
  );
});

// ── Touch input ───────────────────────────────
canvas.addEventListener('touchmove', e => {
  if (!gameRunning) return;
  e.preventDefault();
  const rect  = canvas.getBoundingClientRect();
  bucketX = Math.min(
    Math.max(e.touches[0].clientX - rect.left, BUCKET_W / 2),
    canvas.width - BUCKET_W / 2
  );
}, { passive: false });

// ── Main loop ─────────────────────────────────
function gameLoop() {
  if (!gameRunning) return;

  applyKeyboard();
  frameCount++;

  // Spawn
  if (frameCount % spawnRate === 0) spawnDrop();

  // Update drops
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.y += d.speed;
    d.x += d.wobble;
    d.x  = Math.max(DROP_R, Math.min(canvas.width - DROP_R, d.x));

    if (collides(d)) {
      score += d.golden ? 3 : 1;
      dropsThisLevel++;
      spawnParticles(d.x, d.y, d.golden);
      drops.splice(i, 1);
      checkLevelUp();
      updateHUD();
    } else if (d.y - DROP_R > canvas.height) {
      lives--;
      spawnSplash(d.x);
      drops.splice(i, 1);
      updateHUD();
      if (lives <= 0) { endGame(); return; }
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x   += p.vx;
    p.y   += p.vy;
    p.vy  += 0.15;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Render
  drawBackground();
  drops.forEach(drawDrop);
  drawBucket();
  drawParticles();
  drawBanner();

  animId = requestAnimationFrame(gameLoop);
}

// ── Start / End ───────────────────────────────
function startGame() {
  cancelAnimationFrame(animId);
  resizeCanvas();
  initGame();
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  gameRunning = true;
  gameLoop();
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animId);
  finalScoreMsg.textContent =
    `You caught ${score} drop${score !== 1 ? 's' : ''}! 💧`;
  gameoverScreen.classList.remove('hidden');
}

// ── Buttons ───────────────────────────────────
startBtn.addEventListener('click',   startGame);
restartBtn.addEventListener('click', startGame);

// ── Resize ────────────────────────────────────
window.addEventListener('resize', () => {
  resizeCanvas();
  if (!gameRunning) { drawBackground(); drawBucket(); }
});

// ── Boot ──────────────────────────────────────
resizeCanvas();
drawBackground();
