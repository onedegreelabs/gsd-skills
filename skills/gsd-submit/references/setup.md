# 처음 한 번만 하는 세팅

이 스킬은 **당신이 로그인해 둔 Chrome**을 통해 밀그램에 접근한다. 그래서 브라우저를 조작할 도구가
하나 필요하고, 그걸 Chrome에 연결하는 작업을 딱 한 번 해야 한다. 5분이면 끝나고, 다음 기수부터는
아무것도 안 해도 된다.

대부분 자동이다. 먼저 이것부터 돌린다.

```bash
scripts/install.sh
```

무엇이 빠졌는지만 보려면:

```bash
scripts/preflight.sh
```

---

## 1. Node.js 22 이상

`install.sh` 가 Homebrew나 nvm으로 설치한다. 자동 설치가 실패하면
[nodejs.org](https://nodejs.org) 에서 LTS 버전을 받아 설치하고 터미널을 새로 연다.

## 2. Google Chrome

없으면 [google.com/chrome](https://www.google.com/chrome/) 에서 설치한다.
Safari·Arc·Dia 같은 다른 브라우저로는 안 된다.

## 3. chromux

Chrome을 조작하는 도구다. `install.sh` 가 알아서 받아 설치한다.

```bash
git clone https://github.com/modakbul-gongbang/chromux ~/team-attention/chromux
cd ~/team-attention/chromux && npm install && npm install -g .
```

`npm install -g` 에서 권한 오류가 나면 시스템 Node를 쓰고 있다는 뜻이다.
nvm으로 설치한 Node를 쓰면 권한 문제가 없다.

## 4. Chrome 확장 연결 — 여기만 직접 해야 한다

**이 단계만 사람이 해야 한다.** 에이전트는 브라우저 확장을 설치할 수 없다.
`install.sh` 가 필요한 창을 다 열어주고 기다리므로 순서대로만 하면 된다.

1. Chrome에서 `chrome://extensions` (자동으로 열린다)
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 열려 있는 Finder 창에서 `~/team-attention/chromux/extension` 폴더 선택
5. 확장 팝업에 **Connected** 가 뜨면 끝

한 번 해두면 Chrome을 껐다 켜도 자동으로 다시 붙는다.

확인:

```bash
chromux tabs        # 지금 열려 있는 탭 목록이 나오면 성공
```

> 연결되어 있는 동안 Chrome 위쪽에 "chromux가 이 브라우저를 디버깅하고 있습니다" 띠가 보인다.
> 정상이다. 닫으면 연결이 끊긴다.

## 5. 밀그램 로그인

Chrome에서 [milgram.io](https://www.milgram.io) 에 로그인한다.
**GSD 참가 신청에 쓴 그 계정이어야 한다.** 다른 계정으로 로그인되어 있으면 제출이 거부된다.

```bash
node scripts/milgram.mjs whoami     # 이름과 이메일이 나오면 성공
```

---

## 자주 걸리는 것

**`chromux tabs` 가 실패한다**
확장이 로드되지 않았거나 연결이 끊겼다. `chromux pair` 를 다시 실행하고 확장 팝업이
`Connected` 인지 본다.

**`밀그램에 로그인되어 있지 않습니다`**
Chrome에 밀그램 탭이 하나도 없으면 스킬이 백그라운드로 하나 연다. 그래도 안 되면
직접 열어 로그인 상태를 확인한다. 시크릿 창의 로그인은 잡히지 않는다.

**`참가자가 아닙니다` (403)**
로그인한 계정이 그 이벤트에 참가자로 등록되어 있지 않다. 신청에 쓴 이메일과 같은지 확인하고,
같다면 운영자에게 참가 승인을 요청한다. 멘토·심사위원·운영자 계정으로는 제출할 수 없다.

**확장 팝업에 정지 스위치가 켜져 있다**
팝업에서 다시 허용한다.

**Chrome이 아닌 브라우저를 쓴다**
`~/.chromux/config.json` 에 `liveLaunchCmd` 를 설정하면 되지만, 제일 빠른 길은
이 작업 동안만 Chrome을 쓰는 것이다.

## 무엇이 어디에 저장되나

- chromux 설정과 상태: `~/.chromux/`
- live 연결은 **별도 프로파일을 만들지 않는다.** 평소 쓰던 Chrome 그대로다
- 화면 캡처는 `gsd-shot` 이라는 임시 프로파일을 잠깐 띄웠다 지운다. 평소 Chrome과 무관하다
- 밀그램 토큰은 **어디에도 저장하지 않는다.** 제출할 때마다 브라우저에서 새로 읽는다
