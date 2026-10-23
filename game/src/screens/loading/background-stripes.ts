import type { Graphics } from 'pixi.js';

import type { StageTransform } from '../../core/stage';
import { BACKGROUND_STRIPE_WIDTH, COLORS } from './layout';

/** HTML entry screens share the loading palette, stage alignment and stripe width. */
export function applyLoadingStripes(element: HTMLElement, width: number, height: number): void {
  const scale = Math.min(width / 1920, height / 1080);
  if (scale <= 0) return;
  const color = (value: number) => '#' + value.toString(16).padStart(6, '0');
  element.style.backgroundColor = color(COLORS.backgroundStripeLight);
  element.style.backgroundImage = `linear-gradient(to right, ${color(COLORS.backgroundStripeDark)} 50%, ${color(COLORS.backgroundStripeLight)} 50%)`;
  element.style.backgroundSize = `${2 * BACKGROUND_STRIPE_WIDTH * scale}px 100%`;
  element.style.backgroundPosition = `${(width - 1920 * scale) / 2}px 0`;
}

/** Faixas alinhadas à stage, mas estendidas até as bordas reais do viewport. */
export function drawLoadingStripes(
  graphics: Graphics,
  width: number,
  height: number,
  transform: StageTransform,
): void {
  graphics.clear();
  const stripeWidth = BACKGROUND_STRIPE_WIDTH * transform.scale;
  if (width <= 0 || height <= 0 || stripeWidth <= 0) return;

  // As duas extremidades usam a mesma grade física para evitar frestas subpixel.
  const first = Math.floor(-transform.x / stripeWidth);
  const last = Math.ceil((width - transform.x) / stripeWidth);
  for (let index = first; index < last; index++) {
    const left = Math.max(0, Math.round(transform.x + index * stripeWidth));
    const right = Math.min(width, Math.round(transform.x + (index + 1) * stripeWidth));
    if (right <= left) continue;
    const color = index % 2 === 0 ? COLORS.backgroundStripeDark : COLORS.backgroundStripeLight;
    graphics.rect(left, 0, right - left, height).fill(color);
  }
}
