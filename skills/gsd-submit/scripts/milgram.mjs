#!/usr/bin/env node
// 밀그램 제출물 등록 CLI
//
// 밀그램에 공개 API 문서는 없지만 프론트가 api.milgram.io REST를 그대로 쓴다.
// 이 스크립트는 UI를 클릭하지 않고 그 API를 직접 호출한다. 클릭 자동화보다 훨씬 덜 깨진다.
//
// 인증: chromux 격리 프로파일(`gsd`)로 전용 Chrome을 띄워 /api/auth/session 에서
//       accessToken을 읽는다. 로그인이 안 되어 있으면 창을 앞에 띄우고 로그인을 기다린다.
//       로그인 세션은 프로파일에 남으므로 로그인은 사실상 한 번이다.
//       사용자의 평소 Chrome은 건드리지 않고, 확장 설치도 필요 없다.
//       토큰은 이 프로세스의 메모리에만 있고 파일에 쓰거나 출력하지 않는다.
//
// 명령:
//   login                      전용 창을 띄워 밀그램 로그인 (최초 1회)
//   whoami                     로그인 계정 확인 (로그인 안 돼 있으면 실패만 알림)
//   today                      오늘 열린 GSD 이벤트 찾기
//   questions [eventId]        참가신청서 질문·선택지 확인
//   register [eventId] [카테고리...]  참가 신청 (이미 했으면 그냥 확인만)
//   status [eventId]           참가 상태 · 내 제출물 · 빈 슬롯 · 마감 시각
//   submit <payload.json>      참가 신청(필요하면) → 등록/갱신 → 제출까지
//   delete <eventId> <buildId> 등록 취소 (테스트 정리용)
//   get <path>                 임의 GET (디버깅)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { markdownToDescription } from './md-to-tiptap.mjs';

const API = 'https://api.milgram.io';
const PROFILE = 'gsd'; // 전용 Chrome 프로파일 — 로그인 세션이 여기 남는다
const SESSION = 'auth';
const COMMUNITY_ID = 'c91c74be-c428-4293-bb6e-5024f4e97241'; // GSD (Get Ship Done) Club
const MAX_IMAGES = 10;
const LOGIN_WAIT_SECONDS = 180;
// https://www.milgram.io/ko (루트) 는 onedegreelabs.io 마케팅 사이트로 리다이렉트된다.
// 세션 확인용 탭은 반드시 실제 앱 화면으로 열어야 한다.
const DEFAULT_MILGRAM_URL = 'https://www.milgram.io/ko/community/getshipdoneclub/events';

// ---------------------------------------------------------------- chromux

function chromux(args, { quiet = true } = {}) {
  return execFileSync('chromux', args, {
    env: { ...process.env, CHROMUX_PROFILE: PROFILE },
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function parseJsonOutput(out) {
  const start = out.indexOf('{');
  if (start < 0) throw new Error(`chromux 응답을 해석할 수 없습니다: ${out.slice(0, 200)}`);
  return JSON.parse(out.slice(start));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 전용 프로파일을 띄운다. 이미 떠 있으면 그대로 쓴다. */
function launchProfile({ headless }) {
  try {
    chromux(['launch', PROFILE, ...(headless ? ['--headless'] : [])]);
  } catch {
    /* 이미 실행 중이면 에러가 나도 그대로 쓴다 */
  }
}

function killProfile() {
  try {
    chromux(['kill', PROFILE]);
  } catch {
    /* 안 떠 있으면 그만 */
  }
}

/** 탭을 연다 (또는 이동시킨다). 로그인 대기 중에는 절대 다시 부르면 안 된다 — 진행 중인
 *  로그인 흐름(구글 리다이렉트 등)을 이 URL로 되돌려 버려서 로그인이 끊긴다. */
function openMilgramTab({ foreground = false, url = DEFAULT_MILGRAM_URL } = {}) {
  chromux(['open', ...(foreground ? [] : ['--background']), SESSION, url]);
  // 새로 만든 프로파일은 Accept-Language가 en이라 /ko 로 들어가도 /en 으로 리다이렉트된다.
  // 로그인 창이 영어로 뜨면 수강생이 헤매므로 한국어로 고정한다.
  try {
    chromux([
      'cdp',
      SESSION,
      'Network.setExtraHTTPHeaders',
      '{"headers":{"Accept-Language":"ko-KR,ko;q=0.9"}}',
    ]);
    chromux(['open', SESSION, url]); // 헤더를 적용한 상태로 한 번 더
  } catch {
    /* 헤더 설정이 안 되면 영어로라도 진행한다 */
  }
}

/**
 * 지금 열려 있는 탭에서 세션만 읽는다. **탐색(navigate)하지 않는다.**
 * 로그인 흐름 중간(구글 로그인 페이지 등)에 불러도 탭을 건드리지 않고,
 * milgram.io가 아닌 origin이면 fetch가 실패해 token: null 로 조용히 돌아온다.
 */
function peekSession() {
  const file = join(tmpdir(), `gsd-auth-${randomUUID()}.js`);
  writeFileSync(
    file,
    `const s = await fetch('/api/auth/session', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
     return {
       token: s && s.accessToken ? s.accessToken : null,
       user: s && s.user ? { id: s.user.id, name: s.user.name, email: s.user.email } : null,
     };`,
  );
  try {
    return parseJsonOutput(chromux(['run', SESSION, '--page-file', file]));
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* 지워지지 않아도 진행 */
    }
  }
}

/** 로그인시켜 둘 페이지 — 오늘 기수 이벤트가 있으면 그 페이지 (공개 API, 로그인 불필요) */
async function loginPageUrl() {
  const fallback = 'https://www.milgram.io/ko/community/getshipdoneclub/events';
  try {
    const res = await fetch(`${API}/communities/${COMMUNITY_ID}/events?limit=100`);
    const events = (await res.json())?.data?.data ?? [];
    const today = kstDateString(new Date());
    const dated = events
      .filter((e) => e.startAt)
      .map((e) => ({ id: e.id, day: kstDateString(new Date(e.startAt)) }));
    const pick =
      dated.find((e) => e.day === today) ??
      dated.filter((e) => e.day > today).sort((a, b) => a.day.localeCompare(b.day))[0];
    return pick ? `https://www.milgram.io/ko/event/${pick.id}` : fallback;
  } catch {
    return fallback;
  }
}

let cachedAuth = null;

/**
 * { token, user } — 프로세스 메모리에만 둔다.
 *
 * interactive: 로그인이 안 되어 있을 때 창을 앞에 띄우고 로그인을 기다릴지.
 * 조용히 확인만 할 곳(preflight의 whoami)은 false로 부른다.
 */
async function auth({ interactive = true } = {}) {
  if (cachedAuth) return cachedAuth;

  // 1) 조용히 확인 — 이미 로그인돼 있으면 창을 띄울 필요가 없다
  launchProfile({ headless: true });
  let result;
  try {
    openMilgramTab();
    result = peekSession();
  } catch (e) {
    // 프로파일이 headed로 이미 떠 있는 등 상태가 꼬였으면 리셋 후 한 번 더
    killProfile();
    launchProfile({ headless: true });
    openMilgramTab();
    result = peekSession();
  }
  if (result.token) {
    cachedAuth = result;
    return cachedAuth;
  }

  if (!interactive) {
    fail(
      '밀그램에 로그인되어 있지 않습니다.\n' +
        'node scripts/milgram.mjs login 을 실행하면 로그인 창이 열립니다.',
    );
  }

  // 2) 로그인 창을 앞에 띄우고 기다린다
  killProfile(); // headless를 내리고 창이 보이게 다시 띄운다
  launchProfile({ headless: false });
  const url = await loginPageUrl();

  process.stderr.write(
    '\n── 밀그램 로그인이 필요합니다 ──────────────────────\n' +
      '방금 열린 Chrome 창에서 로그인해 주세요.\n' +
      'GSD 참가 신청에 쓴 계정으로 로그인해야 합니다.\n' +
      '(구글 로그인이 막히면 이메일 로그인을 이용하세요)\n' +
      '──────────────────────────────────────────────\n로그인을 기다리는 중',
  );

  openMilgramTab({ foreground: true, url }); // 여기서 딱 한 번만 이동한다
  for (let i = 0; i < LOGIN_WAIT_SECONDS / 3; i++) {
    await sleep(3000);
    process.stderr.write('.');
    try {
      result = peekSession(); // 탐색 없이 지금 화면 그대로 확인 — 로그인 흐름을 방해하지 않는다
      if (result.token) {
        process.stderr.write(`\n로그인 확인: ${result.user?.email ?? ''}\n`);
        cachedAuth = result;
        return cachedAuth;
      }
    } catch {
      /* 페이지 이동 중이면 다음 턴에 다시 */
    }
  }

  process.stderr.write('\n');
  fail(`${LOGIN_WAIT_SECONDS / 60}분 안에 로그인이 확인되지 않았습니다. 로그인한 뒤 다시 실행하세요.`);
}

// ---------------------------------------------------------------- API

async function api(method, path, body) {
  const { token } = await auth();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw Object.assign(new Error(explainError(res.status, json, path)), {
      status: res.status,
      body: json ?? text,
    });
  }
  return json?.data ?? json;
}

function explainError(status, json, path) {
  const raw = json?.message ?? json?.error ?? '';
  const detail = Array.isArray(raw) ? raw.join(', ') : String(raw);

  if (status === 401) return '밀그램 로그인 세션이 만료됐습니다. 브라우저에서 다시 로그인하세요.';
  if (status === 403) {
    if (/participants can join/i.test(detail))
      return (
        '이 계정은 이벤트의 "참가자"가 아닙니다. 멘토·심사위원·운영자 계정으로는 제출물을 등록할 수 없습니다.\n' +
        '이벤트에 참가 신청이 승인된 계정으로 로그인했는지 확인하세요.'
      );
    if (/approved participants/i.test(detail))
      return '이벤트 참가 신청이 승인되지 않았습니다. 운영자에게 문의하세요.';
    return `권한이 없습니다: ${detail}`;
  }
  if (status === 409 && /already belongs to a build/i.test(detail))
    return '이미 다른 팀에 소속되어 있습니다. 한 이벤트에서는 한 팀에만 속할 수 있습니다.';
  if (status === 400 && /submission image/i.test(detail))
    return '제출물 사진이 최소 1장 필요합니다.';
  if (status === 400 && /description/i.test(detail)) return '제출물 설명이 비어 있습니다.';
  if (/closed|deadline/i.test(detail)) return `제출 기간이 아닙니다: ${detail}`;

  return `밀그램 API 오류 (${status}) ${path}${detail ? ` — ${detail}` : ''}`;
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/** 로컬 파일을 올리고 { key, url } 을 받는다. */
async function uploadFile(path) {
  const abs = resolve(path);
  const size = statSync(abs).size;
  if (size > 20 * 1024 * 1024) fail(`이미지가 너무 큽니다 (${(size / 1e6).toFixed(1)}MB): ${abs}`);

  const { token } = await auth();
  const type = MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream';
  const form = new FormData();
  form.append('file', new Blob([readFileSync(abs)], { type }), basename(abs));

  const res = await fetch(`${API}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(explainError(res.status, json, '/files/upload'));

  const data = json?.data ?? {};
  if (!data.url && !data.key) throw new Error(`업로드 응답에 URL이 없습니다: ${JSON.stringify(json)}`);
  return { key: data.key ?? null, url: data.url ?? data.key };
}

// ---------------------------------------------------------------- 조회

const asArray = (v) => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []);

/** KST 기준 오늘 시작하는 GSD 이벤트. */
async function findTodayEvent() {
  const events = asArray(await api('GET', `/communities/${COMMUNITY_ID}/events?limit=100`));
  const today = kstDateString(new Date());

  const todays = events.filter((e) => {
    const start = e.startDate ?? e.startAt ?? e.startTime;
    return start && kstDateString(new Date(start)) === today;
  });

  return { today, events, matches: todays };
}

function kstDateString(date) {
  return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- 참가 신청

/** 내 참가 기록. 신청하지 않았으면 null. */
async function myParticipant(eventId) {
  try {
    return await api('GET', `/events/${eventId}/participants/me`);
  } catch (error) {
    if (error.status === 404 || error.status === 403) return null;
    throw error;
  }
}

/**
 * 참가신청서의 선택형 질문에 답을 만든다.
 *
 * 옵션 문구는 기수마다 조금씩 다르다(40기는 '기타'가 'Other'였다). 그래서 payload에서 받은
 * 카테고리를 실제 옵션 목록과 맞춰 본 뒤 넣는다. 못 맞추면 '기타'류 옵션으로 떨어진다.
 */
function pickOptions(options, wanted) {
  const values = options.map((o) => o.value);
  const norm = (s) => String(s).toLowerCase().replace(/[\s·・.,()&/-]/g, '');

  const picked = [];
  for (const w of wanted) {
    const exact = values.find((v) => v === w);
    if (exact) {
      picked.push(exact);
      continue;
    }
    const loose = values.find((v) => norm(v) === norm(w) || norm(v).includes(norm(w)) || norm(w).includes(norm(v)));
    if (loose) picked.push(loose);
  }

  if (picked.length) return [...new Set(picked)];

  // 아무것도 못 맞췄으면 '기타' 계열로
  const other = options.find((o) => o.isOther) ?? options.at(-1);
  return other ? [other.value] : [];
}

/** 참가신청서 답안을 만든다. 사람이 직접 답해야 하는 질문이 있으면 알려준다. */
async function buildRegistrationAnswers(eventId, categories) {
  let form;
  try {
    form = await api('GET', `/events/${eventId}/registration-form/questions`);
  } catch {
    return { answers: {}, blocked: [] };
  }

  const questions = form?.questions ?? [];
  const answers = {};
  const blocked = [];

  for (const q of questions) {
    if (!q.required) continue;

    if (q.type === 'choice') {
      const options = q.choice?.options ?? [];
      const picked = pickOptions(options, categories);
      if (!picked.length) {
        blocked.push(q.title);
        continue;
      }
      // CHECKBOX는 배열, RADIO·DROP_DOWN은 문자열
      answers[q.questionId] = q.choice?.type === 'CHECKBOX' ? picked : picked[0];
      continue;
    }

    // 약관 동의나 서술형은 대신 답하지 않는다 — 본인이 직접 해야 한다
    blocked.push(q.title);
  }

  return { answers, blocked };
}

/**
 * 제출할 수 있는 상태로 만든다. 신청을 안 했으면 대신 신청해 준다.
 * 수강생은 이미 교육에 참가한 사람이라, 신청 누락은 절차 문제일 뿐이므로 막지 않고 처리한다.
 */
async function ensureParticipant(eventId, categories = []) {
  const me = await myParticipant(eventId);

  // 신청을 취소하거나 거절된 이력이 있으면 기록은 남고 상태만 바뀐다 — 이때는 다시 신청한다
  const needsFreshRegistration = !me || me.status === 'cancelled' || me.status === 'rejected';

  if (me && !needsFreshRegistration) {
    if (me.status !== 'approved') {
      fail(
        `참가 신청이 승인 대기 중입니다 (상태: ${me.status}).\n` +
          '운영진(지팡이)에게 승인을 요청한 뒤 다시 실행하세요.',
      );
    }
    const type = me.hackathonParticipantType;
    if (type && type !== 'participant') {
      fail(
        `이 계정은 참가자 유형이 '${type}' 입니다. 제출물은 '참가자' 유형만 등록할 수 있습니다.\n` +
          '운영진(지팡이)에게 유형 변경을 요청하세요.',
      );
    }
    if (!type) {
      fail(
        '이 계정에 참가자 유형이 지정되어 있지 않아 제출물을 등록할 수 없습니다.\n' +
          "운영진(지팡이)에게 참가자 유형을 '참가자'로 지정해 달라고 요청하세요.",
      );
    }
    return { registered: false, participantId: me.id };
  }

  // 신청 이력이 없거나 취소·거절 상태다 — 대신 신청한다
  const event = await api('GET', `/events/${eventId}`);
  const ticketId = event?.tickets?.[0]?.id;
  if (!ticketId) fail('이벤트에 신청 가능한 티켓이 없습니다. 운영진에게 문의하세요.');

  const { answers, blocked } = await buildRegistrationAnswers(eventId, categories);
  if (blocked.length) {
    fail(
      '참가신청서에 직접 답해야 하는 항목이 있어 대신 신청할 수 없습니다:\n' +
        blocked.map((t) => `  - ${t}`).join('\n') +
        `\n\n이벤트 페이지에서 참가 신청을 먼저 해주세요:\n  https://www.milgram.io/ko/event/${eventId}`,
    );
  }

  process.stderr.write(
    me?.status === 'cancelled'
      ? '참가 신청이 취소된 상태라 다시 신청합니다\n'
      : '참가 신청이 안 되어 있어 대신 신청합니다\n',
  );
  const result = await api('POST', `/events/${eventId}/register`, {
    ticketId,
    hackathonParticipantType: 'participant',
    registrationAnswers: answers,
  });

  if (result?.status && result.status !== 'approved') {
    fail(
      `참가 신청은 접수됐지만 승인 대기 상태입니다 (${result.status}).\n` +
        '운영진(지팡이)에게 승인을 요청한 뒤 다시 실행하세요.',
    );
  }

  return { registered: true, participantId: result?.id ?? null, answers };
}

async function slotState(eventId) {
  const res = await api('GET', `/events/${eventId}/build-slots?limit=50`);
  const rows = asArray(res);
  const mine = rows.find((r) => r.build?.isMine || r.build?.isMember);
  const empty = rows.filter((r) => r.isEmpty);
  return {
    rows,
    myBuild: mine?.build ?? null,
    mySlotOrder: mine?.displayOrder ?? null,
    firstEmptySlotId: empty[0]?.slotId ?? null,
    emptyCount: empty.length,
    totalSlots: res?.activeSlotCount ?? rows.length,
    viewerRole: res?.viewerRole ?? null,
  };
}

// ---------------------------------------------------------------- 제출

async function submit(payloadPath) {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
  const payloadDir = dirname(resolve(payloadPath));
  // payload.json 안의 상대 경로는 payload.json이 있는 폴더 기준이다 — 실행 위치(cwd)와 무관하게
  const near = (p) => resolve(payloadDir, p);

  const eventId = payload.eventId ?? (await resolveEventId());
  const title = required(payload.title, 'title');

  // GSD 관례상 팀명은 만든 사람 이름이다. 지어낸 팀명이 들어가지 않도록 프로필 이름을 기본값으로
  // 쓰고, 다른 값이 들어오면 그대로 진행하되 눈에 띄게 알린다 (마감 직전에 막지는 않는다).
  const profileName = (await auth()).user?.name?.trim() || '';
  const teamName = String(payload.teamName ?? '').trim() || profileName;
  if (!teamName) fail('팀명을 정할 수 없습니다. payload에 teamName(참가자 이름)을 넣어주세요.');
  if (profileName && teamName !== profileName) {
    process.stderr.write(
      `주의: 팀명이 밀그램 프로필 이름과 다릅니다 ("${teamName}" ≠ "${profileName}").\n` +
        '      GSD 제출물의 팀명은 만든 사람 이름으로 등록하는 것이 관례입니다.\n',
    );
  }

  const markdown = payload.descriptionFile
    ? readFileSync(near(payload.descriptionFile), 'utf8')
    : payload.descriptionMarkdown;
  if (!markdown?.trim()) fail('descriptionMarkdown 또는 descriptionFile 이 필요합니다.');
  const description = markdownToDescription(markdown);

  const imagePaths = (payload.images ?? []).map(near);
  if (!imagePaths.length) fail('제출물 사진이 최소 1장 필요합니다 (images).');
  if (imagePaths.length > MAX_IMAGES) fail(`제출물 사진은 최대 ${MAX_IMAGES}장입니다.`);

  // 참가 신청이 안 되어 있으면 대신 신청한다 (참가신청서 답까지 payload의 categories로)
  const categories = [payload.categories ?? payload.category ?? []].flat().filter(Boolean);
  const registration = await ensureParticipant(eventId, categories);

  const state = await slotState(eventId);

  // 이미지 업로드 — 첫 장이 대표 이미지(thumbnail), 나머지는 images
  const uploaded = [];
  for (const p of imagePaths) {
    process.stderr.write(`업로드: ${basename(p)}\n`);
    uploaded.push(await uploadFile(p));
  }
  const thumbnail = uploaded[0].url;
  const images = uploaded.slice(1).map((u) => u.url);

  const teamLogo = payload.teamLogo ? (await uploadFile(near(payload.teamLogo))).key : undefined;

  const links = (payload.links ?? [])
    .filter((l) => l?.url)
    .map((l) => ({ url: l.url, label: l.label ?? undefined, description: l.description ?? undefined }));

  // 1) 팀(build) 확보 — 이미 있으면 새로 만들지 않고 갱신한다
  let buildId = state.myBuild?.id ?? null;
  let created = false;

  if (buildId) {
    await api('PATCH', `/events/${eventId}/builds/${buildId}`, {
      title,
      teamName,
      summary: payload.summary ?? '',
      ...(teamLogo ? { teamLogo } : {}),
    });
  } else {
    if (!state.firstEmptySlotId)
      fail(
        '빈 슬롯이 없습니다. 운영자에게 현황판 슬롯 추가를 요청하세요.\n' +
          `(전체 ${state.totalSlots}개가 모두 차 있습니다)`,
      );
    const build = await api('POST', `/events/${eventId}/builds`, {
      slotId: state.firstEmptySlotId,
      title,
      teamName,
      summary: payload.summary ?? '',
      ...(teamLogo ? { teamLogo } : {}),
    });
    buildId = build.id;
    created = true;
  }

  // 2) 제출 — 실패해도 build는 남으므로 재실행하면 이어서 채운다
  try {
    await api('POST', `/events/${eventId}/builds/${buildId}/submission`, {
      description,
      thumbnail,
      images,
      links,
    });
  } catch (error) {
    console.error(
      JSON.stringify({ ok: false, stage: 'submission', eventId, buildId, created, error: error.message }, null, 2),
    );
    process.exit(1);
  }

  const publicUrl = `https://www.milgram.io/ko/event/${eventId}/builds`;
  console.log(
    JSON.stringify(
      {
        ok: true,
        eventId,
        buildId,
        created,
        updated: !created,
        registered: registration.registered,
        teamName,
        title,
        publicUrl,
        imageCount: uploaded.length,
      },
      null,
      2,
    ),
  );
}

async function resolveEventId() {
  const { today, matches } = await findTodayEvent();
  if (matches.length === 1) return matches[0].id;
  if (!matches.length)
    fail(
      `오늘(${today}) 열린 GSD 이벤트를 찾지 못했습니다.\n` +
        'payload에 eventId를 직접 넣거나, 이벤트 페이지 URL의 UUID를 확인하세요.',
    );
  fail(
    `오늘(${today}) 이벤트가 ${matches.length}개입니다. payload에 eventId를 지정하세요:\n` +
      matches.map((e) => `  ${e.id}  ${String(e.title).trim()}`).join('\n'),
  );
}

// ---------------------------------------------------------------- CLI

function required(value, name) {
  if (!String(value ?? '').trim()) fail(`${name} 이(가) 필요합니다.`);
  return String(value).trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [, , cmd, ...rest] = process.argv;

try {
  switch (cmd) {
    case 'login': {
      const { user } = await auth({ interactive: true });
      console.log(JSON.stringify(user, null, 2));
      break;
    }
    case 'whoami': {
      const { user } = await auth({ interactive: false });
      console.log(JSON.stringify(user, null, 2));
      break;
    }
    case 'today': {
      const { today, matches } = await findTodayEvent();
      console.log(
        JSON.stringify(
          { today, matches: matches.map((e) => ({ id: e.id, title: String(e.title).trim() })) },
          null,
          2,
        ),
      );
      break;
    }
    case 'questions': {
      const eventId = rest[0] ?? (await resolveEventId());
      const form = await api('GET', `/events/${eventId}/registration-form/questions`);
      console.log(
        JSON.stringify(
          (form?.questions ?? []).map((q) => ({
            title: q.title,
            required: q.required,
            type: q.type,
            choiceType: q.choice?.type ?? null,
            options: (q.choice?.options ?? []).map((o) => o.value),
          })),
          null,
          2,
        ),
      );
      break;
    }
    case 'register': {
      const eventId = rest[0] ?? (await resolveEventId());
      const categories = rest.slice(1);
      const r = await ensureParticipant(eventId, categories);
      console.log(JSON.stringify({ ok: true, eventId, ...r }, null, 2));
      break;
    }
    case 'status': {
      const eventId = rest[0] ?? (await resolveEventId());
      const me = await myParticipant(eventId);
      const s = await slotState(eventId);
      console.log(
        JSON.stringify(
          {
            eventId,
            registered: !!me,
            participantStatus: me?.status ?? null,
            participantType: me?.hackathonParticipantType ?? null,
            viewerRole: s.viewerRole,
            totalSlots: s.totalSlots,
            emptySlots: s.emptyCount,
            myBuild: s.myBuild
              ? {
                  id: s.myBuild.id,
                  slotOrder: s.mySlotOrder,
                  teamName: s.myBuild.teamName,
                  title: s.myBuild.title,
                  submitted: !!s.myBuild.hasSubmission,
                  lastSubmittedAt: s.myBuild.lastSubmittedAt ?? null,
                  deadline: s.myBuild.submissionDeadlineAt ?? null,
                  closed: !!s.myBuild.isSubmissionClosed,
                }
              : null,
          },
          null,
          2,
        ),
      );
      break;
    }
    case 'submit': {
      if (!rest[0]) fail('usage: milgram.mjs submit <payload.json>');
      await submit(rest[0]);
      break;
    }
    case 'delete': {
      const [eventId, buildId] = rest;
      if (!eventId || !buildId) fail('usage: milgram.mjs delete <eventId> <buildId>');
      // 현황판 슬롯을 쥔 채로는 팀이 해체되지 않는다 (409). 먼저 슬롯을 놓는다.
      try {
        await api('PATCH', `/events/${eventId}/builds/${buildId}/slot`, { slotId: null });
      } catch {
        /* 슬롯이 없으면 그대로 진행 */
      }
      await api('DELETE', `/events/${eventId}/builds/${buildId}`);
      console.log(JSON.stringify({ ok: true, deleted: buildId }, null, 2));
      break;
    }
    case 'get': {
      if (!rest[0]) fail('usage: milgram.mjs get <path>');
      console.log(JSON.stringify(await api('GET', rest[0]), null, 2));
      break;
    }
    default:
      fail('usage: milgram.mjs login|whoami|today|questions|register|status|submit|delete|get');
  }
} catch (error) {
  fail(error.message);
}
