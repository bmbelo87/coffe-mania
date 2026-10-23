import { Application, Assets, Container } from 'pixi.js';
import { createSceneBackgroundView } from '../src/screens/room/iso-art';
const art = await fetch('/assets/indoor/indoor-art.json').then(response => response.json());
const app = new Application();
await app.init({width:1440,height:900,background:'#a2c957',antialias:false,preserveDrawingBuffer:true});
document.querySelector('main').append(app.canvas);
const scene = new Container(); app.stage.addChild(scene);
for (const tile of art.sceneBackground.tiles) {
  const texture = await Assets.load('/assets/indoor/' + tile.file);
  texture.source.scaleMode = 'nearest';
  scene.addChild(createSceneBackgroundView(tile,texture));
}
function zoom(value) {
  scene.scale.set(value);scene.position.set(720-450*value,450+470*value);
}
document.querySelector('#minimum').onclick=()=>zoom(.55);
document.querySelector('#normal').onclick=()=>zoom(1);
document.querySelector('#maximum').onclick=()=>zoom(2.4);
zoom(.55);
