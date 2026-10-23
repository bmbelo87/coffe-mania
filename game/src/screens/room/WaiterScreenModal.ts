import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../../core/stage';
import { releaseNpcAvatar, type NpcAvatarSource } from '../../avatar/NpcAvatarSource';
import type { BakedAvatarBundle } from '../../avatar/bake';
import { WaiterClient, type Employee, type WaiterSnapshot } from '../../game/waiters';
import { PopupOpening } from './PopupOpening';
import { fitJuiceImage, juicePart, juiceText } from './JuiceInterfaceParts';

interface Art { panel: Texture; lock: Texture; button: Texture; close: Texture; arrow: Texture; waiter: Texture }
// Centers of the yellow side rails, in the panel's 412px logical coordinate space.
const PAGE_ARROW_INSET = 16;
let artPromise: Promise<Art> | undefined;
function loadArt(): Promise<Art> {
  return artPromise ??= (async () => {
    const url = (file: string) => new URL(`assets/ui/${file}`, new URL(import.meta.env.BASE_URL, document.baseURI)).href;
    const [panel, lock, button, close, arrow, waiter] = await Promise.all([
      'employees/panel.png', 'padlock.png', 'cafe-welcome/ok-button.png', 'spices/button-close.png',
      'recipe-book/page-arrow.png', 'level-up/waiter.png',
    ].map(file => Assets.load<Texture>(url(file))));
    return { panel, lock, button, close, arrow, waiter };
  })().catch(error => { artPromise = undefined; throw error; });
}

/** Four modular cards, following archive P039. Local candidates stand in for Orkut friends. */
export class WaiterScreenModal {
  readonly view = new Container();
  private readonly panel = new Container();
  private readonly popup: PopupOpening;
  private art?: Art;
  private snapshot?: WaiterSnapshot;
  private page = 0;
  private picking = false;
  private busy = false;
  private message = '';
  private disposed = false;
  private generation = 0;
  private controller?: AbortController;
  private readonly portraits = new Map<string, { bundle: BakedAvatarBundle; texture: Texture }>();
  private readonly loadingPortraits = new Set<string>();

  constructor(private readonly avatarSource?: NpcAvatarSource, private readonly client = new WaiterClient()) {
    this.view.label = 'waiter-screen-modal'; this.view.visible = false;
    const backdrop = new Graphics().rect(-12000, -12000, 24000, 24000).fill({ color: 0x342c23, alpha: .38 });
    backdrop.eventMode = 'static';
    for (const event of ['pointerdown', 'pointerup', 'pointertap', 'wheel'] as const) backdrop.on(event, e => e.stopPropagation());
    this.panel.scale.set(1.85);
    this.panel.position.set((STAGE_WIDTH - 412 * 1.85) / 2, (STAGE_HEIGHT - 449 * 1.85) / 2);
    this.panel.hitArea = new Rectangle(0, 0, 412, 449); this.panel.eventMode = 'static';
    for (const event of ['pointerdown', 'pointerup', 'pointertap', 'wheel'] as const) this.panel.on(event, e => e.stopPropagation());
    this.view.addChild(backdrop, this.panel);
    this.popup = new PopupOpening(this.panel, STAGE_WIDTH / 2, STAGE_HEIGHT / 2, backdrop);
    window.addEventListener('keydown', this.onKey, true);
  }
  get isOpen(): boolean { return this.view.visible; }
  async open(): Promise<void> {
    this.close(); this.view.visible = true; this.page = 0; this.picking = false; this.message = 'Carregando…';
    this.controller = new AbortController();
    const revision = ++this.generation;
    this.popup.open(); this.draw();
    try {
      const [art, snapshot] = await Promise.all([loadArt(), this.client.request()]);
      if (this.disposed || revision !== this.generation) return;
      this.art = art; this.snapshot = snapshot; this.message = '';
    } catch (error) { if (revision === this.generation) this.message = error instanceof Error ? error.message : 'Tente novamente.'; }
    if (!this.disposed && revision === this.generation) this.draw();
  }
  close(): void {
    this.view.visible = false; this.generation++; this.controller?.abort(); this.loadingPortraits.clear();
    for (const { texture, bundle } of this.portraits.values()) { texture.destroy(); releaseNpcAvatar(bundle); }
    this.portraits.clear();
  }
  update(deltaMs: number): void { if (this.isOpen) this.popup.update(deltaMs); }
  private readonly onKey = (event: KeyboardEvent) => {
    if (this.isOpen && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); }
  };
  private button(label: string, x: number, y: number, width: number, click: () => void, enabled = true): Container {
    const view = new Container(); view.position.set(x, y); view.label = 'employee-button:' + label;
    view.addChild(juicePart(this.art!.button, 0, 0, width, 26));
    const text = juiceText(label, width / 2, 13, 14, 0xffffff); text.anchor.set(.5); view.addChild(text);
    view.eventMode = enabled ? 'static' : 'none'; view.alpha = enabled ? 1 : .5;
    view.cursor = 'pointer'; view.hitArea = new Rectangle(0, 0, width, 26);
    view.on('pointertap', event => { event.stopPropagation(); click(); });
    return view;
  }
  private async hire(employee: Employee): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.message = ''; const revision = this.generation; this.draw();
    try {
      const snapshot = await this.client.request(employee.id);
      if (revision !== this.generation || this.disposed) return;
      this.snapshot = snapshot; this.picking = false; this.page = Math.floor((snapshot.employees.length - 1) / 4);
      this.message = `${employee.name} já está trabalhando no café!`;
    } catch (error) { if (revision === this.generation) this.message = error instanceof Error ? error.message : 'Tente novamente.'; }
    finally { this.busy = false; if (!this.disposed && revision === this.generation) this.draw(); }
  }
  private portrait(employee: Employee, x: number, y: number): void {
    const cached = this.portraits.get(employee.id);
    this.panel.addChild(fitJuiceImage(cached?.texture ?? this.art!.waiter, x, y, 97, 87));
    if (cached || this.loadingPortraits.has(employee.id) || !this.avatarSource?.bakePortrait || !this.controller) return;
    this.loadingPortraits.add(employee.id);
    const revision = this.generation;
    void this.avatarSource.bakePortrait(employee.appearance, this.controller.signal).then(bundle => {
      if (this.disposed || revision !== this.generation) { releaseNpcAvatar(bundle); return; }
      const cell = bundle.baked.cells.find(frame => frame.clip === 0 && frame.direction === 0) ?? bundle.baked.cells[0];
      const size = bundle.baked.cell;
      let frame = new Rectangle(cell.x, cell.y, size, size);
      // Bake cells include walking margins; size cards by the visible avatar instead.
      const context = bundle.baked.canvas.getContext('2d');
      if (context) {
        const pixels = context.getImageData(cell.x, cell.y, size, size).data;
        let left = size, top = size, right = -1, bottom = -1;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          if (pixels[(y * size + x) * 4 + 3] <= 8) continue;
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (right >= left && bottom >= top) frame = new Rectangle(cell.x + left, cell.y + top, right - left + 1, bottom - top + 1);
      }
      const texture = new Texture({ source: bundle.texture.source, frame });
      this.portraits.set(employee.id, { bundle, texture }); this.draw();
    }).catch(() => { /* Keep the existing uniform icon while a portrait is unavailable. */ });
  }
  private draw(): void {
    for (const child of this.panel.removeChildren()) child.destroy({ children: true });
    if (!this.art) { this.panel.addChild(juiceText(this.message, 206, 200, 17)); return; }
    this.panel.addChild(juicePart(this.art.panel, 0, 0, 412, 449));
    const title = juiceText(this.picking ? 'Escolha um empregado' : 'Empregados', 206, 23, this.picking ? 24 : 28);
    title.anchor.set(.5, 0); this.panel.addChild(title);
    const subtitle = juiceText(this.picking ? 'Escolha quem vai trabalhar no seu Café.' : 'Contrate bons empregados e mantenha seu público satisfeito!', 43, 60, 12, 0x956441, '400');
    subtitle.style.wordWrap = true; subtitle.style.wordWrapWidth = 324; this.panel.addChild(subtitle);
    const close = new Sprite(this.art.close); close.position.set(354, -9); close.width = 30; close.height = 30;
    close.eventMode = 'static'; close.cursor = 'pointer'; close.on('pointertap', () => this.close()); this.panel.addChild(close);
    const state = this.snapshot;
    if (!state) { this.panel.addChild(juiceText(this.message, 60, 170, 15)); return; }
    const candidates = state.candidates.filter(candidate => !state.employees.some(employee => employee.id === candidate.id));
    const total = this.picking ? candidates.length : state.unlockLevels.length;
    const pages = Math.max(1, Math.ceil(total / 4)); this.page = Math.min(this.page, pages - 1);
    for (let i = 0; i < 4; i++) {
      const slot = this.page * 4 + i; const x = i % 2 ? 215 : 48; const y = i < 2 ? 111 : 274;
      const employee = this.picking ? candidates[slot] : state.employees[slot];
      if (employee) {
        const name = juiceText(employee.name, x + 74, y + 8, 17, 0x76634c); name.anchor.set(.5, 0); this.panel.addChild(name);
        this.portrait(employee, x + 25, y + 26);
        if (this.picking && this.message) { const status = juiceText(this.message, 206, 94, 10, 0xb03014); status.anchor.set(.5); if (status.width > 320) status.scale.set(320 / status.width); this.panel.addChild(status); }
    if (this.picking) this.panel.addChild(this.button('Contratar', x + 22, y + 112, 102, () => { void this.hire(employee); }, !this.busy));
        else { const status = juiceText('Trabalhando', x + 74, y + 113, 12, 0x548a38); status.anchor.set(.5, 0); this.panel.addChild(status); }
      } else if (!this.picking && slot < state.slots) {
        const label = juiceText('Vaga disponível', x + 74, y + 12, 15, 0x76634c); label.anchor.set(.5, 0); this.panel.addChild(label);
        this.panel.addChild(fitJuiceImage(this.art.waiter, x + 45, y + 42, 55, 57));
        this.panel.addChild(this.button('Contratar', x + 22, y + 112, 102, () => { this.picking = true; this.page = 0; this.draw(); }, !this.busy));
      } else {
        const label = juiceText('Bloqueado', x + 74, y + 13, 19, 0x929292); label.anchor.set(.5, 0); this.panel.addChild(label);
        this.panel.addChild(fitJuiceImage(this.art.lock, x + 51, y + 48, 46, 61));
        const level = state.unlockLevels[slot];
        const info = juiceText(level ? `Nível ${level}` : 'Em breve', x + 74, y + 115, 12, 0x929292); info.anchor.set(.5, 0); this.panel.addChild(info);
      }
    }
    for (const [direction, x] of [[-1, PAGE_ARROW_INSET], [1, 412 - PAGE_ARROW_INSET]] as const) {
      const arrow = new Sprite(this.art.arrow); arrow.anchor.set(.5); arrow.position.set(x, 251); arrow.width = 24; arrow.height = 30;
      if (direction > 0) arrow.scale.x *= -1;
      const enabled = this.page + direction >= 0 && this.page + direction < pages;
      arrow.alpha = enabled ? 1 : .3; arrow.eventMode = enabled ? 'static' : 'none'; arrow.cursor = 'pointer';
      arrow.on('pointertap', () => { this.page += direction; this.draw(); }); this.panel.addChild(arrow);
    }
    if (this.picking) this.panel.addChild(this.button('Voltar', 155, 420, 100, () => { this.picking = false; this.page = 0; this.draw(); }));
    else {
      const status = juiceText(this.message || `${state.employees.length}/${state.slots} empregados · ${this.page + 1}/${pages}`, 206, 426, 11, 0x956441, '400');
      status.anchor.set(.5); if (status.width > 370) status.scale.set(370 / status.width); this.panel.addChild(status);
    }
  }
  destroy(): void { this.disposed = true; this.close(); window.removeEventListener('keydown', this.onKey, true); this.view.destroy({ children: true }); }
}
