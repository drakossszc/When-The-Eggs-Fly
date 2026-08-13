const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameArea = document.getElementById("gameArea");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const missesEl = document.getElementById("misses");
const startScreen = document.getElementById("startScreen");
const gameOver = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");
const finalBest = document.getElementById("finalBest");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const soundBtn = document.getElementById("soundBtn");

let width = 0;
let height = 0;
let eggs = [];
let particles = [];
let score = 0;
let misses = 0;
let running = false;
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 720;
let difficulty = 1;
let soundOn = true;
let audioCtx = null;

let bestScore = Number(localStorage.getItem("whenEggsFlyBest") || 0);
bestScoreEl.textContent = bestScore;

const eggTypes = {
  normal: { points: 1, scale: 1, color: "#fff4e7", outline: "#6b3636" },
  small: { points: 3, scale: 0.70, color: "#f39a8f", outline: "#6b3636" },
  gold: { points: 5, scale: 1.05, color: "#ffd34e", outline: "#8c5420" },
  rainbow: { points: 10, scale: 1.12, color: "#ffffff", outline: "#633c57" }
};

function resizeCanvas() {
  const rect = gameArea.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  width = rect.width;
  height = rect.height;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function chooseEggType() {
  const roll = Math.random();

  if (roll < 0.0095) return "rainbow";
  if (roll < 0.012) return "gold";
  if (roll < 0.35) return "small";
  return "normal";
}

function spawnEgg() {
  const type = chooseEggType();
  const data = eggTypes[type];

  const baseSize = Math.min(width, height) * 0.075;
  const radius = baseSize * data.scale;

  const x = random(radius + 10, width - radius - 10);

  // Todos salen desde abajo y reciben una velocidad vertical negativa.
  const y = height + radius + 10;
  const vx = random(-125, 125) * (0.75 + difficulty * 0.1);
  const vy = random(-790, -620) * (0.9 + difficulty * 0.06);
  const gravity = random(760, 900) * (0.9 + difficulty * 0.04);

  eggs.push({
    x, y, vx, vy, gravity,
    radius,
    type,
    rotation: random(-0.35, 0.35),
    rotationSpeed: random(-2.5, 2.5),
    alive: true,
    born: performance.now()
  });
}

function drawEgg(egg) {
  ctx.save();
  ctx.translate(egg.x, egg.y);
  ctx.rotate(egg.rotation);

  const r = egg.radius;
  const type = eggTypes[egg.type];

  // Forma de huevo: parte superior más redondeada y base más ancha.
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.35);
  ctx.bezierCurveTo(r * 0.72, -r * 1.20, r * 1.02, -r * 0.35, r * 0.92, r * 0.35);
  ctx.bezierCurveTo(r * 0.82, r * 1.02, r * 0.48, r * 1.28, 0, r * 1.32);
  ctx.bezierCurveTo(-r * 0.48, r * 1.28, -r * 0.82, r * 1.02, -r * 0.92, r * 0.35);
  ctx.bezierCurveTo(-r * 1.02, -r * 0.35, -r * 0.72, -r * 1.20, 0, -r * 1.35);
  ctx.closePath();

  if (egg.type === "rainbow") {
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, "#ff7676");
    grad.addColorStop(0.25, "#ffd166");
    grad.addColorStop(0.5, "#7bdcb5");
    grad.addColorStop(0.75, "#70a7ff");
    grad.addColorStop(1, "#c58cff");
    ctx.fillStyle = grad;
  } else if (egg.type === "gold") {
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, "#fff4a8");
    grad.addColorStop(0.45, "#ffd34e");
    grad.addColorStop(1, "#ee9c26");
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, "#fffdf9");
    grad.addColorStop(0.65, type.color);
    grad.addColorStop(1, egg.type === "small" ? "#e77b78" : "#e7c9bb");
    ctx.fillStyle = grad;
  }

  ctx.shadowColor = "rgba(92, 46, 46, .28)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 6;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(3, r * 0.12);
  ctx.strokeStyle = type.outline;
  ctx.stroke();

  // Brillo.
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.63, r * 0.17, r * 0.35, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.fill();

  if (egg.type === "rainbow") {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.stroke();
  }

  ctx.restore();
}

function createParticles(x, y, type) {
  const colors = {
    normal: ["#fff4e7", "#f4c7b9", "#ffffff"],
    small: ["#f28b82", "#ffc1ba", "#fff0e9"],
    gold: ["#ffd34e", "#fff2a0", "#f4a261"],
    rainbow: ["#ff7676", "#ffd166", "#70d6a5", "#70a7ff", "#c58cff"]
  };

  for (let i = 0; i < 18; i++) {
    particles.push({
      x, y,
      vx: random(-230, 230),
      vy: random(-260, 120),
      size: random(3, 7),
      life: 0.65,
      maxLife: 0.65,
      color: colors[type][Math.floor(Math.random() * colors[type].length)]
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vy += 450 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function update(dt) {
  difficulty += dt * 0.012;

  spawnTimer += dt * 1000;
  spawnInterval = Math.max(330, 720 - difficulty * 25);

  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEgg();

    if (difficulty > 6 && Math.random() < 0.25) {
      setTimeout(() => {
        if (running) spawnEgg();
      }, 120);
    }
  }

  for (let i = eggs.length - 1; i >= 0; i--) {
    const egg = eggs[i];

    egg.vy += egg.gravity * dt;
    egg.x += egg.vx * dt;
    egg.y += egg.vy * dt;
    egg.rotation += egg.rotationSpeed * dt;

    // Rebote suave en las paredes.
    if (egg.x - egg.radius < 0) {
      egg.x = egg.radius;
      egg.vx *= -0.85;
    }

    if (egg.x + egg.radius > width) {
      egg.x = width - egg.radius;
      egg.vx *= -0.85;
    }

    // Se considera fallado cuando cae por la parte inferior.
    if (egg.y - egg.radius > height + 25) {
      eggs.splice(i, 1);
      misses++;
      missesEl.textContent = misses;

      if (misses >= 10) {
        endGame();
        return;
      }
    }
  }

  updateParticles(dt);
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  // Decoración de fondo.
  ctx.fillStyle = "rgba(255,255,255,.45)";
  for (let i = 0; i < 16; i++) {
    const x = (i * 137) % width;
    const y = 55 + ((i * 83) % Math.max(100, height - 120));
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const egg of eggs) drawEgg(egg);
  drawParticles();
}

function gameLoop(timestamp) {
  if (!running) return;

  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;

  update(dt);
  draw();

  if (running) requestAnimationFrame(gameLoop);
}

function startGame() {
  score = 0;
  misses = 0;
  difficulty = 1;
  spawnTimer = 0;
  eggs = [];
  particles = [];
  running = true;

  scoreEl.textContent = "0";
  missesEl.textContent = "0";
  startScreen.classList.add("hidden");
  gameOver.classList.add("hidden");

  lastTime = 0;
  playSound("start");
  requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("whenEggsFlyBest", bestScore);
  }

  bestScoreEl.textContent = bestScore;
  finalScore.textContent = score;
  finalBest.textContent = bestScore;
  gameOver.classList.remove("hidden");
  playSound("gameover");
}

function popEggAt(x, y) {
  if (!running) return;

  // Se busca desde el último para facilitar la selección cuando se cruzan.
  for (let i = eggs.length - 1; i >= 0; i--) {
    const egg = eggs[i];
    const distance = Math.hypot(x - egg.x, y - egg.y);

    if (distance <= egg.radius * 1.2) {
      const points = eggTypes[egg.type].points;
      score += points;
      scoreEl.textContent = score;

      createParticles(egg.x, egg.y, egg.type);
      playSound(egg.type);

      eggs.splice(i, 1);
      return;
    }
  }
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();

  if (event.touches && event.touches.length) {
    return {
      x: event.touches[0].clientX - rect.left,
      y: event.touches[0].clientY - rect.top
    };
  }

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

canvas.addEventListener("pointerdown", (event) => {
  const pos = pointerPosition(event);
  popEggAt(pos.x, pos.y);
});

function playSound(type) {
  if (!soundOn) return;

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const tones = {
      normal: 420,
      small: 560,
      gold: 720,
      rainbow: 920,
      start: 300,
      gameover: 160
    };

    osc.frequency.value = tones[type] || 420;
    osc.type = type === "rainbow" ? "triangle" : "sine";

    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.10);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.11);
  } catch (error) {
    // El juego funciona aunque el navegador bloquee el audio.
  }
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "🔊" : "🔇";
  if (soundOn) playSound("normal");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) {
    lastTime = performance.now();
  }
});
