const ROUND_SECONDS = 30;
const LEVEL_TARGET_SCORE = 20;
const SHOT_DURATION_MS = 640;
const MIN_DRAG_TO_SHOOT = 18;
const HOOP_FEEDBACK_MS = 520;
const LEVEL_INTRO_HOLD_MS = 820;
const LEVEL_INTRO_MOVE_MS = 430;
const SET_SHOT_DISTANCES = ["近距离", "中距离", "远距离"];
const LAYUP_MIN_X = -44;
const LAYUP_MAX_X = 250;
const LAYUP_STEP = 16;

const rules = window.shotRules;
let audioContext = null;
let currentMode = "menu";

const modeSelectEl = document.querySelector("#modeSelect");
const classicGameEl = document.querySelector("#classicGame");
const slingGameEl = document.querySelector("#slingGame");
const classicModeButton = document.querySelector("#classicModeButton");
const setShotModeButton = document.querySelector("#setShotModeButton");
const layupModeButton = document.querySelector("#layupModeButton");
const classicBackButton = document.querySelector("#classicBackButton");
const slingBackButton = document.querySelector("#slingBackButton");

const gameOverEl = document.querySelector("#gameOver");
const finalScoreEl = document.querySelector("#finalScore");
const finalStreakEl = document.querySelector("#finalStreak");
const resultLabelEl = document.querySelector("#resultLabel");
const restartButton = document.querySelector("#restartButton");

const classic = {
  state: createRoundState(),
  scoreEl: document.querySelector("#score"),
  timeLeftEl: document.querySelector("#timeLeft"),
  bestStreakEl: document.querySelector("#bestStreak"),
  chapterBadgeEl: document.querySelector("#classicChapterBadge"),
  shotFeedbackEl: document.querySelector("#shotFeedback"),
  shootButton: document.querySelector("#shootButton"),
  startButton: document.querySelector("#startButton"),
  courtEl: document.querySelector("#court"),
  hoopEl: document.querySelector("#hoop"),
  levelBadgeEl: document.querySelector("#classicLevelBadge"),
  levelIntroEl: document.querySelector("#classicLevelIntro"),
  introTimerId: null,
  aimArcEl: document.querySelector("#aimArc"),
  powerFillEl: document.querySelector("#powerFill"),
  powerCoachEl: document.querySelector("#powerCoach"),
  handsEl: document.querySelector("#classicHands"),
  modeLabel: "投球练习"
};

const sling = {
  state: createRoundState(),
  scoreEl: document.querySelector("#slingScore"),
  timeLeftEl: document.querySelector("#slingTimeLeft"),
  bestStreakEl: document.querySelector("#slingBestStreak"),
  chapterBadgeEl: document.querySelector("#slingChapterBadge"),
  feedbackEl: document.querySelector("#slingFeedback"),
  ballEl: document.querySelector("#slingBall"),
  playerEl: document.querySelector("#slingPlayer"),
  courtEl: document.querySelector("#slingCourt"),
  hoopEl: document.querySelector("#slingHoop"),
  levelBadgeEl: document.querySelector("#slingLevelBadge"),
  levelIntroEl: document.querySelector("#slingLevelIntro"),
  introTimerId: null,
  rimLineEl: document.querySelector("#slingRimLine"),
  netEl: document.querySelector(".sling-net"),
  arcEl: document.querySelector("#slingArc"),
  arcPathEl: document.querySelector("#slingArcPath"),
  powerEl: document.querySelector("#slingPower"),
  layupControlsEl: document.querySelector("#layupControls"),
  layupLeftButton: document.querySelector("#layupLeftButton"),
  layupRightButton: document.querySelector("#layupRightButton"),
  layupMoveTimerId: null,
  modeLabel: "定点投球"
};

function createRoundState() {
  return {
    score: 0,
    timeLeft: ROUND_SECONDS,
    currentStreak: 0,
    bestStreak: 0,
    isPlaying: false,
    isDragging: false,
    isShooting: false,
    timerId: null,
    distanceIndex: 1,
    layupX: 0,
    startX: 0,
    startY: 0,
    dragX: 0,
    dragY: 0
  };
}

function showMode(mode) {
  stopRound(classic);
  stopRound(sling);
  currentMode = mode;
  modeSelectEl.classList.toggle("hidden", mode !== "menu");
  classicGameEl.classList.toggle("hidden", mode !== "classic");
  slingGameEl.classList.toggle("hidden", mode !== "set-shot" && mode !== "layup");
  slingGameEl.dataset.mode = mode;
  gameOverEl.classList.add("hidden");

  if (mode === "classic") {
    resetIdleState(classic.state);
    resetClassicUi();
    classic.courtEl.classList.add("moving-hoop");
    classic.startButton.textContent = "开始游戏";
    setClassicFeedback("按住篮球");
    updateClassicScoreboard();
    playLevelIntro(classic, "第一章", "投球练习");
  }

  if (mode === "set-shot") {
    resetIdleState(sling.state);
    sling.state.distanceIndex = 1;
    sling.state.layupX = 0;
    sling.modeLabel = "定点投球";
    resetSlingUi();
    setSlingFeedback("中距离：拉住篮球");
    updateSlingScoreboard();
    playLevelIntro(sling, "第一章", "定点投球");
  }

  if (mode === "layup") {
    resetIdleState(sling.state);
    sling.state.distanceIndex = 1;
    sling.state.layupX = 0;
    sling.modeLabel = "移动上篮";
    resetSlingUi();
    setSlingFeedback("左右移动，随时投球");
    updateSlingScoreboard();
    playLevelIntro(sling, "第一章", "移动上篮");
  }
}

function stopRound(game) {
  resetLevelIntro(game);
  window.clearInterval(game.state.timerId);
  window.clearInterval(game.layupMoveTimerId);
  game.layupMoveTimerId = null;
  game.state.timerId = null;
  game.state.isPlaying = false;
  game.state.isDragging = false;
  game.state.isShooting = false;
}

function resetIdleState(state) {
  state.score = 0;
  state.timeLeft = ROUND_SECONDS;
  state.currentStreak = 0;
  state.bestStreak = 0;
  state.distanceIndex = 1;
  state.layupX = 0;
  state.startX = 0;
  state.startY = 0;
  state.dragX = 0;
  state.dragY = 0;
}

function resetLevelIntro(game) {
  window.clearTimeout(game.introTimerId);
  game.introTimerId = null;

  if (!game.levelIntroEl || !game.levelBadgeEl) {
    return;
  }

  game.levelIntroEl.dataset.state = "idle";
  game.levelIntroEl.style.removeProperty("--level-intro-x");
  game.levelIntroEl.style.removeProperty("--level-intro-y");
  game.levelIntroEl.style.removeProperty("--level-intro-scale");
  game.levelBadgeEl.classList.remove("level-badge-arrived");
}

function playLevelIntro(game, chapterLabel, levelLabel) {
  if (!game.levelIntroEl || !game.levelBadgeEl) {
    return;
  }

  resetLevelIntro(game);
  game.levelIntroEl.textContent = `${chapterLabel}\n${levelLabel}`;
  if (game.chapterBadgeEl) {
    game.chapterBadgeEl.textContent = chapterLabel;
  }
  game.levelBadgeEl.textContent = levelLabel;
  game.levelIntroEl.dataset.state = "showing";
  void game.levelIntroEl.offsetWidth;

  game.introTimerId = window.setTimeout(() => {
    const introRect = game.levelIntroEl.getBoundingClientRect();
    const badgeRect = game.levelBadgeEl.getBoundingClientRect();
    const introCenterX = introRect.left + introRect.width / 2;
    const introCenterY = introRect.top + introRect.height / 2;
    const badgeCenterX = badgeRect.left + badgeRect.width / 2;
    const badgeCenterY = badgeRect.top + badgeRect.height / 2;
    const scale = Math.min(
      badgeRect.width / introRect.width,
      badgeRect.height / introRect.height,
      0.58
    );
    const targetCenterX = badgeRect.left + (introRect.width * scale) / 2;
    const targetCenterY = badgeRect.top + (introRect.height * scale) / 2;

    game.levelIntroEl.style.setProperty("--level-intro-x", `${targetCenterX - introCenterX}px`);
    game.levelIntroEl.style.setProperty("--level-intro-y", `${targetCenterY - introCenterY}px`);
    game.levelIntroEl.style.setProperty("--level-intro-scale", String(scale));
    game.levelIntroEl.dataset.state = "settling";

    game.introTimerId = window.setTimeout(() => {
      game.levelIntroEl.dataset.state = "settled";
      game.levelBadgeEl.classList.add("level-badge-arrived");

      game.introTimerId = window.setTimeout(() => {
        game.levelBadgeEl.classList.remove("level-badge-arrived");
        game.introTimerId = null;
      }, 620);
    }, LEVEL_INTRO_MOVE_MS);
  }, LEVEL_INTRO_HOLD_MS);
}

function startClassicRound() {
  prepareAudio();
  resetState(classic.state);
  classic.state.timerId = window.setInterval(() => tickRound(classic, endClassicRound), 1000);
  resetClassicUi();
  classic.startButton.textContent = "游戏中";
  setClassicFeedback("按住篮球");
  updateClassicScoreboard();
}

function startSlingRound() {
  prepareAudio();
  resetState(sling.state);
  if (currentMode === "set-shot") {
    sling.state.distanceIndex = 1;
  }
  sling.state.timerId = window.setInterval(() => tickRound(sling, endSlingRound), 1000);
  resetSlingUi();
  setSlingFeedback(currentMode === "layup" ? "左右移动，随时投球" : "中距离：拉住篮球");
  updateSlingScoreboard();
}

function resetState(state) {
  window.clearInterval(state.timerId);
  state.score = 0;
  state.timeLeft = ROUND_SECONDS;
  state.currentStreak = 0;
  state.bestStreak = 0;
  state.isPlaying = true;
  state.isDragging = false;
  state.isShooting = false;
  state.startX = 0;
  state.startY = 0;
  state.dragX = 0;
  state.dragY = 0;
}

function tickRound(game, endRound) {
  game.state.timeLeft -= 1;

  if (game === classic) {
    updateClassicScoreboard();
  } else {
    updateSlingScoreboard();
  }

  if (game.state.timeLeft <= 0) {
    endRound();
  }
}

function endClassicRound() {
  stopRound(classic);
  classic.state.timeLeft = 0;
  resetClassicUi();
  classic.courtEl.classList.remove("shot-made", "shot-missed", "hot", "slowmo");
  setClassicFeedback("结束");
  updateClassicScoreboard();
  showGameOver(classic.state);
}

function endSlingRound() {
  stopRound(sling);
  sling.state.timeLeft = 0;
  resetSlingUi();
  sling.courtEl.classList.remove("shot-made", "shot-missed", "hot", "slowmo");
  setSlingFeedback("结束");
  updateSlingScoreboard();
  showGameOver(sling.state);
}

function showGameOver(state) {
  const passed = state.score >= LEVEL_TARGET_SCORE;
  finalScoreEl.textContent = String(state.score);
  finalStreakEl.textContent = String(state.bestStreak);
  resultLabelEl.textContent = passed ? "过关！" : "再挑战";
  resultLabelEl.classList.toggle("pass", passed);
  resultLabelEl.classList.toggle("retry", !passed);
  gameOverEl.classList.remove("hidden");
}

function updateClassicScoreboard() {
  classic.scoreEl.textContent = String(classic.state.score);
  classic.timeLeftEl.textContent = String(classic.state.timeLeft);
  classic.bestStreakEl.textContent = String(classic.state.bestStreak);
}

function updateSlingScoreboard() {
  sling.scoreEl.textContent = String(sling.state.score);
  sling.timeLeftEl.textContent = String(sling.state.timeLeft);
  sling.bestStreakEl.textContent = String(sling.state.bestStreak);
}

function setClassicFeedback(text) {
  classic.shotFeedbackEl.textContent = text;
}

function setSlingFeedback(text) {
  sling.feedbackEl.textContent = text;
}

function setClassicBallTransform(x, y, scale = 1) {
  classic.shootButton.style.transform = `translateX(-50%) translate(${x}px, ${y}px) scale(${scale})`;
  classic.handsEl.style.transform = `translateX(-50%) translate(${x * 0.72}px, ${y * 0.62}px)`;
}

function setSlingBallTransform(x, y, scale = 1) {
  const layupX = currentMode === "layup" ? sling.state.layupX : 0;
  sling.ballEl.style.transform = `translate(${layupX + x}px, ${y}px) scale(${scale})`;
  sling.playerEl.style.transform = `translate(${layupX + x * 0.42}px, ${y * 0.32}px)`;
}

function resetClassicUi() {
  classic.courtEl.classList.remove("is-dragging");
  classic.shootButton.style.transition = "transform 220ms ease, opacity 180ms ease";
  setClassicBallTransform(0, 0, 1);
  classic.powerFillEl.style.height = "0%";
  classic.aimArcEl.style.transform = "translateX(-50%)";
  classic.aimArcEl.style.removeProperty("--arc-lean");
  setPowerCoach(classic.powerCoachEl, "按住后向下拉", "");
}

function resetSlingUi() {
  sling.courtEl.classList.remove(
    "is-dragging",
    "moving-hoop",
    "layup-mode",
    "distance-near",
    "distance-mid",
    "distance-far"
  );
  sling.ballEl.style.transition = "transform 220ms ease, opacity 180ms ease";
  setSlingBallTransform(0, 0, 1);
  sling.arcEl.style.removeProperty("--arc-lift");
  sling.arcEl.style.transform = "none";
  sling.arcPathEl.setAttribute("d", "");
  applySlingModeLayout();
  setPowerCoach(sling.powerEl, currentMode === "layup" ? "左右移动后拉球" : `${getSetShotDistanceLabel()}：向左后方拉`, "");
}

function getSetShotDistanceLabel() {
  return SET_SHOT_DISTANCES[sling.state.distanceIndex] || "中距离";
}

function applySlingModeLayout() {
  slingGameEl.dataset.mode = currentMode;
  sling.levelBadgeEl.textContent = currentMode === "layup" ? "移动上篮" : "定点投球";
  sling.courtEl.dataset.distance = currentMode === "set-shot" ? getSetShotDistanceLabel() : "";
  sling.layupControlsEl.classList.toggle("visible", currentMode === "layup");

  if (currentMode === "set-shot") {
    const className = ["distance-near", "distance-mid", "distance-far"][sling.state.distanceIndex] || "distance-mid";
    sling.courtEl.classList.add(className);
    return;
  }

  if (currentMode === "layup") {
    sling.courtEl.classList.add("layup-mode");
  }
}

function moveLayupPlayer(direction) {
  if (currentMode !== "layup" || sling.state.isShooting) {
    return;
  }

  if (!sling.state.isPlaying) {
    startSlingRound();
  }

  sling.state.layupX = clamp(sling.state.layupX + direction * LAYUP_STEP, LAYUP_MIN_X, LAYUP_MAX_X);
  sling.courtEl.classList.toggle("dribbling", direction !== 0);
  setSlingBallTransform(sling.state.dragX, sling.state.dragY, sling.state.isDragging ? 1.08 : 1);
}

function startLayupMove(direction) {
  moveLayupPlayer(direction);
  window.clearInterval(sling.layupMoveTimerId);
  sling.layupMoveTimerId = window.setInterval(() => moveLayupPlayer(direction), 80);
}

function stopLayupMove() {
  window.clearInterval(sling.layupMoveTimerId);
  sling.layupMoveTimerId = null;
  sling.courtEl.classList.remove("dribbling");
}

function handleClassicPointerDown(event) {
  prepareAudio();

  if (classic.state.isShooting || classic.state.timeLeft <= 0 || currentMode !== "classic") {
    return;
  }

  if (!classic.state.isPlaying) {
    startClassicRound();
  }

  classic.state.isDragging = true;
  classic.state.startX = event.clientX;
  classic.state.startY = event.clientY;
  classic.state.dragX = 0;
  classic.state.dragY = 0;
  classic.shootButton.setPointerCapture(event.pointerId);
  classic.shootButton.style.transition = "none";
  classic.courtEl.classList.add("is-dragging");
  setClassicFeedback("蓄力 0%");
  classic.powerFillEl.style.height = "0%";
  setPowerCoach(classic.powerCoachEl, "继续向下拉", "");
}

function handleClassicPointerMove(event) {
  if (!classic.state.isDragging || classic.state.isShooting) {
    return;
  }

  classic.state.dragX = clamp(event.clientX - classic.state.startX, -rules.MAX_DRAG_X, rules.MAX_DRAG_X);
  classic.state.dragY = clamp(event.clientY - classic.state.startY, 0, rules.MAX_DRAG_Y);
  updateClassicAimingUi();
}

function handleClassicPointerRelease(event) {
  if (!classic.state.isDragging) {
    return;
  }

  classic.state.isDragging = false;
  classic.shootButton.releasePointerCapture(event.pointerId);

  if (classic.state.dragY < MIN_DRAG_TO_SHOOT) {
    resetClassicUi();
    setClassicFeedback("再拉远点");
    return;
  }

  shootClassicBall();
}

function updateClassicAimingUi() {
  const normalized = rules.normalizeDrag({ dragX: classic.state.dragX, dragY: classic.state.dragY });
  const powerPercent = Math.round(normalized.power * 100);
  const arcAngle = clamp(-normalized.direction * 0.25, -22, 22);
  const arcLean = clamp(-normalized.direction * 0.65, -62, 62);
  const arcScale = 0.72 + normalized.power * 0.42;

  classic.courtEl.classList.add("is-dragging");
  setClassicBallTransform(classic.state.dragX, classic.state.dragY, 1.08);
  classic.aimArcEl.style.transform = `translateX(-50%) rotate(${arcAngle}deg) scaleY(${arcScale})`;
  classic.aimArcEl.style.setProperty("--arc-lean", `${arcLean}px`);
  classic.powerFillEl.style.height = `${powerPercent}%`;
  setClassicFeedback(`蓄力 ${powerPercent}%`);
  updateClassicPowerCoach(normalized.power);
}

function shootClassicBall() {
  classic.state.isShooting = true;
  classic.courtEl.classList.remove("shot-made", "shot-missed", "slowmo");
  const result = rules.judgeShot({ dragX: classic.state.dragX, dragY: classic.state.dragY });
  const flightX = result.made ? -result.direction * 0.18 : -result.direction * 0.95;
  const flightY = result.made ? -292 : result.reason === "short" ? -190 : -250;

  classic.courtEl.classList.remove("is-dragging");
  classic.shootButton.style.transition = "transform 620ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease";
  classic.powerFillEl.style.height = "0%";
  setClassicBallTransform(flightX, flightY, result.made ? 0.4 : 0.58);

  window.setTimeout(() => resolveShot(classic, result, resetClassicUi, setClassicFeedback, updateClassicScoreboard), SHOT_DURATION_MS);
}

function handleSlingPointerDown(event) {
  prepareAudio();

  if (sling.state.isShooting || sling.state.timeLeft <= 0 || (currentMode !== "set-shot" && currentMode !== "layup")) {
    return;
  }

  if (!sling.state.isPlaying) {
    startSlingRound();
  }

  sling.state.isDragging = true;
  sling.state.startX = event.clientX;
  sling.state.startY = event.clientY;
  sling.state.dragX = 0;
  sling.state.dragY = 0;
  sling.ballEl.setPointerCapture(event.pointerId);
  sling.ballEl.style.transition = "none";
  sling.courtEl.classList.add("is-dragging");
  setSlingFeedback("蓄力 0%");
  setPowerCoach(sling.powerEl, "继续往左拉", "");
}

function handleSlingPointerMove(event) {
  if (!sling.state.isDragging || sling.state.isShooting) {
    return;
  }

  sling.state.dragX = clamp(event.clientX - sling.state.startX, -rules.MAX_SLING_PULL, 40);
  sling.state.dragY = clamp(event.clientY - sling.state.startY, -rules.MAX_SLING_ARC, rules.MAX_SLING_ARC);
  updateSlingAimingUi();
}

function handleSlingPointerRelease(event) {
  if (!sling.state.isDragging) {
    return;
  }

  sling.state.isDragging = false;
  sling.ballEl.releasePointerCapture(event.pointerId);

  if (-sling.state.dragX < 42) {
    resetSlingUi();
    setSlingFeedback("再往左拉远点");
    return;
  }

  shootSlingBall();
}

function updateSlingAimingUi() {
  const normalized = rules.normalizeSlingDrag({ dragX: sling.state.dragX, dragY: sling.state.dragY });
  const powerPercent = Math.round(normalized.pull * 100);
  const geometry = getSlingGeometry();
  const dots = Array.from(sling.arcEl.querySelectorAll("span"));
  const pathPoints = [];

  sling.courtEl.classList.add("is-dragging");
  setSlingBallTransform(sling.state.dragX, sling.state.dragY, 1.08);
  sling.arcEl.style.transform = "none";
  sling.arcEl.style.removeProperty("--arc-lift");

  for (let i = 0; i <= 18; i += 1) {
    const point = rules.calculateSlingPoint(
      { dragX: sling.state.dragX, dragY: sling.state.dragY },
      geometry,
      i / 18
    );
    pathPoints.push(`${i === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }

  sling.arcPathEl.setAttribute("d", pathPoints.join(" "));

  dots.forEach((dot, index) => {
    const t = (index + 1) / (dots.length + 1);
    const point = rules.calculateSlingPoint({ dragX: sling.state.dragX, dragY: sling.state.dragY }, geometry, t);
    const scale = 1.18 - index * 0.07;
    const alpha = 0.95 - index * 0.07;
    dot.style.transform = `translate(${point.x}px, ${point.y}px) scale(${scale})`;
    dot.style.opacity = String(alpha);
  });
  setSlingFeedback(`蓄力 ${powerPercent}%`);
  updateSlingPowerCoach(normalized);
}

function shootSlingBall() {
  sling.state.isShooting = true;
  sling.courtEl.classList.remove("shot-made", "shot-missed", "slowmo");
  const input = { dragX: sling.state.dragX, dragY: sling.state.dragY };
  const geometry = getSlingGeometry();
  const result = rules.judgeSlingTrajectory(input, geometry);
  sling.courtEl.classList.remove("is-dragging");
  sling.ballEl.style.transition = "none";
  animateSlingTrajectory(input, geometry, result);
}

function animateSlingTrajectory(input, geometry, result) {
  const startTime = performance.now();
  const duration = result.made ? 1080 : result.reason === "rim" ? 980 : 880;
  const impactT = result.impactPoint?.t ?? 0.9;

  function frame(now) {
    const progress = clamp((now - startTime) / duration, 0, 1);
    let point;

    if (result.made && progress > impactT) {
      const phase = (progress - impactT) / Math.max(1 - impactT, 0.01);
      const impact = result.impactPoint;
      point = {
        x: impact.x + Math.sin(phase * Math.PI) * 10,
        y: impact.y + phase * 88
      };
    } else if (result.reason === "rim" && progress > impactT) {
      const phase = (progress - impactT) / Math.max(1 - impactT, 0.01);
      const impact = result.impactPoint;
      point = {
        x: impact.x + phase * 150,
        y: impact.y - Math.sin(phase * Math.PI) * 62 + phase * 92
      };
    } else {
      point = rules.calculateSlingPoint(input, geometry, progress);
    }

    setSlingBallTransform(point.x, point.y, result.made ? 0.72 : 0.78);

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }

    resolveShot(sling, result, resetSlingUi, setSlingFeedback, updateSlingScoreboard);
  }

  requestAnimationFrame(frame);
}

function resolveShot(game, result, resetUi, setFeedback, updateScoreboard) {
  if (!game.state.isPlaying) {
    game.state.isShooting = false;
    resetUi();
    return;
  }

  if (result.made) {
    game.state.score += 2;
    game.state.currentStreak += 1;
    game.state.bestStreak = Math.max(game.state.bestStreak, game.state.currentStreak);
    const hot = game.state.currentStreak >= 3;
    game.courtEl.classList.toggle("hot", hot);
    setFeedback(hot ? `HOT ${game.state.currentStreak} 连中` : "+2 命中");
    startSlowMotion(game);
    triggerHoopFeedback(game, true);
    playMadeSound(hot);
    vibrate(30);
    updateScoreboard();

    window.setTimeout(() => {
      game.state.isShooting = false;
      advanceTrainingState(game);
      resetUi();
    }, 420);
  } else {
    game.state.currentStreak = 0;
    game.courtEl.classList.remove("hot");
    setFeedback(getMissText(result.reason));
    triggerHoopFeedback(game, false);
    game.state.isShooting = false;
    advanceTrainingState(game);
    resetUi();
    updateScoreboard();
  }
}

function advanceTrainingState(game) {
  if (game !== sling || currentMode !== "set-shot") {
    return;
  }

  sling.state.distanceIndex = (sling.state.distanceIndex + 1) % SET_SHOT_DISTANCES.length;
}

function triggerHoopFeedback(game, made) {
  game.courtEl.classList.remove("shot-made", "shot-missed");
  void game.hoopEl.offsetWidth;
  game.courtEl.classList.add(made ? "shot-made" : "shot-missed");

  window.setTimeout(() => {
    game.courtEl.classList.remove("shot-made", "shot-missed");
  }, HOOP_FEEDBACK_MS);
}

function startSlowMotion(game) {
  game.courtEl.classList.add("slowmo");

  window.setTimeout(() => {
    game.courtEl.classList.remove("slowmo");
  }, 260);
}

function updateClassicPowerCoach(power) {
  if (power < 0.48) {
    setPowerCoach(classic.powerCoachEl, "力度偏小", "warn");
    return;
  }

  if (power > 0.9) {
    setPowerCoach(classic.powerCoachEl, "力度太大", "warn");
    return;
  }

  setPowerCoach(classic.powerCoachEl, "力度刚好", "good");
}

function updateSlingPowerCoach(normalized) {
  if (normalized.pull < 0.46) {
    setPowerCoach(sling.powerEl, "力度偏小", "warn");
    return;
  }

  if (normalized.pull > 0.88) {
    setPowerCoach(sling.powerEl, "力度太大", "warn");
    return;
  }

  if (normalized.arc < -0.5) {
    setPowerCoach(sling.powerEl, "弧线太高", "warn");
    return;
  }

  if (normalized.arc > 0.5) {
    setPowerCoach(sling.powerEl, "弧线太低", "warn");
    return;
  }

  setPowerCoach(sling.powerEl, "角度刚好", "good");
}

function getSlingGeometry() {
  const ballRect = sling.ballEl.getBoundingClientRect();
  const rimRect = sling.rimLineEl.getBoundingClientRect();
  const netRect = sling.netEl.getBoundingClientRect();
  const baseCenterX = ballRect.left + ballRect.width / 2 - sling.state.dragX;
  const baseCenterY = ballRect.top + ballRect.height / 2 - sling.state.dragY;

  return {
    rimX: rimRect.left + rimRect.width / 2 - baseCenterX,
    rimY: rimRect.top + rimRect.height / 2 - baseCenterY,
    rimWidth: rimRect.width,
    netLeft: netRect.left - baseCenterX,
    netRight: netRect.right - baseCenterX,
    netTop: netRect.top - baseCenterY,
    netBottom: netRect.bottom - baseCenterY
  };
}

function setPowerCoach(element, text, tone) {
  element.textContent = text;
  element.classList.toggle("good", tone === "good");
  element.classList.toggle("warn", tone === "warn");
}

function prepareAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playMadeSound(hot) {
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const master = audioContext.createGain();
  const base = hot ? 760 : 660;
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(hot ? 0.22 : 0.18, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  master.connect(audioContext.destination);

  playTone(base, now, 0.14, master);
  playTone(base + 220, now + 0.08, 0.16, master);

  if (hot) {
    playTone(base + 440, now + 0.15, 0.13, master);
  }
}

function playTone(frequency, startTime, duration, destination) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.9, startTime + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function getMissText(reason) {
  if (reason === "short") return "短了，拉远一点";
  if (reason === "strong") return "太大力，少拉一点";
  if (reason === "left") return "偏左了";
  if (reason === "right") return "偏右了";
  if (reason === "high") return "弧线太高";
  if (reason === "low") return "弧线太低";
  if (reason === "rim") return "砸框弹出";
  return "偏了";
}

function vibrate(duration) {
  if ("vibrate" in navigator) {
    navigator.vibrate(duration);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

classicModeButton.addEventListener("click", () => showMode("classic"));
setShotModeButton.addEventListener("click", () => showMode("set-shot"));
layupModeButton.addEventListener("click", () => showMode("layup"));
classicBackButton.addEventListener("click", () => showMode("menu"));
slingBackButton.addEventListener("click", () => showMode("menu"));

classic.shootButton.addEventListener("pointerdown", handleClassicPointerDown);
classic.shootButton.addEventListener("pointermove", handleClassicPointerMove);
classic.shootButton.addEventListener("pointerup", handleClassicPointerRelease);
classic.shootButton.addEventListener("pointercancel", handleClassicPointerRelease);
classic.startButton.addEventListener("click", startClassicRound);

sling.ballEl.addEventListener("pointerdown", handleSlingPointerDown);
sling.ballEl.addEventListener("pointermove", handleSlingPointerMove);
sling.ballEl.addEventListener("pointerup", handleSlingPointerRelease);
sling.ballEl.addEventListener("pointercancel", handleSlingPointerRelease);

sling.layupLeftButton.addEventListener("pointerdown", () => startLayupMove(-1));
sling.layupLeftButton.addEventListener("pointerup", stopLayupMove);
sling.layupLeftButton.addEventListener("pointercancel", stopLayupMove);
sling.layupLeftButton.addEventListener("pointerleave", stopLayupMove);
sling.layupRightButton.addEventListener("pointerdown", () => startLayupMove(1));
sling.layupRightButton.addEventListener("pointerup", stopLayupMove);
sling.layupRightButton.addEventListener("pointercancel", stopLayupMove);
sling.layupRightButton.addEventListener("pointerleave", stopLayupMove);

restartButton.addEventListener("click", () => {
  gameOverEl.classList.add("hidden");

  if (currentMode === "set-shot" || currentMode === "layup") {
    startSlingRound();
  } else {
    startClassicRound();
  }
});

updateClassicScoreboard();
updateSlingScoreboard();
