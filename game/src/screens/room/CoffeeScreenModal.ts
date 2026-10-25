import { Container, Graphics, NineSliceSprite, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../../core/stage';
import { COFFEE_GROUPS, CoffeeClient, coffeeMastery, loadCoffeeArt, loadCoffeeInterfaceArt,
  type CoffeeGroup, type CoffeeInterfaceArt, type CoffeeRecipe, type CoffeeSnapshot } from '../../game/coffees';
import type { PlayerState } from '../../game/player-state';
import { PopupOpening } from './PopupOpening';
import { coffeeCard } from './CoffeeCardParts';
import { coffeeTabSkin } from './CoffeeTabParts';

export const COFFEE_LAYOUT = {
  width: 648, height: 586, scale: 1.4,
  tabs: { x: 24, y: 117, width: 147, height: 43, activeHeight: 47, stemHeight: 74, gap: 4 },
  rows: { x: 215, y: 170, width: 391, height: 89, step: 94 },
} as const;

function label(value: string, x: number, y: number, size: number, color = 0x633611, bold = false, stroke?: number) {
  const result = new Text({ text: value, resolution: 2, style: new TextStyle({ fontFamily: bold ? ['Arial Black', 'Arial', 'sans-serif'] : ['Arial', 'sans-serif'], fontSize: size,
    fontWeight: bold ? '700' : '400', fill: color, padding: 3,
    ...(stroke === undefined ? {} : { stroke: { color: stroke, width: 3, join: 'round' } }) }) });
  result.position.set(x, y); result.eventMode = 'none'; return result;
}
function image(texture: Texture, x: number, y: number, width: number, height: number) {
  const sprite = new Sprite(texture); sprite.anchor.set(.5);
  sprite.scale.set(Math.min(width / texture.width, height / texture.height));
  sprite.position.set(x + width / 2, y + height / 2); sprite.eventMode = 'none'; return sprite;
}

/** New-generation coffee layout, independent of juice batches and the old turquoise panel. */
export class CoffeeScreenModal {
  readonly view = new Container();
  private readonly panel = new Container();
  private readonly popup: PopupOpening;
  private machineId = '';
  private group: CoffeeGroup = 'basic';
  private state?: CoffeeSnapshot;
  private art?: CoffeeInterfaceArt;
  private recipes: CoffeeRecipe[] = [];
  private textures = new Map<string, Texture>();
  private message = '';
  private help = false;
  private busy = false;
  private disposed = false;
  private generation = 0;
  private snapshotSerial = 0;

  constructor(private readonly client: CoffeeClient, private readonly onState: (state: PlayerState) => void) {
    this.view.label = 'coffee-modal'; this.view.visible = false;
    const backdrop = new Graphics().rect(-12000, -12000, 24000, 24000).fill({ color: 0x000000, alpha: .3 });
    backdrop.eventMode = 'static'; backdrop.hitArea = new Rectangle(-12000, -12000, 24000, 24000);
    for (const event of ['pointerdown', 'pointerup', 'wheel'] as const) backdrop.on(event, e => e.stopPropagation());
    backdrop.on('pointertap', e => { e.stopPropagation(); this.close(); });
    this.panel.scale.set(COFFEE_LAYOUT.scale);
    this.panel.position.set((STAGE_WIDTH - COFFEE_LAYOUT.width * COFFEE_LAYOUT.scale) / 2,
      (STAGE_HEIGHT - COFFEE_LAYOUT.height * COFFEE_LAYOUT.scale) / 2);
    this.panel.eventMode = 'static'; this.panel.hitArea = new Rectangle(0, 0, COFFEE_LAYOUT.width, COFFEE_LAYOUT.height);
    for (const event of ['pointerdown', 'pointerup', 'pointertap', 'wheel'] as const) this.panel.on(event, e => e.stopPropagation());
    this.view.addChild(backdrop, this.panel);
    this.popup = new PopupOpening(this.panel, STAGE_WIDTH / 2, STAGE_HEIGHT / 2, backdrop);
    window.addEventListener('keydown', this.onKey);
  }
  get isOpen() { return this.view.visible; }
  private onKey = (event: KeyboardEvent) => {
    if (!this.isOpen || event.key !== 'Escape') return;
    event.preventDefault(); if (this.help) { this.help = false; this.draw(); } else this.close();
  };
  async open(machineId: string) {
    const wasOpen = this.isOpen, generation = ++this.generation;
    this.machineId = machineId; this.group = 'basic'; this.help = false;
    this.state = undefined; this.message = 'Carregando cafés…'; this.view.visible = true; this.draw();
    if (!wasOpen) this.popup.open();
    try {
      const [drinks, art, state] = await Promise.all([loadCoffeeArt(), loadCoffeeInterfaceArt(), this.client.refresh()]);
      if (this.disposed || generation !== this.generation) return;
      this.recipes = drinks.recipes; this.textures = drinks.textures; this.art = art; this.state = state;
      this.message = ''; this.onState(state.playerState); this.draw();
    } catch (error) {
      if (!this.disposed && generation === this.generation) {
        this.message = error instanceof Error ? error.message : 'Não foi possível abrir os cafés.'; this.draw();
      }
    }
  }
  close() { this.generation++; this.view.visible = false; }
  update(deltaMs: number) { if (this.isOpen) this.popup.update(deltaMs); }
  async refresh() {
    if (!this.isOpen || this.busy) return;
    const generation = this.generation, serial = this.snapshotSerial;
    try {
      const state = await this.client.refresh();
      if (this.disposed || generation !== this.generation || serial !== this.snapshotSerial || this.busy) return;
      this.state = state; this.onState(state.playerState); this.draw();
    } catch { /* A transient refresh failure keeps the last authoritative snapshot. */ }
  }
  private async act(action: 'select' | 'recharge', recipeId?: string) {
    if (this.busy || this.disposed) return;
    this.busy = true; this.snapshotSerial++; this.message = ''; this.draw();
    const generation = this.generation, machineId = this.machineId;
    try {
      const state = await this.client.act(action, machineId, { recipeId });
      if (this.disposed) return;
      this.onState(state.playerState);
      if (generation === this.generation) { this.state = state; if (action === 'recharge') this.help = false; }
    } catch (error) {
      if (!this.disposed && generation === this.generation) this.message = error instanceof Error ? error.message : 'Ação recusada.';
    } finally {
      this.busy = false;
      if (!this.disposed) {
        if (generation !== this.generation && this.isOpen) void this.refresh();
        this.draw();
      }
    }
  }
  private hit(name: string, x: number, y: number, width: number, height: number, activate: () => void) {
    const target = new Container(); target.label = name; target.position.set(x, y);
    target.hitArea = new Rectangle(0, 0, width, height); target.eventMode = 'static'; target.cursor = 'pointer';
    target.on('pointertap', event => { event.stopPropagation(); activate(); }); this.panel.addChild(target); return target;
  }
  private button(text: string, x: number, y: number, width: number, enabled: boolean, onClick: () => void, name: string) {
    if (!this.art) return;
    const target = this.hit(name, x, y, width, 25, () => { if (enabled) onClick(); });
    const background = new NineSliceSprite({ texture: this.art.button, leftWidth: 8, rightWidth: 8, topHeight: 8, bottomHeight: 8 });
    background.width = width; background.height = 25; background.eventMode = 'none';
    if (!enabled) { background.tint = 0x999999; target.cursor = 'default'; }
    const caption = label(text, width / 2, 12.5, 15, 0xffffff, true); caption.anchor.set(.5);
    target.addChild(background, caption);
  }
  private draw() {
    for (const child of this.panel.removeChildren()) child.destroy({ children: true });
    const art = this.art;
    if (!art) { this.panel.addChild(label(this.message, 200, 280, 22, 0xffffff, true, 0x59351a)); return; }
    const background = new Sprite(art.panel); background.width = 648; background.height = 586; background.eventMode = 'none';
    this.panel.addChild(background);
    const header = new Sprite(art.header); header.width = 508; header.height = 126; header.position.set(28, -12); header.eventMode = 'none'; this.panel.addChild(header);
    this.panel.addChild(image(art.help, 536, 0, 44, 44), image(art.close, 588, 0, 44, 44));
    this.hit('coffee-help', 536, 0, 44, 44, () => { this.help = !this.help; this.draw(); });
    this.hit('coffee-close', 588, 0, 44, 44, () => this.close());
    COFFEE_GROUPS.forEach((tab, index) => {
      const bounds = COFFEE_LAYOUT.tabs;
      const x = bounds.x + index * (bounds.width + bounds.gap);
      const active = this.group === tab.id;
      const unlocked = this.state?.groups.includes(tab.id) ?? tab.id === 'basic';
      const tabSprite = coffeeTabSkin(active ? art.tabActive : art.tab, active, bounds.width, bounds.stemHeight);
      tabSprite.label = 'coffee-tab-skin-' + tab.id;
      tabSprite.position.set(x, bounds.y); this.panel.addChild(tabSprite);
      const caption = label(tab.name, x + (unlocked ? bounds.width / 2 : 64), bounds.y + 22, 21,
        active ? 0xffffff : 0x70401d, true, active ? 0x634021 : undefined);
      caption.label = 'coffee-tab-caption-' + tab.id; caption.anchor.set(.5);
      // Long captions keep a separate lane from the lock; the icon never covers a letter.
      if (!unlocked && caption.width > 110) caption.scale.set(110 / caption.width);
      this.panel.addChild(caption);
      if (!unlocked) {
        const lock = image(art.lock, x + 126, bounds.y + 5, 15, 21); lock.label = 'coffee-tab-lock-' + tab.id; this.panel.addChild(lock);
      }
      // Locked categories remain inspectable; selection permissions belong to the server.
      const target = this.hit('coffee-tab-' + tab.id, x, bounds.y, bounds.width, bounds.height,
        () => { this.group = tab.id; this.help = false; this.message = ''; this.draw(); });
      if (!active && unlocked) {
        target.on('pointerover', () => { if (!caption.destroyed) { caption.style.fill = 0xffffff; caption.style.stroke = { color: 0x634021, width: 3, join: 'round' }; } });
        target.on('pointerout', () => { if (!caption.destroyed) { caption.style.fill = 0x70401d; caption.style.stroke = { color: 0x634021, width: 0, alpha: 0 }; } });
      }
    });
    // Clip the original peach sample to the body; the mask owns shape, never painted ornament.
    const body = new Sprite(art.body); body.label = 'coffee-panel-front'; body.position.set(26, 159); body.width = 596; body.height = 393; body.eventMode = 'none';
    const bodyMask = new Graphics().roundRect(26, 159, 596, 393, 20).fill(0xffffff); bodyMask.eventMode = 'none';
    this.panel.addChild(body, bodyMask); body.mask = bodyMask;
    const machineWindow = new Sprite(art.machineWindow); machineWindow.position.set(45, 170); machineWindow.width = 162; machineWindow.height = 177; machineWindow.eventMode = 'none';
    const evolutionWindow = new Sprite(art.evolutionWindow); evolutionWindow.position.set(47, 414); evolutionWindow.width = 157.5; evolutionWindow.height = 111.5; evolutionWindow.eventMode = 'none';
    this.panel.addChild(machineWindow, evolutionWindow);
    const stage = this.state?.evolutionStage ?? 1;
    const machine = art.machines.find(variant => variant.stage === stage) ?? art.machines[0];
    if (machine) this.panel.addChild(image(machine.previewTexture, 51, 171, 151, 174));
    this.drawEvolution(stage);
    for (let index = 0; index < 4; index++) {
      const recipe = this.recipes.filter(recipe => recipe.group === this.group)[index];
      const selected = !this.help && recipe?.id === (this.state?.selected[this.machineId] ?? 'espresso');
      const card = coffeeCard(selected ? art.cardServingReference : art.cardReference, selected ? undefined : art.portrait);
      card.position.set(COFFEE_LAYOUT.rows.x, COFFEE_LAYOUT.rows.y + index * COFFEE_LAYOUT.rows.step); this.panel.addChild(card);
    }
    if (this.help) this.drawHelp();
    else this.recipes.filter(recipe => recipe.group === this.group).forEach((recipe, index) => this.drawRecipe(recipe, index));
    if (this.message) {
      const notice = label(this.message, 36, 554, 12, 0x7a2718);
      notice.style.wordWrap = true; notice.style.wordWrapWidth = 570; this.panel.addChild(notice);
    }
  }
  private drawEvolution(stage: number) {
    const art = this.art!;
    this.panel.addChild(label('Máquina ' + stage + '/3', 69, 428, 18, 0x653b16, true));
    art.machines.forEach((machine, index) => {
      const sprite = image(machine.previewTexture, 62 + index * 43, 453, 39, 49);
      if (machine.stage > stage) { sprite.alpha = .35; this.panel.addChild(sprite, image(art.lock, 73 + index * 43, 468, 18, 25)); }
      else this.panel.addChild(sprite);
    });
    const hint = label(stage < 3 ? 'Domine os sabores\npara evoluir!' : 'Todos os modelos\ndesbloqueados!', 129, 509, 12);
    hint.anchor.set(.5, 0); hint.style.align = 'center'; this.panel.addChild(hint);
  }
  private drawRecipe(recipe: CoffeeRecipe, index: number) {
    const art = this.art!, y = COFFEE_LAYOUT.rows.y + index * COFFEE_LAYOUT.rows.step;
    const unlocked = this.state?.groups.includes(recipe.group) ?? false;
    const selected = (this.state?.selected[this.machineId] ?? 'espresso') === recipe.id;
    const texture = this.textures.get(recipe.id);
    if (texture) { const sprite = image(texture, 220, y + 9, 72, 75); if (!unlocked) sprite.alpha = .45; this.panel.addChild(sprite); }
    const name = label(recipe.name, 294, y + 8, 16, selected ? 0xffffff : 0x65360e, true, selected ? 0x8a4a25 : undefined);
    const maxWidth = 184;
    if (name.width > maxWidth) name.scale.set(maxWidth / name.width);
    this.panel.addChild(name);
    for (const [icon, x, py, w, h] of [[art.energy, 302, y + 32, 12, 18], [art.gold, 380, y + 32, 18, 18],
      [art.xp, 301, y + 56, 15, 20], [art.popularity, 380, y + 56, 18, 18]] as const) this.panel.addChild(image(icon, x, py, w, h));
    this.panel.addChild(label('-' + recipe.energyCost, 322, y + 34, 12, 0xd46b31), label('+' + recipe.gold, 400, y + 34, 12),
      label('+' + recipe.xp + ' XP', 321, y + 59, 12), label('+' + recipe.popularityTenths / 10, 400, y + 59, 12));
    const mastery = coffeeMastery(this.state?.mastery[recipe.id] ?? 0, this.state?.masteryThresholds ?? [20, 50, 100]);
    if (mastery.dominated) this.panel.addChild(image(art.dominado, 486, y + 6, 108, 25));
    else this.panel.addChild(label('Nível ' + mastery.level, 486, y + 6, 19, 0x784f20, true));
    this.panel.addChild(label(mastery.dominated ? `Servido ${mastery.count} vezes` : `${mastery.count}/${mastery.goal} serviços`, 486, y + 37, 11, selected ? 0xffffff : 0x633611));
    if (selected) {
      this.panel.addChild(image(art.servindo, 486, y + 52, 108, 28));
    }
    else this.button(unlocked ? 'Selecionar' : 'Bloqueado', 486, y + 55, 108, unlocked && !this.busy,
      () => { void this.act('select', recipe.id); }, 'coffee-select-' + recipe.id);
  }
  private drawHelp() {
    const art = this.art!;
    const steps = [
      ['Escolha um sabor', 'Clique em Selecionar na aba do café que\nvocê deseja servir aos seus clientes.'],
      ['Sirva o cliente', 'Clique no balão de café para atender.\nCada serviço usa energia e rende bônus.'],
      ['Aprenda novos cafés', 'Domine os quatro sabores de uma aba\npara liberar as próximas receitas.'],
    ];
    steps.forEach(([title, hint], index) => {
      const y = COFFEE_LAYOUT.rows.y + index * COFFEE_LAYOUT.rows.step;
      const icon = index === 0 ? this.textures.get('espresso') : index === 1 ? art.popularity : art.xp;
      if (icon) this.panel.addChild(image(icon, 231, y + 8, 58, 62));
      this.panel.addChild(label(title!, 307, y + 5, 19, 0x65360e, true), label(hint!, 307, y + 34, 12));
    });
    this.panel.addChild(image(art.energy, 238, 465, 42, 56),
      label(`Energia: ${this.state?.playerState.energy.current ?? 0}/${this.state?.playerState.energy.maximum ?? 0}`, 307, 456, 18, 0x7b3815, true));
    this.button('Recarregar · 4 Granas', 306, 499, 188, !this.busy && Boolean(this.state), () => { void this.act('recharge'); }, 'coffee-recharge');
    this.button('Voltar', 514, 499, 78, true, () => { this.help = false; this.draw(); }, 'coffee-back');
  }
  destroy() {
    this.disposed = true; this.generation++; window.removeEventListener('keydown', this.onKey);
    this.view.destroy({ children: true });
  }
}
