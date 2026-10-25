import { Application, Container, Sprite, Text } from 'pixi.js';
import { loadRoomItemArt } from '../src/game/room-inventory';
import { surfacePatternFrame } from '../src/game/surface-pattern';
import { createProceduralWallView } from '../src/screens/room/ProceduralWallView';
import { rotateFloorSprite } from '../src/screens/room/iso-art';
import { tileToScreen } from '../src/world/iso';
const app=new Application();await app.init({width:1920,height:1290,background:'#e1e6d1',antialias:true,preserveDrawingBuffer:true});document.body.append(app.canvas);
const root=new URL('assets/items/',new URL(import.meta.env.BASE_URL,document.baseURI));
const index=await(await fetch(new URL('catalog.json',root))).json();
const catalog=await Promise.all(index.items.filter(i=>i.classname.startsWith('behance_')).map(i=>fetch(new URL(i.manifest,root)).then(r=>r.json())));
const art=await loadRoomItemArt({catalog,inventory:[],revision:0});
const keys=['egypt','classic','cards','oriental','balloons','confetti','june_festival','circus','circus_deluxe','night','blue_tiles','parquet'];
let rotation=0;const scenes=[],floorRecords=[];
for(const [i,key] of keys.entries()){
 const group=new Container();group.position.set((i%4)*480+240,Math.floor(i/4)*430+135);group.scale.set(.58);app.stage.addChild(group);
 const floor=art.art.get('behance_floor_'+key),wall=art.art.get('behance_wall_'+key);
 for(let tx=1;tx<=4;tx++)for(let ty=1;ty<=4;ty++){
  const frame=surfacePatternFrame(floor,tx,ty,rotation),sprite=new Sprite(art.textureFor(frame.file)),p=tileToScreen(tx,ty);
  sprite.position.set(p.x+frame.left,p.y+frame.top);rotateFloorSprite(sprite,frame,rotation);group.addChild(sprite);floorRecords.push({sprite,entry:floor,tx,ty});
 }
 for(let axis=0;axis<2;axis++)for(let n=1;n<=4;n++){
  const item={name:'wall',className:'room_wall',kind:'wall',tx:axis===0?0:n,ty:axis===0?n:0,rotation:axis,sizeX:1,sizeY:1,blocks:true};
  const frame=surfacePatternFrame(wall,n);
  group.addChild(createProceduralWallView(item,{frame,texture:art.textureFor(frame.file),sourceRotation:1},undefined,n===4));
 }
 const text=new Text({text:catalog.find(i=>i.classname==='behance_floor_'+key).name+' / '+catalog.find(i=>i.classname==='behance_wall_'+key).name,style:{fontFamily:'Arial',fontSize:19,fill:0x50351e,wordWrap:true,wordWrapWidth:450}});text.position.set((i%4)*480+15,Math.floor(i/4)*430+15);app.stage.addChild(text);scenes.push(group);
}
window.surfacePreview={ready:true,count:catalog.length,patterns:catalog.map(m=>({classname:m.classname,cells:art.art.get(m.classname).frames.length})),app,art,scenes,setRotation:r=>{
 rotation=r;for(const {sprite,entry,tx,ty} of floorRecords){const frame=surfacePatternFrame(entry,tx,ty,r),p=tileToScreen(tx,ty);sprite.texture=art.textureFor(frame.file);sprite.position.set(p.x+frame.left,p.y+frame.top);rotateFloorSprite(sprite,frame,r);}
}};
