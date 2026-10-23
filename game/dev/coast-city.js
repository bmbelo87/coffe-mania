import { Application, Container } from 'pixi.js';
import { loadFonts } from '../src/core/fonts';
import { loadGameAssets, loadIndoorArt, indoorTexture } from '../src/game/asset-manifest';
import { loadRoomItemArt, roomModelItems } from '../src/game/room-inventory';
import { RoomModel } from '../src/world/RoomModel';
import { RoomScreen } from '../src/screens/room/RoomScreen';
import { createSceneBackgroundView, sceneBackgroundOffset } from '../src/screens/room/iso-art';
import { emptyPlayerState } from '../src/game/player-state';

await loadFonts();
const app = new Application();
await app.init({width:1920,height:1080,background:'#80a514',antialias:true,preserveDrawingBuffer:true});
document.querySelector('main').append(app.canvas);
await loadGameAssets(progress=>document.querySelector('output').textContent=`Carregamento do jogo: ${Math.round(progress*100)}%`);
const art = await loadIndoorArt();
const legacy = {art, textureFor: indoorTexture};
const catalog = await Promise.all(['starter_stove','starter_counter','white_cloth_table','classic_chair','mafia_door','basic_window','default_tile_name'].map(name=>fetch(`/assets/items/${name}/item.json`).then(r=>r.json())));
const unit=(i,x,y,rotation=0)=>({unitId:`fixture-${i}-${x}-${y}`,itemId:catalog[i].id,tx:x,ty:y,rotation,placed:true});
const inventory=[...[1,2,3].map(x=>unit(0,x,9,3)),...[1,2,3].map(x=>unit(1,x,7,1)),unit(2,3,3),unit(2,5,5),unit(3,2,3),unit(3,4,5),unit(4,1,3),unit(5,0,6)];
let room;
const background = new Container();
const sceneOffset=sceneBackgroundOffset(art.sceneBackground);
for (const tile of art.sceneBackground.tiles) {
  const view=createSceneBackgroundView(tile,indoorTexture(tile.file));
  view.position.x+=sceneOffset.x;view.position.y+=sceneOffset.y;background.addChild(view);
}
background.scale.set(.55);background.position.set(960,540-170*.55);
app.stage.addChild(background);
async function cafe(expanded=false) {
  const previous=room;room=undefined;
  if(previous){app.stage.removeChild(previous.view);previous.destroy();}
  const snapshot={revision:1,tilesX:expanded?13:7,tilesY:expanded?17:10,inventory,catalog,playerState:emptyPlayerState()};
  const provider=await loadRoomItemArt(snapshot,legacy);
  room=new RoomScreen({roomSnapshot:snapshot,artProvider:provider,floorClassName:'default_tile_name',model:new RoomModel({tilesX:snapshot.tilesX,tilesY:snapshot.tilesY,items:roomModelItems(snapshot,provider.art)}),showHud:false,npcCount:0,outsideNpcs:false});
  app.stage.addChild(room.view);room.playerView.view.visible=false;room.update(0);background.visible=false;
  room.setStageScale(app.canvas.getBoundingClientRect().width/1920);
  document.querySelector('output').textContent=`${new Set(art.sceneBackground.tiles.map(part=>part.file)).size} PNGs / ${art.sceneBackground.tiles.length} camadas — café ${snapshot.tilesX}×${snapshot.tilesY}; carregador do jogo; não altera a conta.`;
}
document.querySelector('#cafe').onclick=()=>void cafe();
document.querySelector('#expanded').onclick=()=>void cafe(true);
document.querySelector('#background').onclick=()=>{if(room)room.view.visible=false;background.visible=true;};
function zoom(value) {
  if(background.visible){background.scale.set(value);background.position.set(960,540-170*value);}
  else if(room){room.camera.setBitterMode(true);room.camera.setZoom(value);room.applyCamera();}
}
document.querySelector('#minimum').onclick=()=>zoom(.55);
document.querySelector('#normal').onclick=()=>zoom(1);
document.querySelector('#maximum').onclick=()=>zoom(2.4);
document.querySelector('#coast').onclick=()=>{
  if(room)room.view.visible=false;background.visible=true;background.scale.set(1);background.position.set(1900,740);
};
document.querySelector('#crossing').onclick=()=>{
  if(room)room.view.visible=false;background.visible=true;background.scale.set(2);background.position.set(900,820);
};
function wallDetail(x,y) {
  if(!room)return;
  background.visible=false;room.view.visible=true;
  room.camera.setBitterMode(true);room.camera.setZoom(2.4);room.camera.centerOn({x,y});room.applyCamera();
}
document.querySelector('#wall-left').onclick=()=>wallDetail(-(room.model.tilesY-1)*80,(room.model.tilesY-1)*40+25);
document.querySelector('#wall-right').onclick=()=>wallDetail((room.model.tilesX-1)*80,(room.model.tilesX-1)*40+25);
document.querySelector('#threshold').onclick=()=>wallDetail(-160,210);
window.addEventListener('resize',()=>room?.setStageScale(app.canvas.getBoundingClientRect().width/1920));
app.ticker.add(t=>room?.update(t.deltaMS));
await cafe();
