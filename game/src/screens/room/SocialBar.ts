import { Container, Rectangle, Sprite, Text, TextStyle, type Texture } from 'pixi.js';

import { FONT_FAMILY } from '../../core/font-tokens';
import {
  clampSocialPage, socialDisplayName, socialPageCount, socialPageSlots, socialProgressLabel, uniqueSocialPlayers,
  type SocialPlayer,
} from './social-bar-model';

export interface SocialBarPlayer extends SocialPlayer {
  /** A caller-owned ready portrait; changing pages never destroys its shared texture. */
  portrait?: Texture;
}

export interface SocialBarTextures {
  /** Complete white friend card, nominally 100×150, without dynamic lettering. */
  card: Texture;
  /** Orange photo well, nominally 82×82, drawn behind the portrait. */
  portraitFrame: Texture;
  /** Original-style grey silhouette with real alpha around the body. */
  portraitPlaceholder: Texture;
  /** Complete orange invitation card, nominally 100×150, without lettering. */
  addFriend: Texture;
  spatula: Texture;
  /** Optional system promotion art; supplied independently from real player records. */
  promotionChef?: Texture;
}

export interface SocialBarOptions {
  textures: SocialBarTextures;
  players?: readonly SocialBarPlayer[];
  onVisit?: (playerId: string, player: SocialPlayer) => void;
  onAddFriend?: () => void;
  onPageChange?: (page: number, pageCount: number) => void;
}

const SLOT_CENTERS = [385, 516, 648, 779, 910, 1041, 1172, 1303] as const;
const SLOT_TOP = 782;
const CARD_WIDTH = 100;
const CARD_HEIGHT = 150;
const BROWN = 0x704721;

/** The historical friend row in the action bar's native coordinates. The owner positions/scales it. */
export class SocialBar {
  readonly view = new Container();
  private players: SocialBarPlayer[];
  private currentPage = 0;
  private disposed = false;

  constructor(private readonly options: SocialBarOptions) {
    this.view.label = 'room-social-bar';
    this.view.eventMode = 'passive';
    this.players = uniqueSocialPlayers(options.players ?? []).map(player => ({ ...player }));
    this.draw();
  }

  get page(): number { return this.currentPage; }
  get pageCount(): number { return socialPageCount(this.players.length); }
  get canGoPrevious(): boolean { return this.currentPage > 0; }
  get canGoNext(): boolean { return this.currentPage + 1 < this.pageCount; }

  setPlayers(players: readonly SocialBarPlayer[]): void {
    if (this.disposed) return;
    this.players = uniqueSocialPlayers(players).map(player => ({ ...player }));
    this.currentPage = clampSocialPage(this.currentPage, this.players.length);
    this.draw();
    this.notifyPage();
  }

  setPortrait(playerId: string, portrait?: Texture): void {
    if (this.disposed) return;
    const player = this.players.find(value => value.playerId === playerId);
    if (!player || player.portrait === portrait) return;
    player.portrait = portrait;
    this.draw();
  }

  setPage(page: number): void {
    if (this.disposed) return;
    const next = clampSocialPage(page, this.players.length);
    if (next === this.currentPage) return;
    this.currentPage = next;
    this.draw();
    this.notifyPage();
  }

  previous(): void { this.setPage(this.currentPage - 1); }
  next(): void { this.setPage(this.currentPage + 1); }
  first(): void { this.setPage(0); }
  last(): void { this.setPage(this.pageCount - 1); }

  private notifyPage(): void { this.options.onPageChange?.(this.page, this.pageCount); }

  private image(texture: Texture, x: number, y: number, width: number, height: number): Sprite {
    const image = new Sprite(texture);
    image.position.set(x, y);
    image.width = width;
    image.height = height;
    image.eventMode = 'none';
    return image;
  }

  private text(value: string, y: number, size: number, color = BROWN): Text {
    const text = new Text({
      text: value,
      style: new TextStyle({
        fontFamily: [FONT_FAMILY, 'sans-serif'], fontSize: size,
        fontWeight: '600', fill: color, align: 'center',
      }),
    });
    text.anchor.set(0.5, 0);
    text.position.set(0, y);
    text.eventMode = 'none';
    return text;
  }

  private fitWidth(text: Text, width: number): void {
    if (text.width > width) text.scale.x *= width / text.width;
  }

  private slot(index: number, activate?: () => void): Container {
    const slot = new Container();
    slot.label = `room-social-slot-${this.currentPage * SLOT_CENTERS.length + index + 1}`;
    slot.position.set(SLOT_CENTERS[index], SLOT_TOP);
    slot.eventMode = 'static';
    slot.cursor = activate ? 'pointer' : 'default';
    slot.hitArea = new Rectangle(-CARD_WIDTH / 2, 0, CARD_WIDTH, CARD_HEIGHT);
    for (const event of ['pointerdown', 'pointerup', 'pointerupoutside', 'wheel'] as const) {
      slot.on(event, input => input.stopPropagation());
    }
    slot.on('pointertap', event => { event.stopPropagation(); activate?.(); });
    return slot;
  }

  private drawPlayer(index: number, player: SocialBarPlayer): Container {
    const slot = this.slot(index, this.options.onVisit
      ? () => this.options.onVisit?.(player.playerId, player) : undefined);
    slot.label = `room-social-player-${player.playerId}`;
    slot.addChild(this.image(this.options.textures.card, -50, 0, CARD_WIDTH, CARD_HEIGHT));

    this.addTitle(slot, player.displayName);

    this.addPortrait(slot, player.portrait ?? this.options.textures.portraitPlaceholder,
      `room-social-portrait-${player.playerId}`);

    const badge = new Container();
    badge.eventMode = 'none';
    const spatula = new Sprite(this.options.textures.spatula);
    spatula.anchor.set(0, 0.5);
    spatula.scale.set(44 / Math.max(1, spatula.texture.height));
    const level = this.text(socialProgressLabel(player.level), 0, 25, 0xffd436);
    level.anchor.set(0, 0.5);
    level.style.stroke = { color: BROWN, width: 5, join: 'round' };
    level.style.padding = 3;
    level.x = spatula.width + 3;
    badge.addChild(spatula, level);
    const width = spatula.width + 3 + level.width;
    const scale = Math.min(1, 96 / Math.max(1, width));
    badge.scale.set(scale);
    badge.position.set(-width * scale / 2, 108);
    slot.addChild(badge);

    const experience = this.text(socialProgressLabel(player.experience), 132, 15, 0x151515);
    experience.style.fontFamily = 'Arial';
    experience.style.fontWeight = '400';
    this.fitWidth(experience, 92);
    slot.addChild(experience);
    return slot;
  }

  private addTitle(slot: Container, displayName: string): void {
    const name = this.text(socialDisplayName(displayName), 1, 18);
    name.style.fontFamily = 'Arial';
    name.style.fontWeight = '700';
    this.fitWidth(name, 92);
    slot.addChild(name);
  }

  private addPortrait(slot: Container, texture: Texture | undefined, label: string): void {
    slot.addChild(this.image(this.options.textures.portraitFrame, -41, 27, 82, 82));
    if (!texture) return;
    const portrait = new Sprite(texture);
    portrait.label = label;
    portrait.anchor.set(0.5);
    portrait.position.set(0, 68);
    portrait.scale.set(Math.min(70 / Math.max(1, texture.width), 70 / Math.max(1, texture.height)));
    portrait.eventMode = 'none';
    slot.addChild(portrait);
  }

  /** Vacant neighbours have a generic title and empty photo well, without identity or progress. */
  private drawEmpty(index: number): Container {
    const slot = this.slot(index);
    slot.label = `room-social-empty-${index + 1}`;
    slot.addChild(this.image(this.options.textures.card, -50, 0, CARD_WIDTH, CARD_HEIGHT));
    this.addTitle(slot, '');
    this.addPortrait(slot, undefined, `room-social-empty-portrait-${index + 1}`);
    return slot;
  }

  private drawInvitation(index: number): Container {
    const slot = this.slot(index, this.options.onAddFriend);
    slot.label = `room-social-invite-${index + 1}`;
    slot.addChild(this.image(this.options.textures.addFriend, -50, 0, CARD_WIDTH, CARD_HEIGHT));
    const label = this.text('Agregar\nAmigo', 102, 19, 0xffffff);
    label.style.lineHeight = 21;
    label.style.stroke = { color: BROWN, width: 3, join: 'round' };
    label.style.padding = 2;
    this.fitWidth(label, 88);
    slot.addChild(label);
    return slot;
  }

  private draw(): void {
    for (const child of this.view.removeChildren()) child.destroy({ children: true });
    for (const [index, slot] of socialPageSlots(this.players, this.currentPage).entries()) {
      this.view.addChild(slot.kind === 'player' ? this.drawPlayer(index, slot.player)
        : slot.kind === 'invite' ? this.drawInvitation(index) : this.drawEmpty(index));
    }
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.players = [];
    // Supplied textures belong to the asset/portrait cache, not to these disposable views.
    this.view.destroy({ children: true });
  }
}
