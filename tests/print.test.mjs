import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const pdfPath = path.join(root, 'artifacts/이승환_ERP_CRM_개발자_이력서_2026-07.pdf');

const REQUIRED_METRICS = [
  '약 2.6만 건',
  '1분 이상에서 수초',
  '전송량을 약 1/6',
  '1원 단위 불일치',
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

let pdfInfo;
let pdfText;
let pdfSize;

test.before(async () => {
  await execFileAsync(process.execPath, ['scripts/render-pdf.mjs'], {
    cwd: root,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  ({ stdout: pdfInfo } = await execFileAsync('pdfinfo', [pdfPath], { cwd: root }));
  ({ stdout: pdfText } = await execFileAsync('pdftotext', [pdfPath, '-'], {
    cwd: root,
    maxBuffer: 10 * 1024 * 1024,
  }));
  pdfText = pdfText.replace(/\s+/g, ' ').trim();
  pdfSize = (await stat(pdfPath)).size;
});

test('renders exactly two pages', () => {
  const pages = Number(pdfInfo.match(/^Pages:\s+(\d+)$/m)?.[1]);
  assert.equal(pages, 2);
});

test('renders each page at A4 size', () => {
  assert.match(pdfInfo, /^Page size:\s+\S+\s+x\s+\S+\s+pts\s+\(A4\)$/m);
});

test('keeps the approved headline metrics in extracted PDF text', () => {
  const missing = REQUIRED_METRICS.filter((metric) => !pdfText.includes(metric));
  assert.deepEqual(missing, [], `Missing PDF metrics: ${missing.join(', ')}`);
});

test('keeps telephone PII and forbidden claims out of the PDF', () => {
  const present = FORBIDDEN_COPY.filter((copy) => pdfText.includes(copy));
  if (/\b(?:\+?82[-.\s]?)?0?10[-.\s]?\d{3,4}[-.\s]?\d{4}\b/.test(pdfText)) {
    present.unshift('Korean mobile number');
  }
  assert.deepEqual(present, [], `Forbidden PDF copy: ${present.join(', ')}`);
});

test('produces a nontrivial PDF artifact larger than 50KB', () => {
  assert.ok(pdfSize > 50 * 1024, `Expected >50KB, received ${pdfSize} bytes`);
});
