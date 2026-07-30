#!/usr/bin/env bash
# 제출물 대표 이미지 촬영 — URL을 PNG로 찍는다.
#
# 사용자의 실제 Chrome(live)이 아니라 gsd-shot 이라는 격리 프로파일을 헤드리스로 띄운다.
# 로그인 세션과 무관하고 창도 뜨지 않으므로 작업을 방해하지 않는다.
#
#   capture.sh <url> <out.png> [--wait "화면에 뜨는 문구"] [--full]
#   capture.sh --cleanup                 촬영이 끝나면 프로파일을 정리한다
#
# 여러 장을 찍을 때는 연달아 호출하고 마지막에 --cleanup 을 한 번 부른다.

set -euo pipefail

PROFILE=gsd-shot
SESSION=shot
WIDTH=1440
HEIGHT=900

export CHROMUX_PROFILE="$PROFILE"

if [[ "${1:-}" == "--cleanup" ]]; then
  chromux kill "$PROFILE" >/dev/null 2>&1 || true
  echo "cleaned up"
  exit 0
fi

url="${1:-}"
out="${2:-}"
shift 2 || true

wait_text=""
full=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait) wait_text="${2:-}"; shift 2 ;;
    --full) full=1; shift ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$url" || -z "$out" ]]; then
  echo "usage: capture.sh <url> <out.png> [--wait \"문구\"] [--full]" >&2
  exit 1
fi

chromux launch "$PROFILE" --headless >/dev/null 2>&1 || true

chromux cdp "$SESSION" Emulation.setDeviceMetricsOverride \
  "{\"width\":$WIDTH,\"height\":$HEIGHT,\"deviceScaleFactor\":2,\"mobile\":false}" >/dev/null 2>&1 || true

chromux open "$SESSION" "$url" >/dev/null

# 뷰포트를 확정한 뒤(첫 open 시점엔 세션이 없어 override가 안 먹는다) 한 번 더 적용한다
chromux cdp "$SESSION" Emulation.setDeviceMetricsOverride \
  "{\"width\":$WIDTH,\"height\":$HEIGHT,\"deviceScaleFactor\":2,\"mobile\":false}" >/dev/null 2>&1 || true

if [[ -n "$wait_text" ]]; then
  chromux wait-for-text "$SESSION" "$wait_text" >/dev/null 2>&1 || true
fi

# 폰트·이미지·애니메이션이 자리를 잡을 시간
sleep 2

if [[ "$full" == 1 ]]; then
  # 문서 전체 높이로 뷰포트를 늘려 한 장에 담는다
  page_height=$(chromux run "$SESSION" --page-file /dev/stdin <<'JS' 2>/dev/null | sed -n 's/.*"h": *\([0-9]*\).*/\1/p'
return { h: Math.min(document.documentElement.scrollHeight, 4000) };
JS
)
  if [[ -n "${page_height:-}" ]]; then
    chromux cdp "$SESSION" Emulation.setDeviceMetricsOverride \
      "{\"width\":$WIDTH,\"height\":$page_height,\"deviceScaleFactor\":2,\"mobile\":false}" >/dev/null 2>&1 || true
    sleep 1
  fi
fi

chromux screenshot "$SESSION" "$out" >/dev/null
echo "$out"
