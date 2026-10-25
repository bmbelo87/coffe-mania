import {Application,Container,Graphics,Text} from 'pixi.js';
import {loadRoomItemArt} from '../src/game/room-inventory';
import {rotatedArt} from '../src/game/indoor-art';
import {loadAvatarAssets} from '../src/game/asset-manifest';
import {bakeAvatars} from '../src/avatar/bake';
import {CLIP} from '../src/avatar/clips';
import {Actor} from '../src/world/Actor';
import {AvatarActorView} from '../src/screens/room/AvatarActorView';
import {createArtView} from '../src/screens/room/iso-art';
import {createChairBackrest} from '../src/screens/room/ChairBackrest';
import {RoomDepthSorter,setSeatedActorRoomDepth} from '../src/screens/room/RoomDepthSorter';
import {seatingAnchorFor,SEATING_HIP_CLEARANCE} from '../src/game/seating-anchor';
const app=new Application();await app.init({width:1600,height:1440,background:'#dce5d5',antialias:true,preserveDrawingBuffer:true});document.body.append(app.canvas);app.stop();
const root=new URL('assets/items/',new URL(import.meta.env.BASE_URL,document.baseURI));
const names=['pink_square_chair','acervo_chair_yellow_black'];
const catalog=await Promise.all(names.map(n=>fetch(new URL(n+'/item.json',root)).then(r=>r.json())));
const provider=await loadRoomItemArt({catalog,inventory:[],revision:0});
const {wardrobe}=await loadAvatarAssets();const look=wardrobe.defaultLook();look.hairColour=0x4b260f;look.skinColour=0xefd69d;
const [bundle]=await bakeAvatars({looks:[look],clips:[CLIP.IDLE,CLIP.SIT,CLIP.EAT],cell:256,renderSize:512});
const states=[],scenes=[];
for(let kind=0;kind<2;kind++)for(let action=0;action<2;action++)for(let rotation=0;rotation<4;rotation++){
 const row=kind*2+action,world=new Container();world.sortableChildren=true;world.position.set(200+rotation*400,225+row*360);world.scale.set(1.4);app.stage.addChild(world);
 world.addChild(new Graphics().poly([0,0,80,40,0,80,-80,40]).fill({color:0x99ad8d,alpha:.4}).stroke({color:0x607b58,width:1}));world.children[0].zIndex=-1000002;
 const chair={name:catalog[kind].name,kind:'chair',className:names[kind],tx:0,ty:0,sizeX:1,sizeY:1,rotation,inventoryUnitId:'fixture-chair'};
 const entry=provider.art.get(names[kind]),pose=rotatedArt(entry,rotation),texture=provider.textureFor(pose.frame.file);
 const base=createArtView(chair,pose.frame,texture);world.addChild(base);
 const actor=new Actor('fixture-'+row+'-'+rotation);actor.setTilePosition(0,0);actor.direction=[1,7,5,3][rotation];
 const view=new AvatarActorView(actor,bundle.baked,bundle.texture);view.setActionClip(action?CLIP.EAT:CLIP.SIT,action?250:0);view.update(0);view.setSeatingAnchor(seatingAnchorFor(entry,rotation));world.addChild(view.view);setSeatedActorRoomDepth(view.view,actor,chair);
 const backrest=createChairBackrest(chair,entry,texture);if(backrest){backrest.visible=true;world.addChild(backrest);}
 const sorter=new RoomDepthSorter();sorter.sync(world);world.sortChildren();
 const text=new Text({text:`${catalog[kind].name} / R${rotation} / ${action?'comendo':'sentado'}`,style:{fontFamily:'Arial',fontSize:19,fill:0x4d321b}});text.position.set(15+rotation*400,row*360+10);app.stage.addChild(text);
 states.push({classname:names[kind],rotation,direction:actor.direction,tile:{tx:actor.tileX,ty:actor.tileY},position:{x:actor.x,y:actor.y},animationMs:action?250:0,clip:view.currentClip,frame:view.currentFrame,seat:entry.seatingAnchors?.find(value=>value.rotation===rotation),hip:view.getSeatingHip(),chair:base.zIndex,actor:view.view.zIndex,foreground:backrest?.zIndex??null});
 scenes.push({world,actor,view,chair,backrest,sorter,base});
}
async function setAuditLook(name){
 const reference={...look,itemIds:look.itemIds.filter(id=>!['Shirt','Pants','Skirt','Hair','Hat'].includes(wardrobe.byId(id)?.group)).concat([1020019,1000001,1040002]),hairColour:0xc3b6a4};
 const [replacement]=await bakeAvatars({looks:[name==='reference'?reference:look],clips:[CLIP.IDLE,CLIP.SIT,CLIP.EAT],cell:256,renderSize:512});
 for(const s of scenes.filter(s=>s.chair.className==='acervo_chair_yellow_black'))s.view.setAppearance(replacement.baked,replacement.texture);
}
function refreshSeatedDepth(scene){setSeatedActorRoomDepth(scene.view.view,scene.actor,scene.chair);scene.sorter.sync(scene.world);scene.world.sortChildren();}
app.render();window.furnitureRotations={ready:true,app,states,scenes,clearance:SEATING_HIP_CLEARANCE,setAuditLook,refreshSeatedDepth};
