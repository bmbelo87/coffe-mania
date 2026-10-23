import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { STAGE_WIDTH, STAGE_HEIGHT } from '../../core/stage';
import { JuiceClient, loadJuiceArt, loadJuiceInterfaceArt, type JuiceInterfaceArt, type JuiceSnapshot, type JuiceRecipe } from '../../game/juices';
import type { PlayerState } from '../../game/player-state';
import { PopupOpening } from './PopupOpening';
import { fitJuiceImage, juiceButton, juiceCard, juicePart, juiceProgress, juiceSmile, juiceTab, juiceText, JUICE_ROWS, JUICE_SHEET, JUICE_TAB_X } from './JuiceInterfaceParts';

const TABS = [
  { id: 'basic', label: 'Simples' },
  { id: 'medium', label: 'Elaborados' },
  { id: 'tropical', label: 'Poderosos' },
  { id: 'exotic', label: 'Exóticos' },
] as const;

export class JuiceScreenModal {
  readonly view = new Container();
  private readonly panel = new Container();
  private readonly popup: PopupOpening;
  private machineId = '';
  private group = 'basic';
  private state?: JuiceSnapshot;
  private recipes: JuiceRecipe[] = [];
  private textures = new Map<string, Texture>();
  private art?: JuiceInterfaceArt;
  private busy = false;
  private disposed = false;
  private generation = 0;
  private message = '';
  private help = false;

  constructor(private readonly client: JuiceClient, private readonly machineTexture: Texture | undefined, private readonly onState: (state: PlayerState) => void) {
    this.view.label = 'juice-modal'; this.view.visible = false;
    const backdrop = new Graphics().rect(-12000, -12000, 24000, 24000).fill({ color: 0xfff7db, alpha: .64 });
    backdrop.eventMode = 'static'; backdrop.hitArea = new Rectangle(-12000, -12000, 24000, 24000);
    for (const event of ['pointerdown', 'pointerup', 'wheel'] as const) backdrop.on(event, e => e.stopPropagation());
    backdrop.on('pointertap', e => { e.stopPropagation(); this.close(); });
    this.panel.scale.set(JUICE_SHEET.scale);
    const totalHeight = JUICE_SHEET.height + JUICE_SHEET.overhang;
    this.panel.position.set((STAGE_WIDTH - JUICE_SHEET.width * JUICE_SHEET.scale) / 2, (STAGE_HEIGHT - totalHeight * JUICE_SHEET.scale) / 2 + JUICE_SHEET.overhang * JUICE_SHEET.scale);
    this.panel.eventMode = 'static'; this.panel.hitArea = new Rectangle(0, -JUICE_SHEET.overhang, JUICE_SHEET.width, totalHeight);
    for (const event of ['pointerdown', 'pointerup', 'pointertap', 'wheel'] as const) this.panel.on(event, e => e.stopPropagation());
    this.view.addChild(backdrop, this.panel); window.addEventListener('keydown', this.onKey);
    this.popup = new PopupOpening(this.panel, STAGE_WIDTH / 2, STAGE_HEIGHT / 2, backdrop);
  }
  get isOpen() { return this.view.visible; }
  private onKey = (event: KeyboardEvent) => {
    if (!this.isOpen || event.key !== 'Escape') return;
    event.preventDefault(); if (this.help) { this.help = false; this.draw(); } else this.close();
  };
  async open(machineId: string) {
    const wasOpen = this.isOpen;
    const generation = ++this.generation;
    this.machineId = machineId; this.state = undefined; this.help = false; this.group = 'basic';
    this.view.visible = true; this.message = 'Carregando sucos…'; this.draw();
    if (!wasOpen) this.popup.open();
    try {
      const [drinks, art, state] = await Promise.all([loadJuiceArt(), loadJuiceInterfaceArt(), this.client.refresh()]);
      if (this.disposed || generation !== this.generation) return;
      this.recipes = drinks.recipes; this.textures = drinks.textures; this.art = art;
      this.state = state; this.message = ''; this.onState(state.playerState); this.draw();
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.message = error instanceof Error ? error.message : 'Não foi possível abrir os sucos.'; this.draw();
    }
  }
  close() { this.generation++; this.view.visible = false; }
  update(deltaMs: number): void { if (this.isOpen) this.popup.update(deltaMs); }
  async refresh() {
    if (!this.isOpen || this.busy) return;
    const generation = this.generation;
    try {
      const state = await this.client.refresh();
      if (this.disposed || generation !== this.generation) return;
      this.state = state; this.onState(state.playerState); this.draw();
    } catch { /* The current snapshot remains available during a transient network failure. */ }
  }
  private async act(action: 'unlock' | 'prepare' | 'recharge', recipeId?: string) {
    if (this.busy) return;
    this.busy = true; this.message = ''; this.draw();
    const generation = this.generation, machineId = this.machineId;
    try {
      const state = await this.client.act(action, machineId, { recipeId });
      if (this.disposed) return;
      this.onState(state.playerState);
      if (generation === this.generation) { this.state = state; if (action === 'recharge') this.help = false; }
    } catch (error) {
      if (!this.disposed && generation === this.generation) this.message = error instanceof Error ? error.message : 'Ação recusada.';
    } finally { this.busy = false; if (!this.disposed) this.draw(); }
  }
  private draw() {
    for (const child of this.panel.removeChildren()) child.destroy({ children: true });
    const parts = this.art?.parts;
    if (parts) this.panel.addChild(juicePart(parts.panel, 0, 0, 594, 508));
    if (this.art) this.panel.addChild(fitJuiceImage(this.art.logo, 152, -10, 286, 84));
    else this.panel.addChild(juiceText('Sucos!', 230, -10, 57, 0x35c7f8, '700', 0xffdc21));
    this.panel.addChild(juiceButton('?', 507, -4, 26, () => { this.help = !this.help; this.draw(); }, true, 'blue'));
    if (parts) {
      const close = new Sprite(parts.close);
      close.position.set(541, -6); close.width = 26; close.height = 26 * parts.close.height / parts.close.width;
      close.label = 'juice-close'; close.eventMode = 'static'; close.cursor = 'pointer';
      close.on('pointertap', event => { event.stopPropagation(); this.close(); });
      this.panel.addChild(close);
    } else this.panel.addChild(juiceButton('×', 541, -4, 26, () => this.close(), true, 'red'));
    if (parts) {
      for (const [index, tab] of TABS.entries()) {
        const locked = tab.id === 'exotic' || tab.id === 'tropical' && !this.state?.groups.includes(tab.id);
        this.panel.addChild(juiceTab({ active: parts.tabActive, inactive: parts.tabInactive, locked: parts.tabLocked, padlock: parts.padlock }, tab.label, JUICE_TAB_X[index], this.group === tab.id, locked,
          () => { this.group = tab.id; this.help = false; this.message = ''; this.draw(); }));
      }
      // A faixa frontal mascara os 2 px finais de todas as abas, alinhando a emenda.
      this.panel.addChild(juicePart(parts.panelFront, 0, 119, 594, 389));
      this.drawMachine(parts);
    }
    if (this.state?.unlocked) this.drawRecipes();
    else if (this.state) this.drawUnlock();
    if (this.help) this.drawHelp();
    if (this.message) {
      this.panel.addChild(new Graphics().roundRect(201, 482, 357, 17, 3).fill({ color: 0xfffcda, alpha: .95 }));
      const text = juiceText(this.message, 206, 482, 10, 0x9b2d12, '400');
      if (text.width > 345) text.scale.set(345 / text.width);
      this.panel.addChild(text);
    }
  }
  private drawMachine(parts: NonNullable<JuiceScreenModal['art']>['parts']) {
    this.panel.addChild(juicePart(parts.machineWindow, 28, 135, 154, 162));
    const stage = this.state?.evolutionStage ?? 1;
    const machine = this.art?.machines.find(item => item.stage === stage)?.preview ?? this.machineTexture;
    if (machine) this.panel.addChild(fitJuiceImage(machine, 41, 139, 128, 153));
    // The evolution card keeps its blank art separate from the caption, which is regular interface text.
    this.panel.addChild(juicePart(parts.evolutionBackground, 28, 314, 154, 174),
      juicePart(parts.evolutionTitle, 35, 319, 140, 49),
      juicePart(parts.evolutionSilhouette, 74, 372, 62, 82));
    ['Aprimore seus sucos', 'para descobrir!'].forEach((line, index) => {
      const text = juiceText(line, 0, 455 + index * 12, 11, 0x174d70, '400');
      text.x = 105 - text.width / 2; this.panel.addChild(text);
    });
  }
  private drawRecipes() {
    const state = this.state!;
    const batch = state.stock[this.machineId];
    const recipes = this.recipes.filter(recipe => recipe.group === this.group);
    if (!recipes.length) {
      this.panel.addChild(juiceText('Sucos Exóticos', 264, 205, 25), juiceText('Novos sabores ainda indisponíveis.', 233, 254, 16));
      return;
    }
    const unlocked = state.groups.includes(this.group);
    recipes.forEach((recipe, index) => {
      const serving = batch?.recipeId === recipe.id && batch.portions > 0;
      const parts = this.art!.parts;
      const card = juiceCard(serving ? parts.cardServing : parts.card, JUICE_ROWS[index]); card.label = 'juice-card:' + recipe.id;
      const texture = this.textures.get(recipe.id);
      if (texture) card.addChild(fitJuiceImage(texture, 5, -3, 60, 80));
      const title = juiceText(recipe.name, 73, 5, 14);
      if (title.width > 172) title.scale.set(172 / title.width);
      card.addChild(title);
      const mastery = state.mastery[recipe.id] ?? 0;
      const dominated = mastery >= state.masteryServings;
      card.addChild(juiceText(dominated ? 'Dominado' : 'Nível 1', 253, 4, dominated ? 17 : 12, dominated ? 0xffdf00 : 0x00547b, '700', dominated ? 0x723d00 : undefined));
      if (!dominated) card.addChild(juiceText(`Progresso: ${mastery}/${state.masteryServings}`, 254, 18, 9, 0x352617, '400'));
      const progress = juiceProgress(mastery / state.masteryServings); progress.position.set(253, dominated ? 31 : 30); card.addChild(progress);
      if (this.art) {
        const energy = fitJuiceImage(this.art.energy, 76, 28, 18, 18);
        energy.eventMode = 'static'; energy.cursor = 'pointer'; energy.on('pointertap', event => { event.stopPropagation(); this.help = true; this.draw(); });
        card.addChild(energy, fitJuiceImage(this.art.gold, 154, 28, 18, 18), fitJuiceImage(this.art.xp, 76, 50, 17, 18));
      }
      const smile = juiceSmile(); smile.position.set(151, 50); card.addChild(smile);
      card.addChild(juiceText(`-${recipe.energyCost}`, 97, 28, 12, 0xe87014), juiceText(String(recipe.gold), 173, 28, 12),
        juiceText(String(recipe.portions), 97, 51, 12), juiceText((recipe.popularityTenths / 10).toLocaleString('pt-BR'), 173, 51, 12));
      if (serving) card.addChild(juiceText('Servindo', 253, 48, 18, 0xffffff, '700', 0x765321));
      else card.addChild(juiceButton(unlocked ? 'Selecionar' : 'Bloqueado', 253, 49, 99, () => {
        if (batch?.portions) { this.message = 'Sirva os copos restantes antes de selecionar outro sabor.'; this.draw(); return; }
        void this.act('prepare', recipe.id);
      }, unlocked && !this.busy));
      this.panel.addChild(card);
    });
  }
  private drawUnlock() {
    this.panel.addChild(juiceText('Destrave sua Máquina de Sucos!', 213, 180, 19),
      juiceText('Contrate um chaveiro para abrir a caixa.', 217, 226, 14, 0x164e70, '400'),
      juiceText('Comece a preparar e servir seus sucos!', 217, 249, 14, 0x164e70, '400'),
      juiceButton('Chaveiro · 20 Granas', 281, 303, 190, () => { void this.act('unlock'); }, !this.busy));
  }
  private drawHelp() {
    const state = this.state;
    this.panel.addChild(new Graphics().roundRect(197, 133, 367, 349, 10).fill(0xf5f2da).stroke({ color: 0x49a8bb, width: 3 }),
      juiceText('Como servir seus sucos', 221, 157, 21),
      juiceText('Selecione um sabor e prepare seus copos.\nClique no balão de um cliente pedindo suco\npara atendê-lo e ganhar Ouro, XP e Smilles.\n\nDomine os quatro sabores de cada grupo\npara liberar os próximos e evoluir a máquina.', 219, 204, 14, 0x23576b, '400'),
      juiceText(`Energia: ${state?.playerState.energy.current ?? 0}/${state?.playerState.energy.maximum ?? 0}`, 252, 371, 18, 0x006d9b),
      juiceButton('Recarregar · 4 Granas', 259, 407, 200, () => { void this.act('recharge'); }, Boolean(state) && !this.busy),
      juiceButton('Voltar', 488, 450, 65, () => { this.help = false; this.draw(); }, true, 'blue'));
  }
  destroy() { this.disposed = true; this.generation++; window.removeEventListener('keydown', this.onKey); this.view.destroy({ children: true }); }
}
