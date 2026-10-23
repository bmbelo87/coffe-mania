import { Assets, NineSliceSprite, type Texture } from 'pixi.js';

import { UI_DIALOG_URLS, UI_LOGO_URL, UI_PADLOCK_URL } from '../../game/asset-manifest';

/** Peças de arte compartilhadas pelas janelas de confirmação e de bloqueio. */
export interface DialogArt {
  logo: Texture;
  padlock: Texture;
  lockedWindow: Texture;
  confirmWindow: Texture;
  purple: Texture;
  /** Fechar vermelho e botões vazios restaurados da janela de Temperos. */
  close: Texture;
  green: Texture;
  /** Visto verde da loja. */
  confirm?: Texture;
  cash: Texture;
  gold: Texture;
}

type DialogExtras = Pick<DialogArt, 'logo' | 'padlock' | 'lockedWindow' | 'confirmWindow' | 'purple'>;
let pending: Promise<DialogExtras> | undefined;

/** Logo, cadeado, molduras e botão roxo; o restante já chega carregado com a sala. */
export function loadDialogExtras(): Promise<DialogExtras> {
  return pending ??= Promise.all([UI_LOGO_URL, UI_PADLOCK_URL, UI_DIALOG_URLS.lockedWindow, UI_DIALOG_URLS.confirmWindow, UI_DIALOG_URLS.purpleButton]
    .map((url) => Assets.load<Texture>(url)))
    .then(([logo, padlock, lockedWindow, confirmWindow, purple]) => ({ logo, padlock, lockedWindow, confirmWindow, purple }))
    .catch((error: unknown) => { pending = undefined; throw error; });
}

/** Botão vazio esticado só no miolo: cantos e bisel continuam na proporção da arte. */
export function stretchedButton(texture: Texture, width: number, height: number): NineSliceSprite {
  const scale = height / texture.height;
  const face = new NineSliceSprite({ texture, leftWidth: 80, rightWidth: 80, topHeight: 60, bottomHeight: 60 });
  face.width = width / scale;
  face.height = texture.height;
  face.scale.set(scale);
  face.eventMode = 'none';
  return face;
}
