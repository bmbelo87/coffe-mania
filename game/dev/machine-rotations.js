import {Application,Container,Graphics,Sprite,Text} from 'pixi.js';
import {loadCoffeeMachineArt} from '../src/game/coffees';
import {loadJuiceMachineArt} from '../src/game/juices';
import {machinePoseFor} from '../src/game/machine-poses';
import {applyMachineRoomPose} from '../src/screens/room/MachineRoomPose';
import {RoomScreen} from '../src/screens/room/RoomScreen';
import {RoomStoreController} from '../src/screens/room/RoomStoreController';
import {RoomModel} from '../src/world/RoomModel';
import {loadRoomItemArt} from '../src/game/room-inventory';
const app=new Application();await app.init({width:1600,height:3010,background:'#dce5d5',antialias:true,preserveDrawingBuffer:true});document.body.append(app.canvas);app.stop();
const [coffee,juice]=await Promise.all([loadCoffeeMachineArt(),loadJuiceMachineArt()]);
const states=[];let row=0;
for(const [kind,art] of [['coffee_machine',coffee],['juice_machine',juice]])for(const stage of art){
 for(let rotation=0;rotation<4;rotation++){
  const world=new Container();world.position.set(200+rotation*400,row*430+280);world.scale.set(1.2);app.stage.addChild(world);
  world.addChild(new Graphics().poly([0,0,80,40,0,80,-80,40]).fill({color:0x99ad8d,alpha:.4}).stroke({color:0x607b58,width:1}));
  const item={name:kind,kind,tx:0,ty:0,rotation,sizeX:1,sizeY:1},pose=machinePoseFor(stage,rotation),view=new Sprite();applyMachineRoomPose(view,item,pose,'fixture-machine');world.addChild(view);
  const text=new Text({text:`${kind==='coffee_machine'?'Café':'Suco'} / estágio ${stage.stage} / R${rotation}`,style:{fontFamily:'Arial',fontSize:22,fill:0x4d321b}});text.position.set(15+rotation*400,row*430+15);app.stage.addChild(text);
  states.push({kind,stage:stage.stage,rotation,texture:pose.frame.file,frame:pose.frame,tile:{tx:0,ty:0},animationMs:0});
 }
 row++;
}
// Exercise the room's real asynchronous stage updater independently from a game/database session.
const checks=[];
for(const [kind,stages,method,field] of [['coffee_machine',coffee,'updateCoffeeMachineViews','sharedCoffees'],['juice_machine',juice,'updateJuiceMachineViews','sharedJuices']]){
 const item={name:kind,kind,tx:2,ty:3,rotation:0,sizeX:1,sizeY:1,inventoryUnitId:'fixture-machine'},view=new Sprite(),views=[view];
 const room={destroyed:false,itemViews:new Map([[item,views]]),sharedCoffees:[],sharedJuices:[]};
 for(const stage of stages)for(let rotation=0;rotation<4;rotation++){
  room[field]=[{machineId:'fixture-machine',stage:stage.stage}];item.rotation=rotation;
  RoomScreen.prototype[method].call(room);await new Promise(resolve=>setTimeout(resolve,0));
  const expected=machinePoseFor(stage,rotation);
  if(view.texture!==expected.texture||view.label!==`${kind==='coffee_machine'?'coffee':'juice'}-machine-stage-${stage.stage}-rotation-${rotation}`)throw Error('Stage updater reset the facing.');
  checks.push({kind,stage:stage.stage,rotation,correct:true});
 }
 view.label='pending';RoomScreen.prototype[method].call(room);item.rotation=2;await new Promise(resolve=>setTimeout(resolve,0));
 if(view.texture!==machinePoseFor(stages.at(-1),2).texture)throw Error('Late load used stale facing.');
 view.label='detached';RoomScreen.prototype[method].call(room);room.itemViews.set(item,[]);await new Promise(resolve=>setTimeout(resolve,0));
 if(view.label!=='detached')throw Error('Late load mutated detached views.');
 view.destroy();
}
const root=new URL('assets/items/',new URL(import.meta.env.BASE_URL,document.baseURI));
const catalog=await Promise.all(['coffee_machine','juice_machine','pink_square_chair','acervo_chair_yellow_black'].map(n=>fetch(new URL(n+'/item.json',root)).then(r=>r.json())));
const provider=await loadRoomItemArt({catalog,inventory:[],revision:0});
const decoration=[];
for(const item of catalog){
 const world=new Container(),stages=item.kind==='coffee_machine'?coffee:item.kind==='juice_machine'?juice:undefined;
 const controller=new RoomStoreController({snapshot:{catalog,inventory:[],revision:0},client:{},model:new RoomModel({tilesX:7,tilesY:10,items:[],walls:false}),world,art:provider,apply(){},alpha(){},previewArt:(_,rotation)=>stages?machinePoseFor(stages.at(-1),rotation):undefined});
 controller.selection={item};controller.tile={tx:2,ty:3};controller.store={isOpen:true};world.addChild(controller.cursorView);controller.pointer={x:0,y:0};
 for(let i=0;i<4;i++){
  controller.key({key:'r'});const r=controller.rotation,frame=provider.art.get(item.classname).frames[r],expected=stages?machinePoseFor(stages.at(-1),r).texture:provider.textureFor(frame.file);
  if(controller.preview.children[0].texture!==expected)throw Error('Decoration ghost lost rotation or evolution.');
  controller.showCursorImage();if(controller.cursorImage.texture!==expected)throw Error('Cursor image lost rotation or evolution.');
  decoration.push({classname:item.classname,rotation:r,ghost:true,cursor:true});
 }
 world.destroy({children:true});
}
app.render();window.machineRotations={ready:true,app,states,checks,decoration};
