const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.querySelector("#scoreValue");
const comboValue = document.querySelector("#comboValue");
const feverValue = document.querySelector("#feverValue");
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
  easy: { speed: 235, radius: 64, round: 45, dodge: 0.55, itemEvery: 3.2, trapChance: 0.14, name: "轻松" },
  normal: { speed: 315, radius: 58, round: 45, dodge: 0.76, itemEvery: 2.8, trapChance: 0.22, name: "标准" },
  hard: { speed: 415, radius: 50, round: 40, dodge: 0.96, itemEvery: 2.35, trapChance: 0.32, name: "狂暴" },
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
let fever = 0;
let feverTime = 0;
let itemSpawnTimer = 1.2;
let dashTimer = 2.2;
let audioContext = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const feverDuration = 7;
const melody = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 392.0];

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
const items = [];

bestValue.textContent = String(best);
timeValue.textContent = String(timeLeft);
resizeCanvas();
if ("ResizeObserver" in window) {
  const canvasObserver = new ResizeObserver(resizeCanvas);
  canvasObserver.observe(canvas);
} else {
  window.addEventListener("resize", resizeCanvas);
}
window.addEventListener("orientationchange", () => {
  window.setTimeout(resizeCanvas, 220);
});
render(0);

function resetGame(startNow = true) {
  score = 0;
  combo = 0;
  fever = 0;
  feverTime = 0;
  timeLeft = config[difficulty].round;
  running = startNow;
  lastTime = performance.now();
  itemSpawnTimer = 1.1;
  dashTimer = 2 + Math.random() * 1.3;
  target.radius = getTargetRadius();
  target.x = canvas.width * 0.5;
  target.y = canvas.height * 0.5;
  target.vx = config[difficulty].speed * randomSign();
  target.vy = config[difficulty].speed * 0.72 * randomSign();
  target.squash = 0;
  target.blush = 0;
  particles.length = 0;
  texts.length = 0;
  splats.length = 0;
  items.length = 0;
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
  const pace = 1 + Math.min(score / 900, 0.45) + (feverTime > 0 ? 0.12 : 0);
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
  dashTimer -= dt;
  if (dashTimer <= 0) {
    dashTimer = 2.1 + Math.random() * 1.9;
    const angle = Math.random() * Math.PI * 2;
    target.vx += Math.cos(angle) * cfg.speed * 0.72;
    target.vy += Math.sin(angle) * cfg.speed * 0.72;
    addFloatingText("闪", target.x, target.y - target.radius - 18, "#fffaf1", 22);
  }
  limitVelocity(target, cfg.speed * 1.42 * pace);

  target.squash = Math.max(0, target.squash - dt * 4.8);
  target.blush = Math.max(0, target.blush - dt * 2.1);
  shake = Math.max(0, shake - dt * 18);
  flash = Math.max(0, flash - dt * 2.4);
  targetMood += dt;
  updateFever(dt);
  updateItems(dt);

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
  drawItems();
  drawTargetShadow();
  drawTarget();
  drawParticles();
  drawFloatingTexts();
  drawFeverMeter();
  if (flash > 0) drawFlash();
  ctx.restore();
}

function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;
  const sceneScale = clamp(w / 1100, 0.68, 1.12);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#b9e1dc");
  sky.addColorStop(0.62, "#f3dca7");
  sky.addColorStop(1, "#d9995c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.56)";
  drawCloud(w * 0.13, h * 0.15, sceneScale * 1.1);
  drawCloud(w * 0.8, h * 0.13, sceneScale * 0.92);
  drawCloud(w * 0.67, h * 0.24, sceneScale * 0.62);

  ctx.fillStyle = "#6a9b42";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.78);
  ctx.bezierCurveTo(w * 0.16, h * 0.73, w * 0.3, h * 0.83, w * 0.47, h * 0.76);
  ctx.bezierCurveTo(w * 0.65, h * 0.69, w * 0.8, h * 0.8, w, h * 0.71);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 16; i += 1) {
    const x = i * (w / 15) + w * 0.018;
    ctx.fillRect(x, h - 82 * sceneScale + Math.sin(i) * 7, 36 * sceneScale, 7 * sceneScale);
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
  const impact = clamp(target.blush, 0, 1);
  const heat = clamp(combo / 16 + fever / 160 + impact * 0.72, 0, 1);
  const bikiniHue = Math.round((184 + combo * 19 + fever * 1.8 + targetMood * 12) % 360);
  const bikiniColor = feverTime > 0 ? `hsl(${bikiniHue}, 92%, 58%)` : `hsl(${bikiniHue}, 78%, ${44 + heat * 10}%)`;
  const bikiniShade = `hsl(${bikiniHue}, 70%, ${30 + heat * 8}%)`;
  const skinColor = `hsl(${25 - heat * 7}, ${72 + heat * 10}%, ${72 - heat * 6}%)`;
  const skinShade = `hsl(${20 - heat * 5}, 58%, ${58 - heat * 6}%)`;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.scale(squashX, squashY);

  if (feverTime > 0) {
    const aura = 1 + Math.sin(targetMood * 11) * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#f7bd38";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.08, r * 1.05 * aura, r * 1.02 * aura, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#6d442b";
  ctx.lineWidth = Math.max(4, r * 0.075);

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(-r * 0.34, r * 0.13, r * 0.5, r * 0.72, -0.16, 0, Math.PI * 2);
  ctx.ellipse(r * 0.34, r * 0.13, r * 0.5, r * 0.72, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = skinShade;
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.ellipse(-r * 0.34, r * 0.35, r * 0.32, r * 0.24, -0.12, 0, Math.PI * 2);
  ctx.ellipse(r * 0.34, r * 0.35, r * 0.32, r * 0.24, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(109, 68, 43, 0.42)";
  ctx.lineWidth = Math.max(2.5, r * 0.045);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.26);
  ctx.quadraticCurveTo(-r * 0.08, r * 0.08, 0, r * 0.68);
  ctx.stroke();

  ctx.fillStyle = bikiniColor;
  ctx.strokeStyle = "#5d3721";
  ctx.lineWidth = Math.max(3.5, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, -r * 0.32);
  ctx.quadraticCurveTo(0, -r * 0.52, r * 0.72, -r * 0.32);
  ctx.lineTo(r * 0.47, r * 0.1);
  ctx.quadraticCurveTo(r * 0.18, r * 0.32, 0, r * 0.42);
  ctx.quadraticCurveTo(-r * 0.18, r * 0.32, -r * 0.47, r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = bikiniShade;
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.moveTo(-r * 0.56, -r * 0.27);
  ctx.quadraticCurveTo(0, -r * 0.39, r * 0.56, -r * 0.27);
  ctx.lineTo(r * 0.45, -r * 0.08);
  ctx.quadraticCurveTo(0, -r * 0.2, -r * 0.45, -r * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "#fffaf1";
  ctx.lineWidth = Math.max(2, r * 0.03);
  ctx.globalAlpha = 0.74;
  ctx.beginPath();
  ctx.moveTo(-r * 0.67, -r * 0.26);
  ctx.quadraticCurveTo(0, -r * 0.43, r * 0.67, -r * 0.26);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = bikiniShade;
  ctx.lineWidth = Math.max(4, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, -r * 0.31);
  ctx.lineTo(-r * 0.96, -r * 0.18);
  ctx.moveTo(r * 0.72, -r * 0.31);
  ctx.lineTo(r * 0.96, -r * 0.18);
  ctx.stroke();

  if (impact > 0) {
    ctx.globalAlpha = Math.min(0.56, impact * 0.58);
    ctx.fillStyle = "#df4a36";
    ctx.beginPath();
    ctx.ellipse(-r * 0.42, r * 0.16, r * 0.18, r * 0.1, -0.18, 0, Math.PI * 2);
    ctx.ellipse(r * 0.42, r * 0.16, r * 0.18, r * 0.1, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

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

function drawItems() {
  for (const item of items) {
    const alpha = clamp(item.life / item.maxLife, 0, 1);
    const bob = Math.sin(item.pulse * 5) * 4;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(item.x, item.y + bob);
    ctx.rotate(Math.sin(item.pulse * 2) * 0.12);
    ctx.fillStyle = item.type === "trap" ? "#df4a36" : item.type === "clock" ? "#0f8c85" : "#f7bd38";
    ctx.strokeStyle = "#fffaf1";
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (item.type === "star") {
      drawStar(0, 0, item.radius, item.radius * 0.48, 5);
      ctx.stroke();
    } else {
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#fffaf1";
    ctx.font = `900 ${item.radius * 0.9}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.type === "trap" ? "!" : item.type === "clock" ? "+3" : "热", 0, item.type === "star" ? 2 : 1);
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

function drawFeverMeter() {
  const w = Math.min(canvas.width - 28, 260);
  const h = 12;
  const x = 14;
  const y = 14;
  const pct = clamp(fever / 100, 0, 1);
  ctx.save();
  ctx.fillStyle = "rgba(33, 31, 28, 0.24)";
  roundRect(x, y, w, h, h / 2);
  ctx.fill();
  const fill = ctx.createLinearGradient(x, y, x + w, y);
  fill.addColorStop(0, "#0f8c85");
  fill.addColorStop(0.62, "#f7bd38");
  fill.addColorStop(1, "#df4a36");
  ctx.fillStyle = fill;
  roundRect(x, y, w * pct, h, h / 2);
  ctx.fill();
  if (feverTime > 0) {
    ctx.fillStyle = "#fffaf1";
    ctx.font = '900 14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("狂热 x2", x, y + h + 6);
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
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
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (Math.hypot(x - item.x, y - item.y) <= item.radius * 1.08) {
      applyItem(i, x, y);
      return;
    }
  }
  const distance = Math.hypot(x - target.x, y - target.y);

  if (distance <= target.radius * 0.95) {
    hitTarget(x, y, distance);
  } else {
    combo = 0;
    fever = Math.max(0, fever - 14);
    addFloatingText("空", x, y, "#fffaf1", 24);
    statusText.textContent = "没打中";
    updateHud();
  }
}

function hitTarget(x, y, distance) {
  combo += 1;
  const accuracy = clamp(1 - distance / (target.radius * 0.95), 0, 1);
  const bonus = Math.min(8, Math.floor(combo / 3));
  const centerBonus = accuracy > 0.62 ? Math.round(accuracy * 14) : 0;
  const multiplier = feverTime > 0 ? 2 : 1;
  const gained = (10 + bonus * 3 + centerBonus) * multiplier;
  score += gained;
  shake = Math.min(18, 5 + combo * 0.5);
  flash = 1;
  target.squash = 1;
  target.blush = 1;

  addSplat(x, y);
  addParticles(x, y, combo);
  addFloatingText(`${accuracy > 0.72 ? "正中 " : ""}+${gained}`, x, y - 42, feverTime > 0 ? "#f7bd38" : combo >= 8 ? "#df4a36" : "#fffaf1", combo >= 8 ? 34 : 28);
  addFever(accuracy > 0.72 ? 18 : 11);
  playPop(190 + Math.min(combo, 12) * 24 + centerBonus * 3);

  const cfg = config[difficulty];
  const angle = Math.atan2(target.y - y, target.x - x) + (Math.random() - 0.5) * 1.2;
  const boost = cfg.speed * (1.04 + Math.min(combo, 14) * 0.025);
  target.vx = Math.cos(angle) * boost;
  target.vy = Math.sin(angle) * boost;
  statusText.textContent = feverTime > 0 ? "狂热加分" : combo >= 10 ? "连击爆表" : combo >= 5 ? "手感不错" : "命中";
  updateHud();
}

function applyItem(index, x, y) {
  const item = items.splice(index, 1)[0];
  if (item.type === "clock") {
    timeLeft = Math.min(config[difficulty].round + 8, timeLeft + 3);
    score += feverTime > 0 ? 50 : 25;
    addFever(10);
    addFloatingText("+3秒", x, y - 28, "#0f8c85", 28);
    statusText.textContent = "加时";
    playPop(520);
  } else if (item.type === "star") {
    const gained = feverTime > 0 ? 140 : 70;
    score += gained;
    combo += 1;
    addFever(32);
    addFloatingText(`热度 +${gained}`, x, y - 28, "#f7bd38", 28);
    statusText.textContent = "热度上涨";
    playPop(660);
  } else {
    combo = 0;
    score = Math.max(0, score - 30);
    timeLeft = Math.max(0, timeLeft - 2);
    fever = Math.max(0, fever - 28);
    shake = 20;
    flash = 0.7;
    addFloatingText("-2秒", x, y - 28, "#df4a36", 30);
    statusText.textContent = "干扰炸弹";
    playPop(92);
  }
  addParticles(x, y, Math.max(combo, 4));
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
  feverValue.textContent = feverTime > 0 ? "MAX" : String(Math.floor(fever));
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
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + 0.08);
  osc.type = "triangle";
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function ensureAudio() {
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function startMusic() {
  const ctx = ensureAudio();
  if (!ctx || musicTimer) return;
  musicGain = ctx.createGain();
  musicGain.gain.setValueAtTime(muted ? 0 : 0.045, ctx.currentTime);
  musicGain.connect(ctx.destination);
  const playBeat = () => {
    if (!musicGain) return;
    const now = ctx.currentTime;
    const feverPitch = feverTime > 0 ? 1.5 : 1;
    playNote(melody[musicStep % melody.length] * feverPitch, now, 0.16, "sine", 0.32);
    if (musicStep % 2 === 0) {
      playNote(melody[(musicStep + 4) % melody.length] * 0.5, now, 0.22, "triangle", 0.18);
    }
    musicStep += 1;
  };
  playBeat();
  musicTimer = window.setInterval(playBeat, 265);
}

function playNote(frequency, when, duration, type, volume) {
  if (!audioContext || !musicGain) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(when);
  osc.stop(when + duration + 0.03);
}

function setMuted(next) {
  muted = next;
  muteButton.textContent = muted ? "×" : "♪";
  muteButton.setAttribute("aria-label", muted ? "静音" : "声音");
  if (musicGain && audioContext) {
    musicGain.gain.setTargetAtTime(muted ? 0 : 0.045, audioContext.currentTime, 0.05);
  }
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

function updateFever(dt) {
  if (feverTime > 0) {
    feverTime = Math.max(0, feverTime - dt);
    fever = (feverTime / feverDuration) * 100;
    if (feverTime <= 0) {
      fever = 0;
      statusText.textContent = `${config[difficulty].name}模式`;
    }
  } else {
    fever = Math.max(0, fever - dt * 1.2);
  }
}

function addFever(amount) {
  if (feverTime > 0) {
    fever = Math.min(100, fever + amount * 0.16);
    return;
  }
  fever = clamp(fever + amount, 0, 100);
  if (fever >= 100) {
    feverTime = feverDuration;
    fever = 100;
    flash = 1;
    shake = 16;
    addFloatingText("狂热 x2", target.x, target.y - target.radius - 34, "#f7bd38", 34);
    statusText.textContent = "狂热开始";
    playPop(760);
  }
}

function updateItems(dt) {
  itemSpawnTimer -= dt;
  if (itemSpawnTimer <= 0) {
    spawnItem();
    const cfg = config[difficulty];
    itemSpawnTimer = cfg.itemEvery * (0.68 + Math.random() * 0.68);
  }

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    item.life -= dt;
    item.pulse += dt;
    if (item.life <= 0) {
      items.splice(i, 1);
    }
  }
}

function spawnItem() {
  if (items.length >= 3 || canvas.width < 1 || canvas.height < 1) return;
  const cfg = config[difficulty];
  const roll = Math.random();
  const type = roll < cfg.trapChance ? "trap" : roll < cfg.trapChance + 0.34 ? "clock" : "star";
  const radius = Math.round(clamp(canvas.width / 16, 20, 30));
  const pad = radius + 18;
  let x = pad + Math.random() * Math.max(1, canvas.width - pad * 2);
  let y = pad + canvas.height * 0.12 + Math.random() * Math.max(1, canvas.height * 0.58);
  if (Math.hypot(x - target.x, y - target.y) < target.radius * 1.8) {
    x = canvas.width - x;
    y = clamp(y + target.radius * 1.7, pad, canvas.height - pad);
  }
  items.push({
    type,
    x,
    y,
    radius,
    pulse: Math.random() * Math.PI,
    life: type === "trap" ? 4.5 : 5.7,
    maxLife: type === "trap" ? 4.5 : 5.7,
  });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const nextWidth = Math.max(1, Math.round(rect.width));
  const nextHeight = Math.max(1, Math.round(rect.height));
  if (canvas.width === nextWidth && canvas.height === nextHeight) return;

  const oldWidth = canvas.width || nextWidth;
  const oldHeight = canvas.height || nextHeight;
  const scaleX = nextWidth / oldWidth;
  const scaleY = nextHeight / oldHeight;

  canvas.width = nextWidth;
  canvas.height = nextHeight;
  target.radius = getTargetRadius();
  target.x = clamp(target.x * scaleX, target.radius + 18, nextWidth - target.radius - 18);
  target.y = clamp(target.y * scaleY, target.radius + 18, nextHeight - target.radius - 18);
  scaleList(particles, scaleX, scaleY);
  scaleList(texts, scaleX, scaleY);
  scaleList(splats, scaleX, scaleY);
  scaleList(items, scaleX, scaleY);
  render(0);
}

function scaleList(list, scaleX, scaleY) {
  for (const item of list) {
    item.x *= scaleX;
    item.y *= scaleY;
  }
}

function getTargetRadius() {
  return Math.round(config[difficulty].radius * clamp(canvas.width / 760, 0.78, 1.05));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

canvas.addEventListener("pointerdown", handlePointer);
startButton.addEventListener("click", () => {
  startMusic();
  resetGame(true);
});
resetButton.addEventListener("click", () => {
  startMusic();
  resetGame(true);
});
muteButton.addEventListener("click", () => {
  setMuted(!muted);
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
