/* ═══════════════════════════════════════════
   슛돌이 로니! — script.js
   드래그 조준 슈팅 게임 · 정적 사이트 (서버/외부 라이브러리 없음)

   조작: ① 공을 잡고 드래그 → 조준 화살표가 손가락을 따라 회전, 놓으면 방향 고정
         ② 왕복하는 파워 게이지를 탭 → 파워 고정 + 슈팅
   규칙: 방향이 골대 안 + 파워가 적정 구간이면 골인(+100점)
         슈팅 1회당 10초 제한시간 · 한 게임 3회 슈팅 · 최대 300점
         골키퍼 로니는 연출 전용(골이면 반대로, 빗나가면 공 쪽으로 다이빙)
   ═══════════════════════════════════════════ */

"use strict";

/* ── 조정 가능한 상수 (난이도/연출 튜닝은 전부 여기서) ── */
const CONFIG = {
  /* ── 게임 구조 ── */
  SHOTS_PER_GAME: 3,          // 한 게임 슈팅 횟수
  SCORE_PER_GOAL: 100,        // 골인당 점수
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

  /* ── 1단계: 드래그 조준 ──
     공을 터치(클릭)하면 조준 시작, 손가락을 따라 화살표가 실시간 회전,
     떼면 그 방향으로 고정. */
  AIM_MAX_ANGLE: 38,          // 조준 각도 제한 (도 · 좌우 대칭 · 골대를 크게 벗어나지 않는 범위)
  AIM_SPREAD_RATIO: 1.15,     // 최대 각도일 때 수평 도달 거리 = 골대 폭 절반 × 이 값
  BALL_GRAB_RADIUS: 2.6,      // 공 반지름 × 이 값 안을 터치하면 조준 시작 (손가락 오차 허용)

  /* ── 2단계: 파워 게이지 ── */
  POWER_SWEEP_SPEED: 1.1,     // 게이지 왕복 속도 (1초당 편도 횟수)

  /* ── 슛 비행 연출 (거리 값은 화면 높이 대비 비율) ── */
  FLY_DURATION_MS: 700,       // 비행 시간
  FLY_ARC_RATIO: 0.145,       // 포물선 최고점 = 화면 높이 × 이 값
  FLY_END_SCALE: 0.38,        // 도착 시점 공 크기 배율 (원근감)
  FLY_SPIN_TURNS: 1.5,        // 회전 바퀴 수
  SHORT_LAND_MARGIN_RATIO: 0.032, // 파워 부족 시 골대 아래 착지 여유 (화면 높이 대비)
  OVER_RISE_RATIO: 0.105,     // 파워 초과 시 골대 상단 위로 솟는 높이 (화면 높이 대비)

  /* ── 골키퍼 로니 (연출 전용 · 골인 판정과 무관) ── */
  KEEPER_IMG_VERSION: "v=1",  // 이미지 캐시버스터 (이미지 교체 시 올리기)
  KEEPER_ZONE_SPLIT: 1 / 3,   // 정규화 조준각(-1~1)의 구간 경계 — |각| ≤ 이 값이면 중앙(up), 넘으면 좌/우 (기본 3등분)

  /* ── 판정: 골인 ──
     골인 = 방향이 골대 안쪽 범위 AND 파워가 적정 구간.
     그 외(옆 빗나감/파워 부족/파워 과다/시간 초과)는 전부 노골. */
  GOAL_DIRECTION_RATIO: 0.85, // |정규화 조준각| ≤ 이 값이면 방향이 골대 안 (1 ≈ 골포스트)
  POWER_GOAL_MIN: 0.40,       // 파워 적정 구간 하한 (게이지의 40%) — 미만이면 골대까지 못 감
  POWER_GOAL_MAX: 0.85,       // 파워 적정 구간 상한 (게이지의 85%) — 초과면 골대 위로 넘어감

  /* ── 흐름 ── */
  NEXT_SHOT_DELAY_MS: 950,    // 판정 후 다음 슈팅 준비까지 대기
  RESULT_DELAY_MS: 1200,      // 마지막 슛 판정 후 결과 화면까지 대기

  STORAGE_KEY: "roni_best_score", // 최고기록 (총점 기준 · 기존 키 재활용)

  /* ── 결과 등급 (골 수 기준) ── */
  GRADES: [
    { minGoals: 3, key: "perfect", label: "해트트릭!", comment: "3골 전부 성공! 로니 골키퍼도 두 손 들었어요!" },
    { minGoals: 1, key: "good",    label: "굿샷!",     comment: "좋아요! 방향과 파워를 다듬으면 해트트릭도 가능해요." },
    { minGoals: 0, key: "miss",    label: "아쉬워요…", comment: "괜찮아요! 파워는 게이지 40~85% 구간을 노려보세요." },
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
  btnStart: $("#btn-start"),
  gameInner: $(".game-inner"),
  hudScore: $("#hud-score"),
  hudShots: $("#hud-shots"),
  hudTimerChip: $(".hud-timer"),
  hudTimer: $("#hud-timer"),
  timerRing: $("#timer-ring-fg"),
  goalArea: $("#goal-area"),
  goalNetFx: $("#goal-net-fx"),
  keeper: $("#keeper"),
  keeperImg: $("#keeper-img"),
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
  phase: "landing",   // landing | countdown | aim | aiming | power | fly | wait | result
  score: 0,
  shotsLeft: CONFIG.SHOTS_PER_GAME,
  goals: 0,           // 골인 수

  aimAngle: 0,        // 현재 화살표 각도 (도)
  aimPointerId: null, // 조준 중인 포인터 id
  aimPointer: null,   // 최신 포인터 좌표 {x, y} — pointermove는 저장만, 반영은 rAF에서
  shotDeadline: 0,    // 이번 슈팅 마감 시각 (performance.now 기준 · 시작 시각 기준 계산이라 오차 누적 없음)
  power: 0,           // 현재 게이지 값 (0~1)
  powerDir: 1,        // 게이지 진행 방향

  fly: null,          // 비행 중 데이터 { from, to, start, outcome, ... }
  rafId: null,
  lastTime: null,
  lastResult: null,   // { score, goals, grade, isNewRecord }
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

/* ── 골키퍼 (연출 전용) ────────────────────
   조준·파워 중엔 default. 슈팅 순간:
   골인 → 공과 "다른" 방향으로 다이빙(못 막은 연출),
   옆 빗나감 → 공 방향으로 다이빙, 파워 과다 → 위로, 파워 부족 → 준비 자세 유지.
   다음 슈팅 준비 시 default 복귀. 골인 판정에는 관여하지 않는다. */
const keeperSrc = (pose) => `assets/images/roni_${pose}.png?${CONFIG.KEEPER_IMG_VERSION}`;
// 4장 모두 프리로드 — 전환 순간 로딩 딜레이/깜빡임 방지
["default", "left", "right", "up"].forEach((p) => { new Image().src = keeperSrc(p); });

function setKeeperPose(pose) {
  el.keeperImg.src = keeperSrc(pose);
  el.keeper.classList.remove("dive-left", "dive-right", "dive-up");
  if (pose !== "default") el.keeper.classList.add(`dive-${pose}`);
}

/* ── 화면 전환 ───────────────────────────── */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

/* ── 랜딩 ────────────────────────────────── */
function renderLanding() {
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
   다음 슈팅 준비 시 리셋. 비행·판정 연출 중에는 돌지 않는다
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
}

/* ── 게임 시작 ───────────────────────────── */
function startGame() {
  stopLoop();
  showScreen("game");
  state.phase = "countdown";
  state.score = 0;
  state.goals = 0;
  state.shotsLeft = CONFIG.SHOTS_PER_GAME;
  state.fly = null;
  renderHud();
  el.judgeFlash.classList.add("hidden");
  el.flyBall.classList.add("hidden");
  el.shootBall.style.visibility = "";
  el.goalNetFx.classList.remove("is-shaking");
  setKeeperPose("default"); // 재시작 시 준비 자세
  layoutGame();  // 골대 논리 영역을 현재 화면에 맞춤
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
  setKeeperPose("default"); // 다음 슈팅 준비 → 준비 자세 복귀
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
  // 방향까지 골대 안쪽 범위면 "골인", 옆으로 벗어나면 "옆 빗나감(wide)".
  const onTarget = Math.abs(a) <= CONFIG.GOAL_DIRECTION_RATIO;
  const h = (power - CONFIG.POWER_GOAL_MIN) / (CONFIG.POWER_GOAL_MAX - CONFIG.POWER_GOAL_MIN); // 0~1
  return {
    outcome: onTarget ? "goal" : "wide",
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

  // 골키퍼 연출 (판정 무관): 공이 가는 방향 구간(좌/중/우)을 기준으로
  //  골인 → 공과 "다른" 방향으로 다이빙 = 못 막은 것처럼
  //  옆 빗나감 → 공 방향으로 다이빙 (따라갔지만 공이 밖으로)
  //  파워 과다 → 위로 점프 (공이 그 위로 넘어감) · 파워 부족 → 준비 자세 유지
  const a = state.aimAngle / CONFIG.AIM_MAX_ANGLE; // -1 ~ 1
  const ballZone = a < -CONFIG.KEEPER_ZONE_SPLIT ? "left" : a > CONFIG.KEEPER_ZONE_SPLIT ? "right" : "up";
  let pose = "default";
  if (shot.outcome === "goal") {
    const others = ["left", "up", "right"].filter((z) => z !== ballZone);
    pose = others[Math.floor(Math.random() * others.length)];
  } else if (shot.outcome === "wide") {
    pose = ballZone;
  } else if (shot.outcome === "over") {
    pose = "up";
  }
  setKeeperPose(pose);

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

/* ── 판정: 골인 여부 (computeShot의 outcome으로 이미 확정) ── */
function resolveShot() {
  const f = state.fly;
  state.fly = null;
  state.phase = "wait";
  state.shotsLeft -= 1;

  const isGoal = f.outcome === "goal";

  if (isGoal) {
    state.goals += 1;
    state.score += CONFIG.SCORE_PER_GOAL;
    el.flyBall.classList.add("hidden");
    // "GOAL!" 플래시 — "시간 초과!"와 동일 스타일/애니메이션
    showFlash("GOAL!");
    el.goalNetFx.classList.remove("is-shaking");
    void el.goalNetFx.offsetWidth;
    el.goalNetFx.classList.add("is-shaking");
  } else {
    // 노골: 플래시 없이 하단 힌트로만 안내
    if (f.outcome !== "over") {
      setTimeout(() => el.flyBall.classList.add("hidden"), 250);
    } else {
      el.flyBall.classList.add("hidden");
    }
  }
  renderHud();

  el.phaseHint.textContent = isGoal ? "" :
    f.outcome === "short" ? "파워가 부족했어요…" :
    f.outcome === "over" ? "너무 세게 찼어요!" : "옆으로 빗나갔어요!";

  if (state.shotsLeft > 0) {
    setTimeout(beginAim, CONFIG.NEXT_SHOT_DELAY_MS);
  } else {
    setTimeout(finishGame, CONFIG.RESULT_DELAY_MS);
  }
}

/* ── 게임 종료 → 결과 ────────────────────── */
function finishGame() {
  const grade = CONFIG.GRADES.find((g) => state.goals >= g.minGoals);
  const prevBest = loadBest();
  const isNewRecord = prevBest === null || state.score > prevBest;
  if (isNewRecord) saveBest(state.score);
  state.lastResult = { score: state.score, goals: state.goals, grade, isNewRecord };
  renderResult();
}

function renderResult() {
  const { score, goals, grade, isNewRecord } = state.lastResult;
  stopLoop();
  state.phase = "result";

  el.resultHits.textContent = `골 ${goals} / ${CONFIG.SHOTS_PER_GAME}`;
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

  const maxScore = CONFIG.SHOTS_PER_GAME * CONFIG.SCORE_PER_GOAL;
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

// 리사이즈/회전: 골대 논리 영역 재계산
window.addEventListener("resize", () => {
  if (state.phase === "landing" || state.phase === "result") return;
  layoutGame();
});

/* ── 초기화 ──────────────────────────────── */
renderLanding();

// 개발용 디버그 훅 (난이도·연출 값 조절 등)
window.__roniDebug = { CONFIG, state };
