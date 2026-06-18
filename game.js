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
const stageArea = document.querySelector("#stageArea");
const startOverlay = document.querySelector("#startOverlay");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const prevButton = document.querySelector("#prevButton");
const shareButton = document.querySelector("#shareButton");
const soundButton = document.querySelector("#soundButton");
const progressTrack = document.querySelector("#progressTrack");
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
let audioContext = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;

preloadImages();
loadImage(0);
updateHud();

function requiredTaps(index) {
  return Math.max(8, 22 - index * 0.55);
}

function decayPerSecond() {
  const stagePressure = 4.8 + currentIndex * 0.48;
  const progressPressure = 1 + Math.pow(progress / 100, 1.65) * 3.2;
  return stagePressure * progressPressure;
}

function loadImage(index) {
  transitioning = false;
  currentIndex = clamp(index, 0, images.length - 1);
  progress = 0;
  imageEl.classList.remove("is-loaded", "is-pulse");
  imageEl.onload = () => {
    imageEl.classList.add("is-loaded");
  };
  imageEl.src = encodeURI(images[currentIndex]);
  imageName.textContent = images[currentIndex].split("/").pop();
  prevButton.disabled = currentIndex === 0;
  updateHud();
}

function startGame() {
  running = true;
  startOverlay.classList.add("is-hidden");
  startMusic();
  startLoop();
  statusText.textContent = "快速点击，别让进度掉下去";
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
  loadImage(0);
  startMusic();
  startLoop();
  statusText.textContent = "重新开始";
  updateHud();
}

function advanceProgress() {
  if (transitioning) return;
  if (!running) {
    startGame();
  }

  const now = performance.now();
  combo = now - lastTapTime < 820 ? combo + 1 : 1;
  lastTapTime = now;
  taps += 1;

  const gain = requiredTaps(currentIndex);
  const comboBonus = combo > 0 && combo % 7 === 0 ? gain * 0.38 : 0;
  progress = Math.min(100, progress + gain + comboBonus);
  pulseImage(comboBonus > 0);
  playTap(comboBonus > 0 ? 520 : 360 + Math.min(combo, 10) * 18);

  if (progress >= 100) {
    completeCurrentImage();
  } else {
    statusText.textContent = comboBonus > 0 ? "连击猛推" : progress >= 78 ? "快满了，掉得更快" : "继续推进";
  }
  updateHud();
}

function completeCurrentImage() {
  transitioning = true;
  completed = Math.max(completed, currentIndex + 1);
  progress = 100;
  updateHud();
  playTap(720);

  if (currentIndex >= images.length - 1) {
    running = false;
    transitioning = false;
    statusText.textContent = "全部解锁完成";
    tapHint.textContent = "已完成全部图片";
    startOverlay.classList.remove("is-hidden");
    startButton.textContent = "再来一轮";
    return;
  }

  statusText.textContent = `解锁第 ${currentIndex + 2} 张`;
  window.setTimeout(() => {
    loadImage(currentIndex + 1);
  }, 260);
}

function goPrevious() {
  if (currentIndex === 0) return;
  combo = 0;
  transitioning = false;
  lastTapTime = 0;
  loadImage(currentIndex - 1);
  statusText.textContent = "回看上一张";
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
  stageValue.textContent = `${currentIndex + 1}/${images.length}`;
  comboValue.textContent = String(combo);
  progressValue.textContent = `${pct}%`;
  tapValue.textContent = String(taps);
  doneValue.textContent = String(completed);
  progressFill.style.width = `${pct}%`;
  tapHint.textContent = currentIndex === images.length - 1 && pct === 100 ? "已完成全部图片" : `下跌 ${decay.toFixed(1)}%/秒`;
}

function startLoop() {
  if (loopActive) return;
  loopActive = true;
  lastFrameTime = performance.now();
  requestAnimationFrame(updateLoop);
}

function updateLoop(time) {
  if (!running) {
    loopActive = false;
    return;
  }

  const dt = Math.min((time - lastFrameTime) / 1000, 0.05);
  lastFrameTime = time;

  if (!transitioning && progress > 0) {
    const oldProgress = progress;
    progress = Math.max(0, progress - decayPerSecond() * dt);
    if (oldProgress >= 78 && progress < 78) {
      statusText.textContent = "进度掉下来了";
    }
    updateHud();
  }

  requestAnimationFrame(updateLoop);
}

function preloadImages() {
  for (const path of images.slice(0, 4)) {
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
  const ctx = ensureAudio();
  if (!ctx || musicTimer) return;
  musicGain = ctx.createGain();
  musicGain.gain.setValueAtTime(muted ? 0 : 0.038, ctx.currentTime);
  musicGain.connect(ctx.destination);
  const playBeat = () => {
    if (!musicGain) return;
    const now = ctx.currentTime;
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
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.62, now + 0.08);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
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
      await navigator.share({ title: "啪嗒挑战", text: "按顺序解锁图片", url: shareUrl });
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

stageArea.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  advanceProgress();
});
progressTrack.addEventListener("click", advanceProgress);
startButton.addEventListener("click", () => {
  if (currentIndex === images.length - 1 && progress >= 100) {
    resetGame();
  } else {
    startGame();
  }
});
resetButton.addEventListener("click", resetGame);
prevButton.addEventListener("click", goPrevious);
soundButton.addEventListener("click", () => setMuted(!muted));
shareButton.addEventListener("click", shareGame);
