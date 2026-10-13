import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {readPng,writePng} from './png.mjs';
import '../tools/asset-positioner/fit-geometry.js';
import '../tools/asset-positioner/furniture-geometry.js';

const root=path.resolve(import.meta.dirname,'..'), acervo=path.join(root,'tools/acervo');
const F=globalThis.AssetFitGeometry,G=globalThis.CafeFurnitureGeometry;
const batchArgument=process.argv.slice(2).find(arg=>arg.startsWith('--batch='));
const batch=batchArgument?.slice(8);if(batch&&!/^\d{2}$/.test(batch))throw Error('Lote deve ter dois dígitos.');
const onlyArgument=process.argv.slice(2).find(arg=>arg.startsWith('--only='));
const selected=new Set(onlyArgument?.slice(7).split(',')??[]);
const specArgument=process.argv.slice(2).find(arg=>arg.startsWith('--spec='))?.slice(7);
if(specArgument&&!/^[a-z0-9-]+\.json$/.test(specArgument))throw Error('Arquivo de especificações inválido.');
const allSpecs=JSON.parse(fs.readFileSync(path.join(acervo,specArgument??(batch?`moveis-lote-${batch}.json`:'moveis.json')),'utf8'));
const specs=selected.size?allSpecs.filter(spec=>selected.has(spec.classname)):allSpecs;
if(selected.size!==0&&specs.length!==selected.size)throw Error('Classe solicitada não está neste lote.');
const crops=fs.readdirSync(acervo).filter(file=>/^extracoes(?:-lote-\d{2})?\.json$/.test(file)).flatMap(file=>JSON.parse(fs.readFileSync(path.join(acervo,file),'utf8')));
const library=[],allowUpdate=process.argv.includes('--update');
const point=([x,y])=>({x,y});
function pointsFor(image,spec,back){
 const marked=back?spec.backPoints:spec.points;
 if(marked)return Object.fromEntries(Object.entries(marked).map(([key,p])=>[key,point(p)]));
 const detected=F.detect(F.alphaChannel(image.data,image.width,image.height),image.width,image.height);
 if(!detected.top||!detected.base)throw Error(`Marque os planos do asset ${spec.classname}.`);
 return {left:detected.top.left,back:detected.top.back,right:detected.top.right,
  foot:{x:detected.top.back.x,y:image.height-3},groundLeft:detected.base.left,groundRight:detected.base.right};
}
function trim(rendered){
 const box=F.alphaBox(rendered.data,rendered.width,rendered.height,0);if(!box)throw Error('Sprite vazio.');
 const width=box.width+4,height=box.height+4,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<box.height;y++)data.set(rendered.data.subarray(((y+box.top)*rendered.width+box.left)*4,((y+box.top)*rendered.width+box.left+box.width)*4),((y+2)*width+2)*4);
 for(let i=0;i<data.length;i+=4)if(data[i+3]===0)data.fill(0,i,i+4);
 return {data,width,height,left:rendered.left+box.left-2,top:rendered.top+box.top-2};
}
function mirrored(frame){
 const data=new Uint8ClampedArray(frame.data.length);
 for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++)data.set(frame.data.subarray((y*frame.width+x)*4,(y*frame.width+x)*4+4),(y*frame.width+frame.width-x-1)*4);
 return {...frame,data,left:-frame.left-frame.width};
}
function assembled(images){
 const left=Math.min(...images.map(i=>i.left)),top=Math.min(...images.map(i=>i.top));
 const width=Math.max(...images.map(i=>i.left+i.width))-left,height=Math.max(...images.map(i=>i.top+i.height))-top;
 const data=new Uint8ClampedArray(width*height*4);
 for(const image of images)for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  const source=(y*image.width+x)*4,dest=((y+image.top-top)*width+x+image.left-left)*4;
  const a=image.data[source+3]/255,b=data[dest+3]/255,result=a+b*(1-a);if(!result)continue;
  for(let k=0;k<3;k++)data[dest+k]=Math.round((image.data[source+k]*a+data[dest+k]*b*(1-a))/result);data[dest+3]=Math.round(result*255);
 }
 return {width,height,left,top,data};
}
function clearSpecks(image,limit){
 const visited=new Uint8Array(image.width*image.height),queue=new Uint32Array(visited.length);
 for(let start=0;start<visited.length;start++){
  if(visited[start]||image.data[start*4+3]<4)continue;let head=0,tail=1;queue[0]=start;visited[start]=1;
  while(head<tail){const p=queue[head++],x=p%image.width,y=Math.floor(p/image.width);
   for(const n of [x>0?p-1:-1,x<image.width-1?p+1:-1,y>0?p-image.width:-1,y<image.height-1?p+image.width:-1])if(n>=0&&!visited[n]&&image.data[n*4+3]>=4){visited[n]=1;queue[tail++]=n;}
  }
  if(tail<=limit)for(let i=0;i<tail;i++)image.data.fill(0,queue[i]*4,queue[i]*4+4);
 }
 for(let i=0;i<image.data.length;i+=4)if(image.data[i+3]<4)image.data.fill(0,i,i+4);
 return image;
}
function renderView(spec,back=false){
 const name=back?(spec.backGenerated||spec.backCrop):(spec.generated||spec.crop);
 const file=path.join(acervo,back?spec.backGenerated?'gerados':'recortes':spec.generated?'gerados':'recortes',name+'.png');
 const image=readPng(file),height=spec.kind==='chair'?32:spec.kind==='table'?49.2:32;
 const registration=back?spec.backRegistration:spec.registration;
 if(registration){
  // Uniform registration preserves the drawn camera and body proportions, including hidden seat planes.
  const scale=registration.scale,transform=F.rectTransform(-registration.anchor[0]*scale,registration.floorY-registration.anchor[1]*scale,scale);
  const rendered=F.render(image.data,image.width,image.height,transform);
  return {frame:trim(spec.cleanSpecks?clearSpecks(rendered,spec.cleanSpecks):rendered),file,
   calibration:{mode:'uniform',registration,transform,options:{height}}};
 }
 const points=pointsFor(image,spec,back);
 const options={width:spec.surface??1,height,support:spec.support??1};
 const planes=points.groundLeft&&points.groundRight?G.calibratePlanes(points,options):null;
 const transform=planes?.topTransform??G.calibrate(points,options);
 let rendered=planes?F.renderMapped(image.data,image.width,image.height,{bounds:planes.bounds(image.width,image.height),inverse:planes.inverse}):F.render(image.data,image.width,image.height,transform);
 let overlay;
 if(!back&&spec.surfaceCrop){
  const surface=readPng(path.join(acervo,'recortes',spec.surfaceCrop+'.png'));
  const surfacePoints=Object.fromEntries(Object.entries(spec.surfacePoints).map(([key,p])=>[key,point(p)]));
  const surfaceTransform=G.calibratePlanes(surfacePoints,options).topTransform;
  rendered=assembled([rendered,F.render(surface.data,surface.width,surface.height,surfaceTransform)]);
  overlay={crop:spec.surfaceCrop,points:surfacePoints,transform:surfaceTransform};
 }
 const frame=trim(spec.cleanSpecks?clearSpecks(rendered,spec.cleanSpecks):rendered);
 return {frame,calibration:{points,options,mode:planes?'planes':'single',transform,...(overlay?{overlay}:{})},file};
}
function writePreserving(file,bytes){
 if(fs.existsSync(file)&&!fs.readFileSync(file).equals(bytes)&&!allowUpdate)throw Error(`Export existente diferente: ${file}. Revise e use --update explicitamente.`);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
}
for(const spec of specs){
 const front=renderView(spec),back=spec.backCrop||spec.backGenerated?renderView(spec,true):null;
 const baseFrames=back?[front.frame,mirrored(front.frame),back.frame,mirrored(back.frame)]:[front.frame,mirrored(front.frame)];
 const order=spec.poseOrder??baseFrames.map((_,index)=>index);
 if(order.length!==baseFrames.length||new Set(order).size!==order.length||order.some(i=>!Number.isInteger(i)||!baseFrames[i]))throw Error('Ordem de vistas inválida.');
 const frames=order.map(i=>baseFrames[i]);
 const folder=path.join(root,'game/public/assets/items',spec.classname),parts=[];
 const original=spec.original??crops.find(e=>e.id===spec.crop)?.original;
 if(!original)throw Error(`Origem ausente: ${spec.classname}`);
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'artes-referencia',original))).digest('hex');
 for(const [rotation,frame]of frames.entries()){
  const sourceIndex=order[rotation],file=spec.mirrorByCode?(sourceIndex<2?'front.png':'back.png'):`rotation-${rotation}.png`;
  const rawFrame=spec.mirrorByCode?baseFrames[sourceIndex<2?0:2]:frame;
  const temporary=path.join(acervo,`.${spec.classname}-${rotation}.png`);writePng(temporary,rawFrame);
  try{writePreserving(path.join(folder,file),fs.readFileSync(temporary));}finally{fs.unlinkSync(temporary);}
  parts.push({file,width:frame.width,height:frame.height,left:frame.left,top:frame.top,rotation,...(spec.mirrorByCode&&sourceIndex%2?{flipX:true}:{})});
  library.push({name:`${spec.name} · vista ${rotation+1}`,category:'furniture',kind:spec.kind,
   url:`../../game/public/assets/items/${spec.classname}/${file}`,dataUrl:'data:image/png;base64,'+fs.readFileSync(path.join(folder,file)).toString('base64'),
   width:frame.width,height:frame.height,source:original,topHeight:front.calibration.options.height,
   fixedTransform:F.rectTransform(frame.left,frame.top),usage:'asset'});
 }
 const views=back?(spec.backGenerated?(spec.generated?'Frente e costas reconstruídas com imagegen; duas vistas complementares por espelhamento.':'Frente original e costas reconstruídas com imagegen; duas vistas complementares por espelhamento.'):spec.generated?'Frente reconstruída com imagegen e costas recortadas da referência; duas vistas complementares por espelhamento.':'Frente e costas originais; duas vistas complementares por espelhamento.'):
  'Vista da referência e espelhamento horizontal para a segunda direção. As rotações 2 e 3 reutilizam estas vistas; costas ainda não disponíveis.';
 const item={id:spec.id,classname:spec.classname,name:spec.name,type:3,kind:spec.kind,priceGold:spec.priceGold??200,purchasable:true,
  sizeX:1,sizeY:1,itemHeight:spec.kind==='chair'?97.4:front.calibration.options.height,parts,
  source:{acervo:original,sha256:hash,artist:spec.artist??'Autoria não informada na prancha fornecida.',page:spec.page??null,
   method:spec.artMethod??(spec.generated?'Reconstrução com imagegen de referência pequena; aproximação visual, não extração do PNG original.':spec.backGenerated?'Frente recortada da arte original; costas reconstruídas com imagegen.':'Recorte da arte original com transparência e calibração geométrica.'),
   name:spec.nameSource??'Nome descritivo do projeto; nome oficial do item não confirmado.',priceGold:spec.priceSource??'Preço de projeto; valor histórico não confirmado.',views,
   gameplay:'Usa a função básica existente para este kind. Não atribui bônus, evolução ou capacidade especial pela aparência.',
   ...(batch?{batch}:{}),calibration:{tile:[160,80],origin:'back',front:front.calibration,...(back?{back:back.calibration}:{})}}};
 writePreserving(path.join(folder,'item.json'),Buffer.from(JSON.stringify(item,null,2)+'\n'));
 console.info(`${spec.classname}: ${parts.length} vistas, ${parts[0].width}×${parts[0].height}.`);
}
// Reconstruir a biblioteca pelos manifestos preserva as entradas de outros lotes.
library.length=0;
const itemsRoot=path.join(root,'game/public/assets/items');
for(const entry of fs.readdirSync(itemsRoot,{withFileTypes:true}).filter(e=>e.isDirectory())){
 const manifest=path.join(itemsRoot,entry.name,'item.json');if(!fs.existsSync(manifest))continue;
 const item=JSON.parse(fs.readFileSync(manifest,'utf8'));if(!item.source?.acervo)continue;
 for(const part of item.parts){
  const sourceFile=path.join(itemsRoot,entry.name,part.file);let png=fs.readFileSync(sourceFile);
  if(part.flipX){const temporary=path.join(acervo,`.library-${entry.name}.png`);writePng(temporary,mirrored({...readPng(sourceFile),left:0}));try{png=fs.readFileSync(temporary);}finally{fs.unlinkSync(temporary);}}
  library.push({name:`${item.name} · vista ${(part.rotation??0)+1}`,category:'furniture',kind:item.kind,
  url:`../../game/public/assets/items/${item.classname}/${part.file}`,dataUrl:'data:image/png;base64,'+png.toString('base64'),
  width:part.width,height:part.height,source:item.source.acervo,topHeight:item.source.calibration.front.options.height,
   fixedTransform:F.rectTransform(part.left,part.top),usage:'asset'});
 }
}
fs.writeFileSync(path.join(root,'tools/asset-positioner/references/acervo.js'),
 '// Biblioteca derivada dos manifestos do acervo. PNGs e offsets são os mesmos usados pelo jogo.\n'+
 'globalThis.CafeFurnitureLibrary.entries.push(...'+JSON.stringify(library)+');\n');
console.info(`${specs.length} móveis e ${library.length} vistas exportados. Rode npm run assets:room.`);
