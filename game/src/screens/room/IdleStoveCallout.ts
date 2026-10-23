import { Assets, Container, Sprite, Text, type Texture } from 'pixi.js';
import { UI_STOVE_HOVER_URLS } from '../../game/asset-manifest';

interface IdleStoveArt { panel: Texture; book: Texture }
let pending: Promise<IdleStoveArt> | undefined;
export function loadIdleStoveArt(): Promise<IdleStoveArt> {
  return pending ??= Promise.all([
    Assets.load<Texture>(UI_STOVE_HOVER_URLS.panel), Assets.load<Texture>(UI_STOVE_HOVER_URLS.book),
  ]).then(([panel, book]) => ({ panel, book }))
    .catch(error => { pending = undefined; throw error; });
}

/** A ponta do painel é a origem; toda a arte acompanha o topo do fogão no mundo 2x. */
export class IdleStoveCallout {
  readonly view = new Container();

  constructor(art: IdleStoveArt) {
    this.view.label = 'idle-stove-callout';
    this.view.eventMode = 'none'; this.view.interactiveChildren = false; this.view.visible = false;
    const panel = new Sprite(art.panel);
    panel.label = 'idle-stove-panel'; panel.position.set(-52, -146); panel.width = 384; panel.height = 146;
    const book = new Sprite(art.book);
    book.label = 'idle-stove-book'; book.position.set(-70, -134); book.width = 84; book.height = 98;
    const first = new Text({ text: 'Clique no fogão para', style: {
      fontFamily: ['Arial', 'sans-serif'], fontSize: 24, fontWeight: '400', fill: 0x974811,
    } });
    first.label = 'idle-stove-instruction'; first.anchor.set(.5); first.position.set(172, -110);
    const second = new Text({ text: 'preparar um prato!', style: {
      fontFamily: ['Arial', 'sans-serif'], fontSize: 30, fontWeight: '700', fill: 0x873903,
    } });
    second.label = 'idle-stove-action'; second.anchor.set(.5); second.position.set(172, -78);
    this.view.addChild(panel, book, first, second);
  }

  destroy(): void { this.view.destroy({ children: true }); }
}
