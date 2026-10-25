/**
 * Telemetria do cliente, própria do jogo (database/telemetry_routes.go). Só eventos de uma
 * lista fechada, sem dados pessoais: tempo de carregamento, FPS médio por minuto, erros de
 * JavaScript, códigos de desconexão e telas abertas. Os eventos vão em lotes a cada 30 s e
 * ao esconder a página. O servidor descarta o que não estiver na lista.
 */

export type TelemetryScreen =
  | 'cook' | 'spices' | 'waiters' | 'wardrobe' | 'store' | 'supplies'
  | 'juices' | 'invite' | 'settings' | 'expansion';

interface TelemetryEvent { name: string; label?: string; value?: number; source?: string; line?: number }

const FLUSH_MS = 30_000;
const MAX_QUEUE = 120;
const MAX_BATCH = 60;
/** Um erro que se repete a cada quadro não pode encher a fila. */
const MAX_ERRORS_PER_MESSAGE = 3;
const MAX_ERRORS = 20;

const session = typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
let queue: TelemetryEvent[] = [];
let started = false;
let errorCount = 0;
const errorsByMessage = new Map<string, number>();
let frames = 0;
let frameMs = 0;

function push(event: TelemetryEvent): void {
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(event);
}

function flush(leaving = false): void {
  while (queue.length > 0) {
    const events = queue.splice(0, MAX_BATCH);
    // keepalive deixa o último lote sair mesmo com a página fechando.
    void fetch('/api/coffe/telemetry', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: leaving,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session, events }),
    }).catch(() => undefined);
  }
}

function trackError(message: string, source = '', line = 0): void {
  const text = message.trim().slice(0, 300);
  if (!text || errorCount >= MAX_ERRORS) return;
  const seen = errorsByMessage.get(text) ?? 0;
  if (seen >= MAX_ERRORS_PER_MESSAGE) return;
  errorsByMessage.set(text, seen + 1);
  errorCount++;
  push({ name: 'js_error', label: text, source: source.slice(0, 300), line });
}

/** Liga a coleta: erros globais, envio periódico e o lote final ao sair. */
export function startTelemetry(): void {
  if (started) return;
  started = true;
  window.addEventListener('error', (event) => trackError(event.message || String(event.error ?? ''), event.filename, event.lineno));
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    trackError(reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason));
  });
  window.setInterval(() => flush(), FLUSH_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('pagehide', () => flush(true));
}

/** Do início da página até o café aparecer, em milissegundos. */
export function trackLoad(): void {
  push({ name: 'load', value: Math.round(performance.now()) });
}

export function trackScreen(screen: TelemetryScreen): void {
  push({ name: 'screen', label: screen });
}

export function trackDisconnect(code: number): void {
  push({ name: 'disconnect', label: String(code) });
}

/**
 * Chamado a cada quadro do Pixi. Fecha uma média por minuto de jogo visível; com a aba
 * escondida o navegador pausa os quadros e o minuto não conta.
 */
export function trackFrame(deltaMs: number): void {
  if (!started || document.visibilityState === 'hidden' || deltaMs > 1000) return;
  frames++;
  frameMs += deltaMs;
  if (frameMs >= 60_000) {
    push({ name: 'fps', value: Math.round((frames * 10_000) / frameMs) / 10 });
    frames = 0;
    frameMs = 0;
  }
}
