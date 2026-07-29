# 슛돌이 로니! ⚽

농심 메론킥 캐릭터 '로니'와 함께하는 드래그 조준 슈팅 미니게임입니다.
공을 잡고 드래그로 조준하다가 **손을 떼는 순간** 그 시점의 파워 선 위치로 즉시 슈팅 —
로니 골키퍼를 뚫고 **골인하면 100점!** (7번의 기회, 슈팅당 10초, 최대 700점)

- 서버/DB 없이 **완전 정적 사이트** (HTML/CSS/JS만 사용, 외부 라이브러리 없음)
- 배경 일러스트 + 흰 스티커 톤 UI, Wanted Sans Variable 웹폰트(jsdelivr CDN)
- 최고기록(총점)은 `localStorage`에 기기별로 저장

## 게임 규칙

1. **조준 + 슈팅 (한 동작)** — 공을 터치한 채 드래그하면 화살표가 손가락을 따라 회전(좌우 ±38° 제한). **손을 떼는 순간** 그 시점의 파워 선 위치가 파워로 확정되며 즉시 슈팅
   - 파워 인디케이터는 좌↔우 항상 왕복(기본 1왕복 1.2초). 골인 가능 파워 구간은 40~85% (화면 표시는 없음)
   - 드래그가 아주 짧으면(살짝 스침) 슈팅하지 않고 취소
3. **판정** — 방향이 골대 안쪽 범위 + 파워가 적정 구간이면 골 기회. 슈팅 순간 골키퍼 로니가 좌/중/우 중 랜덤 방향으로 다이빙하고, 공 방향과 같으면 세이브(노골), 다르면 골인(+100)
4. **제한시간** — 슈팅 1회당 10초. 초과하면 기회 1 차감 (3초 이하부터 빨간 경고)
5. **결과** — 7회 슈팅 후 총점(최대 700)·골 수·로니 리액션 표시 (6~7골 퍼펙트 / 3~5골 굿샷 / 0~2골 아쉬움)

## 폴더 구조

```
nongshim-roni/
├── index.html        # 랜딩 / 게임 / 결과 3개 화면 + 가로 모드 안내
├── style.css         # 전체 스타일 (모바일 우선 반응형, 480px 중앙 프레임)
├── script.js         # 게임 로직 (상단 CONFIG에서 난이도·연출 조절)
├── assets/images/
│   ├── bg.png        # 배경 일러스트 (골대 포함 · 골대 좌표는 JS가 cover 크롭 수식으로 정렬)
│   ├── roni.png      # 로니 캐릭터 (랜딩/결과)
│   ├── roni_default.png / roni_left.png / roni_right.png / roni_up.png  # 골키퍼 자세 4종
│   └── ball.png      # 축구공
└── README.md
```

## 로컬 실행

```bash
# 방법 1: Python
python -m http.server 8000

# 방법 2: Node
npx serve .
```

브라우저에서 `http://localhost:8000` 접속 → 개발자 도구(F12) 기기 툴바에서 모바일 뷰(390×844 등)로 확인하세요.

## 게임 튜닝

`script.js` 맨 위 `CONFIG` 상수만 수정하면 됩니다. 주요 항목:

| 항목 | 설명 |
|---|---|
| `SHOTS_PER_GAME` / `SCORE_PER_GOAL` | 슈팅 횟수 / 골인당 점수 |
| `SHOT_TIME_LIMIT_MS` / `TIMER_WARN_MS` | 슈팅 제한시간 / 빨간 경고 시점 |
| `AIM_MAX_ANGLE` | 조준 각도 제한 (도) |
| `POWER_ROUNDTRIP_MS` | 파워 인디케이터 1왕복 시간 (짧을수록 어려움) |
| `POWER_GOAL_MIN` / `POWER_GOAL_MAX` | 골인 판정 파워 적정 구간 (기본 40~85%) |
| `GOAL_DIRECTION_RATIO` | 골인 판정 방향 범위 (정규화 조준각 기준) |
| `KEEPER_ZONE_SPLIT` | 공 방향 구간 경계 (좌/중/우 3등분) |
| `KEEPER_DIVE_WEIGHTS` / `KEEPER_REPEAT_PENALTY` | 골키퍼 방향 가중치 / 직전 세이브 방향 반복 페널티 |
| `BG_GOAL_RECT` | 배경 이미지 속 골대 영역 (이미지 교체 시 여기만 맞추면 됨) |
| `GRADES` | 골 수별 결과 등급·코멘트 |
| `STORAGE_KEY` | 최고기록 localStorage 키 |

크기·거리 값은 전부 화면/골대 대비 **비율**이라 어떤 기기에서도 난이도가 동일합니다.

## 배포 (Vercel)

프로덕션: https://nongshim-roni.vercel.app

```bash
vercel --prod
```

GitHub `main` 브랜치: https://github.com/bjisu/nongshim-roni
