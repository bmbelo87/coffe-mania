import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
const source=await build({stdin:{contents:`export {groupItemParts} from './game/src/game/room-inventory';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',write:false,
 plugins:[{name:'unused-pixi',setup(b){b.onResolve({filter:/^pixi\.js$/},()=>({path:'pixi',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const Assets={},Rectangle=class{},Texture=class{};',loader:'js'}));}}]});
const {groupItemParts}=await import('data:text/javascript;base64,'+Buffer.from(source.outputFiles[0].text).toString('base64'));
test('Vistas espelhadas mantêm a caixa registrada e exigem montagem para compartilhar o alpha do desenho',()=>{
 const parts=[{file:'front.png',width:83,height:143,left:-42,top:-80,rotation:1},{file:'front.png',width:83,height:143,left:-41,top:-80,rotation:0,flipX:true}];
 const poses=groupItemParts(parts);assert.deepEqual(poses.map(p=>p.rotation),[0,1]);
 assert.deepEqual(poses[0].frame,{file:'',width:83,height:143,left:-41,top:-80});assert.equal(poses[0].parts[0].flipX,true);
 assert.equal(poses[1].frame,parts[0]);assert.throws(()=>groupItemParts([{...parts[0],flipX:'true'}]),/inválida/);
});
test('Dourada percorre SE, SW, NW, NE com duas imagens originais e completa o ciclo de R',()=>{
 const gold=JSON.parse(fs.readFileSync('game/public/assets/items/original_gold_armchair/item.json','utf8'));
 const poses=groupItemParts(gold.parts);
 assert.deepEqual(poses.map(p=>[p.rotation,p.parts[0].file,!!p.parts[0].flipX]),[[0,'front.png',true],[1,'front.png',false],[2,'back.png',true],[3,'back.png',false]]);
 assert.deepEqual(Array.from({length:5},(_,r)=>poses[r%4].rotation),[0,1,2,3,0]);
});
