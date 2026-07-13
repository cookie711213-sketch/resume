import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getVisibleElements,
  getVisibleText,
  parseResumeDocument,
} from './content-contract.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const document = parseResumeDocument(html);
const text = getVisibleText(document);

const REQUIRED_COPY = [
  'ERP·CRM 백엔드 중심 풀스택 개발자',
  '2025.05–현재',
  '약 2.6만 건',
  '1분 이상에서 수초',
  '전송량을 약 1/6',
  '1원 단위 불일치',
  'CRM 운영·고도화 및 주요 기능 개발',
  '개발 인력 1명 환경',
];

const FORBIDDEN_COPY = [
  '424K',
  '4,785',
  '1,202',
  '161K',
  '824',
  '3,099',
  'P0',
  '2년차',
  '즉시 투입',
  '대리 승진',
  '연봉 인상',
  'undetected-chromedriver',
  '1,500만원',
  '비밀번호 100',
  'AI 챗봇',
  '바이브 코딩',
  '문제 해결에 대한 두려움',
  '전 도메인 단독',
  '전사 목록을 500→30',
  '단독 설계',
];

test('contains every approved positioning and evidence statement', () => {
  const missing = REQUIRED_COPY.filter((copy) => !text.includes(copy));
  assert.deepEqual(missing, [], `Missing approved copy: ${missing.join(', ')}`);
});

test('removes every disallowed legacy claim', () => {
  const present = FORBIDDEN_COPY.filter((copy) => text.includes(copy));
  assert.deepEqual(present, [], `Legacy claims still present: ${present.join(', ')}`);
});

test('publishes no telephone or birth-date PII', () => {
  // Source-level by design: hidden PII is still downloadable in the public HTML.
  const violations = [];
  if (/\bhref\s*=\s*(["'])tel:[^"']*\1/i.test(html)) violations.push('tel href');
  if (/\b(?:\+?82[-.\s]?)?0?10[-.\s]?\d{3,4}[-.\s]?\d{4}\b/.test(html)) {
    violations.push('Korean mobile number');
  }
  if (/\b(?:19|20)\d{2}\.(?:0[1-9]|1[0-2])\.(?:0[1-9]|[12]\d|3[01])\b/.test(html)) {
    violations.push('YYYY.MM.DD birth date');
  }
  assert.deepEqual(violations, [], `PII still present: ${violations.join(', ')}`);
});

test('uses exactly one unique email target', () => {
  const targets = [...document.querySelectorAll('a[href]')]
    .map((element) => element.getAttribute('href'))
    .filter((href) => /^mailto:/i.test(href))
    .map((href) => decodeURIComponent(href.slice('mailto:'.length).split('?', 1)[0]).trim().toLowerCase());
  assert.equal(new Set(targets).size, 1);
});

test('uses the approved five-section information architecture in order', () => {
  const sectionIds = getVisibleElements(document, 'section[id]').map((element) => element.id);
  assert.deepEqual(sectionIds, ['experience', 'cases', 'skills', 'projects', 'background']);
});

test('contains no duplicate element IDs', () => {
  const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});

test('limits project and skill-card density', () => {
  assert.equal(getVisibleElements(document, '.project-card').length, 2);
  assert.ok(
    getVisibleElements(document, '.skill-chip').length <= 20,
    'Expected no more than 20 skill-chip elements',
  );
});

test('keeps only the approved one-person-team context', () => {
  const claims = text.match(/개발 인력 1명 환경|단독|유일|혼자|1인/g) ?? [];
  assert.deepEqual(claims, ['개발 인력 1명 환경']);
});

test('removes superseded strengths and about sections', () => {
  assert.equal(document.getElementById('core-strengths'), null);
  assert.equal(document.getElementById('about-me'), null);
});

test('describes the current company as a window-construction B2C business', () => {
  assert.ok(text.includes('창호 시공업 B2C 사업'));
  const [experience] = getVisibleElements(document, 'section#experience');
  assert.ok(experience, 'Missing current-company experience section');
  assert.doesNotMatch(getVisibleText(experience), /\bB2B\b/i);
});

test('DOM contract ignores non-rendered copy and elements', () => {
  const fixture = parseResumeDocument(`<!doctype html><html><head>
    <style>.decoy::before { content: "424K ERP·CRM 백엔드 중심 풀스택 개발자"; }</style>
    <script>const decoy = "424K ERP·CRM 백엔드 중심 풀스택 개발자";</script>
  </head><body>
    <!-- <section id="experience" class="project-card">424K ERP·CRM 백엔드 중심 풀스택 개발자</section> -->
    <template><section id="cases" class="project-card">424K ERP·CRM 백엔드 중심 풀스택 개발자</section></template>
    <section id="skills" class="project-card" hidden>424K ERP·CRM 백엔드 중심 풀스택 개발자</section>
    <section id="projects" class="project-card" aria-hidden="true">424K ERP·CRM 백엔드 중심 풀스택 개발자</section>
    <section id="background" class="project-card" style="display: none">424K ERP·CRM 백엔드 중심 풀스택 개발자</section>
    <p>visible control copy</p>
  </body></html>`);

  assert.equal(getVisibleText(fixture), 'visible control copy');
  assert.deepEqual(getVisibleElements(fixture, 'section[id]').map((element) => element.id), []);
  assert.equal(getVisibleElements(fixture, '.project-card').length, 0);
});
