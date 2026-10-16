import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = resolve(projectRoot, 'public');
const port = Number(process.env.PORT || 3000);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = resolve(publicRoot, relativePath);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let fileStats;
  try {
    fileStats = statSync(filePath);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  if (!fileStats.isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Đấu Trường Tốc Độ đang chạy tại http://0.0.0.0:${port}`);
});
