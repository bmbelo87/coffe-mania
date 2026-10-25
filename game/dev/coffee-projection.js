import {Application,Assets,Container,Sprite,Text} from 'pixi.js';
import {loadRoomItemArt} from '../src/game/room-inventory';
import {createProceduralWallView} from '../src/screens/room/ProceduralWallView';
import {tileToScreen} from '../src/world/iso';
import {createArtView} from '../src/screens/room/iso-art';
import {RoomDepthSorter} from '../src/screens/room/RoomDepthSorter';
const app=new Application();await app.init({width:1920,height:1200,background:'#e1e6d1',antialias:true,preserveDrawingBuffer:true});document.body.append(app.canvas);
const root=new URL('assets/items/',new URL(import.meta.env.BASE_URL,document.baseURI));
const names=['default_tile_name','default_wallpaper_name','juice_machine'];
const catalog=await Promise.all(names.map(name=>fetch(new URL(name+'/item.json',root)).then(r=>r.json())));
const art=await loadRoomItemArt({catalog,inventory:[],revision:0});
const stages=(await(await fetch(new URL('coffee_machine/stages/catalog.json',root))).json()).stages;
const records=[];
for(let row=0;row<2;row++)for(let stage=1;stage<=3;stage++){
 const group=new Container();group.sortableChildren=true;group.position.set((stage-1)*640+320,row*600+200);group.scale.set(1.15);app.stage.addChild(group);
 const floor=art.art.get('default_tile_name').frames[0],wall=art.art.get('default_wallpaper_name');
 for(let x=1;x<=3;x++)for(let y=1;y<=3;y++){const s=new Sprite(art.textureFor(floor.file)),p=tileToScreen(x,y);s.zIndex=-1000002;s.position.set(p.x+floor.left,p.y+floor.top);group.addChild(s);}
 for(let axis=0;axis<2;axis++)for(let n=1;n<=3;n++){const item={name:'wall',className:'room_wall',kind:'wall',tx:axis===0?0:n,ty:axis===0?n:0,rotation:axis,sizeX:1,sizeY:1,blocks:true};group.addChild(createProceduralWallView(item,{frame:wall.frames[0],texture:art.textureFor(wall.frames[0].file),sourceRotation:wall.wallpaperRotation},undefined,n===3));}
 const frame=stages[stage-1].frame;
 const file=row===0?`stage-${stage}-room-source.png`:frame.file;
 const left=row===0?[-82,-72,-67][stage-1]:frame.left;
 const item={name:'coffee',kind:'coffee_machine',tx:1,ty:1,sizeX:1,sizeY:1,rotation:0,blocks:true};
 const s=createArtView(item,{...frame,left},await Assets.load(new URL('coffee_machine/stages/'+file,root).href));
 s.width=frame.width;s.height=frame.height;group.addChild(s);
 const juice=art.art.get('juice_machine').frames[0],j=createArtView({...item,name:'juice',kind:'juice_machine',tx:2},juice,art.textureFor(juice.file));group.addChild(j);
 new RoomDepthSorter().sync(group);
 const caption=new Text({text:(row===0?'Antes':'Ajustado')+' — estágio '+stage,style:{fontFamily:'Arial',fontSize:26,fill:0x50351e}});caption.position.set((stage-1)*640+25,row*600+20);app.stage.addChild(caption);
 records.push({stage,comparison:row===0?'before':'after',tile:{tx:1,ty:1},rotation:0,animationMs:0,frame:{...frame,left}});
}
window.coffeeProjectionPreview={ready:true,records};
