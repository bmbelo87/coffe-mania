import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import './metrics.css';

import type { PlayerSession } from '../game/session';
import { barList, columnChart, compactNumber, integer, lineChart, SERIES, table } from './charts';

/** Resposta de `/api/coffe/admin/metrics` (database/telemetry_report.go). */
interface NamedCount { label: string; name: string; count: number; total?: number }
interface DaySeries {
  day: string; dau: number; wau: number; mau: number; newAccounts: number; sessions: number; sessionMinutes: number; sessionP50: number;
  goldIn: number; goldOut: number; cashIn: number; cashOut: number; xp: number; loadP50: number; loadP95: number; fpsP50: number;
  onlinePeak: number; errors: number; disconnects: number;
}
interface RetentionCell { eligible: number; retained: number }
interface Report {
  generatedAt: number; days: number; from: string; to: string; staff: boolean;
  now: { available: boolean; players: number; rooms: number; connections: number; tick?: Record<string, number>; task?: Record<string, number> };
  onlineToday: { at: number; players: number }[];
  waitlist: Record<'pending' | 'confirmed' | 'invited' | 'joined', number>;
  accounts: number;
  series: DaySeries[];
  retention: { wave: string; users: number; d1: RetentionCell; d7: RetentionCell; d30: RetentionCell }[];
  funnel: NamedCount[];
  usage: Partial<Record<'screens' | 'recipes' | 'items' | 'supplies' | 'juices' | 'spices' | 'expansions' | 'events', NamedCount[]>>;
  economy: { currency: string; reason: string; in: number; out: number; count: number }[] | null;
  health: Partial<Record<'errors' | 'disconnects' | 'sessionEnds', NamedCount[]>>;
  dropped: number;
}

const SCREENS: Record<string, string> = {
  cook: 'Cozinha', spices: 'Temperos', waiters: 'Garçons', wardrobe: 'Guarda-roupa', store: 'Loja e decoração',
  supplies: 'Encomendas', juices: 'Sucos', invite: 'Convidar amigos', settings: 'Configurações', expansion: 'Expansão',
};
const REASONS: Record<string, string> = {
  cliente: 'Clientes servidos', cozinhar: 'Cozinhar', nivel: 'Prêmio de nível', loja: 'Loja', venda: 'Venda de itens',
  expansao: 'Expansão', suco: 'Sucos servidos', suco_destravar: 'Destravar sucos', recarga_energia: 'Recarga de energia',
  encomenda: 'Encomendas', encomenda_pressa: 'Apressar encomenda', encomenda_salvar: 'Salvar encomenda', tempero: 'Temperos',
  dev: 'Ferramentas de dev', outro: 'Outro (sem motivo registrado)',
};
const CURRENCIES: Record<string, string> = { gold: 'caféOuros', cash: 'caféGranas', xp: 'XP' };
const CLOSE_CODES: Record<string, string> = {
  1000: 'Fechou normalmente', 1001: 'Saiu da página', 1006: 'Conexão caiu', 1008: 'Recusada pelo servidor', 1011: 'Erro no servidor',
  1012: 'Servidor reiniciando', 1013: 'Quarto indisponível', 4001: 'Abriu outra janela', 4002: 'Manutenção', 4003: 'Versão nova',
};
const SESSION_ENDS: Record<string, string> = {
  left: 'Saiu', lost: 'Conexão perdida', closed: 'Encerrada', replaced: 'Outra janela', maintenance: 'Manutenção',
  kicked: 'Removido (suspensão ou exclusão)', flood: 'Excesso de comandos', invalid: 'Comando inválido', shutdown: 'Atualização do servidor',
};
const EXPANSIONS: Record<string, string> = { cash: 'Com caféGranas', gold: 'Com caféOuros', gold_unlock: 'Destravada com caféGranas' };

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const longDay = (day: string) => new Date(`${day}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const percent = (part: number, whole: number) => whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
const minutes = (value: number) => value >= 60 ? `${integer.format(Math.floor(value / 60))} h ${integer.format(Math.round(value % 60))} min` : `${integer.format(Math.round(value))} min`;
const seconds = (ms: number) => `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(parent: HTMLElement, title: string, note?: string): HTMLElement {
  const box = element('section', 'metrics-section');
  box.append(element('h2', '', title));
  if (note) box.append(element('p', 'metrics-note', note));
  parent.append(box);
  return box;
}

function tiles(parent: HTMLElement, items: { label: string; value: string; note?: string }[]): void {
  const row = element('div', 'metrics-tiles');
  for (const item of items) {
    const tile = element('div', 'metrics-tile');
    tile.append(element('span', 'metrics-tile-label', item.label), element('strong', 'metrics-tile-value', item.value));
    if (item.note) tile.append(element('span', 'metrics-tile-note', item.note));
    row.append(tile);
  }
  parent.append(row);
}

function card(parent: HTMLElement, title: string, legend?: { name: string; color: string }[]): HTMLElement {
  const box = element('div', 'metrics-card');
  box.append(element('h3', '', title));
  if (legend && legend.length > 1) {
    const keys = element('div', 'metrics-legend');
    for (const entry of legend) {
      const key = element('span', 'metrics-legend-item');
      const line = element('span', 'metrics-legend-key');
      line.style.background = entry.color;
      key.append(line, document.createTextNode(entry.name));
      keys.append(key);
    }
    box.append(keys);
  }
  parent.append(box);
  return box;
}

/** Os gráficos são redesenhados na largura do cartão quando a janela muda de tamanho. */
const redraws: (() => void)[] = [];
function plot(parent: HTMLElement, draw: (host: HTMLElement) => void, rows?: { head: string[]; rows: string[][] }): void {
  const host = element('div', 'metrics-plot');
  parent.append(host);
  const run = () => draw(host);
  redraws.push(run);
  requestAnimationFrame(run);
  if (rows) {
    const details = element('details', 'metrics-details');
    details.append(element('summary', '', 'Ver tabela'), table(rows.head, rows.rows));
    parent.append(details);
  }
}

function render(content: HTMLElement, report: Report): void {
  redraws.length = 0;
  content.replaceChildren();
  const series = report.series;
  const labels = series.map((s) => shortDay(s.day));
  const titles = series.map((s) => longDay(s.day));
  const today = series.at(-1);
  const usage = report.usage;

  const now = section(content, 'Agora');
  const tick = report.now.tick;
  tiles(now, [
    { label: 'Jogadores online', value: report.now.available ? integer.format(report.now.players) : '—', note: report.now.available ? undefined : 'servidor do jogo sem resposta' },
    { label: 'Cafés ativos', value: report.now.available ? integer.format(report.now.rooms) : '—' },
    { label: 'Passo de simulação p95', value: tick?.p95Ms !== undefined ? `${tick.p95Ms.toLocaleString('pt-BR')} ms` : '—', note: tick?.p99Ms !== undefined ? `p99 ${tick.p99Ms.toLocaleString('pt-BR')} ms` : undefined },
    { label: 'Contas', value: integer.format(report.accounts) },
  ]);
  const online = card(now, 'Jogadores online nas últimas 24 h');
  if (report.onlineToday.length > 1) {
    const hours = report.onlineToday.map((p) => new Date(p.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    plot(online, (host) => lineChart(host, hours, [{ name: 'Jogadores online', color: SERIES[0], values: report.onlineToday.map((p) => p.players) }], compactNumber));
  } else {
    online.append(element('p', 'metrics-empty', 'A contagem é registrada a cada 5 minutos; ainda não há amostras suficientes.'));
  }

  const players = section(content, 'Jogadores', report.staff ? 'Inclui as contas da equipe.' : 'Contas de administração ficam de fora.');
  const total = (key: keyof DaySeries) => sum(series.map((s) => Number(s[key])));
  const sessionsTotal = total('sessions');
  tiles(players, [
    { label: 'Ativos hoje', value: integer.format(today?.dau ?? 0) },
    { label: 'Ativos em 7 dias', value: integer.format(today?.wau ?? 0) },
    { label: 'Ativos em 30 dias', value: integer.format(today?.mau ?? 0) },
    { label: 'Contas novas no período', value: integer.format(total('newAccounts')) },
    { label: 'Sessões no período', value: integer.format(sessionsTotal), note: sessionsTotal > 0 ? `média de ${minutes(total('sessionMinutes') / sessionsTotal)}` : undefined },
  ]);
  const grid = element('div', 'metrics-grid');
  players.append(grid);
  const active = card(grid, 'Jogadores ativos por dia', [{ name: 'No dia', color: SERIES[0] }, { name: 'Nos últimos 7 dias', color: SERIES[1] }]);
  plot(active, (host) => lineChart(host, labels, [
    { name: 'No dia', color: SERIES[0], values: series.map((s) => s.dau) },
    { name: 'Nos últimos 7 dias', color: SERIES[1], values: series.map((s) => s.wau) },
  ], compactNumber, titles), { head: ['Dia', 'No dia', '7 dias', '30 dias', 'Contas novas'], rows: series.map((s) => [shortDay(s.day), integer.format(s.dau), integer.format(s.wau), integer.format(s.mau), integer.format(s.newAccounts)]) });
  const sessions = card(grid, 'Sessões por dia');
  plot(sessions, (host) => columnChart(host, labels, series.map((s) => s.sessions), 'Sessões', compactNumber, titles), {
    head: ['Dia', 'Sessões', 'Tempo total', 'Mediana'],
    rows: series.map((s) => [shortDay(s.day), integer.format(s.sessions), minutes(s.sessionMinutes), s.sessions ? minutes(s.sessionP50) : '—']),
  });

  const retention = section(content, 'Retenção por onda de convite', 'Das contas criadas há pelo menos N dias, quantas jogaram no N-ésimo dia depois do cadastro.');
  const cell = (c: RetentionCell) => c.eligible ? `${percent(c.retained, c.eligible)} (${c.retained}/${c.eligible})` : '—';
  retention.append(table(['Onda', 'Contas', '1 dia', '7 dias', '30 dias'], report.retention
    .filter((row) => row.users > 0)
    .map((row) => [row.wave === 'todas' ? 'Todas' : row.wave === '0' ? 'Sem onda' : `Onda ${row.wave}`, integer.format(row.users), cell(row.d1), cell(row.d7), cell(row.d30)])));

  const funnel = section(content, 'Funil desde o início do alpha', 'Os marcos de cozinhar e servir contam a partir da ativação da telemetria.');
  const first = report.funnel[0]?.count ?? 0;
  barList(funnel, report.funnel.map((step, i) => ({
    name: step.name, value: step.count,
    note: i === 0 ? undefined : percent(step.count, first || report.funnel[1]?.count || 0),
  })), integer.format);

  const use = section(content, 'Uso no período');
  const useGrid = element('div', 'metrics-grid');
  use.append(useGrid);
  const list = (title: string, items: NamedCount[] | undefined, name: (item: NamedCount) => string = (item) => item.name || item.label) => {
    barList(card(useGrid, title), (items ?? []).map((item) => ({ name: name(item), value: item.count })), integer.format);
  };
  list('Telas abertas', usage.screens, (item) => SCREENS[item.label] ?? item.label);
  list('Receitas cozidas', usage.recipes);
  list('Itens comprados', usage.items);
  list('Encomendas', usage.supplies);
  list('Sucos servidos', usage.juices);
  list('Temperos comprados', usage.spices);
  list('Expansões', usage.expansions, (item) => EXPANSIONS[item.label] ?? item.label);

  const economy = section(content, 'Economia no período', 'Cada mudança de caféOuros, caféGranas e XP vem do extrato registrado no servidor.');
  const ecoGrid = element('div', 'metrics-grid');
  economy.append(ecoGrid);
  const gold = card(ecoGrid, 'caféOuros por dia', [{ name: 'Ganhos', color: SERIES[0] }, { name: 'Gastos', color: SERIES[1] }]);
  plot(gold, (host) => lineChart(host, labels, [
    { name: 'Ganhos', color: SERIES[0], values: series.map((s) => s.goldIn) },
    { name: 'Gastos', color: SERIES[1], values: series.map((s) => s.goldOut) },
  ], compactNumber, titles), { head: ['Dia', 'Ganhos', 'Gastos', 'caféGranas ganhas', 'caféGranas gastas', 'XP'], rows: series.map((s) => [shortDay(s.day), integer.format(s.goldIn), integer.format(s.goldOut), integer.format(s.cashIn), integer.format(s.cashOut), integer.format(s.xp)]) });
  const reasons = card(ecoGrid, 'De onde vem e para onde vai');
  const rows = (report.economy ?? []).map((row) => [CURRENCIES[row.currency] ?? row.currency, REASONS[row.reason] ?? row.reason,
    row.in ? `+${integer.format(row.in)}` : '', row.out ? `−${integer.format(row.out)}` : '', integer.format(row.count)]);
  if (rows.length) reasons.append(table(['Moeda', 'Motivo', 'Ganho', 'Gasto', 'Registros'], rows, 2));
  else reasons.append(element('p', 'metrics-empty', 'Nada registrado no período.'));

  const health = section(content, 'Saúde');
  const loads = series.filter((s) => s.loadP50 > 0);
  tiles(health, [
    { label: 'Carregamento (mediana)', value: loads.length ? seconds(loads.at(-1)!.loadP50) : '—', note: loads.length ? `p95 ${seconds(loads.at(-1)!.loadP95)}` : undefined },
    { label: 'FPS (mediana)', value: series.some((s) => s.fpsP50) ? integer.format(series.filter((s) => s.fpsP50).at(-1)!.fpsP50) : '—' },
    { label: 'Erros de JavaScript', value: integer.format(total('errors')) },
    { label: 'Desconexões', value: integer.format(total('disconnects')) },
  ]);
  const healthGrid = element('div', 'metrics-grid');
  health.append(healthGrid);
  const load = card(healthGrid, 'Tempo até o café aparecer', [{ name: 'Mediana', color: SERIES[0] }, { name: 'p95', color: SERIES[1] }]);
  plot(load, (host) => lineChart(host, labels, [
    { name: 'Mediana', color: SERIES[0], values: series.map((s) => s.loadP50 || null) },
    { name: 'p95', color: SERIES[1], values: series.map((s) => s.loadP95 || null) },
  ], seconds, titles));
  barList(card(healthGrid, 'Como as sessões terminaram'), (report.health.sessionEnds ?? []).map((item) => ({ name: SESSION_ENDS[item.label] ?? `Código ${item.label}`, value: item.count })), integer.format);
  barList(card(healthGrid, 'Desconexões vistas pelo jogo'), (report.health.disconnects ?? []).map((item) => ({ name: CLOSE_CODES[item.label] ?? `Código ${item.label}`, value: item.count })), integer.format);
  const errors = card(healthGrid, 'Erros de JavaScript mais comuns');
  barList(errors, (report.health.errors ?? []).map((item) => ({ name: item.label, value: item.count })), integer.format, 'Nenhum erro no período.');

  const waitlist = section(content, 'Lista de espera');
  tiles(waitlist, [
    { label: 'Aguardando confirmar o email', value: integer.format(report.waitlist.pending) },
    { label: 'Confirmados na fila', value: integer.format(report.waitlist.confirmed) },
    { label: 'Convidados', value: integer.format(report.waitlist.invited) },
    { label: 'Criaram a conta', value: integer.format(report.waitlist.joined) },
  ]);

  const footer = element('p', 'metrics-note');
  footer.textContent = `Atualizado às ${new Date(report.generatedAt).toLocaleTimeString('pt-BR')}. Dias no horário de Brasília. Eventos brutos ficam 90 dias; os resumos diários ficam guardados.`
    + (report.dropped ? ` ${integer.format(report.dropped)} eventos foram descartados desde que o servidor ligou (fila cheia ou falha de gravação).` : '');
  content.append(footer);
}

/** Painel de métricas do alpha (`/admin/metricas`), só para o papel admin. */
export async function renderMetricsPage(host: HTMLElement, session: PlayerSession | null): Promise<void> {
  document.body.classList.remove('auth-page');
  document.body.classList.add('metrics-page');
  if (!session) {
    window.location.replace('/?entrar');
    return;
  }
  host.innerHTML = `
    <main class="metrics">
      <header class="metrics-header">
        <a href="/"><img src="/assets/ui/logo/cafe-mania.png" alt="Café Mania" width="957" height="510"></a>
        <h1>Métricas do alpha</h1>
      </header>
      <div class="metrics-filters" role="group" aria-label="Período">
        <button type="button" data-days="7">7 dias</button>
        <button type="button" data-days="30">30 dias</button>
        <button type="button" data-days="90">90 dias</button>
        <label><input type="checkbox" name="staff"> Incluir contas da equipe</label>
        <button type="button" class="metrics-refresh">Atualizar</button>
      </div>
      <p class="metrics-error" role="alert"></p>
      <div class="metrics-content" aria-live="polite"><p class="metrics-empty">Carregando…</p></div>
    </main>`;
  const content = host.querySelector<HTMLElement>('.metrics-content')!;
  const errorBox = host.querySelector<HTMLElement>('.metrics-error')!;
  const staff = host.querySelector<HTMLInputElement>('input[name="staff"]')!;
  let days = 30;
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('[data-days]')];
  const load = async () => {
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.days) === days)));
    content.classList.add('is-loading');
    errorBox.textContent = '';
    try {
      const response = await fetch(`/api/coffe/admin/metrics?days=${days}&staff=${staff.checked ? 1 : 0}`, { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { window.location.replace('/?entrar'); return; }
      if (response.status === 403) { content.replaceChildren(element('p', 'metrics-empty', 'Esta página é só da administração do alpha.')); return; }
      if (!response.ok) throw new Error();
      render(content, await response.json() as Report);
    } catch {
      errorBox.textContent = 'Não foi possível carregar as métricas. Tente atualizar.';
    } finally {
      content.classList.remove('is-loading');
    }
  };
  buttons.forEach((button) => button.addEventListener('click', () => { days = Number(button.dataset.days); void load(); }));
  staff.addEventListener('change', () => void load());
  host.querySelector('.metrics-refresh')!.addEventListener('click', () => void load());
  let resize = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resize); resize = requestAnimationFrame(() => redraws.forEach((draw) => draw())); });
  await load();
}
