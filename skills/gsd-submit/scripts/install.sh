#!/usr/bin/env bash
# 처음 쓰는 맥을 준비시킨다. 자동으로 되는 건 자동으로 하고,
# 사람만 할 수 있는 두 가지(Chrome 확장 로드, 밀그램 로그인)는 화면을 열어주고 기다린다.
#
#   scripts/install.sh              전체
#   scripts/install.sh chromux      chromux 설치까지만
#   scripts/install.sh pair         브릿지 연결(확장 로드)까지만
#   scripts/install.sh login        밀그램 로그인 대기만
#
# 오래 걸린다(확장 로드를 기다리는 동안 최대 3분). 넉넉한 타임아웃으로 실행할 것.
set -uo pipefail

CHROMUX_DIR="${CHROMUX_DIR:-$HOME/team-attention/chromux}"
STEP="${1:-all}"

info() { printf '\n▶ %s\n' "$1"; }
done_() { printf '  ✓ %s\n' "$1"; }
warn() { printf '  ! %s\n' "$1"; }

# ---------------------------------------------------------------- Node

ensure_node() {
  info "Node.js 확인"
  local major=0
  command -v node >/dev/null 2>&1 && major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)

  if [ "${major:-0}" -ge 22 ]; then
    done_ "Node v$(node -p 'process.versions.node')"
    return 0
  fi

  warn "Node 22 이상이 필요하다. 설치를 시도한다"

  if command -v brew >/dev/null 2>&1; then
    brew install node && done_ "Homebrew로 설치했다" && return 0
  fi

  # nvm은 관리자 권한이 필요 없어서 비개발자 맥에서도 통한다
  if [ ! -d "$HOME/.nvm" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash || true
  fi
  # shellcheck disable=SC1090
  [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm install 22 && nvm alias default 22

  if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then
    done_ "Node v$(node -p 'process.versions.node')"
    return 0
  fi

  warn "Node 자동 설치에 실패했다. https://nodejs.org 에서 LTS를 설치한 뒤 다시 실행할 것"
  return 1
}

# ---------------------------------------------------------------- Chrome

ensure_chrome() {
  info "Google Chrome 확인"
  if [ -d "/Applications/Google Chrome.app" ] || command -v google-chrome >/dev/null 2>&1; then
    done_ "설치됨"
    return 0
  fi
  warn "Chrome이 없다. 설치 페이지를 연다 — 설치한 뒤 다시 실행할 것"
  open "https://www.google.com/chrome/" 2>/dev/null || true
  return 1
}

# ---------------------------------------------------------------- chromux

ensure_chromux() {
  info "chromux 설치 확인"
  if command -v chromux >/dev/null 2>&1; then
    done_ "이미 설치됨"
    return 0
  fi

  if [ ! -d "$CHROMUX_DIR/.git" ]; then
    mkdir -p "$(dirname "$CHROMUX_DIR")"
    git clone --depth 1 https://github.com/modakbul-gongbang/chromux "$CHROMUX_DIR" || {
      warn "chromux 내려받기 실패 — 네트워크를 확인할 것"
      return 1
    }
  fi

  (cd "$CHROMUX_DIR" && npm install --silent && npm install -g . --silent) || {
    warn "npm install -g 실패. 권한 문제라면 nvm으로 설치한 Node를 쓰는 게 가장 쉽다"
    return 1
  }

  command -v chromux >/dev/null 2>&1 && done_ "설치 완료" && return 0
  warn "설치했지만 chromux 명령을 찾을 수 없다. 터미널을 새로 열고 다시 실행할 것"
  return 1
}

# ---------------------------------------------------------------- live 브릿지

ensure_pair() {
  info "내 Chrome에 연결 (live 브릿지)"
  if chromux tabs >/dev/null 2>&1; then
    done_ "이미 연결됨"
    return 0
  fi

  chromux pair >/dev/null 2>&1 &

  cat <<EOF

  ── 여기만 직접 해야 한다 (30초) ────────────────────────────
  Chrome 확장 관리 화면과 확장 폴더를 열어뒀다.

   1. 확장 화면 오른쪽 위 [개발자 모드] 를 켠다
   2. [압축해제된 확장 프로그램을 로드합니다] 를 누른다
   3. 방금 열린 Finder 창의 extension 폴더를 고른다

  ─────────────────────────────────────────────────────────
EOF

  open -a "Google Chrome" "chrome://extensions" 2>/dev/null || true
  open "$CHROMUX_DIR/extension" 2>/dev/null || true

  printf '  연결을 기다리는 중'
  for _ in $(seq 1 60); do
    if chromux tabs >/dev/null 2>&1; then
      printf '\n'
      done_ "연결됨"
      return 0
    fi
    printf '.'
    sleep 3
  done

  printf '\n'
  warn "3분 안에 연결되지 않았다. 확장 팝업이 Connected 인지 확인하고 다시 실행할 것"
  return 1
}

# ---------------------------------------------------------------- 밀그램 로그인

ensure_login() {
  info "밀그램 로그인 확인"
  local me
  me=$(node "$(dirname "$0")/milgram.mjs" whoami 2>/dev/null)
  if printf '%s' "$me" | grep -q '"email"'; then
    done_ "$(printf '%s' "$me" | sed -n 's/.*"email": *"\([^"]*\)".*/\1/p')"
    return 0
  fi

  warn "로그인되어 있지 않다. 로그인 페이지를 연다 — GSD 신청에 쓴 계정으로 로그인할 것"
  open -a "Google Chrome" "https://www.milgram.io/ko" 2>/dev/null || true

  printf '  로그인을 기다리는 중'
  for _ in $(seq 1 40); do
    me=$(node "$(dirname "$0")/milgram.mjs" whoami 2>/dev/null)
    if printf '%s' "$me" | grep -q '"email"'; then
      printf '\n'
      done_ "$(printf '%s' "$me" | sed -n 's/.*"email": *"\([^"]*\)".*/\1/p')"
      return 0
    fi
    printf '.'
    sleep 3
  done

  printf '\n'
  warn "로그인이 확인되지 않았다. 로그인한 뒤 다시 실행할 것"
  return 1
}

# ---------------------------------------------------------------- 실행

case "$STEP" in
  chromux) ensure_node && ensure_chrome && ensure_chromux ;;
  pair)    ensure_pair ;;
  login)   ensure_login ;;
  all)     ensure_node && ensure_chrome && ensure_chromux && ensure_pair && ensure_login ;;
  *)       echo "usage: install.sh [all|chromux|pair|login]" >&2; exit 1 ;;
esac

status=$?
echo
if [ $status -eq 0 ]; then
  echo "준비 완료 — 이제 제출할 수 있다"
else
  echo "남은 항목이 있다. 위 안내를 따른 뒤 다시 실행할 것"
fi
exit $status
