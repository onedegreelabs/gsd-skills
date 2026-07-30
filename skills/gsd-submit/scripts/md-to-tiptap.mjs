#!/usr/bin/env node
// 마크다운 → 밀그램 제출물 description(Tiptap JSON 문자열)
//
// 밀그램은 description을 HTML이 아니라 Tiptap JSON 문자열로 저장한다.
// 문자열이 JSON으로 파싱되지 않으면 뷰어가 통째로 문단 하나로 떨어뜨리므로
// (parseDescriptionToJSONContent 폴백), 마크다운이나 HTML을 그대로 넣으면 안 된다.
//
// 사용:
//   node md-to-tiptap.mjs body.md            # JSON 문자열을 stdout으로
//   cat body.md | node md-to-tiptap.mjs -
//
// 지원 문법: ## / ### 헤딩, 문단, - 불릿, **굵게**, *기울임*, [텍스트](url), 맨URL

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const id = () => randomUUID();

const paragraphAttrs = () => ({ id: id(), variant: null, tiptapBg: null, indent: 0 });
const headingAttrs = (level) => ({ id: id(), tiptapBg: null, indent: 0, level });

const linkMark = (href) => ({
  type: 'link',
  attrs: {
    href,
    target: '_blank',
    rel: 'noopener noreferrer nofollow',
    class: 'cursor-pointer text-blue-500 underline',
    title: null,
  },
});

// 인라인 마크업 → text 노드 배열
function inline(raw) {
  const nodes = [];
  const push = (text, marks) => {
    if (!text) return;
    nodes.push(marks?.length ? { type: 'text', marks, text } : { type: 'text', text });
  };

  // [텍스트](url) | **굵게** | *기울임* | 맨 URL
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|(?<!\*)\*([^*\n]+)\*(?!\*)|(https?:\/\/[^\s<>()]+)/g;
  let last = 0;
  let m;

  while ((m = pattern.exec(raw)) !== null) {
    push(raw.slice(last, m.index));
    if (m[1] !== undefined) push(m[1], [linkMark(m[2])]);
    else if (m[3] !== undefined) push(m[3], [{ type: 'bold' }]);
    else if (m[4] !== undefined) push(m[4], [{ type: 'italic' }]);
    else push(m[5], [linkMark(m[5])]);
    last = pattern.lastIndex;
  }
  push(raw.slice(last));

  return nodes.length ? nodes : [{ type: 'text', text: ' ' }];
}

const paragraph = (text) => ({ type: 'paragraph', attrs: paragraphAttrs(), content: inline(text) });

const heading = (level, text) => ({
  type: 'heading',
  attrs: headingAttrs(level),
  content: inline(text),
});

const bulletList = (items) => ({
  type: 'bulletList',
  attrs: { id: id(), tiptapBg: null },
  content: items.map((text) => ({
    type: 'listItem',
    attrs: { id: id() },
    content: [paragraph(text)],
  })),
});

export function markdownToTiptap(markdown) {
  const content = [];
  let pendingBullets = [];

  const flushBullets = () => {
    if (pendingBullets.length) {
      content.push(bulletList(pendingBullets));
      pendingBullets = [];
    }
  };

  for (const rawLine of String(markdown).split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      pendingBullets.push(bullet[1]);
      continue;
    }

    flushBullets();

    const head = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (head) {
      // 샘플 제출물이 섹션 제목에 h2를 쓴다. # 하나짜리도 h2로 맞춘다.
      const level = Math.max(2, Math.min(4, head[1].length));
      content.push(heading(level, head[2]));
      continue;
    }

    content.push(paragraph(trimmed));
  }

  flushBullets();

  if (!content.length) content.push(paragraph(' '));

  return { type: 'doc', content };
}

/** 밀그램 description 필드에 그대로 넣을 문자열 */
export function markdownToDescription(markdown) {
  return JSON.stringify(markdownToTiptap(markdown));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: md-to-tiptap.mjs <body.md|->');
    process.exit(1);
  }
  const md = arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8');
  process.stdout.write(markdownToDescription(md));
}
