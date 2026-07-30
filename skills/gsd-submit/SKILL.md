---
name: gsd-submit
description: GSD(Get Ship Done)에서 오늘 만든 프로젝트를 밀그램(milgram.io) 이벤트 페이지의 제출물로 등록한다. Claude와 나눈 작업 히스토리와 코드베이스를 읽어 제출물 내용을 정리하고, 서비스 화면을 캡처해 대표 이미지로 올리고, 오늘 열린 기수 이벤트를 찾아 팀 등록부터 최종 제출까지 처리한다. "밀그램에 제출해줘", "오늘 만든 거 등록해줘", "GSD 제출물 올려줘", "제출물 등록", "이거 제출해줘" 처럼 제출·등록이 언급되면 사용한다. 수강생이 "다 만들었어, 올려줘" 라고만 해도 맥락이 GSD나 밀그램이면 이 스킬을 쓴다.
---

# GSD 제출물 등록

오늘 하루 만든 것을 밀그램 이벤트 페이지의 **제출물**로 올린다.
수강생은 "제출해줘" 한마디만 하면 되고, 나머지는 여기서 전부 한다.

밀그램에 공개 API 문서는 없지만 프론트가 쓰는 REST가 그대로 열려 있다.
**UI를 클릭하지 않고 그 API를 직접 호출한다.** 브라우저는 로그인 토큰을 읽고 화면을 캡처할 때만 쓴다.
자세한 엔드포인트는 [references/milgram-api.md](references/milgram-api.md).

## 어떻게 진행하나

**끝까지 자동으로 제출한다.** 중간에 "이대로 올릴까요?" 하고 묻지 않는다.
제출 마감 직전에 지친 수강생이 쓰는 스킬이라 단계마다 멈추면 목적을 잃는다.

대신 **끝나면 반드시 결과를 보여준다** — 등록한 팀명·주제·이미지 수와 공개 URL.
제출물은 이벤트 페이지에 공개되는 내용이고, 고칠 게 있으면 "다시 제출해줘"로 같은 자리를 덮어쓴다.

멈춰야 하는 경우는 세 가지뿐이다.

- **사전 점검이 통과하지 않을 때** — 사람만 할 수 있는 세팅이 남아 있다
- **오늘 이벤트를 특정할 수 없을 때** — 임의로 고르지 말고 묻는다
- **참가자 자격이 없을 때** — 계정 문제라 운영자에게 가야 한다

## 0. 사전 점검

```bash
scripts/preflight.sh
```

Node 22+ · Chrome · chromux · live 브릿지 · 밀그램 로그인 다섯 가지를 본다.
`NEED` 가 있으면 바로 설치를 돌린다. **묻지 말고 실행한다** — 수강생은 무엇을 깔아야 하는지 모른다.

```bash
scripts/install.sh          # 넉넉한 타임아웃으로 (최대 5분)
```

Node·chromux 설치는 자동이다. 사람이 해야 하는 건 딱 두 가지이고, 스크립트가 화면을 열어주고 기다린다.

- **Chrome 확장 로드** — 에이전트는 확장을 설치할 수 없다
- **밀그램 로그인** — GSD 신청에 쓴 그 계정으로

막히면 [references/setup.md](references/setup.md)를 본다.

## 1. 무엇을 만들었는지 파악

세 곳을 읽는다. **하나만 읽고 쓰지 않는다** — 코드에는 의도가 없고, 대화에는 결과가 없다.

```bash
scripts/session-digest.mjs                # 현재 폴더의 오늘 작업 기록
scripts/session-digest.mjs ~/projects/x   # 다른 폴더를 볼 때
```

| 어디서 | 무엇을 얻나 |
|---|---|
| **작업 기록** (`session-digest.mjs`) | 무엇을 만들려고 했는지, 어디서 막혔는지, 어떻게 풀었는지 — **회고는 여기서만 나온다** |
| **코드베이스** | README, package.json, 폴더 구조, 실제 동작하는 기능, 기술 스택 |
| **배포 흔적** | git remote, Vercel/Netlify 설정, README 링크, 작업 기록의 배포 명령 |

배포 URL을 못 찾으면 로컬에서 띄워 캡처하고 링크는 비운다. **URL을 지어내지 않는다.**

## 2. 대표 이미지

제출물에는 **사진이 최소 1장 필수**다 (최대 10장). 첫 장이 목록에 뜨는 대표 이미지가 된다.

```bash
scripts/capture.sh <url> out/shot1.png [--wait "화면 문구"] [--full]
scripts/capture.sh --cleanup            # 다 찍은 뒤 한 번
```

수강생의 실제 Chrome이 아니라 격리 프로파일을 헤드리스로 띄우므로 창이 뜨지 않는다.
프로젝트 유형별로 무엇을 찍을지는 [references/capture.md](references/capture.md).

- 배포된 웹이면 메인 화면 + 핵심 기능 화면 2~3장
- 로그인 뒤에만 볼 수 있는 화면이면 무리하지 말고 랜딩만 찍는다
- 웹이 아니면(자동화 스크립트·CLI) **실행 결과물**을 찍는다 — 만들어진 시트, 리포트, 슬랙 메시지
- 아무것도 없으면 요약 카드를 렌더한다 (capture.md의 폴백)

## 3. 제출물 작성

**형식이 내용만큼 중요하다.** 참가자들이 서로 제출물을 구경하는데, 평문 몇 줄이면 만든 것에 비해 초라해 보인다.
섹션 구성과 예시는 [references/submission-format.md](references/submission-format.md)를 그대로 따른다.

```
## 💡 서비스 개요     한줄 요약
## 🔗 프로젝트 URL    배포 링크
## ✨ 핵심 기능       기능별 소제목 + 설명 + 불릿
## 🛠 기술 스택       불릿
## 📝 회고           배운점 / 다음 단계 계획
```

내용은 **작업 기록에서 실제로 있었던 것만** 쓴다. 없는 기능을 채워 넣지 않는다.
회고는 그날의 진짜 막힘과 해결을 쓴다 — 그게 다른 수강생에게 제일 도움이 된다.

마크다운으로 쓰고 `out/body.md` 에 저장한다. 밀그램은 description을 Tiptap JSON으로 받는데
`scripts/md-to-tiptap.mjs` 가 변환한다 (submit이 알아서 호출한다).

## 4. 등록

`out/payload.json` 을 만들고 한 번에 제출한다.

```json
{
  "teamName": "김채은",
  "title": "마케팅 AI 분석 에이전트",
  "summary": "복잡한 마케팅 성과 데이터를 채팅으로 조회하는 대화형 AI 서비스입니다.",
  "descriptionFile": "body.md",
  "links": [{ "label": "서비스 바로가기", "url": "https://my-app.vercel.app" }],
  "images": ["out/shot1.png", "out/shot2.png"]
}
```

```bash
node scripts/milgram.mjs status          # 오늘 이벤트·빈 슬롯·내 제출 상태
node scripts/milgram.mjs submit out/payload.json
```

`submit` 이 하는 일 — 오늘 GSD 이벤트 찾기 → 빈 슬롯에 팀 생성 → 이미지 업로드 → 최종 제출.
**이미 내 팀이 있으면 새로 만들지 않고 그 자리를 갱신한다.** 재실행이 곧 수정이다.

| 필드 | 규칙 |
|---|---|
| `teamName` | 수강생 이름. 밀그램 프로필 이름(`whoami`)을 기본값으로 쓴다 |
| `title` | 제출물 주제 = 서비스 이름 |
| `summary` | 2~3문장. 목록에 뜨는 소개다 |
| `images` | 첫 장이 대표 이미지 |
| `eventId` | 보통 생략(오늘 날짜로 자동). 지난 기수에 올릴 때만 지정 |

## 5. 끝나고 알린다

성공하면 `submit` 이 공개 URL을 낸다. 그대로 전한다.

```
등록 완료 — 42기 제출물 3번 슬롯
https://www.milgram.io/ko/event/{eventId}/builds
```

무엇을 등록했는지(주제·이미지 수·링크)도 한 줄로 요약한다.
**고칠 게 있으면 payload를 고쳐 다시 실행하면 된다**는 것도 알린다.

## 막혔을 때

| 증상 | 원인과 대처 |
|---|---|
| `참가자가 아닙니다` (403) | 로그인 계정이 그 이벤트 참가자가 아니다. GSD 신청에 쓴 계정인지 확인하고, 맞다면 운영자에게 참가 승인을 요청한다 |
| `이미 다른 팀에 소속` (409) | 한 이벤트에 한 팀만 가능하다. `status` 로 기존 팀을 확인하고 그걸 갱신한다 |
| `빈 슬롯이 없습니다` | 운영자에게 현황판 슬롯 추가를 요청한다 |
| `제출 기간이 아닙니다` | 마감이 지났다. 운영자만 열 수 있다 |
| 로그인 세션 만료 (401) | 브라우저에서 다시 로그인한 뒤 재실행 |

브라우저 조작 자체가 안 될 때는 [references/setup.md](references/setup.md)를 본다.

## 참고 문서

| 문서 | 언제 읽나 |
|---|---|
| [references/setup.md](references/setup.md) | 사전 점검에서 `NEED` 가 나왔을 때 |
| [references/milgram-api.md](references/milgram-api.md) | API 응답을 직접 확인해야 할 때, 스크립트를 고칠 때 |
| [references/submission-format.md](references/submission-format.md) | 제출물 내용을 쓸 때 — **매번 본다** |
| [references/capture.md](references/capture.md) | 무엇을 찍을지 모를 때, 웹이 아닌 프로젝트일 때 |
