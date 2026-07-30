#!/usr/bin/env node
// 오늘 Claude Code와 무엇을 만들었는지 추려낸다.
//
// 코드만 봐서는 "무엇을 하려고 했는지"와 "어디서 막혔는지"를 알 수 없다.
// 그건 대화 히스토리에만 있고, 제출물의 회고를 쓰려면 그게 필요하다.
//
//   session-digest.mjs [프로젝트경로] [--days N] [--json]
//
// 기본은 현재 디렉터리, 오늘 하루. 결과는 사람이 읽는 마크다운으로 낸다.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const daysIdx = args.indexOf('--days');
const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 1;
const projectPath = resolve(args.find((a) => !a.startsWith('--') && a !== String(days)) ?? process.cwd());

// Claude Code는 프로젝트 경로의 / 를 - 로 바꿔 디렉터리 이름으로 쓴다
const slug = projectPath.replace(/\//g, '-');
const historyDir = join(homedir(), '.claude', 'projects', slug);

if (!existsSync(historyDir)) {
  console.error(`이 폴더에서 진행한 Claude Code 기록이 없습니다: ${projectPath}`);
  console.error(`(찾은 위치: ${historyDir})`);
  process.exit(2);
}

const cutoff = Date.now() - days * 24 * 3600 * 1000;

const files = readdirSync(historyDir)
  .filter((f) => f.endsWith('.jsonl'))
  .map((f) => join(historyDir, f))
  .filter((f) => statSync(f).mtimeMs >= cutoff)
  .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);

const prompts = [];
const editedFiles = new Map();
const commands = [];
let assistantTurns = 0;
let firstAt = null;
let lastAt = null;

const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  // tool_result가 섞인 항목은 사람이 친 말이 아니다
  if (content.some((c) => c?.type === 'tool_result')) return '';
  return content
    .filter((c) => c?.type === 'text')
    .map((c) => c.text)
    .join('\n');
};

for (const file of files) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const at = entry.timestamp ? new Date(entry.timestamp) : null;
    if (at && at.getTime() >= cutoff) {
      if (!firstAt || at < firstAt) firstAt = at;
      if (!lastAt || at > lastAt) lastAt = at;
    }

    if (entry.type === 'user' && !entry.isSidechain) {
      const text = textOf(entry.message?.content).trim();
      // 시스템이 끼워 넣는 알림·첨부 설명은 사람이 친 말이 아니다
      if (text && !text.startsWith('<') && !text.startsWith('Caveat:') && !text.startsWith('[Image:')) {
        prompts.push({ at: entry.timestamp, text });
      }
    }

    if (entry.type === 'assistant') {
      assistantTurns++;
      const content = entry.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block?.type !== 'tool_use') continue;
        if (['Write', 'Edit', 'NotebookEdit'].includes(block.name) && block.input?.file_path) {
          const path = block.input.file_path;
          editedFiles.set(path, (editedFiles.get(path) ?? 0) + 1);
        }
        if (block.name === 'Bash' && block.input?.command) {
          commands.push(String(block.input.command).split('\n')[0].slice(0, 160));
        }
      }
    }
  }
}

// 배포·빌드처럼 결과를 짐작할 수 있는 명령만 남긴다
const notable = commands.filter((c) =>
  /(^|\s)(vercel\s+(deploy|--prod|link)|netlify\s+deploy|fly\s+deploy|railway\s+up|gh-pages|(npm|pnpm|yarn)\s+run\s+build|expo\s+(build|publish)|supabase\s+(db|link)|git\s+push)/i.test(
    c,
  ),
);

const digest = {
  projectPath,
  sessions: files.length,
  days,
  firstAt: firstAt?.toISOString() ?? null,
  lastAt: lastAt?.toISOString() ?? null,
  promptCount: prompts.length,
  assistantTurns,
  prompts: prompts.map((p) => ({ at: p.at, text: p.text.slice(0, 600) })),
  editedFiles: [...editedFiles.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([path, count]) => ({ path: path.replace(projectPath + '/', ''), edits: count })),
  notableCommands: [...new Set(notable)].slice(0, 20),
};

if (asJson) {
  console.log(JSON.stringify(digest, null, 2));
  process.exit(0);
}

const kst = (iso) =>
  iso ? new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) : '-';

const out = [];
out.push(`# 작업 기록 — ${projectPath}`);
out.push('');
out.push(`세션 ${digest.sessions}개 · 요청 ${digest.promptCount}회 · ${kst(digest.firstAt)} ~ ${kst(digest.lastAt)} (KST)`);
out.push('');
out.push('## 무엇을 요청했나 (시간순)');
out.push('');
for (const p of digest.prompts) out.push(`- [${kst(p.at)}] ${p.text.replace(/\n+/g, ' ')}`);
out.push('');
out.push('## 손댄 파일');
out.push('');
for (const f of digest.editedFiles.slice(0, 40)) out.push(`- ${f.path} (${f.edits}회)`);
if (digest.editedFiles.length > 40) out.push(`- … 외 ${digest.editedFiles.length - 40}개`);
if (digest.notableCommands.length) {
  out.push('');
  out.push('## 배포·빌드 흔적');
  out.push('');
  for (const c of digest.notableCommands) out.push(`- \`${c}\``);
}

console.log(out.join('\n'));
