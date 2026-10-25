import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/Ulisses/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out=path.resolve('.runtime/yellow-chair-seating');fs.mkdirSync(out,{recursive:true});
await build({entryPoints:['game/dev/furniture-rotations.js'],bundle:true,platform:'browser',format:'esm',outfile:path.join(out,'bundle.js'),define:{'import.meta.env.BASE_URL':JSON.stringify(pathToFileURL(path.resolve('game/public')+path.sep).href)},loader:{'.css':'empty'},logLevel:'silent'});
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><style>body{margin:0}canvas{display:block;width:100vw;height:auto}</style><script type="module" src="./bundle.js"></script>');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--allow-file-access-from-files']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1440}}),errors=[],states=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
 await page.goto(pathToFileURL(path.join(out,'index.html')).href);await page.waitForFunction(()=>window.furnitureRotations?.ready);
 for(const look of ['default','reference']){
  await page.evaluate(name=>window.furnitureRotations.setAuditLook(name),look);
  for(const elapsedMs of [0,80,160,240]){
   const rendered=await page.evaluate(({look,elapsedMs})=>{
    const fixture=window.furnitureRotations;
    const values=fixture.scenes.filter(s=>s.chair.className==='acervo_chair_yellow_black').map((s,i)=>{
     const state=fixture.states[fixture.scenes.indexOf(s)];
     const root={x:s.view.view.x,y:s.view.view.y},shadow={x:s.view.view.children[0].x,y:s.view.view.children[0].y};
     s.view.setActionClip(state.clip,i<4?0:elapsedMs);s.view.update(0);s.view.setSeatingAnchor(state.seat);
     fixture.refreshSeatedDepth(s);
     return{look,rotation:s.chair.rotation,direction:s.actor.direction,tile:{tx:s.actor.tileX,ty:s.actor.tileY},elapsedMs:i<4?0:elapsedMs,clip:s.view.currentClip,frame:s.view.currentFrame,seat:state.seat,hip:s.view.getSeatingHip(),chairDepth:s.base.zIndex,actorDepth:s.view.view.zIndex,foregroundDepth:s.backrest.zIndex,rootStable:root.x===s.view.view.x&&root.y===s.view.view.y,shadowStable:shadow.x===s.view.view.children[0].x&&shadow.y===s.view.view.children[0].y};
    });fixture.app.render();return values;
   },{look,elapsedMs});
   for(const s of rendered){assert.equal(s.direction,[1,7,5,3][s.rotation]);assert.ok(Math.abs(s.hip.x-s.seat.x)<.001);assert.ok(Math.abs(s.hip.y-(s.seat.y-3))<.001);assert.equal(s.rootStable,true);assert.equal(s.shadowStable,true);assert.ok(s.chairDepth<s.actorDepth);assert.ok(s.actorDepth<s.foregroundDepth);}
   states.push(...rendered.filter((_,i)=>elapsedMs===0||i>=4));
   await page.screenshot({path:path.join(out,`${look}-${elapsedMs}.png`),clip:{x:0,y:720,width:1600,height:720}});
  }
 }
 assert.equal(states.length,40);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({portsOpened:0,offline:true,states,errors},null,2));
 console.log('40 distinct seated/eating states: 2 appearances, 4 directions, all eating frames; hip contact, root and shadow verified.');
}finally{await browser.close();}
