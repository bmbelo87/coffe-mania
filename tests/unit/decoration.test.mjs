import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const source = await build({ stdin: { contents: `export { DoorView } from './game/src/screens/room/DoorView'; export { RoomStoreController } from './game/src/screens/room/RoomStoreController'; export { Container, Texture, TextureSource } from 'pixi.js'; export {RoomModel} from './game/src/world/RoomModel';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, loader:{'.css':'empty'} });
const M = await import('data:text/javascript;base64,' + Buffer.from(source.outputFiles[0].text).toString('base64'));

test('Decoration snaps an open door closed and keeps it closed while customers cross', () => {
  const texture = new M.Texture({source:new M.TextureSource({width:160,height:240})});
  const door = new M.DoorView({name:'Door',kind:'door',tx:1,ty:3,rotation:0}, {file:'door',left:0,top:-240,width:160,height:240}, texture);
  const actors = [{tileX:1,tileY:3}];
  door.update(300,actors);
  assert.equal(door.openness,1);
  door.update(0,actors,true);
  assert.equal(door.openness,0);
  const closed = [...door.front.geometry.getBuffer('aPosition').data];
  door.update(500,actors,true);
  assert.equal(door.openness,0);
  assert.deepEqual([...door.front.geometry.getBuffer('aPosition').data],closed);
  door.update(300,actors);
  assert.equal(door.openness,1);
  door.destroy();
});

function fixture(prepareSelection) {
  const item={id:3030010,kind:'table',type:3,name:'Mesa',classname:'table',sizeX:1,sizeY:1,priceGold:100};
  const unit={unitId:'table',itemId:item.id,placed:true,tx:3,ty:3,rotation:0};
  const snapshot={revision:1,catalog:[item],inventory:[unit]};
  let mutations=0,released=0;
  const world=new M.Container();
  const store={isOpen:true,setRegisterActive(){},setMessage(){},setEntries(){},setExpansionCards(){}};
  const controller = new M.RoomStoreController({snapshot,client:{async mutate(){mutations++;return snapshot;}},model:new M.RoomModel(),world,art:{art:new Map()},alpha(){},apply(){},prepareSelection,releaseSelection(){released++;}});
  controller.attach(store);
  return {controller,store,entry:{item,unit},mutations:()=>mutations,released:()=>released};
}

test('Table placement waits for the shared refund and cannot commit twice', async () => {
  let confirm;
  const f=fixture(()=>new Promise(resolve=>{confirm=resolve;}));
  f.controller.select(f.entry);
  const first=f.controller.commit(true),second=f.controller.commit(true);
  assert.equal(f.mutations(),0);
  confirm();
  await Promise.all([first,second]);
  assert.equal(f.mutations(),1);
  assert.equal(f.released(),1);
  f.controller.destroy();
});

test('Cancelling or closing before refund acknowledgement prevents placement',async()=>{
  for(const close of [false,true]) {
    let confirm;
    const f=fixture(()=>new Promise(resolve=>{confirm=resolve;}));
    f.controller.select(f.entry);
    const pending=f.controller.commit(true);
    if(close){f.store.isOpen=false;f.controller.onClose();}else f.controller.cancel();
    confirm();await pending;
    assert.equal(f.mutations(),0);
    assert.equal(f.released(),1);
    f.controller.destroy();
  }
});

test('A failed refund restores the selected table without a room mutation',async()=>{
  const f=fixture(()=>Promise.reject(new Error('Offline')));
  f.controller.select(f.entry);
  await f.controller.commit(true);
  assert.equal(f.mutations(),0);
  assert.equal(f.released(),1);
  f.controller.destroy();
});
