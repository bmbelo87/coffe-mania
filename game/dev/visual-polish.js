import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { ThoughtBubble, THOUGHT_BUBBLE_LAYOUT } from '../src/screens/room/ThoughtBubble';
import { loadThoughtBubbleArt } from '../src/game/thought-bubble';
import { SupplyPlatform } from '../src/screens/room/SupplyPlatform';
import { loadSupplyArt } from '../src/game/supplies';
import { loadRoomItemArt } from '../src/game/room-inventory';
import { emptyPlayerState } from '../src/game/player-state';
const app=new Application();await app.init({width:1920,height:1200,background:'#dce6c5',antialias:true,preserveDrawingBuffer:true});document.body.append(app.canvas);
const root=new URL(import.meta.env.BASE_URL,document.baseURI);const tex=path=>Assets.load(new URL('assets/'+path,root).href);
const caption=(text,x,y)=>{const t=new Text({text,style:{fontFamily:'Arial',fontSize:24,fill:0x50351e}});t.position.set(x,y);app.stage.addChild(t)};
const art=await loadThoughtBubbleArt(),bubbles=[];
for(const [i,[name,path]]of [['Café','coffees/espresso.png'],['Suco','juices/orange.png'],['Copo alto','coffees/mocaccino.png'],['Prato futuro','foods/nachos/stage_2.png']].entries()){
 const b=new ThoughtBubble(art,()=>{});b.setIcon(await tex(path));b.view.position.set(180+i*320,340);b.view.scale.set(1.5);app.stage.addChild(b.view);caption(name,100+i*320,355);bubbles.push(b);
}
let now=1700000000000,interact=true;const actions=[];const snapshot={serverNow:now,slots:4,kinds:[{id:'express',name:'Express',quantity:4,seconds:600,gold:3000,level:1,rushGranas:1},{id:'premium',name:'Premium',quantity:40,seconds:43200,gold:75000,level:4,rushGranas:3}],orders:[{id:'first',slot:0,kind:'express',quantity:4,arrivesAt:now+15000,spoilsAt:now+86415000},{id:'second',slot:1,kind:'premium',quantity:40,arrivesAt:now+5000,spoilsAt:now+86405000}],playerState:emptyPlayerState(),collectEnergy:1,saveGranas:1};
const client={serverNowMs:()=>now,refresh:async()=>snapshot,act:async(...args)=>{actions.push(args);return snapshot}};
const supply=new SupplyPlatform({client,art:await loadSupplyArt(),balloon:await tex('ui/spices/spoiled-callout.png'),canInteract:()=>interact,confirm:async()=>false,onSnapshot:()=>{},onError:error=>console.error(error)});
const world=new Container();world.position.set(1530,395);world.scale.set(.75);world.sortableChildren=true;app.stage.addChild(world);supply.place(world,{tx:0,ty:0});supply.apply(snapshot);
for(let i=1;i<=3;i++){const s=new Sprite(await tex(`items/coffee_machine/stages/room-stage-${i}.png`));s.anchor.set(.5,1);s.position.set(170+(i-1)*280,800);s.scale.set(1.25);app.stage.addChild(s)}caption('Cafeteiras: arte posicionada sem contorno grosso',40,835);
for(const [i,name] of ['bather-flat','ice-cream-vendor-flat'].entries()){const s=new Sprite(await tex('scenery/beach-extras/'+name+'.png'));s.anchor.set(.5,1);s.scale.set(i===0?.64:.55);s.position.set(1050+i*360,810);app.stage.addChild(s)}caption('Figurantes da praia',990,835);
const tableManifests=[];
for(const [i,name]of ['green','red'].entries()){
 const folder=`items/acervo_lote02_table_italy_${name}_check/`;const m=await(await fetch(new URL('assets/'+folder+'item.json',root))).json();tableManifests.push(m);const p=m.parts[0];const group=new Container();group.position.set(1530+i*230,860);group.scale.set(1.3);group.addChild(new Graphics().poly([0,0,80,40,0,80,-80,40]).fill({color:0xc1c1a5,alpha:.8}).stroke({color:0x3184bc,width:1}));const s=new Sprite(await tex(folder+p.file));s.position.set(p.left,p.top);group.addChild(s);app.stage.addChild(group);
}caption('Mesas: -14%, deslocamento (-3, -8)',1440,1040);
app.ticker.add(()=>supply.update());window.polishPreview={app,bubbles,supply,actions,layout:THOUGHT_BUBBLE_LAYOUT,advance:ms=>{now+=ms;supply.update()},canInteract:value=>{interact=value;supply.update()}};

for (const [i,color] of ['green','red'].entries()) {
 const folder=`items/acervo_lote02_chair_italy_${color}/`;
 const m=await(await fetch(new URL('assets/'+folder+'item.json',root))).json();
 for (let r=0;r<4;r++) {
  const p=m.parts.find(p=>p.rotation===r),s=new Sprite(await tex(folder+p.file));s.position.set(100+i*650+r*135+p.left,1100+p.top);
  if(p.flipX){s.scale.x=-1;s.x+=p.width;}
  app.stage.addChild(s);
 }
}
caption('Cadeiras verde/vermelha: -7%, quatro direções',40,1170);

const tableArt=await loadRoomItemArt({catalog:tableManifests,inventory:[],revision:0});
window.polishPreview.tableAnchors=tableManifests.map(m=>tableArt.art.get(m.classname).mealAnchor);
window.polishPreview.ready=true;
