#!/usr/bin/env node
// 처음 쓰는 노트북을 준비시킨다. 설치는 전부 자동이고,
// 사람이 할 일은 마지막에 열리는 Chrome 창에서 밀그램 로그인 한 번뿐이다.
//
//   node scripts/install.mjs              전체
//   node scripts/install.mjs chromux      chromux 설치까지만
//   node scripts/install.mjs login        밀그램 로그인만
//
// 로그인을 기다리는 동안 최대 3분 걸린다. 넉넉한 타임아웃으로 실행할 것.
// Windows·macOS 모두에서 돈다.
//
// Node 자체가 없으면 이 스크립트도 못 돈다. Node 설치는 SKILL.md의 안내대로
// (Claude가 OS에 맞는 명령으로) 먼저 처리한다.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, openUrl, which, run, IS_WINDOWS } from './platform.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROMUX_DIR = process.env.CHROMUX_DIR ?? join(homedir(), 'team-attention', 'chromux');
const step = process.argv[2] ?? 'all';

const info = (m) => console.log(`\n▶ ${m}`);
const done = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);

// ---------------------------------------------------------------- Node

function ensureNode() {
  info('Node.js 확인');
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 22) {
    done(`Node v${process.versions.node}`);
    return true;
  }
  warn(`Node v${process.versions.node} — 22 이상이 필요하다`);
  warn('https://nodejs.org 에서 LTS를 설치한 뒤 터미널을 새로 열고 다시 실행할 것');
  openUrl('https://nodejs.org/ko/download');
  return false;
}

// ---------------------------------------------------------------- Chrome

function ensureChrome() {
  info('Google Chrome 확인');
  if (findChrome()) {
    done('설치됨');
    return true;
  }
  warn('Chrome이 없다. 설치 페이지를 연다 — 설치한 뒤 다시 실행할 것');
  openUrl('https://www.google.com/chrome/');
  return false;
}

// ---------------------------------------------------------------- chromux

function ensureChromux() {
  info('chromux 설치 확인');
  if (which('chromux')) {
    done('이미 설치됨');
    return true;
  }

  if (!existsSync(join(CHROMUX_DIR, '.git'))) {
    try {
      mkdirSync(dirname(CHROMUX_DIR), { recursive: true });
      run('git', ['clone', '--depth', '1', 'https://github.com/modakbul-gongbang/chromux', CHROMUX_DIR], {
        stdio: 'inherit',
      });
    } catch {
      warn('chromux 내려받기 실패 — 네트워크를 확인할 것');
      return false;
    }
  }

  try {
    run('npm', ['install', '--silent'], { cwd: CHROMUX_DIR, stdio: 'inherit' });
    run('npm', ['install', '-g', '.', '--silent'], { cwd: CHROMUX_DIR, stdio: 'inherit' });
  } catch {
    warn('npm install -g 실패. 권한 오류라면 관리자 권한 없이 설치되는 Node(nvm 등)를 쓰는 게 쉽다');
    return false;
  }

  if (which('chromux')) {
    done('설치 완료');
    return true;
  }
  warn('설치했지만 chromux 명령을 찾을 수 없다. 터미널을 새로 열고 다시 실행할 것');
  return false;
}

// ---------------------------------------------------------------- 밀그램 로그인

function ensureLogin() {
  info('밀그램 로그인 확인');
  // 로그인이 안 되어 있으면 milgram.mjs 가 전용 Chrome 창을 앞에 띄우고 기다린다
  try {
    execFileSync(process.execPath, [join(HERE, 'milgram.mjs'), 'login'], { stdio: 'inherit' });
    return true;
  } catch {
    warn('로그인이 확인되지 않았다. 다시 실행할 것: node scripts/install.mjs login');
    return false;
  }
}

// ---------------------------------------------------------------- 실행

let okAll = false;
switch (step) {
  case 'chromux':
    okAll = ensureNode() && ensureChrome() && ensureChromux();
    break;
  case 'login':
    okAll = ensureLogin();
    break;
  case 'all':
    okAll = ensureNode() && ensureChrome() && ensureChromux() && ensureLogin();
    break;
  default:
    console.error('usage: node install.mjs [all|chromux|login]');
    process.exit(1);
}

console.log();
console.log(okAll ? '준비 완료 — 이제 제출할 수 있다' : '남은 항목이 있다. 위 안내를 따른 뒤 다시 실행할 것');
process.exit(okAll ? 0 : 1);
