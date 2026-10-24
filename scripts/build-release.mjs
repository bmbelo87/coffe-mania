// Gera o pacote de produção em .runtime/release/: cliente compilado, os dois serviços Go para
// o servidor (Linux amd64 por padrão) e os arquivos de deploy/. Uso e instalação: docs/producao.md.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
const goos = process.env.GOOS ?? 'linux';
const goarch = process.env.GOARCH ?? 'amd64';
const name = `cafe-mania-${version}-${goos}-${goarch}`;
const out = join(root, '.runtime', 'release', name);
const windowsGo = join(process.env.ProgramFiles ?? 'C:/Program Files', 'Go', 'bin', 'go.exe');
const go = process.env.COFFE_GO ?? (process.platform === 'win32' && existsSync(windowsGo) ? windowsGo : 'go');

function run(command, args, env = process.env, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm' });
  if (result.status !== 0) throw new Error(`Falhou: ${command} ${args.join(' ')}`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'bin'), { recursive: true });
console.info(`Café Mania ${version}: compilando o cliente…`);
run('npm', ['run', 'build']);
// PocketBase usa SQLite em Go puro: sem CGO, o binário roda em qualquer Linux sem dependências.
const env = { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: '0' };
const suffix = goos === 'windows' ? '.exe' : '';
for (const [path, binary] of [['./database', 'coffe-database'], ['./game-server', 'coffe-game-server']]) {
  console.info(`Compilando ${path} para ${goos}/${goarch}…`);
  run(go, ['build', '-trimpath', '-ldflags=-s -w', '-o', join(out, 'bin', binary + suffix), path], env);
}
cpSync(join(root, 'game', 'dist'), join(out, 'public'), { recursive: true });
cpSync(join(root, 'deploy'), join(out, 'deploy'), { recursive: true });
writeFileSync(join(out, 'VERSION'), version + '\n');
// Caminhos relativos: o tar do Git Bash leria "C:" de um caminho absoluto como host remoto.
run('tar', ['-czf', name + '.tar.gz', name], process.env, join(root, '.runtime', 'release'));
console.info(`Pacote pronto: .runtime/release/${name}.tar.gz`);
