#!/usr/bin/env bash
# 실행 환경 점검. 오늘 처음 노트북을 켠 수강생 기준으로, 아무것도 없다고 가정한다.
#
#   scripts/preflight.sh
#
# 각 항목을 OK / NEED 로 출력하고, NEED가 하나라도 있으면 종료 코드 1을 낸다.
# 해결은 scripts/install.sh 가 자동으로 한다 (밀그램 로그인만 사람이 한다).
set -uo pipefail

ok=0; need=0
say_ok()   { printf '  OK    %s\n' "$1"; ok=$((ok+1)); }
say_need() { printf '  NEED  %s\n' "$1"; need=$((need+1)); }

echo "[1] Node.js 22+"
if command -v node >/dev/null 2>&1; then
  major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  if [ "${major:-0}" -ge 22 ]; then
    say_ok "v$(node -p 'process.versions.node')"
  else
    say_need "v$(node -p 'process.versions.node') — 22 이상이 필요하다"
  fi
else
  say_need "Node.js 미설치"
fi

echo "[2] Google Chrome"
if [ -d "/Applications/Google Chrome.app" ] || command -v google-chrome >/dev/null 2>&1; then
  say_ok "설치됨"
else
  say_need "Chrome 미설치 — chromux는 실제 Chrome이 필요하다"
fi

echo "[3] chromux CLI"
if command -v chromux >/dev/null 2>&1; then
  pkg="$(npm root -g 2>/dev/null)/@team-attention/chromux/package.json"
  ver=$([ -f "$pkg" ] && sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$pkg" | head -1 || echo "?")
  say_ok "설치됨 (v${ver:-?})"
else
  say_need "chromux 미설치 — scripts/install.sh 가 설치한다"
fi

echo "[4] 밀그램 로그인"
if command -v chromux >/dev/null 2>&1; then
  me=$(node "$(dirname "$0")/milgram.mjs" whoami 2>/dev/null)
  if printf '%s' "$me" | grep -q '"email"'; then
    say_ok "$(printf '%s' "$me" | sed -n 's/.*"email": *"\([^"]*\)".*/\1/p')"
  else
    say_need "로그인 안 됨 — scripts/install.sh login 이 로그인 창을 띄운다"
  fi
else
  say_need "chromux가 없어 확인 불가 (3번 먼저 해결)"
fi

echo
echo "OK $ok / NEED $need"
if [ "$need" -eq 0 ]; then
  echo "→ 바로 제출할 수 있다"
else
  echo "→ scripts/install.sh 를 실행해 NEED 항목을 해결한다"
fi
exit $([ "$need" -eq 0 ] && echo 0 || echo 1)
