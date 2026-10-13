import fs from 'node:fs';import path from 'node:path';
import {readPng,writePng} from './png.mjs';import '../tools/asset-positioner/fit-geometry.js';
const root=path.resolve(import.meta.dirname,'../tools/acervo'),F=globalThis.AssetFitGeometry;
const generated=readPng(path.join(root,'gerados/lote-02/table_italy_green.png'));
const visible=readPng(path.join(root,'recortes/lote02_table_italy_green_visible.png'));
const box=F.alphaBox(generated.data,generated.width,generated.height,128);
if(!box)throw Error('Reconstrução verde vazia.');
const sx=352/box.width,sy=317/box.height;
const transform=F.rectTransform(12-box.left*sx,10-box.top*sy,sx,sy);
const mapped=F.render(generated.data,generated.width,generated.height,transform);
const recipe=JSON.parse(fs.readFileSync(path.join(root,'extracoes-lote-02.json'),'utf8')).find(e=>e.id==='lote02_table_italy_green_visible');
const contains=(x,y,polygon)=>{let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)result=!result;}return result;};
const {width,height}=visible,data=new Uint8ClampedArray(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const sx=x-mapped.left,sy=y-mapped.top,i=(y*width+x)*4;
 const hidden=recipe.exclusions.some(p=>contains(x+.5,y+.5,p))&&recipe.polygons.some(p=>contains(x+.5,y+.5,p));
 if(hidden&&sx>=0&&sy>=0&&sx<mapped.width&&sy<mapped.height)data.set(mapped.data.subarray((sy*mapped.width+sx)*4,(sy*mapped.width+sx)*4+4),i);
 const alpha=visible.data[i+3]/255,under=data[i+3]/255,result=alpha+under*(1-alpha);
 if(result){for(let k=0;k<3;k++)data[i+k]=Math.round((visible.data[i+k]*alpha+data[i+k]*under*(1-alpha))/result);data[i+3]=Math.round(result*255);}
 if(!data[i+3])data.fill(0,i,i+4);
}
writePng(path.join(root,'recortes/lote02_table_italy_green_repaired.png'),{width,height,data});
fs.writeFileSync(path.join(root,'restauracao-mesa-verde-lote-02.json'),JSON.stringify({source:'anexos-usuario/lote-02/referencia-mesas-cadeiras.png',originalVisible:'recortes/lote02_table_italy_green_visible.png',hiddenRegionGeneration:'gerados/lote-02/table_italy_green.png',transform,output:'recortes/lote02_table_italy_green_repaired.png'},null,2)+'\n');
console.info('Mesa verde: desenho visível do screenshot preservado; região encoberta restaurada com imagegen.');
