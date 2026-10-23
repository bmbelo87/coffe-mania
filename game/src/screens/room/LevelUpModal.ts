import { Assets, Container, Graphics, Rectangle, Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../../core/stage';
import { acknowledgeLevel, type LevelReward } from '../../game/player-state';
import { LevelRewardQueue } from '../../game/level-rewards';
import { PopupOpening } from './PopupOpening';
import { fitJuiceImage, juiceButton, juicePart, juiceText } from './JuiceInterfaceParts';

interface LevelUpArt { window: Texture; waiter: Texture; dish: Texture; gold: Texture }
let artPromise: Promise<LevelUpArt> | undefined;
async function loadArt(): Promise<LevelUpArt> {
  return artPromise ??= (async () => {
    const url = (path: string) => new URL(`assets/ui/${path}`, new URL(import.meta.env.BASE_URL, document.baseURI)).href;
    const [window, waiter, dish, icons] = await Promise.all([
      Assets.load<Texture>(url('level-up/window.png')), Assets.load<Texture>(url('level-up/waiter.png')),
      Assets.load<Texture>(url('level-up/dish.png')), Assets.load<Texture>(url('icon_bundle_1.png')),
    ]);
    return { window, waiter, dish, gold: new Texture({ source: icons.source, frame: new Rectangle(360, 342, 314, 299) }) };
  })().catch(error => { artPromise = undefined; throw error; });
}

/** Exibe recibos do servidor. Fechar ou compartilhar confirma apenas a leitura, sem pagar recompensas. */
export class LevelUpModal {
  readonly view = new Container();
  private readonly panel = new Container();
  private readonly popup: PopupOpening;
  private readonly queue = new LevelRewardQueue();
  private art?: LevelUpArt;
  private loading = false;
  private busy = false;
  private status = '';
  private disposed = false;

  constructor(private readonly acknowledge = acknowledgeLevel) {
    this.view.label = 'level-up-modal'; this.view.visible = false;
    const backdrop = new Graphics().rect(-12000, -12000, 24000, 24000).fill({ color: 0x342c23, alpha: .38 });
    backdrop.eventMode = 'static';
    for (const event of ['pointerdown', 'pointerup', 'pointertap', 'wheel'] as const) backdrop.on(event, e => e.stopPropagation());
    this.panel.scale.set(1.85);
    this.panel.position.set((STAGE_WIDTH - 392 * 1.85) / 2, (STAGE_HEIGHT - 460 * 1.85) / 2);
    this.panel.eventMode = 'static'; this.panel.hitArea = new Rectangle(0, 0, 392, 460);
    for (const event of ['pointerdown', 'pointerup', 'pointertap', 'wheel'] as const) this.panel.on(event, e => e.stopPropagation());
    this.view.addChild(backdrop, this.panel);
    this.popup = new PopupOpening(this.panel, STAGE_WIDTH / 2, STAGE_HEIGHT / 2, backdrop);
    window.addEventListener('keydown', this.onKey, true);
  }

  get isOpen(): boolean { return this.view.visible; }

  sync(rewards: readonly LevelReward[]): void {
    this.queue.add(rewards);
    if (this.queue.current && !this.view.visible) {
      this.view.visible = true;
      this.popup.open();
      this.draw();
      void this.prepareArt();
    }
  }

  update(deltaMs: number): void { if (this.isOpen) this.popup.update(deltaMs); }

  private async prepareArt(): Promise<void> {
    if (this.art || this.loading) return;
    this.loading = true;
    try { this.art = await loadArt(); }
    catch { this.status = 'Não foi possível carregar a arte.'; }
    finally { this.loading = false; if (!this.disposed) this.draw(); }
  }

  private readonly onKey = (event: KeyboardEvent) => {
    if (!this.isOpen || event.key !== 'Escape') return;
    event.preventDefault(); event.stopImmediatePropagation(); void this.finish();
  };

  private async finish(): Promise<void> {
    const reward = this.queue.current;
    if (!reward || this.busy) return;
    this.busy = true; this.status = ''; this.draw();
    try {
      await this.acknowledge(reward.level);
      if (this.disposed) return;
      this.queue.dismiss(reward.level);
      if (this.queue.current) this.popup.open();
    } catch (error) { this.status = error instanceof Error ? error.message : 'Tente novamente.'; }
    finally {
      this.busy = false;
      if (!this.disposed) { this.view.visible = Boolean(this.queue.current); this.draw(); }
    }
  }

  private async share(): Promise<void> {
    const reward = this.queue.current;
    if (!reward || this.busy) return;
    this.busy = true; this.draw();
    try {
      const text = `Meu café chegou ao nível ${reward.level} no Café Mania!`;
      if (navigator.share) await navigator.share({ title: 'Café Mania', text });
      else { await navigator.clipboard.writeText(text); this.status = 'Mensagem copiada para compartilhar!'; }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) this.status = 'Não foi possível compartilhar agora.';
    } finally { this.busy = false; if (!this.disposed) this.draw(); }
  }

  private draw(): void {
    for (const child of this.panel.removeChildren()) child.destroy({ children: true });
    const reward = this.queue.current;
    if (!reward) return;
    if (this.art) this.panel.addChild(juicePart(this.art.window, 0, 0, 392, 460));
    else this.panel.addChild(new Graphics().roundRect(8, 15, 376, 430, 16).fill(0xfffefa));

    const level = juiceText(`Nível ${reward.level}`, 196, 118, 36, 0xffffff);
    level.anchor.set(.5); level.rotation = -.095; this.panel.addChild(level);
    const title = juiceText(reward.title ? `“${reward.title}”` : 'Novo nível alcançado!', 196, 174, 22, 0x0094c0);
    title.anchor.set(.5); if (title.width > 345) title.scale.set(345 / title.width); this.panel.addChild(title);
    if (this.art) this.panel.addChild(
      fitJuiceImage(this.art.waiter, 101, 201, 49, 49),
      fitJuiceImage(this.art.gold, 105, 262, 41, 41),
      fitJuiceImage(this.art.dish, 96, 311, 55, 39),
    );
    this.panel.addChild(juiceText(`Garçom x${reward.waiters}!`, 157, 214, 28, 0x843c19));
    this.panel.addChild(juiceText(String(reward.gold), 154, 255, 41, 0xffdf00, '700', 0x663700));
    this.panel.addChild(juiceText(`+${reward.recipes.length} Pratos`, 157, 308, 28, 0x843c19));
    const available = juiceText('Agora disponível', 196, 365, 23, 0x0094c0); available.anchor.set(.5); this.panel.addChild(available);
    const unlocks = reward.recipes.map(recipe => recipe.name);
    if (reward.waiters > 0) unlocks.push(`Mais ${reward.waiters} vaga de garçom (${reward.waiterSlots} no total)`);
    const detail = juiceText(unlocks.length ? unlocks.join(' · ') : 'Continue cozinhando e ganhando XP!', 196, 386, 13, 0x843c19, '400');
    detail.style.wordWrap = true; detail.style.wordWrapWidth = 322; detail.anchor.set(.5, 0);
    if (detail.height > 35) detail.scale.set(35 / detail.height);
    this.panel.addChild(detail);

    const dismiss = juiceButton(this.busy ? 'Aguarde…' : 'Agora não', 48, 431, 137, () => { void this.finish(); }, !this.busy, 'grey');
    this.panel.addChild(dismiss, juiceButton('Compartilhar', 196, 431, 143, () => { void this.share(); }, !this.busy));
    if (this.status) {
      const status = juiceText(this.status, 196, 416, 10, 0xb03014); status.anchor.set(.5); this.panel.addChild(status);
    }
  }

  destroy(): void {
    this.disposed = true; window.removeEventListener('keydown', this.onKey, true); this.view.destroy({ children: true });
  }
}
