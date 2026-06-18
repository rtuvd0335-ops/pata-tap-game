const images = [
  "图片/shell诗莉/00001.jpg",
  "图片/shell诗莉/00002.jpg",
  "图片/shell诗莉/00003.jpg",
  "图片/shell诗莉/00004.jpg",
  "图片/shell诗莉/0005.jpg",
  "图片/shell诗莉/0006.jpg",
  "图片/shell诗莉/0007.jpg",
  "图片/shell诗莉/0008.jpg",
  "图片/shell诗莉/0009.jpg",
  "图片/shell诗莉/00010.jpg",
  "图片/shell诗莉/00011.jpg",
  "图片/shell诗莉/00012.jpg",
  "图片/shell诗莉/00013.jpg",
  "图片/shell诗莉/00014.jpg",
  "图片/shell诗莉/00015.jpg",
  "图片/shell诗莉/00016.jpg",
  "图片/shell诗莉/00017.jpg",
  "图片/shell诗莉/00018.jpg",
  "图片/shell诗莉/00019.jpg",
];

const imageEl = document.querySelector("#sequenceImage");
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const stageArea = document.querySelector("#stageArea");
const startOverlay = document.querySelector("#startOverlay");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const prevButton = document.querySelector("#prevButton");
const shareButton = document.querySelector("#shareButton");
const soundButton = document.querySelector("#soundButton");
const progressFill = document.querySelector("#progressFill");
const imageName = document.querySelector("#imageName");
const tapHint = document.querySelector("#tapHint");
const statusText = document.querySelector("#statusText");
const stageValue = document.querySelector("#stageValue");
const comboValue = document.querySelector("#comboValue");
const progressValue = document.querySelector("#progressValue");
const tapValue = document.querySelector("#tapValue");
const doneValue = document.querySelector("#doneValue");

const shareUrl = "https://rtuvd0335-ops.github.io/pata-tap-game/";
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const melody = [246.94, 293.66, 329.63, 392.0, 329.63, 293.66, 261.63, 329.63];
const canvasSize = { width: 1, height: 1, dpr: 1 };
const target = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  radius: 36,
  heat: 0,
  squish: 0,
  spin: 0,
};
const particles = [];
const floaters = [];

let currentIndex = 0;
let progress = 0;
let taps = 0;
let combo = 0;
let completed = 0;
let running = false;
let muted = false;
let transitioning = false;
let lastTapTime = 0;
let lastFrameTime = 0;
let loopActive = false;
let shake = 0;
let audioContext = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;

preloadImages();
loadImage(0);
resizeCanvas();
updateHud();
renderCanvas(performance.now());

function hitGain(distance = target.radius) {
  const base = Math.max(7.2, 18.4 - currentIndex * 0.38);
  const accuracy = 1 - clamp(distance / Math.max(1, target.radius), 0, 1);
  const comboBoost = Math.min(5.2, Math.floor(combo / 5) * 0.75);
  return base + accuracy * 4.6 + comboBoost;
}

function missPenalty() {
  return 3.3 + currentIndex * 0.24 + progress * 0.032;
}

function decayPerSecond() {
  const stagePressure = 4.2 + currentIndex * 0.46;
  const progressPressure = 0.75 + Math.pow(progress / 100, 1.78) * 3.3;
  return stagePressure * progressPressure;
}

function targetRadius() {
  const scale = clamp(Math.min(canvasSize.width, canvasSize.height) / 520, 0.72, 1.1);
  const size = 50 - currentIndex * 0.82 - progress * 0.04;
  return clamp(size * scale, 24 * scale, 52 * scale);
}

function targetSpeed() {
  const scale = clamp(Math.min(canvasSize.width, canvasSize.height) / 520, 0.82, 1.15);
  return (132 + currentIndex * 19 + progress * 0.95) * scale;
}

function loadImage(index) {
  transitioning = false;
  currentIndex = clamp(index, 0, images.length - 1);
  progress = 0;
  combo = 0;
  lastTapTime = 0;
  imageEl.classList.remove("is-loaded", "is-pulse");
  imageEl.onload = () => {
    imageEl.classList.add("is-loaded");
    resizeCanvas();
    resetTarget(true);
    renderCanvas(performance.now());
  };
  imageEl.src = encodeURI(images[currentIndex]);
  imageName.textContent = images[currentIndex].split("/").pop();
  prevButton.disabled = currentIndex === 0;
  updateHud();
}

function startGame() {
  if (currentIndex === images.length - 1 && progress >= 100) {
    resetGame();
    return;
  }
  running = true;
  startOverlay.classList.add("is-hidden");
  resetTarget(true);
  startMusic();
  startLoop();
  statusText.textContent = "追准移动目标，打空会倒扣";
  updateHud();
}

function resetGame() {
  currentIndex = 0;
  progress = 0;
  taps = 0;
  combo = 0;
  completed = 0;
  running = true;
  transitioning = false;
  lastTapTime = 0;
  lastFrameTime = 0;
  startOverlay.classList.add("is-hidden");
  startButton.textContent = "开始";
  loadImage(0);
  resetTarget(true);
  startMusic();
  startLoop();
  statusText.textContent = "重新开始，先打中目标";
  updateHud();
}

function handleCanvasPointer(event) {
  event.preventDefault();
  if (transitioning) return;
  if (!running) {
    startGame();
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const distance = Math.hypot(x - target.x, y - target.y);

  if (distance <= target.radius) {
    hitTarget(x, y, distance);
  } else {
    missTarget(x, y);
  }
}

function hitTarget(x, y, distance) {
  const now = performance.now();
  combo = now - lastTapTime < 900 ? combo + 1 : 1;
  lastTapTime = now;
  taps += 1;

  const gain = hitGain(distance);
  progress = Math.min(100, progress + gain);
  target.heat = 1;
  target.squish = 1;
  shake = Math.min(9, 3 + combo * 0.18);
  addBurst(x, y, "#f7bd38", 12);
  addFloater(target.x, target.y - target.radius, `+${gain.toFixed(1)}%`, "#fff7df");
  pulseImage(combo > 4);
  playTap(380 + Math.min(combo, 14) * 28);
  kickTarget();

  if (progress >= 100) {
    completeCurrentImage();
  } else {
    statusText.textContent =
      combo >= 10 ? "连击够快，继续压住" : progress >= 78 ? "快满了，下跌也更凶" : "命中，继续追";
  }
  updateHud();
}

function missTarget(x, y) {
  combo = 0;
  lastTapTime = 0;
  taps += 1;
  const loss = missPenalty();
  progress = Math.max(0, progress - loss);
  shake = 5;
  addBurst(x, y, "rgba(255,255,255,0.75)", 6);
  addFloater(x, y, `-${loss.toFixed(1)}%`, "#f06b57");
  playTap(155);
  statusText.textContent = "打空了，进度被扣";
  updateHud();
}

function completeCurrentImage() {
  transitioning = true;
  completed = Math.max(completed, currentIndex + 1);
  progress = 100;
  updateHud();
  playTap(760);

  if (currentIndex >= images.length - 1) {
    running = false;
    transitioning = false;
    statusText.textContent = "全部解锁完成";
    tapHint.textContent = "已经看到最后一张";
    startOverlay.classList.remove("is-hidden");
    startButton.textContent = "再来一轮";
    return;
  }

  statusText.textContent = `解锁第 ${currentIndex + 2} 张`;
  window.setTimeout(() => {
    loadImage(currentIndex + 1);
  }, 330);
}

function goPrevious() {
  if (currentIndex === 0) return;
  combo = 0;
  transitioning = false;
  lastTapTime = 0;
  loadImage(currentIndex - 1);
  statusText.textContent = "回看上一张";
}

function resetTarget(center = false) {
  const bounds = getPlayableBounds();
  const radius = targetRadius();
  target.radius = radius;
  target.x = center ? bounds.x + bounds.width * 0.5 : random(bounds.x + radius, bounds.x + bounds.width - radius);
  target.y = center ? bounds.y + bounds.height * 0.52 : random(bounds.y + radius, bounds.y + bounds.height - radius);
  setTargetVelocity();
  keepTargetInside();
}

function setTargetVelocity(angle = Math.random() * Math.PI * 2) {
  const speed = targetSpeed();
  target.vx = Math.cos(angle) * speed;
  target.vy = Math.sin(angle) * speed;
  target.spin = Math.random() * Math.PI * 2;
}

function kickTarget() {
  const away = Math.atan2(target.y - canvasSize.height * 0.5, target.x - canvasSize.width * 0.5);
  const randomTurn = (Math.random() - 0.5) * Math.PI * 1.25;
  setTargetVelocity(away + Math.PI * 0.65 + randomTurn);
  target.x += target.vx * 0.035;
  target.y += target.vy * 0.035;
  keepTargetInside();
}

function updateTarget(dt, time) {
  target.radius = targetRadius();
  const bounds = getPlayableBounds();
  const wiggle = 42 + currentIndex * 3;
  target.vx += Math.sin(time * 0.004 + target.spin) * wiggle * dt;
  target.vy += Math.cos(time * 0.003 + target.spin * 1.7) * wiggle * dt;
  limitTargetSpeed();

  target.x += target.vx * dt;
  target.y += target.vy * dt;

  if (target.x < bounds.x + target.radius) {
    target.x = bounds.x + target.radius;
    target.vx = Math.abs(target.vx) * random(0.92, 1.08);
  } else if (target.x > bounds.x + bounds.width - target.radius) {
    target.x = bounds.x + bounds.width - target.radius;
    target.vx = -Math.abs(target.vx) * random(0.92, 1.08);
  }

  if (target.y < bounds.y + target.radius) {
    target.y = bounds.y + target.radius;
    target.vy = Math.abs(target.vy) * random(0.92, 1.08);
  } else if (target.y > bounds.y + bounds.height - target.radius) {
    target.y = bounds.y + bounds.height - target.radius;
    target.vy = -Math.abs(target.vy) * random(0.92, 1.08);
  }

  if (Math.random() < dt * (0.32 + currentIndex * 0.018)) {
    const angle = Math.atan2(target.vy, target.vx) + random(-0.75, 0.75);
    setTargetVelocity(angle);
  }

  target.heat = Math.max(0, target.heat - dt * 3.8);
  target.squish = Math.max(0, target.squish - dt * 5.2);
}

function limitTargetSpeed() {
  const maxSpeed = targetSpeed();
  const current = Math.hypot(target.vx, target.vy) || 1;
  const ratio = maxSpeed / current;
  target.vx *= ratio;
  target.vy *= ratio;
}

function keepTargetInside() {
  const bounds = getPlayableBounds();
  target.x = clamp(target.x, bounds.x + target.radius, bounds.x + bounds.width - target.radius);
  target.y = clamp(target.y, bounds.y + target.radius, bounds.y + bounds.height - target.radius);
}

function getPlayableBounds() {
  const pad = 8;
  const frame = {
    x: pad,
    y: pad,
    width: Math.max(1, canvasSize.width - pad * 2),
    height: Math.max(1, canvasSize.height - pad * 2),
  };

  if (!imageEl.naturalWidth || !imageEl.naturalHeight) {
    return frame;
  }

  const scale = Math.min(canvasSize.width / imageEl.naturalWidth, canvasSize.height / imageEl.naturalHeight);
  const width = imageEl.naturalWidth * scale;
  const height = imageEl.naturalHeight * scale;
  return {
    x: (canvasSize.width - width) / 2 + pad,
    y: (canvasSize.height - height) / 2 + pad,
    width: Math.max(1, width - pad * 2),
    height: Math.max(1, height - pad * 2),
  };
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 120 * dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }

  for (let i = floaters.length - 1; i >= 0; i -= 1) {
    const floater = floaters[i];
    floater.life -= dt;
    floater.y -= 42 * dt;
    if (floater.life <= 0) {
      floaters.splice(i, 1);
    }
  }
}

function addBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + random(-0.32, 0.32);
    const speed = random(85, 210);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: random(2.5, 5.5),
      color,
      life: random(0.25, 0.56),
      maxLife: 0.56,
    });
  }
}

function addFloater(x, y, text, color) {
  floaters.push({ x, y, text, color, life: 0.72, maxLife: 0.72 });
}

function renderCanvas(time) {
  ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

  if (shake > 0) {
    shake = Math.max(0, shake - 0.55);
  }

  drawTarget(time);
  drawParticles();
  drawFloaters();
}

function drawTarget(time) {
  const r = target.radius;
  const pulse = 1 + Math.sin(time * 0.012) * 0.04 + target.squish * 0.12;
  const outer = r * pulse;
  const hot = target.heat;
  const x = target.x + (shake ? random(-shake, shake) * 0.25 : 0);
  const y = target.y + (shake ? random(-shake, shake) * 0.25 : 0);
  const hue = 7 + Math.min(36, currentIndex * 2);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 0.002 + target.spin) * 0.14);
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${hue}, 82%, ${52 + hot * 8}%, 0.94)`;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(4, r * 0.12);
  ctx.strokeStyle = "rgba(255, 250, 241, 0.92)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 250, 241, 0.9)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(15, 140, 133, ${0.78 + hot * 0.18})`;
  ctx.fill();

  ctx.fillStyle = "#fffaf1";
  ctx.font = `900 ${Math.max(18, r * 0.78)}px "Microsoft YaHei", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("啪", 0, 1);

  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 18px "Microsoft YaHei", system-ui, sans-serif';
  for (const floater of floaters) {
    const alpha = clamp(floater.life / floater.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(33, 31, 28, 0.46)";
    ctx.strokeText(floater.text, floater.x, floater.y);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function pulseImage(strong) {
  imageEl.classList.remove("is-pulse");
  void imageEl.offsetWidth;
  imageEl.classList.add("is-pulse");
  stageArea.animate(
    [
      { transform: "translateY(0)" },
      { transform: strong ? "translateY(-2px)" : "translateY(-1px)" },
      { transform: "translateY(0)" },
    ],
    { duration: strong ? 170 : 120, easing: "ease-out" },
  );
  window.setTimeout(() => imageEl.classList.remove("is-pulse"), strong ? 180 : 120);
}

function updateHud() {
  const pct = Math.round(progress);
  const decay = decayPerSecond();
  const gain = hitGain(0);
  stageValue.textContent = `${currentIndex + 1}/${images.length}`;
  comboValue.textContent = String(combo);
  progressValue.textContent = `${pct}%`;
  tapValue.textContent = String(taps);
  doneValue.textContent = String(completed);
  progressFill.style.width = `${pct}%`;
  tapHint.textContent =
    currentIndex === images.length - 1 && pct === 100
      ? "已完成全部图片"
      : `命中 +${gain.toFixed(1)}% / 下跌 ${decay.toFixed(1)}%/秒`;
}

function startLoop() {
  if (loopActive) return;
  loopActive = true;
  lastFrameTime = performance.now();
  requestAnimationFrame(updateLoop);
}

function updateLoop(time) {
  const dt = Math.min((time - lastFrameTime) / 1000, 0.05);
  lastFrameTime = time;

  if (running && !transitioning) {
    updateTarget(dt, time);
    if (progress > 0) {
      const oldProgress = progress;
      progress = Math.max(0, progress - decayPerSecond() * dt);
      if (oldProgress >= 78 && progress < 78) {
        statusText.textContent = "进度掉下来了，继续追目标";
      }
      updateHud();
    }
  }

  updateParticles(dt);
  renderCanvas(time);

  if (running || particles.length || floaters.length) {
    requestAnimationFrame(updateLoop);
  } else {
    loopActive = false;
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasSize.width = Math.max(1, rect.width);
  canvasSize.height = Math.max(1, rect.height);
  canvasSize.dpr = dpr;
  canvas.width = Math.round(canvasSize.width * dpr);
  canvas.height = Math.round(canvasSize.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!target.x || !target.y) {
    resetTarget(true);
  } else {
    keepTargetInside();
  }
}

function preloadImages() {
  for (const path of images.slice(0, 5)) {
    const image = new Image();
    image.src = encodeURI(path);
  }
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
  const ctxAudio = ensureAudio();
  if (!ctxAudio || musicTimer) return;
  musicGain = ctxAudio.createGain();
  musicGain.gain.setValueAtTime(muted ? 0 : 0.038, ctxAudio.currentTime);
  musicGain.connect(ctxAudio.destination);
  const playBeat = () => {
    if (!musicGain) return;
    const now = ctxAudio.currentTime;
    const note = melody[musicStep % melody.length];
    playNote(note, now, 0.16, "sine", 0.32);
    if (musicStep % 2 === 0) {
      playNote(note * 0.5, now, 0.22, "triangle", 0.2);
    }
    musicStep += 1;
  };
  playBeat();
  musicTimer = window.setInterval(playBeat, 310);
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

function playTap(frequency) {
  if (muted) return;
  const ctxAudio = ensureAudio();
  if (!ctxAudio) return;
  const now = ctxAudio.currentTime;
  const osc = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();
  osc.type = frequency < 200 ? "sawtooth" : "triangle";
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * 0.62), now + 0.08);
  gain.gain.setValueAtTime(frequency < 200 ? 0.055 : 0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  gain.connect(ctxAudio.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function setMuted(next) {
  muted = next;
  soundButton.textContent = muted ? "×" : "♪";
  soundButton.setAttribute("aria-label", muted ? "静音" : "声音");
  if (musicGain && audioContext) {
    musicGain.gain.setTargetAtTime(muted ? 0 : 0.038, audioContext.currentTime, 0.05);
  }
}

async function shareGame() {
  const text = `啪嗒挑战：${shareUrl}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "啪嗒挑战", text: "来试试移动目标手速挑战", url: shareUrl });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      statusText.textContent = "试玩链接已复制";
    } else {
      copyWithFallback(text);
      statusText.textContent = "分享文本已复制";
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      copyWithFallback(text);
      statusText.textContent = "分享文本已复制";
    }
  }
}

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

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

canvas.addEventListener("pointerdown", handleCanvasPointer);
window.addEventListener("resize", () => {
  resizeCanvas();
  renderCanvas(performance.now());
});
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);
prevButton.addEventListener("click", goPrevious);
soundButton.addEventListener("click", () => setMuted(!muted));
shareButton.addEventListener("click", shareGame);
