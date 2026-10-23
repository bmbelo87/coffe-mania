import { Container } from 'pixi.js';
import { MODAL_OPEN_DURATION_MS, MODAL_OVERLAY_ALPHA, modalAnimationFrame } from './ModalAnimation';

/** Camada de animação independente do layout: conserva escala, posição e pivô do conteúdo. */
export class PopupOpening {
  readonly view = new Container();
  private elapsedMs = 0;
  private running = false;

  constructor(content: Container, centerX: number, centerY: number, private readonly backdrop?: Container) {
    const parent = content.parent;
    if (!parent) throw new Error('O popup precisa estar montado antes de receber a animação.');
    const index = parent.getChildIndex(content);
    this.view.label = 'popup-opening';
    this.setCenter(centerX, centerY);
    parent.addChildAt(this.view, index);
    this.view.addChild(content);
  }

  setCenter(x: number, y: number): void {
    this.view.pivot.set(x, y);
    this.view.position.set(x, y);
  }

  open(): void {
    this.elapsedMs = 0;
    this.running = true;
    this.apply();
  }

  update(deltaMs: number): void {
    if (!this.running) return;
    this.elapsedMs += Math.max(0, deltaMs);
    this.apply();
  }

  private apply(): void {
    const frame = modalAnimationFrame('opening', this.elapsedMs);
    this.view.scale.set(frame.scale);
    this.view.alpha = frame.alpha;
    if (this.backdrop) this.backdrop.alpha = frame.backdropAlpha / MODAL_OVERLAY_ALPHA;
    if (frame.finished) this.running = false;
  }
}

/** O diálogo HTML usa a mesma curva do Pixi, sem manter outra animação em CSS. */
export function animatePopupElement(content: HTMLElement, backdrop: HTMLElement): void {
  const frames = Array.from({ length: 27 }, (_, index) => {
    const offset = index / 26;
    const frame = modalAnimationFrame('opening', MODAL_OPEN_DURATION_MS * offset);
    return { offset, transform: `scale(${frame.scale})`, opacity: frame.alpha };
  });
  content.animate(frames, { duration: MODAL_OPEN_DURATION_MS, easing: 'linear' });
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MODAL_OPEN_DURATION_MS, easing: 'linear' });
}
