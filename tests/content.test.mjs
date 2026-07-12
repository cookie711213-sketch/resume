import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

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

function visibleText(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function attributeValues(name) {
  const expression = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'gis');
  return [...html.matchAll(expression)].map((match) => match[2]);
}

function classCount(className) {
  return attributeValues('class').reduce((count, value) => {
    return count + value.split(/\s+/).filter((token) => token === className).length;
  }, 0);
}

test('contains every approved positioning and evidence statement', () => {
  const missing = REQUIRED_COPY.filter((copy) => !html.includes(copy));
  assert.deepEqual(missing, [], `Missing approved copy: ${missing.join(', ')}`);
});

test('removes every disallowed legacy claim', () => {
  const present = FORBIDDEN_COPY.filter((copy) => html.includes(copy));
  assert.deepEqual(present, [], `Legacy claims still present: ${present.join(', ')}`);
});

test('publishes no telephone or birth-date PII', () => {
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
  const targets = [...html.matchAll(/\bhref\s*=\s*(["'])mailto:([^?"']+)(?:\?[^"']*)?\1/gi)]
    .map((match) => decodeURIComponent(match[2]).trim().toLowerCase());
  assert.equal(new Set(targets).size, 1);
});

test('uses the approved five-section information architecture in order', () => {
  const sectionIds = [...html.matchAll(/<section\b[^>]*\bid\s*=\s*(["'])(.*?)\1[^>]*>/gis)]
    .map((match) => match[2]);
  assert.deepEqual(sectionIds, ['experience', 'cases', 'skills', 'projects', 'background']);
});

test('contains no duplicate element IDs', () => {
  const ids = attributeValues('id');
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});

test('limits project and skill-card density', () => {
  assert.equal(classCount('project-card'), 2);
  assert.ok(classCount('skill-chip') <= 20, 'Expected no more than 20 skill-chip elements');
});

test('keeps only the approved one-person-team context', () => {
  const claims = visibleText(html).match(/개발 인력 1명 환경|단독|유일|혼자|1인/g) ?? [];
  assert.deepEqual(claims, ['개발 인력 1명 환경']);
});

test('removes superseded strengths and about sections', () => {
  assert.doesNotMatch(html, /core-strengths|about-me/i);
});

test('describes the current company as a window-construction B2C business', () => {
  assert.ok(html.includes('창호 시공업 B2C 사업'));
  const experience = html.match(
    /<section\b(?=[^>]*\bid\s*=\s*(["'])experience\1)[^>]*>[\s\S]*?<\/section>/i,
  );
  assert.ok(experience, 'Missing current-company experience section');
  assert.doesNotMatch(visibleText(experience[0]), /\bB2B\b/i);
});
