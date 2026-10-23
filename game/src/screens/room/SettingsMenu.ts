import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';

import { UI_BUTTONS_COLLECTION_URL, UI_BUTTONS_POSITIONS_URL, UI_SETTINGS_MENU_URLS } from '../../game/asset-manifest';

export type SettingsMenuAction = 'zoomIn' | 'zoomOut' | 'fullscreen' | 'music' | 'sound' | 'advanced';

export interface SettingsMenuTextures {
  zoomIn: Texture;
  zoomOut: Texture;
  fullscreen: Texture;
  fullscreenExit: Texture;
  music: Texture;
  musicOff: Texture;
  sound: Texture;
  soundOff: Texture;
  advanced: Texture;
}

export interface SettingsMenuState {
  fullscreen: boolean;
  music: boolean;
  sound: boolean;
}

interface ButtonsCollectionJson {
  buttons: Array<{ name: string; bbox: { x1: number; y1: number }; size: { width: number; height: number } }>;
}

let pending: Promise<SettingsMenuTextures> | undefined;

/** Botões azuis da interface atual; as variantes desligadas ficam em `ui/settings-menu/`. */
export function loadSettingsMenuTextures(): Promise<SettingsMenuTextures> {
  return pending ??= Promise.all([
    Assets.load<Texture>(UI_BUTTONS_COLLECTION_URL),
    Assets.load<ButtonsCollectionJson>(UI_BUTTONS_POSITIONS_URL),
    Assets.load<Texture>(UI_SETTINGS_MENU_URLS.soundOff),
    Assets.load<Texture>(UI_SETTINGS_MENU_URLS.musicOff),
    Assets.load<Texture>(UI_SETTINGS_MENU_URLS.fullscreenExit),
  ]).then(([sheet, data, soundOff, musicOff, fullscreenExit]) => {
    const crop = (name: string): Texture => {
      const button = data.buttons.find((entry) => entry.name === name);
      if (!button) throw new Error(`Botão ausente na coleção: ${name}`);
      return new Texture({ source: sheet.source, frame: new Rectangle(button.bbox.x1, button.bbox.y1, button.size.width, button.size.height) });
    };
    return {
      zoomIn: crop('mais'), zoomOut: crop('menos'), fullscreen: crop('tela_cheia'), fullscreenExit,
      music: crop('musica'), musicOff, sound: crop('volume'), soundOff, advanced: crop('configuracao'),
    };
  }).catch((error: unknown) => { pending = undefined; throw error; });
}

const BUTTON_SIZE = 58;
const GAP = 8;
/** A engrenagem de "Avançado" é menor, como um ajuste secundário. */
const ADVANCED_SIZE = 46;
const ORDER: readonly SettingsMenuAction[] = ['zoomIn', 'zoomOut', 'fullscreen', 'music', 'sound', 'advanced'];
const OPEN_MS = 160;

/**
 * Menu suspenso da engrenagem azul. O visual final do jogo mostra a engrenagem com uma setinha,
 * mas nenhuma captura do menu aberto; as funções são as da coluna de controles de 2010 (zoom,
 * tela cheia, música e som). Abre para cima, a partir do ponto de ancoragem.
 */
export class SettingsMenu {
  readonly view = new Container();
  private readonly catcher = new Container();
  private readonly column = new Container();
  private readonly buttons = new Map<SettingsMenuAction, { holder: Container; icon: Sprite }>();
  private openTimer = 0;
  private opened = false;

  constructor(
    private readonly textures: SettingsMenuTextures,
    private readonly onAction: (action: SettingsMenuAction) => void,
  ) {
    this.view.label = 'settings-menu';
    this.view.visible = false;
    // Um toque fora fecha o menu, como um menu suspenso; o toque não passa para a sala.
    this.catcher.label = 'settings-menu-outside';
    this.catcher.eventMode = 'static';
    this.catcher.hitArea = new Rectangle(-12000, -12000, 24000, 24000);
    this.catcher.on('pointerdown', (event) => { event.stopPropagation(); this.close(); });
    this.catcher.on('wheel', () => this.close());
    this.column.label = 'settings-menu-column';
    this.view.addChild(this.catcher, this.column);
    let y = 0;
    for (const action of ORDER) {
      const size = action === 'advanced' ? ADVANCED_SIZE : BUTTON_SIZE;
      y -= size + GAP;
      const holder = new Container();
      holder.label = `settings-menu-${action}`;
      holder.position.set(0, y + size / 2);
      holder.eventMode = 'static';
      holder.cursor = 'pointer';
      holder.hitArea = new Rectangle(-size / 2, -size / 2, size, size);
      const icon = new Sprite(this.textureFor(action, { fullscreen: false, music: true, sound: true }));
      icon.anchor.set(0.5);
      icon.eventMode = 'none';
      this.fit(icon, size);
      holder.addChild(icon);
      holder.on('pointerover', () => holder.scale.set(1.1));
      holder.on('pointerout', () => holder.scale.set(1));
      holder.on('pointerdown', (event) => { event.stopPropagation(); holder.scale.set(0.92); });
      holder.on('pointerup', () => holder.scale.set(1.1));
      holder.on('pointertap', (event) => {
        event.stopPropagation();
        this.onAction(action);
        if (action === 'advanced') this.close();
      });
      this.column.addChild(holder);
      this.buttons.set(action, { holder, icon });
    }
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.onKeyDown, true);
  }

  get isOpen(): boolean { return this.opened; }

  /** `anchor` é o centro da engrenagem em coordenadas do pai do menu. */
  open(anchor: { x: number; y: number }, state: SettingsMenuState, gearSize: number): void {
    this.sync(state);
    this.column.position.set(anchor.x, anchor.y - gearSize / 2 - 4);
    this.opened = true;
    this.openTimer = 0;
    this.view.visible = true;
    this.column.alpha = 0;
  }

  toggle(anchor: { x: number; y: number }, state: SettingsMenuState, gearSize: number): void {
    if (this.opened) this.close();
    else this.open(anchor, state, gearSize);
  }

  close(): void {
    this.opened = false;
    this.view.visible = false;
    for (const { holder } of this.buttons.values()) holder.scale.set(1);
  }

  /** Ícones de liga/desliga refletem o estado atual depois de cada clique. */
  sync(state: SettingsMenuState): void {
    for (const [action, { icon }] of this.buttons) {
      const texture = this.textureFor(action, state);
      if (icon.texture !== texture) {
        icon.texture = texture;
        this.fit(icon, action === 'advanced' ? ADVANCED_SIZE : BUTTON_SIZE);
      }
    }
  }

  update(deltaMs: number): void {
    if (!this.opened || this.openTimer >= OPEN_MS) return;
    this.openTimer = Math.min(OPEN_MS, this.openTimer + Math.max(0, deltaMs));
    const t = this.openTimer / OPEN_MS;
    const ease = 1 - (1 - t) ** 3;
    this.column.alpha = ease;
    this.column.pivot.y = -12 * (1 - ease);
  }

  private textureFor(action: SettingsMenuAction, state: SettingsMenuState): Texture {
    const t = this.textures;
    switch (action) {
      case 'zoomIn': return t.zoomIn;
      case 'zoomOut': return t.zoomOut;
      case 'fullscreen': return state.fullscreen ? t.fullscreenExit : t.fullscreen;
      case 'music': return state.music ? t.music : t.musicOff;
      case 'sound': return state.sound ? t.sound : t.soundOff;
      case 'advanced': return t.advanced;
    }
  }

  private fit(icon: Sprite, size: number): void {
    icon.scale.set(size / Math.max(icon.texture.width, icon.texture.height));
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.opened || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.close();
  };

  destroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKeyDown, true);
    this.view.destroy({ children: true });
  }
}
