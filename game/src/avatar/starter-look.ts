import type { Look, Wardrobe } from './wardrobe';
import initial from '../../../shared/avatarappearance/starter.json';

/** IDs persistidos: cada peça ocupa um slot normal e pode ser trocada isoladamente. */
export const STARTER_PARTS = {
  Eyes: 1050022, Mouth: 1060025, Eyebrows: 1070012,
  Hair: 1040016, Shirt: 1020056, Pants: 1000021,
} as const;

export function starterLook(wardrobe: Wardrobe): Look {
  if (initial.itemIds.some(id => !wardrobe.byId(id))) throw new Error('Peça ausente no personagem inicial.');
  return {
    itemIds: [...initial.itemIds],
    skinColour: initial.skinColour,
    hairColour: initial.hairColour,
  };
}
