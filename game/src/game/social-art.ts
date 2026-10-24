import { Assets, type Texture } from 'pixi.js';

import type { SocialBarTextures } from '../screens/room/SocialBar';
import type { SocialNewsBanner } from '../screens/room/SocialNews';

export interface SocialArt extends Omit<SocialBarTextures, 'spatula'> {
  banners: SocialNewsBanner[];
  newsBackground: Texture;
}

const base = new URL('assets/ui/social/', new URL(import.meta.env.BASE_URL, document.baseURI));
const banners = [
  ['mobile', 'Café Mania no celular!', 'banner-mobile.png'],
  ['taqueria', 'Arriba, arriba!', 'banner-taqueria.png'],
  ['cash', 'Promoção de caféGranas', 'banner-cash.png'],
  ['beach-stoves', 'Fogões de Praia', 'banner-beach-stoves.png'],
] as const;
let pending: Promise<SocialArt> | undefined;

/** Public UI artwork only; player identities come from the caller, never from this catalogue. */
export function loadSocialArt(): Promise<SocialArt> {
  const files = ['card.png', 'portrait-frame.png', 'portrait-placeholder.png', 'add-friend.png', 'promotion-chef.png', 'news-background.png', ...banners.map(banner => banner[2])];
  return pending ??= Promise.all(files.map(file => Assets.load<Texture>(new URL(file, base).href)))
    .then(([card, portraitFrame, portraitPlaceholder, addFriend, promotionChef, newsBackground, ...textures]) => ({
      card, portraitFrame, portraitPlaceholder, addFriend, promotionChef, newsBackground,
      banners: banners.map(([id, title], index) => ({ id, title, texture: textures[index] })),
    }))
    .catch((error: unknown) => { pending = undefined; throw error; });
}
