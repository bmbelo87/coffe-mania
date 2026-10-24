import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';

export interface SocialNewsBanner {
  id: string;
  title: string;
  texture: Texture;
}

export interface SocialNewsOptions {
  banners: readonly SocialNewsBanner[];
  buttons: { leftArrow: Texture; rightArrow: Texture; close: Texture };
  background?: Texture;
  onClose(): void;
  onActivate?(banner: SocialNewsBanner): void;
}

/** Coordinates belong to the native main action-bar artwork, before its parent scale. */
export const SOCIAL_NEWS_FRAME = { x: 328, y: 777, width: 1034, height: 164 } as const;

const BANNER_HEIGHT = 128;
const INDICATOR_COUNT = 4;
const CONTROL_GAP = 24;
const CONTROL_Y = 148;

/** Original news artwork replaces the friend cards while the toolbar icons remain visible. */
export class SocialNews {
  readonly view = new Container();
  private readonly banner = new Sprite();
  private readonly previousButton: Container;
  private readonly nextButton: Container;
  private readonly indicators: Graphics[] = [];
  private banners: readonly SocialNewsBanner[];
  private pageIndex = 0;
  private disposed = false;

  constructor(options: SocialNewsOptions) {
    this.banners = [...options.banners];
    const { width, height, x, y } = SOCIAL_NEWS_FRAME;
    this.view.label = 'room-social-news';
    this.view.position.set(x, y);
    this.view.hitArea = new Rectangle(0, 0, width, height);
    this.view.eventMode = 'static';
    for (const name of ['pointerdown', 'pointerup', 'pointerupoutside', 'pointertap', 'wheel'] as const) {
      this.view.on(name, (event) => event.stopPropagation());
    }

    if (options.background) {
      const background = new Sprite(options.background);
      background.label = 'room-social-news-background';
      background.width = width;
      background.height = height;
      background.eventMode = 'none';
      this.view.addChild(background);
    }

    this.banner.anchor.set(0.5);
    this.banner.position.set(width / 2, BANNER_HEIGHT / 2);
    this.banner.eventMode = options.onActivate ? 'static' : 'none';
    this.banner.cursor = options.onActivate ? 'pointer' : 'default';
    this.banner.on('pointertap', (event) => {
      event.stopPropagation();
      const selected = this.selectedBanner;
      if (selected) options.onActivate?.(selected);
    });
    this.view.addChild(this.banner);

    const firstControlX = width / 2 - CONTROL_GAP * (INDICATOR_COUNT + 1) / 2;
    this.previousButton = this.createButton(options.buttons.leftArrow, 'previous', 14, () => this.previous());
    this.previousButton.position.set(firstControlX, CONTROL_Y);
    this.view.addChild(this.previousButton);

    for (let slot = 0; slot < INDICATOR_COUNT; slot++) {
      const indicator = new Graphics();
      indicator.label = `room-social-news-page-${slot + 1}`;
      indicator.position.set(firstControlX + CONTROL_GAP * (slot + 1), CONTROL_Y);
      indicator.hitArea = new Rectangle(-11, -11, 22, 22);
      indicator.eventMode = 'static';
      indicator.cursor = 'pointer';
      indicator.on('pointertap', (event) => {
        event.stopPropagation();
        this.setPage(this.indicatorWindowStart + slot);
      });
      this.indicators.push(indicator);
      this.view.addChild(indicator);
    }

    this.nextButton = this.createButton(options.buttons.rightArrow, 'next', 14, () => this.next());
    this.nextButton.position.set(firstControlX + CONTROL_GAP * (INDICATOR_COUNT + 1), CONTROL_Y);
    this.view.addChild(this.nextButton);

    const close = this.createButton(options.buttons.close, 'close', 25, () => {
      this.hide();
      options.onClose();
    });
    close.position.set(width - 17, 17);
    this.view.addChild(close);
    this.sync();
  }

  get page(): number { return this.pageIndex; }

  get selectedBanner(): SocialNewsBanner | undefined { return this.banners[this.pageIndex]; }

  setBanners(banners: readonly SocialNewsBanner[]): void {
    if (this.disposed) return;
    const selectedId = this.selectedBanner?.id;
    this.banners = [...banners];
    const retainedIndex = selectedId ? this.banners.findIndex((entry) => entry.id === selectedId) : -1;
    this.pageIndex = retainedIndex >= 0 ? retainedIndex : Math.min(this.pageIndex, Math.max(0, this.banners.length - 1));
    this.sync();
  }

  setPage(page: number): void {
    if (this.disposed || !Number.isFinite(page)) return;
    this.pageIndex = Math.max(0, Math.min(Math.trunc(page), Math.max(0, this.banners.length - 1)));
    this.sync();
  }

  next(): void {
    if (this.banners.length) this.setPage((this.pageIndex + 1) % this.banners.length);
  }

  previous(): void {
    if (this.banners.length) this.setPage((this.pageIndex + this.banners.length - 1) % this.banners.length);
  }

  show(): void { if (!this.disposed) this.view.visible = true; }

  hide(): void { if (!this.disposed) this.view.visible = false; }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    // Textures belong to the asset loader and remain shared by other room controls.
    this.view.destroy({ children: true });
  }

  private get indicatorWindowStart(): number {
    return Math.floor(this.pageIndex / INDICATOR_COUNT) * INDICATOR_COUNT;
  }

  private createButton(texture: Texture, name: string, size: number, activate: () => void): Container {
    const holder = new Container();
    holder.label = `room-social-news-${name}`;
    holder.eventMode = 'static';
    holder.cursor = 'pointer';
    holder.hitArea = new Rectangle(-15, -15, 30, 30);
    const art = new Sprite(texture);
    art.anchor.set(0.5);
    art.scale.set(size / Math.max(1, texture.width, texture.height));
    art.eventMode = 'none';
    holder.addChild(art);
    holder.on('pointertap', (event) => {
      event.stopPropagation();
      if (!this.disposed) activate();
    });
    return holder;
  }

  private sync(): void {
    const selected = this.selectedBanner;
    this.banner.visible = selected !== undefined;
    if (selected) {
      this.banner.texture = selected.texture;
      this.banner.label = `room-social-news-banner-${selected.id}: ${selected.title}`;
      this.banner.scale.set(Math.min(
        (SOCIAL_NEWS_FRAME.width - 12) / Math.max(1, selected.texture.width),
        (BANNER_HEIGHT - 12) / Math.max(1, selected.texture.height),
      ));
    }

    const canNavigate = this.banners.length > 1;
    for (const arrow of [this.previousButton, this.nextButton]) {
      arrow.alpha = canNavigate ? 1 : 0.4;
      arrow.eventMode = canNavigate ? 'static' : 'none';
    }
    this.indicators.forEach((indicator, slot) => {
      const page = this.indicatorWindowStart + slot;
      indicator.visible = page < this.banners.length;
      indicator.clear().circle(0, 0, 5.5).fill(page === this.pageIndex ? 0x096f98 : 0x19abd0);
    });
  }
}
