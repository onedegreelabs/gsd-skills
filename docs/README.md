# 웹 가이드

수강생에게 링크로 공유하는 가이드 페이지다.

- **공개 주소**: https://onedegreelabs.github.io/gsd-skills/
- **텍스트 버전**: [../GUIDE.md](../GUIDE.md)

| 파일 | 무엇 |
|---|---|
| `index.html` | **페이지 전체.** 워딩을 고치려면 여기만 고치면 된다 |
| `images/*.png` | 밀그램 실제 화면 캡처 |

빌드 단계가 없다. GitHub Pages가 `main` 브랜치의 이 폴더를 그대로 서빙한다.

## 워딩 고치는 법

**GitHub에서 바로 고치는 게 제일 쉽다.**

1. [docs/index.html 편집 화면](https://github.com/onedegreelabs/gsd-skills/edit/main/docs/index.html) 열기
2. 글자 고치고 → `Commit changes`
3. **1분쯤 뒤** 공개 주소에 반영된다 ([Actions 탭](https://github.com/onedegreelabs/gsd-skills/actions)에서 배포 진행 확인)

로컬에서 고칠 때는 파일을 열어 고치고 push 하면 된다.

```bash
$EDITOR docs/index.html
git commit -am "가이드 워딩 수정" && git push
```

미리 보려면 파일을 브라우저로 바로 열면 된다 (서버 필요 없음).

```bash
open docs/index.html          # macOS
start docs\index.html         # Windows
```

### 어디를 고쳐야 하나

본문은 `<section id="s1">` ~ `<section id="s7">` 안에 순서대로 들어 있다.

| 찾을 것 | 무엇 |
|---|---|
| `<h1>` | 큰 제목 |
| `class="lede"` | 제목 아래 소개 문단 |
| `class="facts"` | 상단의 알약 3개 (걸리는 시간 등) |
| `id="bootstrap"` | **수강생이 붙여넣는 문장** — 여기를 고치면 복사 버튼 내용도 같이 바뀐다 |
| `class="note"` | 안내 상자 (`note warn` 주황, `note ok` 초록) |
| `<details>` | 문제 해결 FAQ 접기 항목 |
| `data-os="win"` / `data-os="mac"` | OS별로 다르게 보이는 부분 |

목차(`nav.rail`)의 항목 이름은 각 섹션 `<h2>` 와 **따로 적혀 있으니 같이 고친다.**

> 같은 내용이 [../GUIDE.md](../GUIDE.md) 에도 있다. 텍스트 버전이 필요 없으면
> 그 파일은 지우고 이 페이지 링크만 남겨도 된다.

## 화면 캡처를 다시 찍을 때

**실제 수강생 이름이 찍히지 않게 한다.** 공개 저장소이고 페이지도 공개다.
샘플 제출물(`홍길동 (샘플)`)만 있는 기수 페이지에서 찍는 것이 안전하다.

```bash
node skills/gsd-submit/scripts/capture.mjs "<url>" docs/images/03-builds-list.png
```

로그인이 필요한 화면은 `gsd` 프로파일(로그인된 전용 창)로 찍는다.

```bash
CHROMUX_PROFILE=gsd chromux open g "<url>"
CHROMUX_PROFILE=gsd chromux screenshot g docs/images/04-submission-detail.png --region 64 0 1216 900 --space css
```

파일 이름을 그대로 덮어쓰면 페이지는 손대지 않아도 캡처만 갱신된다.
