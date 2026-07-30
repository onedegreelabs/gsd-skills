# 처음 한 번만 하는 세팅

이 스킬은 제출 전용 Chrome 창을 하나 띄워 밀그램에 접근한다. 평소 쓰는 브라우저는 건드리지 않는다.
설치는 전부 자동이고, **사람이 할 일은 그 창에서 밀그램 로그인 한 번뿐이다.**
로그인 세션은 남아 있으므로 다음 기수부터는 아무것도 안 해도 된다.

```bash
node scripts/install.mjs          # 전부 알아서 한다. 마지막에 로그인 창이 열린다
```

무엇이 빠졌는지만 보려면:

```bash
node scripts/preflight.mjs
```

---

## Windows·macOS 모두에서 돈다

스크립트는 전부 Node(`.mjs`)로 되어 있다. 셸 스크립트(`.sh`)를 쓰지 않는 이유는
Windows에서 Git for Windows가 없으면 Claude Code가 PowerShell을 쓰기 때문에
`.sh` 가 아예 실행되지 않기 때문이다. Node는 chromux 때문에 어차피 필요하다.

OS별로 다른 부분(Chrome 경로, URL 열기, 폴더 열기)은 `scripts/platform.mjs` 한 곳에 모여 있다.

## 자동으로 되는 것

**1. Google Chrome** — 없으면 설치 페이지가 열린다. [google.com/chrome](https://www.google.com/chrome/)

**2. chromux** — Chrome을 조작하는 도구. 알아서 받아 설치한다.
`npm install -g` 에서 권한 오류가 나면 관리자 권한 없이 설치되는 Node를 쓰는 게 가장 쉽다
(Windows는 [nodejs.org](https://nodejs.org) 설치본, macOS는 nvm이나 Homebrew).

> **Node.js 22+ 는 미리 있어야 한다.** 스크립트 자체가 Node로 돌기 때문이다.
> 없으면 [nodejs.org](https://nodejs.org) 에서 LTS를 설치하고 **터미널을 새로 연 뒤** 다시 실행한다.
> Windows는 `winget install OpenJS.NodeJS.LTS`, macOS는 `brew install node` 도 된다.

## 사람이 하는 것 — 밀그램 로그인 (1번)

설치가 끝나면 Chrome 창이 하나 열리고 이번 기수 이벤트 페이지가 뜬다.
거기서 밀그램에 로그인하면 끝이다.

- **이미 GSD 참가 신청을 했다면 그때 쓴 계정**으로 로그인한다.
  신청을 안 했으면 아무 계정이나 괜찮다 — 참가 신청까지 스킬이 대신 한다
- 이 창은 제출 전용 프로파일이라 평소 브라우저의 로그인과 무관하다
- 구글 로그인이 "안전하지 않은 브라우저" 라며 막히면 **이메일 로그인**을 쓴다

확인:

```bash
node scripts/milgram.mjs whoami     # 이름과 이메일이 나오면 성공
```

---

## 자주 걸리는 것

**`밀그램에 로그인되어 있지 않습니다`**
`node scripts/milgram.mjs login` 을 실행하면 로그인 창이 다시 열린다.

**로그인했는데도 인식이 안 된다**
평소 쓰는 Chrome이 아니라 **새로 열린 전용 창**에서 로그인해야 한다.
평소 브라우저에 로그인돼 있어도 소용없다.

**`참가자가 아닙니다` (403)**
로그인한 계정이 그 이벤트에 참가자로 등록되어 있지 않다. 신청에 쓴 이메일과 같은지 확인하고,
같다면 운영자에게 참가 승인을 요청한다. 멘토·심사위원·운영자 계정으로는 제출할 수 없다.

**구글 로그인이 막힌다**
자동화 도구가 띄운 Chrome에서는 구글이 로그인을 막을 때가 있다.
밀그램의 이메일 로그인을 쓰면 된다.

## 무엇이 어디에 저장되나

- chromux 설정과 프로파일: `~/.chromux/`
- 밀그램 로그인 세션: 전용 프로파일(`gsd`) 안. 평소 Chrome과 완전히 분리돼 있다
- 화면 캡처는 `gsd-shot` 프로파일을 잠깐 띄웠다 지운다
- 밀그램 토큰은 **파일로 저장하지 않는다.** 제출할 때마다 프로파일에서 새로 읽는다
