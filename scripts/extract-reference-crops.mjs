import fs from 'node:fs';
import path from 'node:path';
import {readPng,writePng} from './png.mjs';
import '../tools/asset-positioner/fit-geometry.js';
const root=path.resolve(import.meta.dirname,'../tools/acervo');
const batchArgument=process.argv.slice(2).find(arg=>arg.startsWith('--batch='));
const batch=batchArgument?.slice(8);if(batch&&!/^\d{2}$/.test(batch))throw Error('Lote deve ter dois dígitos.');
const recipes=JSON.parse(fs.readFileSync(path.join(root,batch?`extracoes-lote-${batch}.json`:'extracoes.json'),'utf8'));
fs.mkdirSync(path.join(root,'recortes'),{recursive:true});
for(const entry of recipes){
 const image=readPng(path.join(root,entry.source)),[x,y,width,height]=entry.rect;
 if(x<0||y<0||x+width>image.width||y+height>image.height)throw Error(`Recorte fora da fonte: ${entry.id}`);
 const data=new Uint8ClampedArray(width*height*4);
 for(let row=0;row<height;row++)data.set(image.data.subarray(((y+row)*image.width+x)*4,((y+row)*image.width+x+width)*4),row*width*4);
 if(entry.polygons){
  const contains=(px,py,polygon)=>{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>py)!==(by>py)&&px<(bx-ax)*(py-ay)/(by-ay)+ax)inside=!inside;}return inside;};
  for(let py=0;py<height;py++)for(let px=0;px<width;px++){const i=(py*width+px)*4;let coverage=0;
   for(const dx of [.25,.75])for(const dy of [.25,.75])if(entry.polygons.some(p=>contains(px+dx,py+dy,p)))coverage++;
   if(entry.woodWindows&&data[i]>data[i+1]+20&&data[i+1]>data[i+2]+10&&entry.woodWindows.some(p=>contains(px+.5,py+.5,p)))coverage=4;
   data[i+3]=Math.round(data[i+3]*coverage/4);
   if(entry.removeBlueFloor&&data[i+2]<150&&data[i+2]>data[i+1]+3&&data[i+1]>data[i]+3)data[i+3]=0;
   if(entry.removeLightBackdrop&&data[i]>135&&data[i+1]>160&&data[i+2]>150)data[i+3]=0;
   if(entry.removeNonCloth&&(data[i]<100||data[i+1]<data[i]-15||data[i+2]<data[i]-15))data[i+3]=0;
   if(entry.exclusions?.some(p=>contains(px+.5,py+.5,p)))data[i+3]=0;
  }
 }
 if(entry.background){
  // Fundo de pranchas JPEG: distância da cor uniforme medida no canto do recorte.
  // O recorte original continua disponível na fonte; o alpha não é inferido pela cor branca.
  const bg=Array.from(data.slice(0,3)),region=new Uint8Array(width*height),queue=new Uint32Array(width*height);let start=0,end=0;
  const distance=p=>Math.sqrt(bg.reduce((sum,c,k)=>sum+(data[p*4+k]-c)**2,0));
  const visit=p=>{if(region[p]||distance(p)>=65)return;region[p]=1;queue[end++]=p;};
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  for(const [x,y] of entry.transparentSeeds??[]){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)throw Error('Semente de transparência inválida.');visit(y*width+x);}
  // Cores semelhantes no interior (como um queimador cinza) continuam opacas.
  while(start<end){const p=queue[start++],x=p%width,y=Math.floor(p/width);if(x>0)visit(p-1);if(x<width-1)visit(p+1);if(y>0)visit(p-width);if(y<height-1)visit(p+width);}
  for(let i=0;i<data.length;i+=4){if(!region[i/4])continue;const d=distance(i/4);
   if(d<22)data[i+3]=0;
   else if(d<65){const alpha=(d-22)/43;data[i+3]=Math.round(alpha*255);for(let k=0;k<3;k++)data[i+k]=Math.max(0,Math.min(255,Math.round((data[i+k]-bg[k]*(1-alpha))/alpha)));}
  }
 }
 for(let i=0;i<data.length;i+=4)if(data[i+3]===0)data.fill(0,i,i+4);
 if(entry.retainCanvas){writePng(path.join(root,'recortes',entry.id+'.png'),{width,height,data});continue;}
 const box=globalThis.AssetFitGeometry.alphaBox(data,width,height,10);if(!box)throw Error(`Recorte vazio: ${entry.id}`);
 const result=new Uint8ClampedArray((box.width+4)*(box.height+4)*4);
 for(let row=0;row<box.height;row++)result.set(data.subarray(((row+box.top)*width+box.left)*4,((row+box.top)*width+box.left+box.width)*4),((row+2)*(box.width+4)+2)*4);
 writePng(path.join(root,'recortes',entry.id+'.png'),{width:box.width+4,height:box.height+4,data:result});
}
console.info(`${recipes.length} recortes RGBA extraídos; fontes intactas.`);
