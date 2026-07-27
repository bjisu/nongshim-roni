# 메론킥 슛! ⚽

농심 메론킥 캐릭터 '로니'와 함께하는 원터치 반응속도 미니게임입니다.
좌우로 움직이는 공이 **골대 중앙에 왔을 때 탭!** — 정확도(%)에 따라 로니가 리액션합니다.

- 서버/DB/Firebase 없이 **완전 정적 사이트** (HTML/CSS/JS만 사용)
- 메론킥 과자 패키지 무드 디자인 (멜론 그린 + 크림 + 그물망 패턴, 외부 이미지 없이 인라인 SVG/캔버스로 구현)
- 최고기록은 `localStorage`에 기기별로 저장

## 폴더 구조

```
roni-kick-timing/
├── index.html        # 랜딩/게임/결과 3개 화면
├── style.css         # 전체 스타일 (모바일 우선, 데스크톱은 중앙 정렬 / :root에 메론킥 팔레트·그물망 타일)
├── script.js         # 게임 로직 (상단 CONFIG에서 난이도·등급 조절)
├── assets/images/
│   ├── roni.png      # 로니 캐릭터 (배경 제거본)
│   └── ball.png      # 축구공
└── README.md
```

## 로컬에서 실행하기 (Cursor)

이 폴더를 Cursor로 열고, 아래 중 하나로 로컬 서버를 띄우면 됩니다.
(파일을 더블클릭해 열어도 동작하지만, 로컬 서버 실행을 권장합니다.)

```bash
# 방법 1: Python
python3 -m http.server 8000

# 방법 2: Node
npx serve .
```

브라우저에서 `http://localhost:8000` 접속 → 개발자 도구(F12) → 기기 툴바에서 모바일 뷰(예: iPhone)로 확인하세요.

## 게임 튜닝

`script.js` 맨 위 `CONFIG` 상수만 수정하면 됩니다.

| 항목 | 설명 |
|---|---|
| `BALL_SPEED_RATIO` | 공 속도 (트랙폭 대비 초당 비율, 기본 0.6) — 높일수록 어려움 |
| `INPUT_LOCK_MS` | 탭 후 입력 잠금 시간 |
| `GRADES` | 등급 커트라인/문구/코멘트 |
| `STORAGE_KEY` | 최고기록 localStorage 키 |

골대 존의 시각적 너비는 `style.css`의 `--goal-zone-width`(기본 26%)로 조절합니다. (판정은 존이 아니라 중앙 거리 기반 % 공식이라 시각 요소만 바뀝니다.)

## GitHub Pages 배포

1. GitHub에 새 저장소 생성 (예: `roni-kick-timing`)
2. 이 폴더 내용을 push

   ```bash
   git init
   git add .
   git commit -m "메론킥 슛! MVP"
   git branch -M main
   git remote add origin https://github.com/{내아이디}/roni-kick-timing.git
   git push -u origin main
   ```

3. 저장소 **Settings → Pages → Source**를 `main` 브랜치 `/ (root)`로 지정
4. 1~2분 후 `https://{내아이디}.github.io/roni-kick-timing/` 접속 확인
5. 이후 수정 사항은 `main`에 push하면 자동 재배포

## 완료 기준 체크 (PRD 11)

- [x] 랜딩 → 게임 → 결과 3단계 화면 전환
- [x] PRD 5.2 공식 그대로 정확도 계산
- [x] 등급별(퍼펙트킥/굿샷/헛발질) 로니 리액션 분기
- [x] 최고기록 localStorage 유지
- [ ] GitHub Pages 배포 (위 절차대로 push 후 확인)
- [ ] 실기기(iOS Safari / Android Chrome) 최종 확인
