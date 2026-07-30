#!/usr/bin/env node
// 제출물 대표 이미지 촬영 — URL을 PNG로 찍는다.
//
//   node scripts/capture.mjs <url> <out.png> [--wait "화면에 뜨는 문구"] [--full]
//   node scripts/capture.mjs --cleanup            촬영이 끝나면 프로파일을 정리한다
//
// 사용자의 평소 Chrome이 아니라 gsd-shot 이라는 격리 프로파일을 헤드리스로 띄운다.
// 로그인 세션과 무관하고 창도 뜨지 않으므로 작업을 방해하지 않는다.
// 여러 장을 찍을 때는 연달아 호출하고 마지막에 --cleanup 을 한 번 부른다.

import { run } from './platform.mjs';

const PROFILE = 'gsd-shot';
const SESSION = 'shot';
const WIDTH = 1440;
const HEIGHT = 900;

const env = { ...process.env, CHROMUX_PROFILE: PROFILE };
const chromux = (args, opts = {}) =>
  run('chromux', args, { env, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const quiet = (args) => {
  try {
    return chromux(args);
  } catch {
    return '';
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argv = process.argv.slice(2);

if (argv[0] === '--cleanup') {
  quiet(['kill', PROFILE]);
  console.log('cleaned up');
  process.exit(0);
}

const url = argv[0];
const out = argv[1];
let waitText = '';
let full = false;
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === '--wait') waitText = argv[++i] ?? '';
  else if (argv[i] === '--full') full = true;
  else {
    console.error(`알 수 없는 옵션: ${argv[i]}`);
    process.exit(1);
  }
}

if (!url || !out) {
  console.error('usage: node capture.mjs <url> <out.png> [--wait "문구"] [--full]');
  process.exit(1);
}

const metrics = (h) =>
  `{"width":${WIDTH},"height":${h},"deviceScaleFactor":2,"mobile":false}`;

quiet(['launch', PROFILE, '--headless']);
quiet(['cdp', SESSION, 'Emulation.setDeviceMetricsOverride', metrics(HEIGHT)]);

chromux(['open', SESSION, url]);

// 첫 open 시점엔 세션이 없어 override가 안 먹으므로 한 번 더 적용한다
quiet(['cdp', SESSION, 'Emulation.setDeviceMetricsOverride', metrics(HEIGHT)]);

if (waitText) quiet(['wait-for-text', SESSION, waitText]);

// 폰트·이미지·애니메이션이 자리를 잡을 시간
await sleep(2000);

if (full) {
  const res = quiet([
    'run',
    SESSION,
    '-',
    'return { h: Math.min(document.documentElement.scrollHeight, 4000) };',
  ]);
  const h = Number(res.match(/"h":\s*(\d+)/)?.[1]);
  if (h > 0) {
    quiet(['cdp', SESSION, 'Emulation.setDeviceMetricsOverride', metrics(h)]);
    await sleep(1000);
  }
}

chromux(['screenshot', SESSION, out]);
console.log(out);
