import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const source=await build({stdin:{contents:`export {RoomDepthSorter,setActorRoomDepth,setItemRoomDepth,setSeatedActorRoomDepth} from './game/src/screens/room/RoomDepthSorter';export {actorDepth} from './game/src/world/iso';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',write:false});
const M=await import('data:text/javascript;base64,'+Buffer.from(source.outputFiles[0].text).toString('base64'));
const view=()=>({visible:true,renderable:true,alpha:1,destroyed:false,zIndex:0});
test('Ocupante sentado vem depois de sua cadeira, inclusive com âncora frontal e tile visual anterior',()=>{
 for(const rotation of [0,1,2,3])for(const anchor of ['center','front-edge']){
  const chair={kind:'chair',tx:3,ty:4,rotation,occlusionAnchor:anchor},actor={tileX:2,tileY:4,drawPriority:M.actorDepth(280)},cv=view(),av=view();
  M.setItemRoomDepth(cv,chair);M.setSeatedActorRoomDepth(av,actor,chair);new M.RoomDepthSorter().sync({children:[av,cv]});assert.ok(cv.zIndex<av.zIndex);
 }
});
test('Ao levantar, a profundidade volta ao tile lógico sem mudar a interpolação',()=>{
 const chair={kind:'chair',tx:3,ty:4,rotation:0},actor={tileX:2,tileY:4,drawPriority:M.actorDepth(280)},cv=view(),av=view(),sorter=new M.RoomDepthSorter();
 M.setItemRoomDepth(cv,chair);M.setSeatedActorRoomDepth(av,actor,chair);sorter.sync({children:[av,cv]});assert.ok(cv.zIndex<av.zIndex);
 M.setSeatedActorRoomDepth(av,actor);sorter.sync({children:[av,cv]});assert.ok(av.zIndex<cv.zIndex);assert.equal(actor.tileX,2);assert.equal(actor.tileY,4);
});
