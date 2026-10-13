import {Assets, type Texture} from 'pixi.js';

/** The stake's ground point stays at the sign's logical tile; the PNG carries all its lettering. */
export const LAND_SALE_SIGN_FRAME = {"left":-79.33333333333333,"top":-204,"width":158.66666666666666,"height":205.33333333333334,"scale":0.3333333333333333};
export const LAND_SALE_SIGN_URL = new URL('assets/scenery/land-sale/sign.png', new URL(import.meta.env.BASE_URL, document.baseURI)).href;

export async function loadLandSaleSignTexture(): Promise<Texture> {
  const texture = await Assets.load<Texture>(LAND_SALE_SIGN_URL);
  texture.source.scaleMode = 'linear';
  texture.source.autoGenerateMipmaps = true;
  texture.source.mipmapFilter = 'linear';
  return texture;
}
