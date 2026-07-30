// 운영체제 차이를 여기 한 곳에 모아둔다.
//
// 수강생 노트북은 Windows와 macOS가 섞여 있다. 셸 스크립트(.sh)는 Windows에서
// Git for Windows가 없으면 아예 실행되지 않아서(Claude Code가 PowerShell을 쓴다),
// 스크립트를 전부 Node로 옮겼다. Node는 chromux 때문에 어차피 필요하다.

import { existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';

export const IS_WINDOWS = process.platform === 'win32';
export const IS_MAC = process.platform === 'darwin';

/** 설치된 Chrome 실행 파일 경로. 없으면 null. */
export function findChrome() {
  const env = process.env;

  if (IS_WINDOWS) {
    const candidates = [
      env.PROGRAMFILES && join(env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      env['PROGRAMFILES(X86)'] &&
        join(env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
      env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean);
    return candidates.find((p) => existsSync(p)) ?? null;
  }

  if (IS_MAC) {
    const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    return existsSync(p) ? p : null;
  }

  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium']) {
    try {
      return execFileSync('which', [name], { encoding: 'utf8' }).trim() || null;
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

/** 기본 브라우저로 URL을 연다 (설치 안내 페이지 등). */
export function openUrl(url) {
  try {
    if (IS_WINDOWS) {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (IS_MAC) {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* 못 열어도 진행 — 안내 문구에 URL이 함께 나온다 */
  }
}

/** 폴더를 파일 탐색기/Finder로 연다. */
export function openFolder(path) {
  try {
    if (IS_WINDOWS) spawn('explorer', [path], { detached: true, stdio: 'ignore' }).unref();
    else if (IS_MAC) spawn('open', [path], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [path], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* 무시 */
  }
}

/** PATH에서 실행 파일을 찾는다. Windows는 .cmd·.exe 확장자가 붙는다. */
export function which(cmd) {
  try {
    const out = IS_WINDOWS
      ? execFileSync('where', [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      : execFileSync('which', [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).find((l) => l.trim()) ?? null;
  } catch {
    return null;
  }
}

/**
 * npm·chromux·git 처럼 Windows에서 .cmd 래퍼로 설치되는 명령을 실행한다.
 *
 * Windows에서는 Node가 .cmd 를 직접 실행할 수 없어 `cmd /c` 를 거쳐야 한다.
 * `shell: true` 를 쓰면 안 된다 — Node가 인자를 따로 quoting하지 않아서
 * `C:\Users\Chloe Kim\...` 처럼 **공백이 든 경로가 쪼개진다.** 사용자 이름에
 * 공백이 있는 노트북이 흔하다. execFileSync에 배열로 넘기면 Node가 알아서 quoting한다.
 */
export function run(cmd, args, opts = {}) {
  const [bin, binArgs] = IS_WINDOWS ? ['cmd', ['/c', cmd, ...args]] : [cmd, args];
  return execFileSync(bin, binArgs, {
    encoding: 'utf8',
    ...opts,
  });
}
