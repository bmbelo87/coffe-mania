/**
 * Gráficos do painel de métricas, em SVG próprio (sem bibliotecas). Cores de série validadas
 * contra a superfície creme #fffdf7: azul #2a78d6 e laranja #eb6834. Textos usam sempre as
 * cores de texto, nunca a da série; a identidade vem da linha ou barra ao lado.
 */

export const SERIES = ['#2a78d6', '#eb6834'] as const;
const SVG = 'http://www.w3.org/2000/svg';
const INK = '#66401e';
const MUTED = '#8a7660';
const GRID = '#ece4d6';

export interface LineSeries { name: string; color: string; values: (number | null)[] }

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** Topo da escala arredondado para 1, 2 ou 5 × 10ⁿ, com 4 divisões. */
function niceMax(value: number): number {
  if (value <= 0) return 4;
  const step = value / 4;
  const power = 10 ** Math.floor(Math.log10(step));
  const nice = [1, 2, 2.5, 5, 10].find((n) => n * power >= step) ?? 10;
  return nice * power * 4;
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
export const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
export function compactNumber(value: number): string { return value >= 1000 ? compact.format(value) : integer.format(value); }

let tip: HTMLDivElement | undefined;
function tooltip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'metrics-tip';
    tip.setAttribute('role', 'status');
    document.body.append(tip);
  }
  return tip;
}

/** Valor em destaque, nome da série depois, com a marca da cor ao lado. */
export function showTip(x: number, y: number, title: string, rows: { color?: string; value: string; name: string }[]): void {
  const box = tooltip();
  box.replaceChildren();
  const head = document.createElement('div');
  head.className = 'metrics-tip-title';
  head.textContent = title;
  box.append(head);
  for (const row of rows) {
    const line = document.createElement('div');
    line.className = 'metrics-tip-row';
    if (row.color) {
      const key = document.createElement('span');
      key.className = 'metrics-tip-key';
      key.style.background = row.color;
      line.append(key);
    }
    const value = document.createElement('strong');
    value.textContent = row.value;
    const name = document.createElement('span');
    name.textContent = row.name;
    line.append(value, name);
    box.append(line);
  }
  box.style.display = 'block';
  const width = box.offsetWidth;
  box.style.left = `${Math.min(window.innerWidth - width - 8, x + 14)}px`;
  box.style.top = `${Math.max(8, y - box.offsetHeight - 10)}px`;
}
export function hideTip(): void { if (tip) tip.style.display = 'none'; }

interface Frame { width: number; height: number; left: number; right: number; top: number; bottom: number; max: number }

function axes(root: SVGSVGElement, frame: Frame, labels: string[], format: (n: number) => string): void {
  const plotH = frame.height - frame.top - frame.bottom;
  for (let i = 0; i <= 4; i++) {
    const y = frame.top + plotH - (plotH * i) / 4;
    root.append(svg('line', { x1: frame.left, x2: frame.width - frame.right, y1: y, y2: y, stroke: GRID, 'stroke-width': 1 }));
    const tick = svg('text', { x: frame.left - 6, y: y + 4, 'text-anchor': 'end', fill: MUTED, 'font-size': 11 });
    tick.textContent = format((frame.max * i) / 4);
    root.append(tick);
  }
  const plotW = frame.width - frame.left - frame.right;
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(plotW / 56))));
  labels.forEach((label, i) => {
    if (i % every !== 0 && i !== labels.length - 1) return;
    if (i !== labels.length - 1 && labels.length - 1 - i < every / 2) return;
    const x = labels.length === 1 ? frame.left + plotW / 2 : frame.left + (plotW * i) / (labels.length - 1);
    const text = svg('text', { x, y: frame.height - 6, 'text-anchor': 'middle', fill: MUTED, 'font-size': 11 });
    text.textContent = label;
    root.append(text);
  });
}

/**
 * Linhas de 2 px sobre a mesma escala, com mira vertical que encaixa no dia mais próximo e
 * uma dica com todas as séries daquele dia. O último valor de cada série é rotulado.
 */
export function lineChart(host: HTMLElement, labels: string[], series: LineSeries[], format: (n: number) => string, titles = labels): void {
  if (!series.some((s) => s.values.some((v) => v !== null && v > 0))) {
    const none = document.createElement('p');
    none.className = 'metrics-empty';
    none.textContent = 'Nada registrado no período.';
    host.replaceChildren(none);
    return;
  }
  const width = Math.max(280, host.clientWidth), height = 210;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const frame: Frame = { width, height, left: 44, right: 54, top: 12, bottom: 24, max };
  const root = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' });
  axes(root, frame, labels, (n) => format(n));
  const plotW = width - frame.left - frame.right, plotH = height - frame.top - frame.bottom;
  const x = (i: number) => labels.length === 1 ? frame.left + plotW / 2 : frame.left + (plotW * i) / (labels.length - 1);
  const y = (v: number) => frame.top + plotH - (plotH * v) / max;
  for (const s of series) {
    let d = '';
    s.values.forEach((v, i) => { if (v !== null) d += `${d && s.values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
    root.append(svg('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    let lastIndex = s.values.length - 1;
    while (lastIndex >= 0 && s.values[lastIndex] === null) lastIndex--;
    if (lastIndex >= 0) {
      const v = s.values[lastIndex]!;
      root.append(svg('circle', { cx: x(lastIndex), cy: y(v), r: 4, fill: s.color, stroke: '#fffdf7', 'stroke-width': 2 }));
      const label = svg('text', { x: x(lastIndex) + 8, y: y(v) + 4, fill: INK, 'font-size': 12, 'font-weight': 600 });
      label.textContent = format(v);
      root.append(label);
    }
  }
  const cross = svg('line', { y1: frame.top, y2: frame.top + plotH, stroke: MUTED, 'stroke-width': 1, visibility: 'hidden' });
  root.append(cross);
  const hit = svg('rect', { x: frame.left - 8, y: 0, width: plotW + 16, height, fill: 'transparent', tabindex: 0 });
  const point = (clientX: number, clientY: number, i?: number) => {
    const box = root.getBoundingClientRect();
    const index = i ?? Math.round(((clientX - box.left - frame.left) / plotW) * (labels.length - 1));
    const at = Math.min(labels.length - 1, Math.max(0, index));
    cross.setAttribute('x1', String(x(at)));
    cross.setAttribute('x2', String(x(at)));
    cross.setAttribute('visibility', 'visible');
    showTip(clientX, clientY, titles[at] ?? '', series.map((s) => ({ color: s.color, name: s.name, value: s.values[at] === null ? '—' : format(s.values[at]!) })));
    return at;
  };
  let focused = labels.length - 1;
  hit.addEventListener('pointermove', (event) => { focused = point(event.clientX, event.clientY); });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  hit.addEventListener('focus', () => { const box = root.getBoundingClientRect(); point(box.left + x(focused), box.top + frame.top, focused); });
  hit.addEventListener('blur', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  hit.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    focused = Math.min(labels.length - 1, Math.max(0, focused + (event.key === 'ArrowRight' ? 1 : -1)));
    const box = root.getBoundingClientRect();
    point(box.left + x(focused), box.top + frame.top, focused);
  });
  root.append(hit);
  host.replaceChildren(root);
}

/** Colunas de até 24 px, ponta arredondada de 4 px e base reta; cada coluna tem sua dica. */
export function columnChart(host: HTMLElement, labels: string[], values: number[], name: string, format: (n: number) => string, titles = labels): void {
  const width = Math.max(280, host.clientWidth), height = 190;
  const max = niceMax(Math.max(0, ...values));
  const frame: Frame = { width, height, left: 44, right: 12, top: 12, bottom: 24, max };
  const root = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' });
  const plotW = width - frame.left - frame.right, plotH = height - frame.top - frame.bottom;
  const band = plotW / Math.max(1, labels.length);
  const barW = Math.max(2, Math.min(24, band - 2));
  // The axis labels are centered on each band, like the bars.
  const centers = labels.map((_, i) => frame.left + band * i + band / 2);
  for (let i = 0; i <= 4; i++) {
    const y = frame.top + plotH - (plotH * i) / 4;
    root.append(svg('line', { x1: frame.left, x2: width - frame.right, y1: y, y2: y, stroke: GRID, 'stroke-width': 1 }));
    const tick = svg('text', { x: frame.left - 6, y: y + 4, 'text-anchor': 'end', fill: MUTED, 'font-size': 11 });
    tick.textContent = format((max * i) / 4);
    root.append(tick);
  }
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(plotW / 56))));
  values.forEach((value, i) => {
    const h = (plotH * value) / max;
    const left = centers[i]! - barW / 2, base = frame.top + plotH;
    const r = Math.min(4, barW / 2, h);
    if (h > 0) {
      root.append(svg('path', {
        d: `M${left},${base}V${base - h + r}Q${left},${base - h} ${left + r},${base - h}H${left + barW - r}Q${left + barW},${base - h} ${left + barW},${base - h + r}V${base}Z`,
        fill: SERIES[0],
      }));
    }
    const hit = svg('rect', { x: centers[i]! - band / 2, y: frame.top, width: band, height: plotH, fill: 'transparent', tabindex: 0 });
    const show = (cx: number, cy: number) => showTip(cx, cy, titles[i] ?? '', [{ color: SERIES[0], name, value: format(value) }]);
    hit.addEventListener('pointermove', (event) => show(event.clientX, event.clientY));
    hit.addEventListener('pointerleave', hideTip);
    hit.addEventListener('focus', () => { const box = hit.getBoundingClientRect(); show(box.left + box.width / 2, box.top + plotH - h); });
    hit.addEventListener('blur', hideTip);
    root.append(hit);
    if (i % every === 0 || i === labels.length - 1) {
      if (i !== labels.length - 1 && labels.length - 1 - i < every / 2) return;
      const text = svg('text', { x: centers[i]!, y: height - 6, 'text-anchor': 'middle', fill: MUTED, 'font-size': 11 });
      text.textContent = labels[i]!;
      root.append(text);
    }
  });
  host.replaceChildren(root);
}

/**
 * Barras horizontais com o valor na ponta: nome à esquerda, todas as barras na mesma escala.
 * A lista entra no fim do elemento, depois do título do cartão.
 */
export function barList(host: HTMLElement, items: { name: string; value: number; note?: string }[], format: (n: number) => string, empty = 'Nada registrado no período.'): void {
  if (items.length === 0) {
    const none = document.createElement('p');
    none.className = 'metrics-empty';
    none.textContent = empty;
    host.append(none);
    return;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  const list = document.createElement('ol');
  list.className = 'metrics-bars';
  for (const item of items) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'metrics-bar-name';
    name.textContent = item.name;
    name.title = item.name;
    const track = document.createElement('span');
    track.className = 'metrics-bar-track';
    const bar = document.createElement('span');
    bar.className = 'metrics-bar';
    bar.style.width = `${Math.max(1, (item.value / max) * 100)}%`;
    const value = document.createElement('span');
    value.className = 'metrics-bar-value';
    value.textContent = format(item.value) + (item.note ? ` · ${item.note}` : '');
    track.append(bar, value);
    row.append(name, track);
    list.append(row);
  }
  host.append(list);
}

/** Tabela simples; o conteúdo entra como texto. */
export function table(head: string[], rows: string[][], numericFrom = 1): HTMLTableElement {
  const element = document.createElement('table');
  element.className = 'metrics-table';
  const thead = element.createTHead().insertRow();
  head.forEach((label, i) => {
    const cell = document.createElement('th');
    cell.textContent = label;
    if (i >= numericFrom) cell.className = 'num';
    thead.append(cell);
  });
  const body = element.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    row.forEach((value, i) => {
      const cell = tr.insertCell();
      cell.textContent = value;
      if (i >= numericFrom) cell.className = 'num';
    });
  }
  return element;
}
