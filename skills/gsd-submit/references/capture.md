# 대표 이미지 찍기

제출물에는 **사진이 최소 1장** 있어야 저장된다 (최대 10장). 첫 장이 현황판 목록에 뜨는 얼굴이다.

```bash
scripts/capture.sh <url> out/shot1.png [--wait "화면에 뜨는 문구"] [--full]
scripts/capture.sh --cleanup        # 다 찍고 나서 한 번
```

수강생의 실제 Chrome이 아니라 `gsd-shot` 이라는 격리 프로파일을 **헤드리스**로 띄운다.
창이 뜨지 않고 로그인 세션과도 무관하다. 1440×900 뷰포트에 2배 해상도로 찍는다.

- `--wait` — 그 문구가 보일 때까지 기다린다. 데이터를 불러 그리는 화면에 쓴다
- `--full` — 문서 전체 높이를 한 장에 담는다 (최대 4000px). 랜딩페이지에 어울린다

## 무엇을 찍나

### 배포된 웹 서비스

메인 화면 한 장 + 핵심 기능 화면 1~2장. 3장이면 충분하다.

로그인 뒤에만 볼 수 있는 화면은 격리 프로파일에서 안 열린다. **무리해서 뚫지 않는다** —
랜딩·로그인 화면을 대표로 쓰고, 기능 설명은 글로 채운다.

### 로컬에서만 도는 웹

dev 서버를 띄우고 `http://localhost:3000` 을 찍는다.

```bash
npm run dev &        # 백그라운드로
scripts/capture.sh http://localhost:3000 out/shot1.png --wait "핵심 문구"
```

찍고 나면 서버를 정리한다. 배포 URL이 없으므로 제출물 `links` 는 비운다.

### 웹이 아닌 것 — 업무 자동화, CLI, 스크립트

GSD 제출물의 절반쯤은 웹이 아니다. 이때는 **결과물을 찍는다.** 코드 화면은 찍지 않는다.

| 만든 것 | 찍을 것 |
|---|---|
| 스프레드시트를 채우는 자동화 | 채워진 구글 시트 |
| 리포트 생성기 | 만들어진 리포트 문서·PDF |
| 슬랙·메일 봇 | 실제로 도착한 메시지 |
| 데이터 수집기 | 수집된 데이터를 띄운 화면 |

공개 URL이 있으면 `capture.sh` 로 찍고, 화면에만 있으면 macOS 기본 명령으로 찍는다.

```bash
screencapture -x out/shot1.png            # 전체 화면 (조용히)
screencapture -x -R 0,0,1440,900 out/shot1.png   # 영역 지정
```

**개인정보가 찍히지 않는지 본다.** 이 이미지는 이벤트 페이지에 공개된다.
실제 고객 이름·연락처·매출이 들어간 화면이면 더미 데이터로 바꿔 다시 찍거나 그 부분을 가린다.
찍은 뒤 반드시 열어서 확인한다.

### 아무것도 찍을 게 없을 때

마지막 수단으로 요약 카드를 만든다. HTML을 헤드리스 Chrome으로 렌더한다.

```bash
cat > out/card.html <<'HTML'
<html><body style="margin:0;width:1200px;height:630px;display:flex;flex-direction:column;
  justify-content:center;padding:80px;box-sizing:border-box;
  font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;
  background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff">
  <div style="font-size:20px;opacity:.6;letter-spacing:2px">GSD 42기</div>
  <div style="font-size:64px;font-weight:800;margin:16px 0">서비스 이름</div>
  <div style="font-size:28px;opacity:.8;line-height:1.5">한 줄 소개</div>
</body></html>
HTML

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --screenshot=out/shot1.png --window-size=1200,630 \
  "file://$PWD/out/card.html"
```

카드만 올리는 건 마지막 선택지다. 실제 결과물 사진이 언제나 낫다.

## 확인

올리기 전에 찍은 이미지를 **직접 열어본다.** 로딩 스피너만 찍히거나, 쿠키 배너가 화면을 덮거나,
다크모드로 까맣게 나오는 일이 흔하다. 그런 이미지가 목록의 얼굴이 되면 안 된다.

쿠키·동의 배너가 가리면 `--wait` 로 조금 기다렸다 찍거나, 배너가 없는 하위 페이지를 찍는다.
