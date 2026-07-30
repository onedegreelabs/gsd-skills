# 밀그램 제출물 API

공개 문서는 없지만 웹 프론트가 `api.milgram.io` REST를 그대로 쓴다. 이 스킬은 UI를 클릭하지 않고
그 API를 직접 호출한다. 클릭 자동화는 화면이 바뀌면 바로 깨지는데, 40명이 동시에 제출하는
마감 직전에 그러면 답이 없다.

여기 적힌 값은 40기 이벤트에 실제로 호출해 확인한 것이다.

## 인증

토큰은 밀그램 웹의 NextAuth 세션에서 나온다.

```
GET https://www.milgram.io/api/auth/session
→ { user: {...}, accessToken: "...", expires: "..." }
```

브라우저 안에서만 읽을 수 있으므로 chromux 격리 프로파일(`gsd`)로 전용 Chrome을 띄워 가져온다
(`milgram.mjs` 의 `auth()`). 로그인이 안 되어 있으면 창을 앞에 띄우고 로그인될 때까지 기다린다.
로그인 세션은 프로파일에 남으므로 로그인은 사실상 최초 1회다.
토큰은 **프로세스 메모리에만** 두고 파일에 쓰거나 출력하지 않는다.

> 처음에는 live 모드(사용자의 실제 Chrome + 확장)를 썼는데, 비개발자에게 "개발자 모드 켜고
> 압축해제된 확장 로드"가 최대 허들이었다. 격리 프로파일은 확장이 필요 없어서 이 단계가 통째로
> 사라진다. 대가는 전용 창에서 한 번 더 로그인하는 것뿐이다.

이후 모든 호출은 `Authorization: Bearer <accessToken>`.

응답은 전부 `{ data: ..., timestamp }` 로 감싸여 온다. 목록은 `data.data` 가 배열이다.

## 엔드포인트

| 하는 일 | 호출 |
|---|---|
| 커뮤니티 이벤트 목록 | `GET /communities/{communityId}/events?limit=100` |
| 슬롯 + 등록된 팀 | `GET /events/{eventId}/build-slots?limit=50` |
| 팀 상세 | `GET /events/{eventId}/builds/{buildId}` |
| 팀 생성 | `POST /events/{eventId}/builds` |
| 팀 정보 수정 | `PATCH /events/{eventId}/builds/{buildId}` |
| 제출 | `POST /events/{eventId}/builds/{buildId}/submission` |
| 임시저장 | `PUT /events/{eventId}/builds/{buildId}/submission-draft` |
| 슬롯 놓기 | `PATCH /events/{eventId}/builds/{buildId}/slot` `{"slotId": null}` |
| 등록 취소 | `DELETE /events/{eventId}/builds/{buildId}` |
| 파일 업로드 | `POST /files/upload` (multipart, 필드명 `file`) |
| 이벤트 참가 / 취소 | `POST /events/{eventId}/register` · `DELETE /events/{eventId}/unregister` |

GSD 커뮤니티 id는 `c91c74be-c428-4293-bb6e-5024f4e97241`.

**`limit` 은 50이 상한이다.** 200을 주면 400이 떨어진다.

## build-slots 응답

```json
{ "data": {
  "data": [ { "slotId": "…", "displayOrder": 1, "isEmpty": false,
              "build": { "id": "…", "teamName": "…", "isMine": true,
                         "hasSubmission": true, "submissionDeadlineAt": "…",
                         "isSubmissionClosed": false } } ],
  "activeSlotCount": 40, "myBuildCount": 0, "viewerRole": "guest"
} }
```

- 빈 슬롯은 `isEmpty: true` — 첫 번째 것의 `slotId` 로 팀을 만든다
- 내 팀은 `build.isMine` 으로 찾는다
- `viewerRole` 이 `guest` 면 그 이벤트의 참가자가 아니다

## 팀 생성

```json
POST /events/{eventId}/builds
{ "slotId": "…", "title": "제출물 주제", "teamName": "팀명", "summary": "소개", "teamLogo": "uploads/…" }
```

- `title`, `teamName` 필수
- **`slotId` 는 사실상 필수다.** 없으면 팀빌딩 기능이 켜진 이벤트에서만 통하는데 GSD는 꺼져 있다
- `teamLogo` 는 업로드 응답의 **key**(`uploads/…`), 이미지들은 **전체 URL**을 쓴다. 서로 다르다

## 제출

```json
POST /events/{eventId}/builds/{buildId}/submission
{ "description": "<Tiptap JSON 문자열>", "thumbnail": "https://cdn.milgram.io/…",
  "images": ["https://cdn.milgram.io/…"], "links": [{ "url": "…", "label": "서비스 바로가기" }] }
```

- `description` 필수, **사진 최소 1장**(`thumbnail` + `images` 합쳐서), 최대 10장
- 재호출하면 덮어쓴다. 수정은 그냥 다시 제출하면 된다

### description은 HTML이 아니라 Tiptap JSON이다

여기가 제일 걸리기 쉬운 곳이다. 마크다운이나 HTML을 넣으면 뷰어가 JSON 파싱에 실패하고
**문자열 전체를 문단 하나로** 떨어뜨린다. 태그가 그대로 보인다.

```json
{ "type": "doc", "content": [
  { "type": "heading", "attrs": { "id": "<uuid>", "tiptapBg": null, "indent": 0, "level": 2 },
    "content": [{ "type": "text", "text": "💡 서비스 개요" }] },
  { "type": "paragraph", "attrs": { "id": "<uuid>", "variant": null, "tiptapBg": null, "indent": 0 },
    "content": [{ "type": "text", "marks": [{ "type": "bold" }], "text": "한줄 요약:" }] }
] }
```

`scripts/md-to-tiptap.mjs` 가 마크다운을 이 구조로 바꾼다. 헤딩·문단·불릿·굵게·기울임·링크를 지원한다.
직접 JSON을 손으로 쓰지 말고 마크다운을 쓴다.

링크 mark는 `attrs` 를 다 채워야 밀그램 스타일로 렌더된다.

```json
{ "type": "link", "attrs": { "href": "…", "target": "_blank",
  "rel": "noopener noreferrer nofollow", "class": "cursor-pointer text-blue-500 underline", "title": null } }
```

## 파일 업로드

```
POST /files/upload   multipart/form-data, 필드명 file
→ { data: { key: "uploads/이름-uuid.webp", url: "https://cdn.milgram.io/uploads/…" } }
```

서버가 webp로 변환한다. `Content-Type` 헤더를 직접 지정하지 않는다 — FormData가 boundary와 함께 만든다.

## 서버가 막는 것들

API 소스(`hackathon-builds.service.ts`)에서 확인한 제약이다. 미리 알면 엉뚱한 데서 헤매지 않는다.

| 규칙 | 결과 |
|---|---|
| 승인된 참가자여야 한다 | 403 `Only approved participants…` |
| 참가자 **유형이 '참가자'** 여야 한다 | 403 `Only hackathon participants can join build teams` — 멘토·심사위원·운영자는 등록 불가 |
| 한 이벤트에 한 팀만 | 409 `Participant already belongs to a build` |
| 등록·제출 기간이 열려 있어야 한다 | 400/403 — 운영자가 현황판에서 `제출물 등록 시작`을 눌러야 슬롯이 생긴다 |
| 사진 0장 | 400 `Missing required fields: submission image` |
| 사진 11장 이상 | 400 `Build images must be 10 or fewer` |

`milgram.mjs` 의 `explainError()` 가 이 메시지들을 한국어로 바꾼다. 새 오류를 만나면 거기에 추가한다.

## 팀을 지울 때 (테스트 정리)

`DELETE .../builds/{buildId}` 만 부르면 409 `Release the dashboard slot before disbanding the team` 이 난다.
**슬롯을 먼저 놓아야 한다.** `milgram.mjs delete` 는 이 두 단계를 알아서 한다.

```
PATCH /events/{eventId}/builds/{buildId}/slot   {"slotId": null}
DELETE /events/{eventId}/builds/{buildId}
```

그리고 **순서를 지킨다.** 참가를 먼저 취소해 버리면 그 순간부터 참가자가 아니라
자기 팀도 못 건드린다 (403 `Only approved participants…`). 참가 취소는 맨 마지막이다.

## 스킬을 테스트할 때

참가자 자격이 없으면 등록 경로를 밟아볼 수 없다. 운영자 계정으로 검증하려면 이렇게 한다.

```
POST   /events/{eventId}/register     {"ticketId": "...", "hackathonParticipantType": "participant",
                                       "registrationAnswers": { "<questionId>": ["..."] }}
… 등록 · 제출 테스트 …
PATCH  /events/{eventId}/builds/{buildId}/slot   {"slotId": null}
DELETE /events/{eventId}/builds/{buildId}
DELETE /events/{eventId}/unregister
```

- `ticketId` 는 이벤트 상세(`GET /events/{eventId}`)의 `tickets[0].id`
- 참가신청서 필수 질문은 `GET /events/{eventId}/registration-form/questions` 로 확인해 답을 채운다
- **실제 운영 중인 기수에서 테스트하면 참가자 수와 현황판에 잠깐 뜬다.** 끝나면 반드시 되돌린다

## 디버깅

```bash
node scripts/milgram.mjs whoami
node scripts/milgram.mjs today
node scripts/milgram.mjs status [eventId]
node scripts/milgram.mjs get "/events/{eventId}/builds/{buildId}"
node scripts/milgram.mjs delete <eventId> <buildId>     # 테스트 정리
```

`get` 은 임의 경로를 그대로 호출한다. 응답 구조가 궁금하면 이걸 쓴다.
