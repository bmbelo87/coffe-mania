// Fontes são preservadas; alterar os três exports calibrados exige --update com suas classes explícitas.
import fs from 'node:fs';
import path from 'node:path';
import { readPng, writePng } from './png.mjs';
import '../tools/asset-positioner/fit-geometry.js';
import '../tools/asset-positioner/furniture-geometry.js';

const root = path.resolve(import.meta.dirname,'..');
const sourceRoot = process.argv[2] && path.resolve(process.argv[2]);
if (!sourceRoot || !fs.existsSync(sourceRoot)) throw Error('Informe a pasta _recortes como primeiro argumento.');
const references = path.join(root,'tools/asset-positioner/references');
const items = path.join(root,'game/public/assets/items');
const updateArgument = process.argv.slice(3).find(arg=>arg.startsWith('--update='));
const updates = new Set(updateArgument ? updateArgument.slice(9).split(',') : []);
const editable = new Set(['original_glass_table','original_striped_table','original_barbecue']);
for(const name of updates)if(!editable.has(name))throw Error(`Atualização não suportada: ${name}`);
const G = globalThis.CafeFurnitureGeometry, F = globalThis.AssetFitGeometry;
const point = (x,y) => ({x,y});
const tableSpecs = [
  { index:'04',classname:'original_glass_table',name:'Mesa de Vidro com Madeira',id:9030101,support:.75,width:1,mode:'planes',
    points:{left:point(3,66),back:point(130,2),right:point(257,66),groundLeft:point(35,132),foot:point(132,182),groundRight:point(228,132)} },
  { index:'07',classname:'original_gold_table',name:'Mesa Preta e Dourada',id:9030102,support:.88,
    points:{left:point(7,73),back:point(135,6),right:point(265,72),foot:point(134,202)} },
  { index:'08',classname:'original_striped_table',name:'Balcão com Toalha Listrada',kind:'counter',id:9030103,support:1,width:.85,topHeight:31,mode:'planes',
    points:{left:point(24,73),back:point(136,17),right:point(248,73),groundLeft:point(6,142),foot:point(133,205),groundRight:point(262,139)} },
];
const names = { '4286853-001':['Piano Preto','Piano Creme','Fogão Churrasqueira','Mesa de Vidro','Poltrona · costas','Poltrona · frente','Mesa Preta e Dourada','Balcão Listrado'],
  '43063757-010':['Piso de Água','Piso de Pedras','Piso de Piscina','Piso de Areia','Piso com Grama'] };
function preserve(file,bytes) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if (fs.existsSync(file)) {
    const before=fs.readFileSync(file);
    if (!before.equals(bytes)) {
      const relative=path.relative(items,file), classname=relative.split(path.sep)[0];
      if(relative.startsWith('..') || !updates.has(classname))throw Error(`Arquivo existente diferente: ${file}. Preserve-o e use outra classe.`);
      const backup=path.join(root,'.runtime/asset-audit/geometry-before',relative);
      fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.writeFileSync(backup,before);
      fs.writeFileSync(file,bytes);
    }
  }
  else fs.writeFileSync(file,bytes);
}
function rgba(file,image) {
  // writePng também normaliza arquivos de paleta para RGBA, preservando os pixels decodificados.
  const temporary = file+'.tmp';fs.mkdirSync(path.dirname(file),{recursive:true});writePng(temporary,image);
  try { preserve(file,fs.readFileSync(temporary)); } finally { fs.unlinkSync(temporary); }
}
const entries = [];
for (const folder of fs.readdirSync(sourceRoot,{withFileTypes:true}).filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {
  const sheetPath = path.join(sourceRoot,folder.name,'folha.json'); if(!fs.existsSync(sheetPath)) continue;
  const sheet = JSON.parse(fs.readFileSync(sheetPath,'utf8'));
  for(const piece of sheet.pecas) {
    const input = path.join(sourceRoot,folder.name,piece.arquivo), image = readPng(input);
    let transparent = 0,partial = 0; for(let i=3;i<image.data.length;i+=4) {if(image.data[i]===0)transparent++;else if(image.data[i]<255)partial++;}
    if(!transparent) throw Error(`Recorte sem transparência real: ${input}`);
    const file = path.join(references,'originals',folder.name,piece.arquivo); preserve(file,fs.readFileSync(input));
    const short=folder.name.replace('behance-',''), index=Number.parseInt(piece.arquivo,10)-1;
    const category=short==='4286853-001'?'furniture':short.endsWith('-009')||short.endsWith('-010')?'floor':short==='4432119-001'?'ui':'food';
    const spec=short==='4286853-001'?tableSpecs.find(s=>s.index+'.png'===piece.arquivo):null;
    entries.push({name:names[short]?.[index]??`${short}/${piece.arquivo}`,url:`references/originals/${folder.name}/${piece.arquivo}`,
      dataUrl:'data:image/png;base64,'+fs.readFileSync(input).toString('base64'),category,
      ...(category === 'ui' ? {uiGeneration:'legacy',usage:'reference-only'} : {}),
      ...(short==='4286853-001' && piece.arquivo==='03.png' ? {kind:'stove',topHeight:45.1,support:1,fixedTransform:F.rectTransform(-80,80-image.height*160/image.width,160/image.width)} : {}),
      source:`${sheet.folha} · recorte ${piece.arquivo}`,width:image.width,height:image.height,transparentPixels:transparent,partialAlphaPixels:partial,
      ...(spec ? {kind:spec.kind??'table',points:spec.points,support:spec.support,surface:spec.width??1,topHeight:spec.topHeight??G.defaults.topHeight,fitMode:spec.mode??'single'} : {})});
  }
}
const current = {};
for(const [kind,classname] of [['table','white_cloth_table'],['chair','classic_chair'],['counter','starter_counter'],['stove','starter_stove']]) {
  const item=JSON.parse(fs.readFileSync(path.join(items,classname,'item.json'),'utf8'));
  current[kind]={classname,parts:item.parts.map(p=>{preserve(path.join(references,'current',classname,p.file),fs.readFileSync(path.join(items,classname,p.file)));return {...p,url:`references/current/${classname}/${p.file}`};})};
}
fs.writeFileSync(path.join(references,'library.js'),'// Índice derivado das fontes; regenerado por scripts/import-cafe-originals.mjs.\n'+'globalThis.CafeFurnitureLibrary = '+JSON.stringify({entries,current},null,2)+';\n');
function trim(rendered) {
  const box=F.alphaBox(rendered.data,rendered.width,rendered.height);if(!box)throw Error('Imagem vazia.');
  const data=new Uint8ClampedArray(box.width*box.height*4);
  for(let y=0;y<box.height;y++)data.set(rendered.data.subarray(((y+box.top)*rendered.width+box.left)*4,((y+box.top)*rendered.width+box.left+box.width)*4),y*box.width*4);
  return {width:box.width,height:box.height,data,left:rendered.left+box.left,top:rendered.top+box.top};
}
function saveItem(spec,images) {
  const folder=path.join(items,spec.classname), parts=[];
  images.forEach((image,rotation)=>{
    const file=`rotation-${rotation}.png`;rgba(path.join(folder,file),image);
    parts.push({file,width:image.width,height:image.height,left:image.left,top:image.top,...(images.length>1?{rotation}: {})});
  });
  const item={id:spec.id,classname:spec.classname,name:spec.name,type:spec.type??3,kind:spec.kind??'table',priceGold:spec.priceGold??500,purchasable:true,
    sizeX:1,sizeY:1,itemHeight:spec.itemHeight??G.defaults.topHeight,parts,
    source:{art:spec.source,calibration:spec.calibration,priceGold:'Preço de projeto; não confirmado pela configuração histórica.'}};
  preserve(path.join(folder,'item.json'),Buffer.from(JSON.stringify(item,null,2)+'\n'));
}
const original = index => readPng(path.join(sourceRoot,'behance-4286853-001',index+'.png'));
for(const spec of tableSpecs) {
  const source=original(spec.index), options={width:spec.width??1,height:spec.topHeight??G.defaults.topHeight,support:spec.support};
  const mapping=spec.mode==='planes'?G.calibratePlanes(spec.points,options):null;
  const transform=mapping?.topTransform??G.calibrate(spec.points,options);
  saveItem({...spec,source:`behance/artes/4286853/001.jpg · recorte ${spec.index}.png fornecido pelo responsável.`,
    itemHeight:options.height,
    calibration:{tile:[160,80],origin:'back',topHeight:options.height,support:spec.support,points:spec.points,transform,
      ...(mapping?{mode:'planes',surface:options.width,groundAnchor:mapping.foot}: {})}},
    [trim(mapping?F.renderMapped(source.data,source.width,source.height,{bounds:mapping.bounds(source.width,source.height),inverse:mapping.inverse}):F.render(source.data,source.width,source.height,transform))]);
}
for(const [index,classname,name,id] of [['01','original_black_piano','Piano Preto',9090101],['02','original_cream_piano','Piano Creme',9090102],['03','original_barbecue','Fogão Churrasqueira',9090103]]) {
  const image=original(index), scale=160/image.width;
  const stove=index==='03';
  const result=trim(F.render(image.data,image.width,image.height,F.rectTransform(-80,(stove?80:70)-image.height*scale,scale)));
  saveItem({classname,name,id,kind:stove?'stove':'decor',itemHeight:Math.max(1,40-result.top),source:`behance/artes/4286853/001.jpg · recorte ${index}.png fornecido pelo responsável.`,
    calibration:stove?'Fogão: escala original preservada, sprite deslocado 10 px para baixo; apoio frontal em y=80.':'Escala uniforme para largura de um tile; apoio frontal em y=70. Decoração sem funções de cozinha.'},[result]);
}
const front=original('06'), back=original('05');
const chairView = image => {
  const scale=83/image.width;return trim(F.render(image.data,image.width,image.height,F.rectTransform(-41.5,63-image.height*scale,scale)));
};
const mirror = image => {
  const data=new Uint8ClampedArray(image.data.length);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)data.set(image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4),(y*image.width+image.width-x-1)*4);
  return {...image,data,left:-image.left-image.width};
};
const f=chairView(front),b=chairView(back);
saveItem({classname:'original_gold_armchair',name:'Poltrona Dourada',id:9040101,kind:'chair',priceGold:200,itemHeight:97.4,
  source:'behance/artes/4286853/001.jpg · recortes 05.png (costas) e 06.png (frente) fornecidos pelo responsável.',
  calibration:'Quatro vistas: frente, frente espelhada, costas espelhada, costas. Escala uniforme para 83 px, apoio em y=63; conferir postura sentada no runtime.'},[f,mirror(f),mirror(b),b]);

for(let i=1;i<=5;i++) {
  const image=readPng(path.join(sourceRoot,'behance-43063757-010',`0${i}.png`));
  const result=F.render(image.data,image.width,image.height,F.rectTransform(-80,0,160/image.width,80/image.height));
  // A máscara geométrica elimina margens da folha e garante que o sprite não cubra o tile vizinho.
  for(let y=0;y<result.height;y++)for(let x=0;x<result.width;x++)if(Math.abs((x+.5)-80)/80+Math.abs((y+.5)-40)/40>1)result.data[(y*result.width+x)*4+3]=0;
  saveItem({classname:['original_water_floor','original_stone_floor','original_pool_floor','original_sand_floor','original_grass_floor'][i-1],
    name:names['43063757-010'][i-1]+' (Mosaico)',id:9050100+i,type:0,kind:'decor',priceGold:10,itemHeight:0,
    source:`behance/artes/43063757/010.jpg · recorte 0${i}.png fornecido pelo responsável.`,
    calibration:'Bloco original reduzido a um tile 160×80, máscara em losango. Repetição do bloco; não é extração de cada subtile original.'},[result]);
}
console.info(`${entries.length} recortes preservados na biblioteca; 12 itens originais cadastrados. Rode npm run assets:room.`);
