#!/usr/bin/env node
// 실행 환경 점검. 오늘 처음 노트북을 켠 수강생 기준으로, 아무것도 없다고 가정한다.
//
//   node scripts/preflight.mjs
//
// 각 항목을 OK / NEED 로 출력하고, NEED가 하나라도 있으면 종료 코드 1을 낸다.
// 해결은 scripts/install.mjs 가 자동으로 한다 (밀그램 로그인만 사람이 한다).
//
// Windows·macOS 모두에서 돈다. Node로 짠 이유는 platform.mjs 주석 참고.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, which, run, IS_WINDOWS } from './platform.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

let ok = 0;
let need = 0;
const sayOk = (m) => {
  console.log(`  OK    ${m}`);
  ok++;
};
const sayNeed = (m) => {
  console.log(`  NEED  ${m}`);
  need++;
};

// [1] Node — 이 스크립트가 돌고 있다는 건 Node가 있다는 뜻이니 버전만 본다
console.log('[1] Node.js 22+');
const major = Number(process.versions.node.split('.')[0]);
if (major >= 22) sayOk(`v${process.versions.node}`);
else sayNeed(`v${process.versions.node} — 22 이상이 필요하다`);

// [2] Chrome
console.log('[2] Google Chrome');
const chrome = findChrome();
if (chrome) sayOk('설치됨');
else sayNeed('Chrome 미설치 — chromux는 실제 Chrome이 필요하다');

// [3] chromux
console.log('[3] chromux CLI');
if (which('chromux')) {
  let ver = '?';
  try {
    const root = run('npm', ['root', '-g'], { stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const pkg = join(root, '@team-attention', 'chromux', 'package.json');
    if (existsSync(pkg)) ver = JSON.parse(readFileSync(pkg, 'utf8')).version ?? '?';
  } catch {
    /* 버전을 못 읽어도 설치는 된 것 */
  }
  sayOk(`설치됨 (v${ver})`);
} else {
  sayNeed('chromux 미설치 — node scripts/install.mjs 가 설치한다');
}

// [4] 밀그램 로그인
console.log('[4] 밀그램 로그인');
if (which('chromux')) {
  let me = '';
  try {
    me = execFileSync(process.execPath, [join(HERE, 'milgram.mjs'), 'whoami'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    /* 로그인 안 된 상태 */
  }
  const email = me.match(/"email":\s*"([^"]+)"/)?.[1];
  if (email) sayOk(email);
  else sayNeed('로그인 안 됨 — node scripts/install.mjs login 이 로그인 창을 띄운다');
} else {
  sayNeed('chromux가 없어 확인 불가 (3번 먼저 해결)');
}

console.log();
console.log(`OK ${ok} / NEED ${need}`);
console.log(need === 0 ? '→ 바로 제출할 수 있다' : '→ node scripts/install.mjs 를 실행해 NEED 항목을 해결한다');
process.exit(need === 0 ? 0 : 1);
