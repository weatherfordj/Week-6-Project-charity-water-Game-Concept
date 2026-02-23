(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const bucketImg = new Image();
  bucketImg.src = "Bucket.png";  // adjust path if needed

  let bucketProcessed = false;

  bucketImg.onload = () => {
  if (bucketProcessed) return;
  bucketProcessed = true;
  const off = document.createElement("canvas");
  off.width = bucketImg.width;
  off.height = bucketImg.height;
  const offCtx = off.getContext("2d");

  offCtx.drawImage(bucketImg, 0, 0);
  const imgData = offCtx.getImageData(0, 0, off.width, off.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Remove light gray background
    if (r > 200 && g > 200 && b > 200) {
      data[i + 3] = 0;
    }
  }

  offCtx.putImageData(imgData, 0, 0);
  bucketImg.src = off.toDataURL();
};

  // HUD elements
  const scoreEl = document.getElementById("score");
  const streakEl = document.getElementById("streak");
  const multEl = document.getElementById("multiplier");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");

  // Buttons / overlay
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const overlay = document.getElementById("overlay");
  const finalScoreEl = document.getElementById("finalScore");
  const finalBestEl = document.getElementById("finalBest");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const copyBtn = document.getElementById("copyBtn");

  // Game config
  const GAME_SECONDS = 60;
  const BASE_SPAWN_MS = 650;
  const MIN_SPAWN_MS = 260;

  // State
  let running = false;
  let lastFrame = 0;
  let spawnTimer = 0;
  let timeLeft = GAME_SECONDS;
  let timerInterval = null;

  let score = 0;
  let streak = 0;
  let multiplier = 1;

  const bestKey = "catchstreak_best";
  let bestScore = Number(localStorage.getItem(bestKey) || 0);
  bestEl.textContent = String(bestScore);

  // Input
  const keys = { left: false, right: false };

  // Entities
  const bucket = {
   width: 110,
   height: 18,
   x: canvas.width / 2 - 55,
   y: canvas.height - 85,
   speed: 520
 };
  const droplets = [];

  function resetGame() {
    running = false;
    lastFrame = 0;
    spawnTimer = 0;
    timeLeft = GAME_SECONDS;

    score = 0;
    streak = 0;
    multiplier = 1;

    droplets.length = 0;

    bucket.x = canvas.width / 2 - bucket.width / 2;

    updateHUD();
    hideOverlay();
    stopTimer();
  }

  function startGame() {
    if (running) return;
    resetGame();
    running = true;
    startBtn.disabled = true;
    restartBtn.disabled = false;

    startTimer();
    requestAnimationFrame(loop);
  }

  function restartGame() {
    resetGame();
    running = true;
    startBtn.disabled = true;
    restartBtn.disabled = false;

    startTimer();
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    stopTimer();
    startBtn.disabled = false;
    restartBtn.disabled = false;

    // Best score update
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(bestKey, String(bestScore));
      bestEl.textContent = String(bestScore);
    }

    finalScoreEl.textContent = String(score);
    finalBestEl.textContent = String(bestScore);
    showOverlay();
  }

  function startTimer() {
    timeEl.textContent = String(timeLeft);
    timerInterval = setInterval(() => {
      if (!running) return;
      timeLeft -= 1;
      timeEl.textContent = String(timeLeft);

      // gentle difficulty scaling: spawn faster over time
      // (handled in getSpawnInterval)

      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateHUD() {
    scoreEl.textContent = String(score);
    streakEl.textContent = String(streak);
    multEl.textContent = `x${multiplier}`;
    timeEl.textContent = String(timeLeft);
    bestEl.textContent = String(bestScore);
  }

  function showOverlay() {
    overlay.hidden = false;
  }
  function hideOverlay() {
    overlay.hidden = true;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function getSpawnInterval() {
    // Over the round, reduce spawn interval (more drops)
    // timeLeft goes from 60 -> 0, progress goes 0 -> 1
    const progress = 1 - (timeLeft / GAME_SECONDS);
    const interval = BASE_SPAWN_MS - Math.floor(progress * 420);
    return clamp(interval, MIN_SPAWN_MS, BASE_SPAWN_MS);
  }

  function spawnDroplet() {
    // Bonus roughly 1 in 12 drops
    const isBonus = Math.random() < (1 / 12);

    const r = isBonus ? 10 : 8;
    const margin = 140; // increase = narrower drop zone
    const minX = margin + r;
    const maxX = canvas.width - margin - r;
    const x = Math.random() * (maxX - minX) + minX;
    const y = -20;

    // speed scales slightly with time progress too
    const progress = 1 - (timeLeft / GAME_SECONDS);
    const baseSpeed = isBonus ? 230 : 260;
    const speed = baseSpeed + progress * 180 + Math.random() * 60;

    droplets.push({
      x, y, r, speed,
      type: isBonus ? "bonus" : "normal"
    });
  }

  function recalcMultiplier() {
    multiplier = 1 + Math.floor(streak / 10);
  }

  function onCatch(type) {
    streak += 1;
    recalcMultiplier();

    const base = (type === "bonus") ? 10 : 1;
    score += base * multiplier;

    updateHUD();
  }

  function onMiss() {
    streak = 0;
    multiplier = 1;
    updateHUD();
  }

  function rectCircleColliding(rect, circle) {
    // Find closest point on the rectangle to the circle center
    const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) <= (circle.r * circle.r);
  }

  function update(dt) {
    // Move bucket
    if (keys.left) bucket.x -= bucket.speed * dt;
    if (keys.right) bucket.x += bucket.speed * dt;
    bucket.x = clamp(bucket.x, 0, canvas.width - bucket.width);

    // Spawn droplets
    spawnTimer += dt * 1000;
    const spawnEvery = getSpawnInterval();
    while (spawnTimer >= spawnEvery) {
      spawnDroplet();
      spawnTimer -= spawnEvery;
    }

    // Update droplets
    const bucketRect = {
    x: bucket.x + 18,
    y: bucket.y + 10,
    w: bucket.width - 36,
    h: 28
    };

    for (let i = droplets.length - 1; i >= 0; i--) {
      const d = droplets[i];
      d.y += d.speed * dt;

      // Check catch (circle hits bucket rect)
      if (rectCircleColliding(bucketRect, d)) {
        onCatch(d.type);
        droplets.splice(i, 1);
        continue;
      }

      // Missed
      if (d.y - d.r > canvas.height) {
        onMiss();
        droplets.splice(i, 1);
      }
    }
  }

function drawPixelBucket(ctx, x, y, w, h) {
  // Pixel-art palette (based on your reference bucket)
  const P = {
    ".": null,        // transparent
    "O": "#06055C",   // outline (very dark blue)
    "B": "#4B69F1",   // medium blue
    "D": "#3140A1",   // darker blue shading
    "L": "#59A0F2",   // light blue
    "W": "#61CDF4",   // water / highlights
    "S": "rgba(0,0,0,0.18)" // shadow
  };

  const sprite = [
    "..........OOOOOO..........",
    ".......OOOOOLLLLOOOO.......",
    ".....OOOOLLLLWWLLLLOOO.....",
    "....OOOLLWWWWWWWWLLLOO....",
    "...OOOLLWWWWWWWWWWLLLOO...",
    "..OOOLLLLWWWWWWWWLLLLLOO..",
    "..OOOLLLLLLLLLLLLLLLLLLO..",
    ".OOOLLLOOOOOOOOOOOOLLLLOO.",
    ".OOOLLOOBBBBBBBBBBOOLLLOO.",
    ".OOOLLOOBBLLLLLLBBOOLLLOO.",
    ".OOOLLOOBBLLDDLLBBOOLLLOO.",
    ".OOOLLOOBBLLDDLLBBOOLLLOO.",
    ".OOOLLOOBBLLDDLLBBOOLLLOO.",
    "..OOOLLOOBBBBBBBBOOLLLOO..",
    "...OOOLLOOOOOOOOOOLLLOO...",
    "....OOOLLLLBBBBLLLLLOOO....",
    ".....OOOOLLLLLLLLLLOOO.....",
    ".......OOOOOOOOOOOO.......",
  ];

  const sw = sprite[0].length;
  const sh = sprite.length;

  // Scale sprite to your bucket size
  const px = w / sw;
  const py = h / sh;

  // Shadow (optional but nice)
  ctx.save();
  ctx.fillStyle = P.S;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + py * 1.5, w * 0.35, h * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw sprite pixels
  for (let row = 0; row < sh; row++) {
    for (let col = 0; col < sw; col++) {
      const ch = sprite[row][col];
      const color = P[ch];
      if (!color) continue;

      // "Crisp" pixels
      ctx.fillStyle = color;
      ctx.fillRect(
        x + col * px,
        y + row * py,
        Math.ceil(px),
        Math.ceil(py)
      );
    }
  }
}

function drawPixelSky(ctx) {
  const skyBlue = "#AEE2FF";
  const cloudWhite = "#FFFFFF";
  const cloudShade = "#E6F5FF";

  // Sky background
  ctx.fillStyle = skyBlue;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Pixel clouds
  function cloud(x, y, scale = 1) {
    const s = 8 * scale; // pixel size

    ctx.fillStyle = cloudWhite;

    ctx.fillRect(x, y, s * 6, s * 3);
    ctx.fillRect(x + s, y - s, s * 4, s * 3);
    ctx.fillRect(x + s * 2, y - s * 2, s * 2, s * 2);

    // subtle shading
    ctx.fillStyle = cloudShade;
    ctx.fillRect(x + s, y + s * 2, s * 4, s);
  }

  // Draw some clouds
  cloud(80, 100, 1);
  cloud(300, 140, 1.2);
  cloud(550, 90, 0.9);
  cloud(650, 180, 1.1);
}

function drawPixelLandscape(ctx) {
  const skyBlue = "#AEE2FF";
  const cloudWhite = "#FFFFFF";
  const cloudShade = "#E6F5FF";
  const grass = "#5CC36A";
  const grassDark = "#3DA653";
  const dirt = "#C98A4C";

  // SKY
  ctx.fillStyle = skyBlue;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // CLOUDS
  function cloud(x, y, scale = 1) {
    const s = 8 * scale;
    ctx.fillStyle = cloudWhite;

    ctx.fillRect(x, y, s * 6, s * 3);
    ctx.fillRect(x + s, y - s, s * 4, s * 3);
    ctx.fillRect(x + s * 2, y - s * 2, s * 2, s * 2);

    ctx.fillStyle = cloudShade;
    ctx.fillRect(x + s, y + s * 2, s * 4, s);
  }

  cloud(100, 90, 1);
  cloud(330, 130, 1.2);
  cloud(590, 85, 0.9);

  // GROUND
  const groundHeight = 110;

  // Dirt base
  ctx.fillStyle = dirt;
  ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);

  // Grass strip
  ctx.fillStyle = grass;
  ctx.fillRect(0, canvas.height - groundHeight, canvas.width, 24);

  // Dark grass edge pixels
  ctx.fillStyle = grassDark;
  for (let i = 0; i < canvas.width; i += 20) {
    ctx.fillRect(i, canvas.height - groundHeight, 10, 6);
  }
}

function drawDroplet(ctx, x, y, r, type) {
  ctx.save();
  ctx.translate(x, y);

  // Optional tiny wobble to feel more "water-like"
  const t = performance.now() / 400;
  ctx.rotate(Math.sin(t + x * 0.01) * 0.05);

  // Colors
  const mainTop = (type === "bonus") ? "#FFF4B0" : "#BFEAFF";
  const mainBottom = (type === "bonus") ? "#FFD750" : "#34B6FF";
  const outline = (type === "bonus") ? "rgba(160,120,0,0.35)" : "rgba(0,70,120,0.35)";

  // Drop shape (sharper tip + round belly)
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.65); // tip

  // Right side
  ctx.bezierCurveTo(
    r * 1.15, -r * 0.9,
    r * 1.10,  r * 0.55,
    0,          r * 1.25
  );

  // Left side
  ctx.bezierCurveTo(
    -r * 1.10,  r * 0.55,
    -r * 1.15, -r * 0.9,
    0,         -r * 1.65
  );

  // Fill gradient
  const g = ctx.createLinearGradient(0, -r * 1.6, 0, r * 1.3);
  g.addColorStop(0, mainTop);
  g.addColorStop(1, mainBottom);

  ctx.fillStyle = g;
  ctx.fill();

  // Optional outline (helps readability on sky background)
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = outline;
  ctx.stroke();

  // Glossy highlight (small curved shine)
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.25, r * 0.22, r * 0.45, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  // Tiny sparkle dot
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(r * 0.10, -r * 0.55, r * 0.10, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

  function draw() {
    drawPixelLandscape(ctx);



    // Draw droplets (improved droplet look)
for (const d of droplets) {
  drawDroplet(ctx, d.x, d.y, d.r, d.type);
}

    // Draw bucket image (only if loaded)
 if (bucketImg.complete) {
  const spriteWidth = 90;
  const spriteHeight = 90;

  ctx.drawImage(
    bucketImg,
    bucket.x,
    bucket.y - (spriteHeight - bucket.height),
    spriteWidth,
    spriteHeight
  );
}

    // Tiny hint text
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("Catch streaks to boost your multiplier!", 16, canvas.height - 14);
    ctx.restore();
  }

  function loop(ts) {
    if (!running) return;

    const now = ts;
    if (!lastFrame) lastFrame = now;
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // Controls
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = true;
    if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = true;

    // Prevent page scroll on arrows
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
  }, { passive: false });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = false;
    if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = false;
  });

  // Mouse move support (maps mouse x to bucket x)
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    bucket.x = clamp(mouseX - bucket.width / 2, 0, canvas.width - bucket.width);
  });

  // Buttons
  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", restartGame);
  playAgainBtn.addEventListener("click", restartGame);

  copyBtn.addEventListener("click", async () => {
    const text = `I scored ${score} in Catch Streak 💧 (bonus drops + multipliers). Learn more: https://www.charitywater.org`;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy Score"), 1200);
    } catch {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => (copyBtn.textContent = "Copy Score"), 1200);
    }
  });

  // Initialize
  resetGame();
})();