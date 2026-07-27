/* ═══════════════════════════════════════════
   메론킥 슛! — script.js
   PRD v1.0 (MVP) 기준 구현 · Firebase/서버 미사용
   ═══════════════════════════════════════════ */

"use strict";

/* ── 조정 가능한 상수 (난이도/등급 튜닝은 여기서) ── */
const CONFIG = {
  BALL_SPEED_RATIO: 1.2,      // 초당 이동 거리 = 트랙폭 × 이 값 (PRD 5.1)
  COUNTDOWN_FROM: 3,          // 카운트다운 시작 숫자
  INPUT_LOCK_MS: 1700,        // 탭 후 입력 잠금 시간 (PRD 4.2: 1.5~2초)
  RESULT_DELAY_MS: 950,       // 판정 플래시 후 결과 화면 전환까지 대기

  /* ── 슛 연출 (공이 골대로 날아가는 구간) ── */
  KICK_DURATION_MS: 620,      // 연출 길이 (0.5~0.7초 권장)
  KICK_ARC_HEIGHT: 130,       // 포물선 최고점 높이 (px)
  KICK_END_SCALE: 0.46,       // 도착 시점 공 크기 배율 (원근감)
  KICK_SPIN_TURNS: 1.6,       // 날아가는 동안 회전 바퀴 수
  KICK_GOOD_SPREAD: 0.28,     // 굿샷 착지 지점: 골대 너비 × 이 값만큼 좌/우로
  KICK_MISS_SPREAD: 0.85,     // 헛발질: 골대 너비 × 이 값만큼 밖으로
  KICK_MISS_RISE: 46,         // 헛발질: 골대 상단보다 이만큼 더 위로

  STORAGE_KEY: "roni_best_score", // PRD 5.4
  GRADES: [                   // PRD 5.3 등급 기준
    { min: 90, key: "perfect", label: "퍼펙트킥!", emote: "🎉", comment: "골대 정중앙 명중! 로니가 신나서 폴짝폴짝 뛰고 있어요." },
    { min: 60, key: "good",    label: "굿샷!",     emote: "😊", comment: "좋은 킥이에요! 조금만 더 중앙을 노려볼까요?" },
    { min: 0,  key: "miss",    label: "헛발질…",   emote: "💦", comment: "아쉬워요! 공이 중앙에 오는 순간을 노려보세요." },
  ],
};

/* ── DOM ─────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const screens = {
  landing: $("#screen-landing"),
  game: $("#screen-game"),
  result: $("#screen-result"),
};
const el = {
  bestLabel: $("#best-score-label"),
  bestValue: $("#best-score-value"),
  btnStart: $("#btn-start"),
  gameInner: $(".game-inner"),
  goal: $(".goal"),
  goalNet: $(".goal-net"),
  track: $("#track"),
  ball: $("#ball"),
  kickBall: null,          // 연출용 공 (최초 슛 때 생성)
  btnTap: $("#btn-tap"),
  gameRoni: $("#game-roni"),
  countdown: $("#countdown"),
  countdownNum: $("#countdown-num"),
  judgeFlash: $("#judge-flash"),
  newRecordBadge: $("#new-record-badge"),
  resultNumber: $("#result-number"),
  accuracyFill: $("#accuracy-fill"),
  resultGrade: $("#result-grade"),
  resultRoni: $("#result-roni"),
  resultEmote: $("#result-emote"),
  resultComment: $("#result-comment"),
  resultBestValue: $("#result-best-value"),
  btnRetry: $("#btn-retry"),
  confettiLayer: $("#confetti-layer"),
};

/* ── 상태 ────────────────────────────────── */
const state = {
  phase: "landing",        // landing | countdown | playing | judged | result
  ballX: 0,                // 공 중심의 현재 x (px, 트랙 내부 기준)
  direction: 1,            // 1: →, -1: ←
  rafId: null,
  lastTime: null,
  lastResult: null,        // { accuracy, grade, isNewRecord }
};

/* ── 최고기록 (localStorage) ─────────────── */
function loadBest() {
  const v = Number(localStorage.getItem(CONFIG.STORAGE_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}
function saveBest(score) {
  try { localStorage.setItem(CONFIG.STORAGE_KEY, String(score)); } catch (_) { /* 시크릿 모드 등 */ }
}

/* ── 화면 전환 ───────────────────────────── */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

/* ── 랜딩 ────────────────────────────────── */
function renderLanding() {
  const best = loadBest();
  if (best !== null) {
    el.bestValue.textContent = `${best}%`;
    el.bestLabel.classList.remove("hidden");
  } else {
    el.bestLabel.classList.add("hidden");
  }
  showScreen("landing");
  state.phase = "landing";
}

/* ── 게임 시작: 카운트다운 → 공 이동 ─────── */
function startGame() {
  stopBall();
  showScreen("game");
  state.phase = "countdown";
  el.btnTap.disabled = true;
  el.gameRoni.classList.remove("is-kicking");
  el.judgeFlash.classList.add("hidden");
  resetKickBall();

  // 공을 좌측 끝에서 대기
  state.ballX = 0;
  state.direction = 1;
  placeBall();

  let n = CONFIG.COUNTDOWN_FROM;
  el.countdown.classList.remove("hidden");

  const tick = () => {
    if (n > 0) {
      el.countdownNum.textContent = n;
      // 애니메이션 재시작
      el.countdownNum.style.animation = "none";
      void el.countdownNum.offsetWidth;
      el.countdownNum.style.animation = "";
      n -= 1;
      setTimeout(tick, 850);
    } else {
      el.countdown.classList.add("hidden");
      beginPlay();
    }
  };
  tick();
}

function beginPlay() {
  state.phase = "playing";
  el.btnTap.disabled = false;
  state.lastTime = null;
  state.rafId = requestAnimationFrame(moveBall);
}

/* ── 공 이동 (requestAnimationFrame, PRD 5.1) ── */
function trackMetrics() {
  const w = el.track.clientWidth;
  const ballW = el.ball.clientWidth || 44;
  const margin = ballW / 2 + 4; // 공이 트랙 밖으로 나가지 않도록
  return { w, min: margin, max: w - margin };
}

function moveBall(t) {
  if (state.phase !== "playing") return;
  if (state.lastTime === null) state.lastTime = t;
  const dt = Math.min((t - state.lastTime) / 1000, 0.05); // 프레임 드랍 보호
  state.lastTime = t;

  const { w, min, max } = trackMetrics();
  const speed = w * CONFIG.BALL_SPEED_RATIO; // px/초

  state.ballX += state.direction * speed * dt;
  if (state.ballX >= max) { state.ballX = max; state.direction = -1; }
  if (state.ballX <= min) { state.ballX = min; state.direction = 1; }

  placeBall();
  state.rafId = requestAnimationFrame(moveBall);
}

function placeBall() {
  el.ball.style.transform = `translate(${state.ballX}px, -50%) translateX(-50%)`;
}

function stopBall() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
}

/* ── 슛 연출: 트랙의 공 → 골대로 포물선 비행 ── */
function ensureKickBall() {
  if (el.kickBall) return el.kickBall;
  const img = document.createElement("img");
  img.src = "assets/images/ball.png";
  img.alt = "";
  img.draggable = false;
  img.className = "kick-ball hidden";
  el.gameInner.appendChild(img);
  el.kickBall = img;
  return img;
}

function resetKickBall() {
  if (el.kickBall) el.kickBall.classList.add("hidden");
  el.ball.style.visibility = "";
  el.goalNet.classList.remove("is-shaking");
}

/* 등급 + 탭한 방향으로 착지 지점 결정 (좌표는 .game-inner 기준) */
function kickTarget(grade, side, origin) {
  const g = el.goal.getBoundingClientRect();
  const cx = g.left + g.width / 2 - origin.left;
  const top = g.top - origin.top;

  if (grade.key === "perfect") {
    return { x: cx, y: top + g.height * 0.55, fade: false };
  }
  if (grade.key === "good") {
    return { x: cx + side * g.width * CONFIG.KICK_GOOD_SPREAD, y: top + g.height * 0.45, fade: false };
  }
  // 헛발질: 골대를 빗나가 밖으로
  return { x: cx + side * g.width * CONFIG.KICK_MISS_SPREAD, y: top - CONFIG.KICK_MISS_RISE, fade: true };
}

function flyBall(grade, side) {
  return new Promise((resolve) => {
    const ball = ensureKickBall();
    const origin = el.gameInner.getBoundingClientRect();
    const b = el.ball.getBoundingClientRect();
    const from = { x: b.left + b.width / 2 - origin.left, y: b.top + b.height / 2 - origin.top };
    const to = kickTarget(grade, side, origin);

    // 트랙의 공은 숨기고 같은 자리에서 연출용 공이 이어받음
    el.ball.style.visibility = "hidden";
    ball.classList.remove("hidden");

    const dur = CONFIG.KICK_DURATION_MS;
    const start = performance.now();

    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 2);            // 수평은 살짝 감속
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e - CONFIG.KICK_ARC_HEIGHT * Math.sin(Math.PI * e);
      const scale = 1 + (CONFIG.KICK_END_SCALE - 1) * e;
      const rot = CONFIG.KICK_SPIN_TURNS * 360 * p;

      ball.style.transform =
        `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;
      ball.style.opacity = to.fade ? String(Math.min(1, (1 - p) / 0.3)) : "1";

      if (p < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/* ── 판정 (PRD 5.2 공식) ─────────────────── */
function judge() {
  if (state.phase !== "playing") return;
  state.phase = "judged";                 // 연출 중 추가 탭 무시
  stopBall();
  el.btnTap.disabled = true;

  // 정확도는 반드시 "탭한 순간"의 공 위치로 계산 (연출과 무관)
  const trackWidth = el.track.clientWidth;
  const centerX = trackWidth / 2;
  const distance = Math.abs(state.ballX - centerX);
  const accuracy = Math.max(0, Math.round(100 - (distance / centerX) * 100));

  const grade = CONFIG.GRADES.find((g) => accuracy >= g.min);
  const prevBest = loadBest();
  const isNewRecord = prevBest === null || accuracy > prevBest;
  if (isNewRecord) saveBest(accuracy);

  state.lastResult = { accuracy, grade, isNewRecord };

  // 로니 킥 모션 + 공 비행을 같은 타이밍에 시작
  const side = state.ballX < centerX ? -1 : 1;
  el.gameRoni.classList.add("is-kicking");

  flyBall(grade, side).then(() => {
    if (grade.key === "perfect") el.goalNet.classList.add("is-shaking");

    el.judgeFlash.textContent = grade.label;
    el.judgeFlash.classList.remove("hidden");
    el.judgeFlash.style.animation = "none";
    void el.judgeFlash.offsetWidth;
    el.judgeFlash.style.animation = "";

    setTimeout(renderResult, CONFIG.RESULT_DELAY_MS);
  });
}

/* ── 결과 화면 ───────────────────────────── */
function renderResult() {
  const { accuracy, grade, isNewRecord } = state.lastResult;
  state.phase = "result";

  el.resultGrade.textContent = grade.label;
  el.resultGrade.className = `result-grade grade-${grade.key}`;
  el.resultRoni.className = `result-roni pose-${grade.key}`;
  el.resultEmote.textContent = grade.emote;
  el.resultComment.textContent = grade.comment;
  el.resultBestValue.textContent = `${loadBest() ?? accuracy}%`;
  el.newRecordBadge.classList.toggle("hidden", !isNewRecord);

  showScreen("result");

  // 숫자 카운트업
  el.accuracyFill.style.width = "0%";
  animateNumber(el.resultNumber, accuracy, 700);
  requestAnimationFrame(() => { el.accuracyFill.style.width = `${accuracy}%`; });

  if (grade.key === "perfect") spawnConfetti();

  // 입력 잠금 해제 (PRD 4.2)
  el.btnRetry.disabled = true;
  setTimeout(() => {
    el.btnRetry.disabled = false;
  }, Math.max(0, CONFIG.INPUT_LOCK_MS - CONFIG.RESULT_DELAY_MS));
}

function animateNumber(node, target, duration) {
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function spawnConfetti() {
  el.confettiLayer.innerHTML = "";
  const colors = ["#c8e86b", "#fff6d8", "#a8d95a", "#ff9a3c", "#ffffff", "#4e8f2f"];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement("span");
    c.className = "confetti";
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = `${2 + Math.random() * 1.8}s`;
    c.style.animationDelay = `${Math.random() * 0.6}s`;
    c.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
    el.confettiLayer.appendChild(c);
  }
}

/* ── 이벤트 바인딩 ───────────────────────── */
el.btnStart.addEventListener("click", startGame);
el.btnRetry.addEventListener("click", startGame);

// 탭 판정: 버튼 + 게임 화면 전체 (PRD 4.2 "화면 전체 또는 하단 큰 버튼")
el.btnTap.addEventListener("pointerdown", (e) => { e.preventDefault(); judge(); });
screens.game.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#btn-tap")) return; // 버튼은 위에서 처리
  judge();
});

// 화면 회전/리사이즈 시 공 위치 보정
window.addEventListener("resize", () => {
  if (state.phase === "playing") {
    const { min, max } = trackMetrics();
    state.ballX = Math.min(Math.max(state.ballX, min), max);
    placeBall();
  }
});

/* ── 초기화 ──────────────────────────────── */
renderLanding();

// 개발용 디버그 훅 (난이도·연출 값 조절 등)
window.__roniDebug = { CONFIG, state };
