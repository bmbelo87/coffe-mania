import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['game/src/game/decoration.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {actorsAllowDecoration,detachedDecorationItem}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const item={id:1,classname:'chair',name:'Chair',type:3,kind:'chair',sizeX:1,sizeY:1};

test('NPC use and both ends of their step cannot block decoration; humans remain protected',()=>{
 for(const kind of ['npc','waiter','human']){
  const actor={id:'a',kind,tx:3,ty:3,chairId:'chair',tableId:'table',move:{from:{tx:2,ty:3},to:{tx:4,ty:3}}};
  for(const id of ['chair','table',undefined])for(const tx of [2,3,4])assert.equal(actorsAllowDecoration(item,{tx,ty:3},0,id,[actor]),kind!=='human');
 }
});
test('human occupancy is checked over the whole rotated footprint',()=>{
 const actor={id:'human',kind:'human',tx:5,ty:4};
 assert.equal(actorsAllowDecoration({...item,sizeX:1,sizeY:3},{tx:3,ty:4},1,undefined,[actor]),false);
 assert.equal(actorsAllowDecoration({...item,sizeX:1,sizeY:3},{tx:3,ty:4},0,undefined,[actor]),true);
});
test('a detached support retains its old position and rotation without following the moved unit',()=>{
 const unit={unitId:'chair',itemId:1,placed:true,tx:3,ty:5,rotation:1};
 const detached=detachedDecorationItem(unit,[{...item,sizeX:1,sizeY:2}]);
 unit.tx=10;unit.ty=10;unit.rotation=3;
 assert.deepEqual([detached.tx,detached.ty,detached.rotation,detached.sizeX,detached.sizeY],[3,5,1,2,1]);
 assert.equal(detached.className,'chair');assert.equal(detachedDecorationItem(undefined,[item]),undefined);
});

test('a fresh realtime snapshot restores detached support and a later update clears it',async()=>{
 const bundle=await build({entryPoints:['game/src/game/room-realtime.ts'],bundle:true,platform:'node',format:'esm',write:false});
 const {RoomRealtime}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const original={fetch:globalThis.fetch,window:globalThis.window,WebSocket:globalThis.WebSocket};
 class Socket {static OPEN=1;static last;readyState=1;constructor(){Socket.last=this;}send(){}close(){this.readyState=3;}}
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({ticket:'fixture-only'})});
 globalThis.window={location:{href:'http://fixture.invalid/'}};globalThis.WebSocket=Socket;
 const live=new RoomRealtime('room');
 try{
  await live.connect();const socket=Socket.last;
  const chair={unitId:'old-chair',itemId:1,placed:true,tx:3,ty:4,rotation:0};
  socket.onmessage({data:JSON.stringify({type:'welcome',epoch:'fixture',seq:1,serverNow:1000,selfId:'human',world:{},actors:[{id:'npc',kind:'npc',state:'eating',decorationExit:true,detachedChair:chair,detachedTable:{...chair,unitId:'table'},food:{id:'meal',recipeId:'nachos'}}]})});
  assert.equal(live.actors.get('npc').detachedChair.tx,3);
  socket.onmessage({data:JSON.stringify({type:'actors',epoch:'fixture',seq:2,serverNow:2000,actors:[{id:'npc',state:'leaving',decorationExit:true}]})});
  const actor=live.actors.get('npc');assert.equal(actor.kind,'npc');assert.equal(actor.detachedChair,undefined);assert.equal(actor.detachedTable,undefined);assert.equal(actor.food,undefined);
 }finally{live.destroy();Object.assign(globalThis,original);}
});
