import { CanvasTexture, Float32BufferAttribute, MeshBasicMaterial, SRGBColorSpace, type Object3D, type SkinnedMesh } from 'three';
import type { AtlasFile } from './AvatarTexture';

/** Uma variante independente compartilha o esqueleto, mas nunca a geometria mutável do corte clássico. */
export function addStarterHair(model: Object3D, image: CanvasImageSource, atlas: AtlasFile): SkinnedMesh | undefined {
  const source = model.getObjectByName('hair05') as SkinnedMesh | undefined;
  const symbol = atlas.symbols.StarterHairShading;
  if (!source?.isSkinnedMesh || !symbol) return;
  const branch = model.getObjectByName('hair05-node') ?? source;
  if (!branch.parent) return;
  const copy = branch.clone(true);
  copy.traverse(node => { node.name = node.name.replace(/^hair05/, 'hairStarter'); });
  const mesh = (copy.name === 'hairStarter' ? copy : copy.getObjectByName('hairStarter')) as SkinnedMesh;
  mesh.geometry = source.geometry.clone();
  const position = mesh.geometry.getAttribute('position');
  // Bind space do Collada é Z_UP. A coroa recebe um pico baixo;
  // franja, contorno lateral e pesos do esqueleto ficam intactos.
  for (let i = 0; i < position.count; i++) {
    if (position.getZ(i) > 6600) position.setZ(i, position.getZ(i) + 250);
  }
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  const { min, max } = mesh.geometry.boundingBox!;
  const uv: number[] = [];
  for (let i = 0; i < position.count; i++) {
    uv.push((position.getX(i) - min.x) / (max.x - min.x), (position.getY(i) - min.y) / (max.y - min.y));
  }
  mesh.geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const canvas = document.createElement('canvas');
  canvas.width = symbol.w; canvas.height = symbol.h;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Sem contexto para textura do cabelo inicial.');
  context.drawImage(image, symbol.sx, symbol.sy, symbol.w, symbol.h, 0, 0, symbol.w, symbol.h);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  mesh.material = new MeshBasicMaterial({ map: texture });
  copy.visible = false;
  branch.parent.add(copy);
  return mesh;
}
