import fs from 'node:fs';import path from 'node:path';
import {readPng,writePng} from './png.mjs';import '../tools/asset-positioner/fit-geometry.js';
const root=path.resolve(import.meta.dirname,'..'),source=path.join(root,'tools/asset-positioner/references/originals/behance-4432119-003');
const folder=path.join(root,'game/public/assets/juices');fs.mkdirSync(folder,{recursive:true});
const flavors=[
 ['orange','Suco de Laranja','basic','01',9,5,24,2,12,'Cartaz de Sucos'],
 ['grape','Suco de Uva','basic','04',22,6,37,2,15,'Enfeite Florido'],
 ['lemon','Limonada','basic','02',35,8,80,1,10,'Torre de Abacaxis'],
 ['pineapple','Suco de Abacaxi','basic','03',43,9,16,5,10,'Balcão de Sucos'],
 ['passion_fruit','Suco de Maracujá','medium','08',12,12,40,3,5,'Cesto de Frutas'],
 ['strawberry','Suco de Morango','medium','09',12,12,40,3,5,'Estante de Frutas'],
 ['tangerine','Suco de Tangerina','medium','07',12,12,40,3,5,'Carrinho de Sucos'],
 ['kiwi','Suco de Kiwi','medium','06',12,12,40,3,5,'Mini Bar de Sucos'],
 ['guarana','Suco de Guaraná','tropical','12',18,16,60,4,6,'Garçonete'],
 ['watermelon','Suco de Melancia','tropical','11',18,16,60,4,6,'Geladeira de Sucos'],
 ['mango','Suco de Manga','tropical','13',18,16,60,4,6,'Sofá Descolado'],
 ['acerola','Suco de Acerola','tropical','10',18,16,60,4,6,'Bar de Sucos'],
];
const catalog={masteryServings:80,source:{names:'Blog oficial Vostu, 2011-01-06, preservado em Acervo-CafeMania/06_inventario/blog_cafe_mania_posts.md; https://cafemaniablogdedicas.blogspot.com/2011/02/',
 basicBalance:'Blog oficial Vostu, 2010-08-24: imagem juice4.jpg preservada em Acervo-CafeMania/03_referencia_cafe_mania/imagens_blog/2010/08/. Valores por copo; custo por preparo.',
 mediumAndTropicalBalance:'Calibração provisória deste projeto; valores históricos completos não localizados.',masteryServings:'80 serviços por sabor: calibração de projeto, orientada pela referência visual de progresso 56/80; não representa todos os níveis históricos.'},
 recipes:flavors.map(([id,name,group,index,energyCost,portions,gold,xp,popularityTenths,masteryReward])=>{fs.copyFileSync(path.join(source,index+'.png'),path.join(folder,id+'.png'));return {id,name,group,file:id+'.png',energyCost,portions,gold,xp,popularityTenths,masteryReward,balanceSource:group==='basic'?'historical-2010':'project-provisional',artSource:`4432119/003.png, recorte ${index}.png; correspondência visual das frutas.`};})};
fs.writeFileSync(path.join(folder,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
const shared=path.join(root,'shared/juicecatalog');fs.mkdirSync(shared,{recursive:true});fs.writeFileSync(path.join(shared,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
const image=readPng(path.join(source,'05.png')),F=AssetFitGeometry;
const detected=F.detect(F.alphaChannel(image.data,image.width,image.height),image.width,image.height);
const fit=F.solve({points:{base:detected.base,top:null},plane:'base',mode:'angle'});
const result=F.render(image.data,image.width,image.height,fit.transform),box=F.alphaBox(result.data,result.width,result.height),data=new Uint8ClampedArray(box.width*box.height*4);
for(let y=0;y<box.height;y++)data.set(result.data.subarray(((y+box.top)*result.width+box.left)*4,((y+box.top)*result.width+box.left+box.width)*4),y*box.width*4);
const itemFolder=path.join(root,'game/public/assets/items/juice_machine');fs.mkdirSync(itemFolder,{recursive:true});writePng(path.join(itemFolder,'rotation-0.png'),{width:box.width,height:box.height,data});
fs.writeFileSync(path.join(itemFolder,'item.json'),JSON.stringify({id:9100001,classname:'juice_machine',name:'Máquina de Sucos',type:3,kind:'juice_machine',priceGold:500,purchasable:true,sizeX:1,sizeY:1,itemHeight:Math.max(0,-result.top-box.top),parts:[{file:'rotation-0.png',width:box.width,height:box.height,left:result.left+box.left,top:result.top+box.top}],source:{art:'4432119/003.png, recorte 05.png fornecido pelo responsável.',calibration:{base:detected.base,transform:fit.transform},priceGold:'Preço de colocação definido pelo projeto; destravamento original de 20 caféGranas implementado separadamente.'}},null,2)+'\n');
console.info('Máquina de sucos e 12 bebidas importadas com alpha original; catálogo de regras sincronizado.');
