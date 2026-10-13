import { readFile, realpath } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const directory = await realpath(resolve(root, 'tools/asset-positioner'));
const mounts = await Promise.all([
  ['/asset-positioner/', directory],
  ['/acervo/', resolve(root, 'tools/acervo')],
  ['/artes-referencia/', resolve(root, 'artes-referencia')],
  ['/game/public/assets/items/', resolve(root, 'game/public/assets/items')],
].filter(([,folder])=>existsSync(folder)).map(async ([prefix,folder])=>[prefix,await realpath(folder)]));
const version = readFileSync(resolve(root, 'VERSION'), 'utf8').trim();
const port = Number(process.env.COFFE_TOOLS_PORT ?? 5175);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('COFFE_TOOLS_PORT deve estar entre 1 e 65535.');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
};
const inside = (path, base) => path.startsWith(base + sep);
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
  }
  let path, base = directory;
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const mount=mounts.find(([prefix])=>pathname.startsWith(prefix));
    if(['/docs/acervo-moveis.md','/docs/acervo-moveis-lote-02.md'].includes(pathname)) {
      base=resolve(root,'docs');path=resolve(base,pathname.slice('/docs/'.length));
    } else if(mount) {
      base=mount[1];const relative=pathname.slice(mount[0].length);path=resolve(base,relative||'index.html');
    } else path = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
  } catch {
    response.writeHead(400); response.end(); return;
  }
  // Cada prefixo tem uma raiz explícita; links simbólicos não podem sair dela.
  if (!inside(path,base)) { response.writeHead(403); response.end(); return; }
  const type = types[extname(path)];
  if (!type) { response.writeHead(404); response.end(); return; }
  try {
    path = await realpath(path);
    if (!inside(path,base)) { response.writeHead(403); response.end(); return; }
    const data = await readFile(path);
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404); response.end();
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Porta ${port} ocupada. Altere COFFE_TOOLS_PORT no .env.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.info(`Asset Studio ${version}: http://127.0.0.1:${port}/`));
