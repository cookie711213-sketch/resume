import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const expectedFiles = [
  'assets/dajeong-home.png',
  'assets/dingdong-teacher-calendar.jpeg',
  'index.html',
];

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), relative));
    } else {
      files.push(relative);
    }
  }
  return files.sort();
}

async function runBuild() {
  return execFileAsync(process.execPath, ['scripts/build-site.mjs'], { cwd: root });
}

function request(port, requestPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: requestPath, method: 'GET' },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve({
          body: Buffer.concat(chunks),
          headers: response.headers,
          status: response.statusCode,
        }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

test('build publishes exactly the three approved public files', async () => {
  const { stdout, stderr } = await runBuild();
  assert.equal(stdout, 'Built site with 3 public files.\n');
  assert.equal(stderr, '');
  assert.deepEqual(await listFiles(path.join(root, 'site')), expectedFiles);

  const published = await listFiles(path.join(root, 'site'));
  assert.equal(published.some((file) => /(?:^|\/)(?:tests?|docs?)(?:\/|$)/i.test(file)), false);
  assert.equal(published.some((file) => /(?:package|playwright|wrangler|\.config\.)/i.test(file)), false);
  assert.equal(published.some((file) => /\.pdf$/i.test(file)), false);
});

test('build fails before publishing when a required source is missing', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'resume-build-'));
  try {
    await mkdir(path.join(fixture, 'assets'));
    await writeFile(path.join(fixture, 'index.html'), '<!doctype html>');
    await writeFile(path.join(fixture, 'assets/dajeong-home.png'), 'png');
    const { buildSite } = await import('../scripts/build-site.mjs');
    await assert.rejects(
      buildSite({ sourceRoot: fixture, outputRoot: path.join(fixture, 'site') }),
      /dingdong-teacher-calendar\.jpeg/,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('local server serves approved files and rejects unsafe or unknown paths', async () => {
  await runBuild();
  const { createSiteServer } = await import('../scripts/serve-site.mjs');
  const server = createSiteServer({ siteRoot: path.join(root, 'site') });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const { port } = server.address();
    const home = await request(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /^text\/html; charset=utf-8$/);
    assert.equal(home.body.toString('utf8'), await readFile(path.join(root, 'index.html'), 'utf8'));

    const png = await request(port, '/assets/dajeong-home.png');
    assert.equal(png.status, 200);
    assert.equal(png.headers['content-type'], 'image/png');

    const jpeg = await request(port, '/assets/dingdong-teacher-calendar.jpeg');
    assert.equal(jpeg.status, 200);
    assert.equal(jpeg.headers['content-type'], 'image/jpeg');

    assert.equal((await request(port, '/missing.png')).status, 404);
    assert.equal((await request(port, '/%2e%2e/package.json')).status, 403);
    assert.equal((await request(port, '/..%2fpackage.json')).status, 403);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
