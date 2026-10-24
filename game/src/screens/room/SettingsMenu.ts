import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';

import { UI_BUTTONS_COLLECTION_URL, UI_BUTTONS_POSITIONS_URL, UI_SETTINGS_MENU_URLS } from '../../game/asset-manifest';

export type SettingsMenuAction = 'zoomIn' | 'zoomOut' | 'view' | 'fullscreen' | 'music' | 'sound' | 'advanced';

export interface SettingsMenuTextures {
  zoomIn: Texture;
  zoomOut: Texture;
  view: Texture;
  fullscreen: Texture;
  fullscreenExit: Texture;
  music: Texture;
  sound: Texture;
  advanced: Texture;
}

export interface SettingsMenuState {
  fullscreen: boolean;
  music: boolean;
  sound: boolean;
}

/** Centro e altura da engrenagem, em coordenadas do pai do menu; `undefined` quando ela some. */
export type SettingsMenuAnchor = () => { x: number; y: number; size: number } | undefined;

interface ButtonsCollectionJson {
  buttons: Array<{ name: string; bbox: { x1: number; y1: number }; size: { width: number; height: number } }>;
}

let pending: Promise<SettingsMenuTextures> | undefined;

/** Botões azuis da interface atual; a variante de sair da tela cheia fica em `ui/settings-menu/`. */
export function loadSettingsMenuTextures(): Promise<SettingsMenuTextures> {
  return pending ??= Promise.all([
    Assets.load<Texture>(UI_BUTTONS_COLLECTION_URL),
    Assets.load<ButtonsCollectionJson>(UI_BUTTONS_POSITIONS_URL),
    Assets.load<Texture>(UI_SETTINGS_MENU_URLS.fullscreenExit),
  ]).then(([sheet, data, fullscreenExit]) => {
    const crop = (name: string): Texture => {
      const button = data.buttons.find((entry) => entry.name === name);
      if (!button) throw new Error(`Botão ausente na coleção: ${name}`);
      return new Texture({ source: sheet.source, frame: new Rectangle(button.bbox.x1, button.bbox.y1, button.size.width, button.size.height) });
    };
    return {
      zoomIn: crop('mais'), zoomOut: crop('menos'), view: crop('visualizar'), fullscreen: crop('tela_cheia'), fullscreenExit,
      music: crop('musica'), sound: crop('volume'), advanced: crop('configuracao'),
    };
  }).catch((error: unknown) => { pending = undefined; throw error; });
}

/**
 * Grade medida no vídeo "Café Mania level 400" (1:00–1:12), em centésimos da altura da engrenagem
 * e a partir do centro dela: botões de 0,82, passo de 0,87, a coluna da direita 0,15 à direita do
 * centro e 0,2 de folga entre a engrenagem e a linha mais próxima.
 */
const UNIT = 100;
const BUTTON = 82;
const PITCH = 87;
const RIGHT_X = 15;
const NEAREST_ROW_Y = 50 + 20 + BUTTON / 2;
const GRID: readonly (readonly [SettingsMenuAction, SettingsMenuAction])[] = [
  ['zoomOut', 'zoomIn'],
  ['view', 'fullscreen'],
  ['sound', 'music'],
];
/**
 * "Avançado" (volumes, modo bitter e modo dev) não existe no original: fica pequeno à direita da
 * engrenagem, fora da grade e da barra de ações (à esquerda fica o envelope).
 */
const ADVANCED = 56;
/** No vídeo, som e música desligados ficam esmaecidos, sem outro ícone. */
const OFF_ALPHA = 0.45;
const OPEN_MS = 160;

/**
 * Menu da engrenagem azul do visual final: grade 2x3 alinhada pela direita da engrenagem, aberta
 * enquanto se joga, até um novo clique na engrenagem. No vídeo a engrenagem fica acima da barra e
 * a grade desce; aqui ela fica dentro da barra de ações, então a grade sobe, na mesma ordem de
 * linhas (zoom em cima, som e música junto da engrenagem).
 */
export class SettingsMenu {
  readonly view = new Container();
  private readonly grid = new Container();
  private readonly buttons = new Map<SettingsMenuAction, { holder: Container; icon: Sprite }>();
  private anchor?: SettingsMenuAnchor;
  private openTimer = 0;
  private opened = false;

  constructor(
    private readonly textures: SettingsMenuTextures,
    private readonly onAction: (action: SettingsMenuAction) => void,
  ) {
    this.view.label = 'settings-menu';
    this.view.visible = false;
    this.grid.label = 'settings-menu-grid';
    this.view.addChild(this.grid);
    const left = RIGHT_X - PITCH;
    GRID.forEach((row, index) => {
      const y = -NEAREST_ROW_Y - (GRID.length - 1 - index) * PITCH;
      this.addButton(row[0], left, y, BUTTON);
      this.addButton(row[1], RIGHT_X, y, BUTTON);
    });
    this.addButton('advanced', RIGHT_X + PITCH, 0, ADVANCED);
  }

  get isOpen(): boolean { return this.opened; }

  open(anchor: SettingsMenuAnchor, state: SettingsMenuState): void {
    this.anchor = anchor;
    if (!this.follow()) return;
    this.sync(state);
    this.opened = true;
    this.openTimer = 0;
    this.view.visible = true;
    this.grid.alpha = 0;
  }

  toggle(anchor: SettingsMenuAnchor, state: SettingsMenuState): void {
    if (this.opened) this.close();
    else this.open(anchor, state);
  }

  close(): void {
    this.opened = false;
    this.view.visible = false;
    for (const { holder } of this.buttons.values()) holder.scale.set(1);
  }

  /** Ícones de liga/desliga refletem o estado atual depois de cada clique. */
  sync(state: SettingsMenuState): void {
    const fullscreen = this.buttons.get('fullscreen');
    if (fullscreen) {
      fullscreen.icon.texture = state.fullscreen ? this.textures.fullscreenExit : this.textures.fullscreen;
      this.fit(fullscreen.icon, BUTTON);
    }
    const music = this.buttons.get('music');
    if (music) music.icon.alpha = state.music ? 1 : OFF_ALPHA;
    const sound = this.buttons.get('sound');
    if (sound) sound.icon.alpha = state.sound ? 1 : OFF_ALPHA;
  }

  update(deltaMs: number): void {
    if (!this.opened || !this.follow()) return;
    if (this.openTimer >= OPEN_MS) return;
    this.openTimer = Math.min(OPEN_MS, this.openTimer + Math.max(0, deltaMs));
    const ease = 1 - (1 - this.openTimer / OPEN_MS) ** 3;
    this.grid.alpha = ease;
    this.grid.pivot.y = -12 * (1 - ease);
  }

  /** Acompanha a engrenagem (zoom da interface, redimensionamento) e fecha quando ela some. */
  private follow(): boolean {
    const at = this.anchor?.();
    if (!at || at.size <= 0) {
      if (this.opened) this.close();
      return false;
    }
    this.grid.position.set(at.x, at.y);
    this.grid.scale.set(at.size / UNIT);
    return true;
  }

  private addButton(action: SettingsMenuAction, x: number, y: number, size: number): void {
    const holder = new Container();
    holder.label = `settings-menu-${action}`;
    holder.position.set(x, y);
    holder.eventMode = 'static';
    holder.cursor = 'pointer';
    holder.hitArea = new Rectangle(-size / 2, -size / 2, size, size);
    const icon = new Sprite(this.textures[action]);
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
    });
    this.grid.addChild(holder);
    this.buttons.set(action, { holder, icon });
  }

  private fit(icon: Sprite, size: number): void {
    icon.scale.set(size / Math.max(icon.texture.width, icon.texture.height));
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
