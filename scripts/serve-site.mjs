import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultSiteRoot = fileURLToPath(new URL('../site', import.meta.url));

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
]);

function respond(response, status, body = '') {
  const payload = Buffer.from(body);
  response.writeHead(status, {
    'content-length': payload.byteLength,
    'content-type': 'text/plain; charset=utf-8',
  });
  response.end(payload);
}

export function createSiteServer({ siteRoot = defaultSiteRoot } = {}) {
  const absoluteRoot = path.resolve(siteRoot);

  return http.createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('allow', 'GET, HEAD');
      respond(response, 405, 'Method Not Allowed');
      return;
    }

    const rawPath = (request.url ?? '/').split('?', 1)[0];
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(rawPath).replaceAll('\\', '/');
    } catch {
      respond(response, 400, 'Bad Request');
      return;
    }

    const segments = decodedPath.split('/').filter(Boolean);
    if (decodedPath.includes('\0') || segments.some((segment) => segment === '..' || segment === '.')) {
      respond(response, 403, 'Forbidden');
      return;
    }

    const relativePath = decodedPath === '/' ? 'index.html' : segments.join('/');
    const filePath = path.resolve(absoluteRoot, relativePath);
    if (filePath !== absoluteRoot && !filePath.startsWith(`${absoluteRoot}${path.sep}`)) {
      respond(response, 403, 'Forbidden');
      return;
    }

    try {
      const linkStat = await lstat(filePath);
      const [realRoot, realFilePath] = await Promise.all([
        realpath(absoluteRoot),
        realpath(filePath),
      ]);
      if (realFilePath !== realRoot && !realFilePath.startsWith(`${realRoot}${path.sep}`)) {
        respond(response, 403, 'Forbidden');
        return;
      }

      const fileStat = linkStat.isSymbolicLink() ? await stat(filePath) : linkStat;
      if (!fileStat.isFile()) {
        respond(response, 404, 'Not Found');
        return;
      }

      const body = await readFile(realFilePath);
      response.writeHead(200, {
        'content-length': body.byteLength,
        'content-type': MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        respond(response, 404, 'Not Found');
        return;
      }
      respond(response, 500, 'Internal Server Error');
    }
  });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const server = createSiteServer();
  server.listen(4173, '127.0.0.1', () => {
    console.log('Serving site at http://127.0.0.1:4173');
  });
}
