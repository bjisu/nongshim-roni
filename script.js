/* ═══════════════════════════════════════════
   슛돌이 로니! — script.js
   v2.0 방향+파워 슈팅 게임 · Firebase/서버 미사용
   조작: ① 탭 → 조준 화살표 고정  ② 탭 → 파워 고정 + 슈팅
   한 게임 3회 슈팅 · 명중당 100점 · 최대 300점
   ═══════════════════════════════════════════ */

"use strict";

/* ── 조정 가능한 상수 (난이도/연출 튜닝은 전부 여기서) ── */
const CONFIG = {
  /* ── 게임 구조 ── */
  SHOTS_PER_GAME: 3,          // 한 게임 슈팅 횟수
  SCORE_PER_HIT: 100,         // 명중당 점수
  COUNTDOWN_FROM: 3,          // 시작 카운트다운

  /* ── 슈팅 제한시간 ── */
  SHOT_TIME_LIMIT_MS: 10000,  // 슈팅 1회당 제한시간 (조준 가능 시점부터)
  TIMER_WARN_MS: 3000,        // 이하로 남으면 빨간 경고 + 펄스

  /* ── 배경 이미지 속 골대 위치 (bg.png 기준 비율) ──
     골대 논리 영역은 JS가 background-size: cover와 같은 수식으로
     매 리사이즈마다 계산한다 → 어떤 화면비에서도 그림의 골대와 정렬됨. */
  BG_IMAGE_W: 608,            // bg.png 원본 크기
  BG_IMAGE_H: 1088,
  BG_GOAL_RECT: { x1: 0.178, x2: 0.822, y1: 0.400, y2: 0.545 }, // 골대 안쪽 영역 (이미지 대비 비율)

  /* ── 타깃(메론킥 과자) ──
     골대 안 잔디 바닥(골라인 근처)에 서 있다. 조준·슈팅 중에는 고정.
     슛 1회가 끝날 때마다 바닥을 따라 새 랜덤 "가로" 위치로 스르륵 이동.
     첫 위치도 랜덤. 크기·거리 전부 골대 크기 대비 비율 → 화면 크기 무관 동일 난이도. */
  SNACK_SIZE_RATIO: 0.21,       // 과자 박스 = 골대 폭 × 이 값
  SNACK_AREA_INSET_X: 0.08,     // 바닥 이동 범위: 좌우 여백 (골대 폭 대비 비율)
  SNACK_GROUND_OFFSET_RATIO: 0.015, // 골대 하단에서 이만큼 위에 발 (골대 높이 대비)
  SNACK_MIN_JUMP_RATIO: 0.16,   // 새 위치는 직전과 최소 이만큼 (이동 범위 대비 비율)
  SNACK_MOVE_MS: 380,           // 새 위치까지 이동 시간 (ease-out · 짧고 담백하게)

  /* ── 1단계: 드래그 조준 ──
     공을 터치(클릭)하면 조준 시작, 손가락을 따라 화살표가 실시간 회전,
     떼면 그 방향으로 고정. */
  AIM_MAX_ANGLE: 38,          // 조준 각도 제한 (도 · 좌우 대칭 · 골대를 크게 벗어나지 않는 범위)
  AIM_SPREAD_RATIO: 1.15,     // 최대 각도일 때 수평 도달 거리 = 골대 폭 절반 × 이 값
  BALL_GRAB_RADIUS: 2.6,      // 공 반지름 × 이 값 안을 터치하면 조준 시작 (손가락 오차 허용)

  /* ── 2단계: 파워 게이지 ── */
  POWER_SWEEP_SPEED: 1.1,     // 게이지 왕복 속도 (1초당 편도 횟수)
  POWER_GOAL_MIN: 0.38,       // 이 미만이면 골대까지 못 감 (약함)
  POWER_GOAL_MAX: 0.82,       // 이 초과면 골대 위로 넘어감 (너무 강함)

  /* ── 슛 비행 연출 (거리 값은 화면 높이 대비 비율) ── */
  FLY_DURATION_MS: 700,       // 비행 시간
  FLY_ARC_RATIO: 0.145,       // 포물선 최고점 = 화면 높이 × 이 값
  FLY_END_SCALE: 0.38,        // 도착 시점 공 크기 배율 (원근감)
  FLY_SPIN_TURNS: 1.5,        // 회전 바퀴 수
  SHORT_LAND_MARGIN_RATIO: 0.032, // 파워 부족 시 골대 아래 착지 여유 (화면 높이 대비)
  OVER_RISE_RATIO: 0.105,     // 파워 초과 시 골대 상단 위로 솟는 높이 (화면 높이 대비)

  /* ── 판정 ── */
  HIT_RADIUS_RATIO: 0.85,     // 명중 반경 = 과자 크기 × 이 값 (과자가 골대에 비례하므로 화면 크기 무관 동일 난이도)

  /* ── 흐름 ── */
  NEXT_SHOT_DELAY_MS: 950,    // 판정 후 다음 슈팅 준비까지 대기
  RESULT_DELAY_MS: 1200,      // 마지막 슛 판정 후 결과 화면까지 대기

  STORAGE_KEY: "roni_best_score", // 최고기록 (총점 기준 · 기존 키 재활용)

  /* ── 결과 등급 (명중 횟수 기준) ── */
  GRADES: [
    { minHits: 3, key: "perfect", label: "퍼펙트!",  comment: "3발 전부 명중! 로니가 신나서 환호하고 있어요!" },
    { minHits: 1, key: "good",    label: "굿샷!",    comment: "좋아요! 과자의 움직임을 읽으면 전부 맞힐 수 있어요." },
    { minHits: 0, key: "miss",    label: "아쉬워요…", comment: "괜찮아요! 파워는 초록~노랑 구간을 노려보세요." },
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
  hudScore: $("#hud-score"),
  hudShots: $("#hud-shots"),
  hudTimerChip: $(".hud-timer"),
  hudTimer: $("#hud-timer"),
  timerRing: $("#timer-ring-fg"),
  goalArea: $("#goal-area"),
  goalNetFx: $("#goal-net-fx"),
  snack: $("#snack"),
  snackImg: $("#snack-img"),
  aimArrow: $("#aim-arrow"),
  shootBall: $("#shoot-ball"),
  flyBall: $("#fly-ball"),
  powerCursor: $("#power-cursor"),
  powerWrap: $(".power-wrap"),
  phaseHint: $("#phase-hint"),
  countdown: $("#countdown"),
  countdownNum: $("#countdown-num"),
  judgeFlash: $("#judge-flash"),
  newRecordBadge: $("#new-record-badge"),
  resultNumber: $("#result-number"),
  accuracyFill: $("#accuracy-fill"),
  resultHits: $("#result-hits"),
  resultGrade: $("#result-grade"),
  resultRoni: $("#result-roni"),
  resultComment: $("#result-comment"),
  resultBestValue: $("#result-best-value"),
  btnRetry: $("#btn-retry"),
  confettiLayer: $("#confetti-layer"),
};

/* ── 상태 ────────────────────────────────── */
const state = {
  phase: "landing",   // landing | countdown | aim | power | fly | wait | result
  score: 0,
  shotsLeft: CONFIG.SHOTS_PER_GAME,
  hits: 0,

  aimAngle: 0,        // 현재 화살표 각도 (도)
  aimPointerId: null, // 조준 중인 포인터 id
  aimPointer: null,   // 최신 포인터 좌표 {x, y} — pointermove는 저장만, 반영은 rAF에서
  shotDeadline: 0,    // 이번 슈팅 마감 시각 (performance.now 기준 · 시작 시각 기준 계산이라 오차 누적 없음)
  power: 0,           // 현재 게이지 값 (0~1)
  powerDir: 1,        // 게이지 진행 방향

  snackXR: 0.5,       // 과자 가로 위치 (이동 범위 내 0~1 비율 · 리사이즈에도 상대 위치 유지)
  snackSize: 66,      // 현재 과자 박스 px (layoutGame이 골대 크기로부터 계산)
  snackHop: null,     // 통통 이동 중 데이터 { fromXR, toXR, start }

  fly: null,          // 비행 중 데이터 { from, to, start, outcome, ... }
  rafId: null,
  lastTime: null,
  lastResult: null,   // { score, hits, grade, isNewRecord }
  recordFadeT: null,  // "최고기록 갱신!" 페이드아웃 타이머
};

/* ── 최고기록 (localStorage · 총점 기준) ─── */
function loadBest() {
  const v = Number(localStorage.getItem(CONFIG.STORAGE_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}
function saveBest(score) {
  try { localStorage.setItem(CONFIG.STORAGE_KEY, String(score)); } catch (_) { /* 시크릿 모드 등 */ }
}

/* 과자 이미지 없으면 CSS 임시 도형으로
   (스크립트 로드 전에 이미 로드 실패했을 수도 있어 complete 상태도 확인) */
el.snackImg.addEventListener("error", () => el.snack.classList.add("no-img"));
if (el.snackImg.complete && el.snackImg.naturalWidth === 0) el.snack.classList.add("no-img");

/* ── 화면 전환 ───────────────────────────── */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

/* ── 랜딩 ────────────────────────────────── */
function renderLanding() {
  const best = loadBest();
  if (best !== null) {
    el.bestValue.textContent = `${best}점`;
    el.bestLabel.classList.remove("hidden");
  } else {
    el.bestLabel.classList.add("hidden");
  }
  showScreen("landing");
  state.phase = "landing";
}

/* ── HUD ─────────────────────────────────── */
function renderHud() {
  el.hudScore.textContent = state.score;
  el.hudShots.textContent = `x${state.shotsLeft}`;
}

/* ── 슈팅 제한시간 타이머 ──────────────────
   조준 가능 시점(beginAim)부터 카운트. 슈팅(파워 확정) 순간 멈추고,
   다음 슈팅 준비 시 리셋. 결과 연출·과자 이동 중에는 돌지 않는다
   (메인 루프에서 aim/aiming/power 단계에만 갱신). */
const TIMER_RING_CIRC = 2 * Math.PI * 8; // SVG r=8 원주

function renderTimer(remainMs) {
  const frac = Math.max(0, remainMs / CONFIG.SHOT_TIME_LIMIT_MS);
  el.timerRing.style.strokeDashoffset = String(TIMER_RING_CIRC * (1 - frac));
  el.hudTimer.textContent = Math.max(0, Math.ceil(remainMs / 1000));
  el.hudTimerChip.classList.toggle("is-warn", remainMs <= CONFIG.TIMER_WARN_MS);
}

function updateShotTimer(now) {
  const remain = state.shotDeadline - now;
  if (remain <= 0) {
    renderTimer(0);
    timeUp();
    return;
  }
  renderTimer(remain);
}

/* 판정/타임아웃 플래시 문구 (동일 스타일·애니메이션) */
function showFlash(text) {
  el.judgeFlash.textContent = text;
  el.judgeFlash.classList.remove("hidden");
  el.judgeFlash.style.animation = "none";
  void el.judgeFlash.offsetWidth;
  el.judgeFlash.style.animation = "";
  setTimeout(() => el.judgeFlash.classList.add("hidden"), 900);
}

/* 시간 초과: 기회 1 차감 → 다음 슈팅 또는 결과 */
function timeUp() {
  state.phase = "wait";
  state.aimPointerId = null;
  state.aimPointer = null;
  el.aimArrow.classList.add("hidden");
  el.powerWrap.classList.remove("is-active");
  state.shotsLeft -= 1;
  renderHud();

  showFlash("시간 초과!");
  el.phaseHint.textContent = "";

  if (state.shotsLeft > 0) {
    setTimeout(hopSnack, 250);
    setTimeout(beginAim, CONFIG.NEXT_SHOT_DELAY_MS);
  } else {
    setTimeout(finishGame, CONFIG.RESULT_DELAY_MS);
  }
}

/* ── 골대/과자 레이아웃 (반응형 핵심) ───────
   background-size: cover와 동일한 수식으로 배경 그림 속 골대의
   화면 좌표를 계산해 골대 논리 영역과 과자 크기를 맞춘다.
   리사이즈/회전 시마다 다시 호출된다. */
function layoutGame() {
  const W = screens.game.clientWidth;
  const H = screens.game.clientHeight;
  if (!W || !H) return; // 화면이 숨겨져 있으면 스킵

  const scale = Math.max(W / CONFIG.BG_IMAGE_W, H / CONFIG.BG_IMAGE_H); // cover
  const iw = CONFIG.BG_IMAGE_W * scale;
  const ih = CONFIG.BG_IMAGE_H * scale;
  const ox = (W - iw) / 2; // 중앙 기준 크롭 오프셋
  const oy = (H - ih) / 2;

  const r = CONFIG.BG_GOAL_RECT;
  el.goalArea.style.left = `${ox + r.x1 * iw}px`;
  el.goalArea.style.top = `${oy + r.y1 * ih}px`;
  el.goalArea.style.width = `${(r.x2 - r.x1) * iw}px`;
  el.goalArea.style.height = `${(r.y2 - r.y1) * ih}px`;

  state.snackSize = (r.x2 - r.x1) * iw * CONFIG.SNACK_SIZE_RATIO;
  el.snack.style.width = `${state.snackSize}px`;
  el.snack.style.height = `${state.snackSize}px`;
}

/* ── 과자(타깃) 위치 ───────────────────────
   골대 안 잔디 바닥에 서 있고, 이동은 바닥을 따라 좌우로만.
   가로 위치는 0~1 비율(snackXR)로만 들고 px는 매번 현재 골대
   크기에서 계산 → 리사이즈에도 상대 위치가 유지된다.
   조준·슈팅 중에는 고정. 슛이 끝날 때마다 새 랜덤 가로 위치로
   통통 튀며 이동한다. 순간이동 없음. */
function snackBounds() {
  const w = el.goalArea.clientWidth;
  const h = el.goalArea.clientHeight;
  const half = state.snackSize / 2;
  const ix = w * CONFIG.SNACK_AREA_INSET_X + half;
  return {
    minX: ix,
    maxX: Math.max(ix, w - ix),
    groundY: h - half - h * CONFIG.SNACK_GROUND_OFFSET_RATIO, // 발이 골대 하단에 닿는 중심 y
  };
}

/* 과자 중심의 골대 영역 내 px 좌표 (항상 현재 크기 기준으로 계산) */
function snackPx() {
  const b = snackBounds();
  return { x: b.minX + state.snackXR * (b.maxX - b.minX), y: b.groundY };
}

function randomSnackXR() {
  let r = state.snackXR;
  for (let i = 0; i < 8; i++) {
    r = Math.random();
    if (Math.abs(r - state.snackXR) >= CONFIG.SNACK_MIN_JUMP_RATIO) break;
  }
  return r;
}

/* 게임 시작: 첫 위치도 랜덤 (등장은 즉시 배치) */
function resetSnack() {
  state.snackHop = null;
  state.snackXR = Math.random();
  placeSnack();
}

/* 새 랜덤 위치로 부드럽게 미끄러지듯 이동 시작 */
function hopSnack() {
  state.snackHop = {
    fromXR: state.snackXR,
    toXR: randomSnackXR(),
    start: performance.now(),
  };
}

function updateSnackHop(now) {
  const hop = state.snackHop;
  if (!hop) return;
  const p = Math.min((now - hop.start) / CONFIG.SNACK_MOVE_MS, 1);
  const e = 1 - Math.pow(1 - p, 3); // ease-out: 감속하며 스르륵 도착
  state.snackXR = hop.fromXR + (hop.toXR - hop.fromXR) * e;
  placeSnack();
  if (p >= 1) {
    state.snackHop = null;
    placeSnack();
  }
}

function placeSnack() {
  const p = snackPx();
  el.snack.style.transform =
    `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
}

/* ── 게임 시작 ───────────────────────────── */
function startGame() {
  stopLoop();
  showScreen("game");
  state.phase = "countdown";
  state.score = 0;
  state.hits = 0;
  state.shotsLeft = CONFIG.SHOTS_PER_GAME;
  state.fly = null;
  renderHud();
  el.judgeFlash.classList.add("hidden");
  el.flyBall.classList.add("hidden");
  el.shootBall.style.visibility = "";
  el.goalNetFx.classList.remove("is-shaking");
  layoutGame();  // 골대·과자 크기를 현재 화면에 맞춤
  resetSnack();  // 첫 위치 랜덤
  renderTimer(CONFIG.SHOT_TIME_LIMIT_MS); // 다시하기 포함 항상 풀 타이머로 초기화
  startLoop();

  let n = CONFIG.COUNTDOWN_FROM;
  el.countdown.classList.remove("hidden");
  const tick = () => {
    if (n > 0) {
      el.countdownNum.textContent = n;
      el.countdownNum.style.animation = "none";
      void el.countdownNum.offsetWidth;
      el.countdownNum.style.animation = "";
      n -= 1;
      setTimeout(tick, 850);
    } else {
      el.countdown.classList.add("hidden");
      beginAim();
    }
  };
  tick();
}

/* ── 1단계: 드래그 조준 ──────────────────── */
function beginAim(resetTimer = true) {
  state.phase = "aim";        // 공 터치 대기
  state.aimAngle = 0;
  state.aimPointerId = null;
  state.aimPointer = null;
  el.shootBall.style.visibility = "";
  el.flyBall.classList.add("hidden");
  el.aimArrow.classList.add("hidden");
  el.powerWrap.classList.remove("is-active");
  state.power = 0;
  state.powerDir = 1;
  placePowerCursor();
  el.phaseHint.textContent = "공을 잡고 조준하세요!";
  if (resetTimer) {
    state.shotDeadline = performance.now() + CONFIG.SHOT_TIME_LIMIT_MS;
    renderTimer(CONFIG.SHOT_TIME_LIMIT_MS);
  }
}

function ballCenter() {
  const b = el.shootBall.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 };
}

/* 최신 포인터 좌표를 향해 화살표 회전 · 각도는 좌우 제한.
   pointermove마다 직접 호출하지 않고 메인 rAF 루프에서 프레임당 1회만
   실행한다 (이벤트 폭주 시에도 부드럽게). 회전은 transform만 사용. */
function applyAim() {
  const p = state.aimPointer;
  if (!p) return;
  const c = ballCenter();
  const dx = p.x - c.x;
  const dy = c.y - p.y;                       // 위쪽이 +
  // 포인터가 공보다 아래면 dy를 최소 1로 눌러 각도 폭주 방지
  let deg = (Math.atan2(dx, Math.max(dy, 1)) * 180) / Math.PI;
  deg = Math.min(Math.max(deg, -CONFIG.AIM_MAX_ANGLE), CONFIG.AIM_MAX_ANGLE);
  state.aimAngle = deg;
  el.aimArrow.style.transform = `translateX(-50%) rotate(${deg}deg)`;
}

/* ── 2단계: 파워 ─────────────────────────── */
function beginPower() {
  state.phase = "power";
  state.power = 0;
  state.powerDir = 1;
  el.powerWrap.classList.add("is-active");
  el.phaseHint.textContent = "탭해서 파워를 정해요!";
}

function updatePower(dt) {
  state.power += state.powerDir * CONFIG.POWER_SWEEP_SPEED * dt;
  if (state.power >= 1) { state.power = 1; state.powerDir = -1; }
  if (state.power <= 0) { state.power = 0; state.powerDir = 1; }
  placePowerCursor();
}

function placePowerCursor() {
  el.powerCursor.style.left = `${state.power * 100}%`;
}

/* ── 슛: 방향+파워로 착지점 계산 ───────────
   좌표계는 .game-inner 기준 px.
   파워 구간: < GOAL_MIN 못 미침 / GOAL_MIN~GOAL_MAX 골대 도달 / > GOAL_MAX 넘어감 */
function computeShot(angleDeg, power) {
  const origin = el.gameInner.getBoundingClientRect();
  const g = el.goalArea.getBoundingClientRect();
  const b = el.shootBall.getBoundingClientRect();

  const from = { x: b.left + b.width / 2 - origin.left, y: b.top + b.height / 2 - origin.top };
  const goal = {
    left: g.left - origin.left,
    top: g.top - origin.top,
    width: g.width,
    height: g.height,
  };
  goal.bottom = goal.top + goal.height;

  const a = angleDeg / CONFIG.AIM_MAX_ANGLE;                     // -1 ~ 1
  const spread = (goal.width / 2) * CONFIG.AIM_SPREAD_RATIO;     // 최대각 수평 도달 거리
  const arcH = origin.height * CONFIG.FLY_ARC_RATIO;             // 연출 거리는 화면 높이 비례

  if (power < CONFIG.POWER_GOAL_MIN) {
    // 파워 부족: 골대 앞에 뚝 떨어짐
    const t = power / CONFIG.POWER_GOAL_MIN; // 0~1
    const shortMargin = origin.height * CONFIG.SHORT_LAND_MARGIN_RATIO;
    return {
      outcome: "short",
      from,
      to: {
        x: from.x + a * spread * (0.3 + 0.7 * t),
        y: from.y - (from.y - (goal.bottom + shortMargin)) * (0.35 + 0.65 * t),
      },
      endScale: 1 + (CONFIG.FLY_END_SCALE - 1) * (0.35 + 0.65 * t),
      arc: arcH * (0.35 + 0.45 * t),
      fade: false,
    };
  }

  if (power > CONFIG.POWER_GOAL_MAX) {
    // 파워 초과: 골대 위로 넘어감
    const o = (power - CONFIG.POWER_GOAL_MAX) / (1 - CONFIG.POWER_GOAL_MAX); // 0~1
    const rise = origin.height * CONFIG.OVER_RISE_RATIO;
    return {
      outcome: "over",
      from,
      to: { x: from.x + a * spread, y: goal.top - rise * (0.4 + 0.6 * o) },
      endScale: CONFIG.FLY_END_SCALE,
      arc: arcH * 1.15,
      fade: true,
    };
  }

  // 적정 파워: 골대 평면 도달. 파워가 셀수록 골대 안 높은 곳에 꽂힌다.
  const h = (power - CONFIG.POWER_GOAL_MIN) / (CONFIG.POWER_GOAL_MAX - CONFIG.POWER_GOAL_MIN); // 0~1
  return {
    outcome: "reach",
    from,
    to: {
      x: from.x + a * spread,
      y: goal.bottom - h * goal.height,
    },
    endScale: CONFIG.FLY_END_SCALE,
    arc: arcH,
    fade: false,
    goal,
  };
}

function shoot() {
  const shot = computeShot(state.aimAngle, state.power);
  state.phase = "fly";
  state.fly = { ...shot, start: performance.now() };
  el.aimArrow.classList.add("hidden");
  el.phaseHint.textContent = "";

  // 발사 위치에서 비행용 공으로 교체
  el.shootBall.style.visibility = "hidden";
  el.flyBall.classList.remove("hidden");
  el.flyBall.style.opacity = "1";
}

function updateFly(now) {
  const f = state.fly;
  const p = Math.min((now - f.start) / CONFIG.FLY_DURATION_MS, 1);
  const e = 1 - Math.pow(1 - p, 2); // 수평 감속
  const x = f.from.x + (f.to.x - f.from.x) * e;
  const y = f.from.y + (f.to.y - f.from.y) * e - f.arc * Math.sin(Math.PI * e);
  const scale = 1 + (f.endScale - 1) * e;
  const rot = CONFIG.FLY_SPIN_TURNS * 360 * p;

  el.flyBall.style.transform =
    `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;
  if (f.fade) el.flyBall.style.opacity = String(Math.max(0, 1 - Math.max(0, p - 0.7) / 0.3));

  if (p >= 1) resolveShot();
}

/* ── 판정: 도착 순간의 과자 위치와 비교 ──── */
function resolveShot() {
  const f = state.fly;
  state.fly = null;
  state.phase = "wait";
  state.shotsLeft -= 1;

  let hit = false;
  if (f.outcome === "reach") {
    // 과자 중심의 .game-inner 기준 좌표 (도착한 "그 순간" 위치)
    const sp = snackPx();
    const snackX = f.goal.left + sp.x;
    const snackY = f.goal.top + sp.y;
    const dist = Math.hypot(f.to.x - snackX, f.to.y - snackY);
    hit = dist <= state.snackSize * CONFIG.HIT_RADIUS_RATIO; // 과자 크기 비례 → 화면 무관 동일 난이도
  }

  if (hit) {
    state.hits += 1;
    state.score += CONFIG.SCORE_PER_HIT;
    el.flyBall.classList.add("hidden");
    // "퍼펙트!" 플래시 — "시간 초과!"와 동일 스타일/애니메이션
    showFlash("퍼펙트!");
    el.goalNetFx.classList.remove("is-shaking");
    void el.goalNetFx.offsetWidth;
    el.goalNetFx.classList.add("is-shaking");
  } else {
    if (f.outcome === "reach") {
      // 골대엔 들어갔지만 과자를 빗나감 → 골망만 출렁
      el.goalNetFx.classList.remove("is-shaking");
      void el.goalNetFx.offsetWidth;
      el.goalNetFx.classList.add("is-shaking");
    }
    if (f.outcome !== "over") {
      setTimeout(() => el.flyBall.classList.add("hidden"), 250);
    } else {
      el.flyBall.classList.add("hidden");
    }
  }
  renderHud();

  el.phaseHint.textContent = hit ? "" :
    f.outcome === "short" ? "파워가 부족했어요…" :
    f.outcome === "over" ? "너무 세게 찼어요!" : "과자를 빗나갔어요!";

  if (state.shotsLeft > 0) {
    // 판정 리액션이 살짝 보인 뒤, 과자가 새 랜덤 위치로 스르륵 이동
    setTimeout(hopSnack, hit ? 420 : 180);
    setTimeout(beginAim, CONFIG.NEXT_SHOT_DELAY_MS);
  } else {
    setTimeout(finishGame, CONFIG.RESULT_DELAY_MS);
  }
}

/* ── 게임 종료 → 결과 ────────────────────── */
function finishGame() {
  const grade = CONFIG.GRADES.find((g) => state.hits >= g.minHits);
  const prevBest = loadBest();
  const isNewRecord = prevBest === null || state.score > prevBest;
  if (isNewRecord) saveBest(state.score);
  state.lastResult = { score: state.score, hits: state.hits, grade, isNewRecord };
  renderResult();
}

function renderResult() {
  const { score, hits, grade, isNewRecord } = state.lastResult;
  stopLoop();
  state.phase = "result";

  el.resultHits.textContent = `명중 ${hits} / ${CONFIG.SHOTS_PER_GAME}`;
  el.resultGrade.textContent = grade.label;
  el.resultGrade.className = `result-grade grade-${grade.key}`;
  el.resultRoni.className = `result-roni pose-${grade.key}`;
  el.resultComment.textContent = grade.comment;
  el.resultBestValue.textContent = `${loadBest() ?? score}점`;

  // "최고기록 갱신!" — 표시 후 3초 뒤 부드럽게 페이드아웃 (재갱신 시 다시 표시)
  clearTimeout(state.recordFadeT);
  el.newRecordBadge.classList.remove("is-visible");
  if (isNewRecord) {
    void el.newRecordBadge.offsetWidth; // 애니메이션 재시작
    el.newRecordBadge.classList.add("is-visible");
    state.recordFadeT = setTimeout(() => el.newRecordBadge.classList.remove("is-visible"), 3000);
  }

  showScreen("result");

  const maxScore = CONFIG.SHOTS_PER_GAME * CONFIG.SCORE_PER_HIT;
  el.accuracyFill.style.width = "0%";
  animateNumber(el.resultNumber, score, 700);
  requestAnimationFrame(() => { el.accuracyFill.style.width = `${(score / maxScore) * 100}%`; });

  if (grade.key === "perfect") spawnConfetti();
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

/* ── 메인 루프 ───────────────────────────── */
function loop(now) {
  if (state.lastTime === null) state.lastTime = now;
  const dt = Math.min((now - state.lastTime) / 1000, 0.05); // 프레임 드랍 보호
  state.lastTime = now;

  updateSnackHop(now); // 슛 사이 이동 중일 때만 실제로 움직인다

  // 제한시간: 조준~파워 단계에서만 흐른다 (연출·이동·결과 중에는 정지)
  if (state.phase === "aim" || state.phase === "aiming" || state.phase === "power") {
    updateShotTimer(now);
  }

  if (state.phase === "aiming") applyAim(); // 프레임당 1회만 화살표 갱신
  else if (state.phase === "power") updatePower(dt);
  else if (state.phase === "fly") updateFly(now);

  state.rafId = requestAnimationFrame(loop);
}

function startLoop() {
  stopLoop();
  state.lastTime = null;
  state.rafId = requestAnimationFrame(loop);
}
function stopLoop() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
}

/* ── 입력 (pointer 이벤트 · 마우스/터치 공용) ──
   조준: 공을 잡고(pointerdown) 드래그(pointermove) → 떼면(pointerup) 방향 고정
   파워: 화면 아무 데나 탭하면 슈팅 */
function onPointerDown(e) {
  e.preventDefault();
  if (state.phase === "aim") {
    const c = ballCenter();
    if (Math.hypot(e.clientX - c.x, e.clientY - c.y) <= c.r * CONFIG.BALL_GRAB_RADIUS) {
      state.phase = "aiming";
      state.aimPointerId = e.pointerId;
      state.aimPointer = { x: e.clientX, y: e.clientY };
      el.aimArrow.classList.remove("hidden");
      applyAim(); // 첫 프레임은 즉시 반영
      el.phaseHint.textContent = "놓으면 방향이 고정돼요!";
      // 손가락이 공 밖으로 나가도 추적 유지
      try { screens.game.setPointerCapture(e.pointerId); } catch (_) { /* 합성 이벤트 등 */ }
    }
  } else if (state.phase === "power") {
    shoot();
  }
}

function onPointerMove(e) {
  if (state.phase !== "aiming" || e.pointerId !== state.aimPointerId) return;
  e.preventDefault();
  // 좌표만 저장 — 실제 회전은 rAF 루프(applyAim)에서 프레임당 1회
  state.aimPointer = { x: e.clientX, y: e.clientY };
}

function onPointerUp(e) {
  if (state.phase !== "aiming" || e.pointerId !== state.aimPointerId) return;
  e.preventDefault();
  state.aimPointerId = null;
  beginPower(); // 화살표는 고정된 방향 그대로 보여준다
}

function onPointerCancel(e) {
  if (state.phase !== "aiming" || e.pointerId !== state.aimPointerId) return;
  beginAim(false); // 조준 취소 → 다시 공 터치 대기 (타이머는 그대로 진행)
}

// passive: false — preventDefault로 드래그 중 스크롤/당겨서 새로고침 차단 보장
screens.game.addEventListener("pointerdown", onPointerDown, { passive: false });
screens.game.addEventListener("pointermove", onPointerMove, { passive: false });
screens.game.addEventListener("pointerup", onPointerUp);
screens.game.addEventListener("pointercancel", onPointerCancel);

/* ── 이벤트 바인딩 ───────────────────────── */
el.btnStart.addEventListener("click", startGame);
el.btnRetry.addEventListener("click", startGame);

// 리사이즈/회전: 골대·과자 레이아웃 재계산.
// 과자 가로 위치는 비율(snackXR)로 저장돼 있어 자동으로 새 크기에 맞는다.
window.addEventListener("resize", () => {
  if (state.phase === "landing" || state.phase === "result") return;
  layoutGame();
  placeSnack();
});

/* ── 초기화 ──────────────────────────────── */
renderLanding();

// 개발용 디버그 훅 (난이도·연출 값 조절 등)
window.__roniDebug = { CONFIG, state };
