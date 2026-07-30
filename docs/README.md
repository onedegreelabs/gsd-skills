# 웹 가이드 소스

수강생에게 링크로 공유하는 가이드 페이지의 원본이다.

- **발행된 페이지**: https://onedegreelabs.github.io/gsd-skills/
- **텍스트 버전**: [../GUIDE.md](../GUIDE.md)

## 구성

| 파일 | 무엇 |
|---|---|
| `guide-template.html` | 페이지 본문. 이미지는 `{{IMG_01}}` 같은 자리표시자로 두었다 |
| `build-guide.mjs` | 자리표시자에 이미지를 base64로 밀어넣어 최종 HTML을 만든다 |
| `images/*.png` | 밀그램 실제 화면 캡처 원본 |

이미지를 인라인하는 이유는 발행 페이지가 외부 호스트를 못 불러오기 때문이다(CSP).
그래서 하나짜리 HTML 파일이 되고, 용량은 600KB 정도다.

## 고치는 법

```bash
# 1. 본문을 고친다
$EDITOR docs/guide-template.html

# 2. 캡처를 줄여서 임시 폴더에 둔다 (macOS)
cd docs/images
for f in *.png; do sips -s format jpeg -s formatOptions 78 --resampleWidth 1100 "$f" --out "/tmp/w_${f%.png}.jpg"; done

# 3. 최종 HTML을 만든다
cd ../.. && node docs/build-guide.mjs      # → gsd-submit-guide.html
```

만들어진 HTML을 같은 아티팩트 URL로 다시 발행하면 링크가 유지된다.
Claude에게 "이 URL로 가이드 다시 발행해줘" 하고 위 URL을 주면 된다.

## 화면 캡처를 다시 찍을 때

**실제 수강생 이름이 찍히지 않게 한다.** 공개 저장소이고, 발행 페이지도 공유된다.
샘플 제출물(`홍길동 (샘플)`)만 있는 기수 페이지에서 찍는 것이 안전하다.

```bash
node skills/gsd-submit/scripts/capture.mjs "<url>" docs/images/03-builds-list.png
```

로그인이 필요한 화면은 `gsd` 프로파일(로그인된 전용 창)로 찍는다.

```bash
CHROMUX_PROFILE=gsd chromux open g "<url>"
CHROMUX_PROFILE=gsd chromux screenshot g docs/images/04-submission-detail.png --region 64 0 1216 900 --space css
```
