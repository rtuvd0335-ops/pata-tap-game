const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.querySelector("#scoreValue");
const comboValue = document.querySelector("#comboValue");
const timeValue = document.querySelector("#timeValue");
const bestValue = document.querySelector("#bestValue");
const statusText = document.querySelector("#statusText");
const startOverlay = document.querySelector("#startOverlay");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const muteButton = document.querySelector("#muteButton");
const shareButton = document.querySelector("#shareButton");
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];
const shareUrl = "https://rtuvd0335-ops.github.io/pata-tap-game/";

const config = {
  easy: { speed: 235, radius: 64, round: 45, dodge: 0.55, name: "轻松" },
  normal: { speed: 315, radius: 58, round: 45, dodge: 0.76, name: "标准" },
  hard: { speed: 415, radius: 50, round: 40, dodge: 0.96, name: "狂暴" },
};

let difficulty = "easy";
let score = 0;
let combo = 0;
let best = Number(localStorage.getItem("pataTapBest") || 0);
let timeLeft = config[difficulty].round;
let running = false;
let muted = false;
let lastTime = 0;
let shake = 0;
let flash = 0;
let targetMood = 0;
let audioContext = null;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

const target = {
  x: 550,
  y: 310,
  vx: 180,
  vy: 140,
  radius: config[difficulty].radius,
  squash: 0,
  blush: 0,
};

const particles = [];
const texts = [];
const splats = [];

bestValue.textContent = String(best);
timeValue.textContent = String(timeLeft);
render(0);

function resetGame(startNow = true) {
  score = 0;
  combo = 0;
  timeLeft = config[difficulty].round;
  running = startNow;
  lastTime = performance.now();
  target.radius = config[difficulty].radius;
  target.x = canvas.width * 0.5;
  target.y = canvas.height * 0.5;
  target.vx = config[difficulty].speed * randomSign();
  target.vy = config[difficulty].speed * 0.72 * randomSign();
  target.squash = 0;
  target.blush = 0;
  particles.length = 0;
  texts.length = 0;
  splats.length = 0;
  updateHud();
  startOverlay.classList.toggle("is-visible", !running);
  statusText.textContent = running ? `${config[difficulty].name}模式` : "准备开始";
  if (running) {
    requestAnimationFrame(loop);
  } else {
    render(0);
  }
}

function loop(time) {
  if (!running) return;
  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;
  update(dt);
  render(dt);
  requestAnimationFrame(loop);
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endGame();
  }

  const cfg = config[difficulty];
  target.x += target.vx * dt;
  target.y += target.vy * dt;

  const pad = target.radius + 18;
  if (target.x < pad || target.x > canvas.width - pad) {
    target.x = clamp(target.x, pad, canvas.width - pad);
    target.vx *= -1;
  }
  if (target.y < pad + 18 || target.y > canvas.height - pad - 8) {
    target.y = clamp(target.y, pad + 18, canvas.height - pad - 8);
    target.vy *= -1;
  }

  const wobble = Math.sin(performance.now() / 340) * cfg.dodge;
  target.vx += wobble * 11;
  target.vy += Math.cos(performance.now() / 420) * cfg.dodge * 8;
  limitVelocity(target, cfg.speed * 1.42);

  target.squash = Math.max(0, target.squash - dt * 4.8);
  target.blush = Math.max(0, target.blush - dt * 2.1);
  shake = Math.max(0, shake - dt * 18);
  flash = Math.max(0, flash - dt * 2.4);
  targetMood += dt;

  updateList(particles, dt);
  updateList(texts, dt);
  updateList(splats, dt);
  updateHud();
}

function endGame() {
  running = false;
  if (score > best) {
    best = score;
    localStorage.setItem("pataTapBest", String(best));
  }
  bestValue.textContent = String(best);
  statusText.textContent = score >= best ? "新纪录" : "本局结束";
  startButton.textContent = "再来一局";
  startOverlay.classList.add("is-visible");
  render(0);
}

function updateList(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    item.life -= dt;
    item.x += (item.vx || 0) * dt;
    item.y += (item.vy || 0) * dt;
    if (item.life <= 0) list.splice(i, 1);
  }
}

function render() {
  ctx.save();
  const shakeX = shake ? (Math.random() - 0.5) * shake : 0;
  const shakeY = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawSplats();
  drawTargetShadow();
  drawTarget();
  drawParticles();
  drawFloatingTexts();
  if (flash > 0) drawFlash();
  ctx.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#b9e1dc");
  sky.addColorStop(0.62, "#f3dca7");
  sky.addColorStop(1, "#d9995c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.56)";
  drawCloud(120, 98, 1.1);
  drawCloud(880, 86, 0.92);
  drawCloud(730, 160, 0.62);

  ctx.fillStyle = "#6a9b42";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.78);
  ctx.bezierCurveTo(180, 478, 330, 542, 520, 497);
  ctx.bezierCurveTo(720, 448, 875, 520, 1100, 462);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 16; i += 1) {
    const x = i * 82 + 20;
    ctx.fillRect(x, canvas.height - 82 + Math.sin(i) * 7, 36, 7);
  }
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(-38, 10, 28, 0, Math.PI * 2);
  ctx.arc(-8, -6, 36, 0, Math.PI * 2);
  ctx.arc(36, 10, 28, 0, Math.PI * 2);
  ctx.rect(-58, 8, 116, 30);
  ctx.fill();
  ctx.restore();
}

function drawTargetShadow() {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#392a1f";
  ctx.beginPath();
  ctx.ellipse(target.x, target.y + target.radius * 0.93, target.radius * 0.96, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTarget() {
  const r = target.radius;
  const squashX = 1 + target.squash * 0.12;
  const squashY = 1 - target.squash * 0.1;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.scale(squashX, squashY);

  ctx.fillStyle = "#24211d";
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.64, r * 0.16, r * 0.23, -0.38, 0, Math.PI * 2);
  ctx.ellipse(r * 0.36, -r * 0.64, r * 0.16, r * 0.23, 0.38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffbc6f";
  ctx.strokeStyle = "#7b4a28";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.2, r * 0.78, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff7df";
  ctx.strokeStyle = "#7b4a28";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.82, r * 0.05);
  ctx.bezierCurveTo(-r * 0.98, r * 0.68, -r * 0.52, r * 0.96, 0, r * 0.7);
  ctx.bezierCurveTo(r * 0.52, r * 0.96, r * 0.98, r * 0.68, r * 0.82, r * 0.05);
  ctx.bezierCurveTo(r * 0.72, -r * 0.08, -r * 0.72, -r * 0.08, -r * 0.82, r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(123, 74, 40, 0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.02);
  ctx.quadraticCurveTo(-r * 0.04, r * 0.36, 0, r * 0.65);
  ctx.stroke();

  const eyeY = -r * 0.28;
  const blink = Math.sin(targetMood * 4) > 0.94 ? 0.15 : 1;
  drawEye(-r * 0.24, eyeY, r * 0.09, blink);
  drawEye(r * 0.24, eyeY, r * 0.09, blink);

  ctx.strokeStyle = "#68351f";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -r * 0.08, r * 0.16, 0.1, Math.PI - 0.1);
  ctx.stroke();

  if (target.blush > 0) {
    ctx.globalAlpha = Math.min(0.5, target.blush);
    ctx.fillStyle = "#df4a36";
    ctx.beginPath();
    ctx.ellipse(-r * 0.48, r * 0.22, r * 0.14, r * 0.08, -0.14, 0, Math.PI * 2);
    ctx.ellipse(r * 0.48, r * 0.22, r * 0.14, r * 0.08, 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEye(x, y, radius, blink) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, blink);
  ctx.fillStyle = "#241f1c";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffaf1";
  ctx.beginPath();
  ctx.arc(radius * 0.35, -radius * 0.35, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin * alpha);
    if (p.kind === "star") {
      drawStar(0, 0, p.size, p.size * 0.45, 5);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFloatingTexts() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of texts) {
    const alpha = clamp(t.life / t.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${t.size}px "Microsoft YaHei", sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(33,31,28,0.28)";
    ctx.fillStyle = t.color;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}

function drawSplats() {
  for (const s of splats) {
    const alpha = clamp(s.life / s.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 5 * alpha;
    ctx.translate(s.x, s.y);
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI * 2 * i) / 10 + s.rot;
      const inner = 8 + s.size * 0.15;
      const outer = s.size * (0.42 + alpha * 0.62);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawFlash() {
  ctx.save();
  ctx.globalAlpha = flash * 0.18;
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawStar(x, y, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (Math.PI * i) / points;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

function handlePointer(event) {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const distance = Math.hypot(x - target.x, y - target.y);

  if (distance <= target.radius * 0.95) {
    hitTarget(x, y);
  } else {
    combo = 0;
    addFloatingText("空", x, y, "#fffaf1", 24);
    statusText.textContent = "没打中";
    updateHud();
  }
}

function hitTarget(x, y) {
  combo += 1;
  const bonus = Math.min(8, Math.floor(combo / 3));
  const gained = 10 + bonus * 3;
  score += gained;
  shake = Math.min(18, 5 + combo * 0.5);
  flash = 1;
  target.squash = 1;
  target.blush = 1;

  addSplat(x, y);
  addParticles(x, y, combo);
  addFloatingText(`+${gained}`, x, y - 42, combo >= 8 ? "#df4a36" : "#fffaf1", combo >= 8 ? 34 : 28);
  playPop(190 + Math.min(combo, 12) * 24);

  const cfg = config[difficulty];
  const angle = Math.atan2(target.y - y, target.x - x) + (Math.random() - 0.5) * 1.2;
  const boost = cfg.speed * (1.04 + Math.min(combo, 14) * 0.025);
  target.vx = Math.cos(angle) * boost;
  target.vy = Math.sin(angle) * boost;
  statusText.textContent = combo >= 10 ? "连击爆表" : combo >= 5 ? "手感不错" : "命中";
  updateHud();
}

function addParticles(x, y, comboCount) {
  const colors = ["#df4a36", "#f7bd38", "#0f8c85", "#fffaf1"];
  const count = 12 + Math.min(comboCount, 12);
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 220;
    const life = 0.45 + Math.random() * 0.5;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: 4 + Math.random() * 8,
      color: colors[i % colors.length],
      kind: i % 3 === 0 ? "star" : "dot",
      spin: Math.random() * 8,
      life,
      maxLife: life,
    });
  }
}

function addFloatingText(text, x, y, color, size) {
  texts.push({
    text,
    x,
    y,
    vx: (Math.random() - 0.5) * 28,
    vy: -72,
    color,
    size,
    life: 0.72,
    maxLife: 0.72,
  });
}

function addSplat(x, y) {
  splats.push({
    x,
    y,
    size: 56 + Math.random() * 26,
    color: Math.random() > 0.45 ? "#df4a36" : "#f7bd38",
    rot: Math.random() * Math.PI,
    life: 0.36,
    maxLife: 0.36,
  });
}

function updateHud() {
  scoreValue.textContent = String(score);
  comboValue.textContent = String(combo);
  timeValue.textContent = String(Math.ceil(timeLeft));
}

function setDifficulty(next) {
  difficulty = next;
  difficultyButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === next);
  });
  resetGame(false);
  statusText.textContent = `${config[next].name}模式`;
}

function playPop(frequency) {
  if (muted || !AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + 0.08);
  osc.type = "triangle";
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function limitVelocity(body, max) {
  const current = Math.hypot(body.vx, body.vy);
  if (current > max) {
    body.vx = (body.vx / current) * max;
    body.vy = (body.vy / current) * max;
  }
}

function randomSign() {
  return Math.random() > 0.5 ? 1 : -1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

canvas.addEventListener("pointerdown", handlePointer);
startButton.addEventListener("click", () => resetGame(true));
resetButton.addEventListener("click", () => resetGame(true));
muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "×" : "♪";
  muteButton.setAttribute("aria-label", muted ? "静音" : "声音");
});

shareButton.addEventListener("click", async () => {
  const text = `啪嗒挑战：${shareUrl}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "啪嗒挑战", text: "来试试这个卡通点击反应小游戏", url: shareUrl });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      statusText.textContent = "试玩链接已复制";
    } else {
      copyWithFallback(shareUrl);
      statusText.textContent = "试玩链接已复制";
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      copyWithFallback(text);
      statusText.textContent = "分享文本已复制";
    }
  }
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
});

function copyWithFallback(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  document.body.removeChild(field);
}
