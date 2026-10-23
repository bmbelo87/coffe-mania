import { Application, Assets } from 'pixi.js';
import { DoorView } from '../src/screens/room/DoorView';

const app=new Application();
await app.init({width:900,height:420,background:'#e8e3d1',antialias:true,preserveDrawingBuffer:true});
document.querySelector('main').append(app.canvas);
const item=await fetch('/assets/items/mafia_door/item.json').then(r=>r.json());
const frame=item.parts[0];
const texture=await Assets.load(`/assets/items/mafia_door/${frame.file}`);
for (const [index,closed] of [false,true].entries()) {
  const door=new DoorView({name:item.name,kind:'door',tx:1,ty:3,rotation:0},frame,texture,item.door);
  door.update(300,[{tileX:1,tileY:3}]);
  door.update(0,[{tileX:1,tileY:3}],closed);
  door.view.position.set(240+index*420,240);
  app.stage.addChild(door.view);
}
document.querySelector('output').textContent='Arte e malha do jogo: abertura normal 100%; decoração 0%. Sem conexão com contas ou banco.';
