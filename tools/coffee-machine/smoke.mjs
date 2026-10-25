import {chromium} from 'file:///C:/Users/Ulisses/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1440,height:810}});await page.goto('http://127.0.0.1:5199/dev/coffee.html');
const result=await page.evaluate(async()=>{
const api=async(path,body)=>{const r=await fetch('/api/coffe/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(path+':'+r.status+':'+JSON.stringify(data));return data};
const session=await api('session/login',{email:'test@local.mail',password:'123456'});
const ticket=await api('game-ticket',{roomId:session.playerId});
window.events=[];const ws=new WebSocket('ws://127.0.0.1:5199/game/ws');window.wire=ws;
await new Promise((resolve,reject)=>{ws.onopen=()=>ws.send(JSON.stringify({type:'join',ticket:ticket.ticket,version:'0.6.1'}));ws.onmessage=e=>{const v=JSON.parse(e.data);window.events.push(v);if(v.type==='welcome')resolve(v)};setTimeout(()=>reject(Error('welcome timed out')),15000);});
let room=await api('room');window.api=api;
let machine=room.inventory.find(i=>i.itemId===9100002);
if(!machine){
 const occupied=new Set();for(const unit of room.inventory.filter(i=>i.placed)){const c=room.catalog.find(c=>c.id===unit.itemId);if(c.type<3)continue;for(let x=0;x<c.sizeX;x++)for(let y=0;y<c.sizeY;y++)occupied.add((unit.tx+x)+','+(unit.ty+y));}
 let target;for(let x=2;x<6&&!target;x++)for(let y=2;y<7;y++)if(!occupied.has(x+','+y)){target={tx:x,ty:y};break;}
 room=await api('room/purchase',{revision:room.revision,requestId:crypto.randomUUID(),itemId:9100002,rotation:0,...target});machine=room.inventory.find(i=>i.itemId===9100002);
}
const selected=await api('coffees/select',{machineId:machine.unitId,recipeId:'descafeinado',requestId:crypto.randomUUID()});
const persisted=await api('coffees');
window.machine=machine;
return {session:{id:session.playerId},machine,selected:persisted.selected,groups:persisted.groups,energy:selected.playerState.energy,events:window.events.map(e=>e.type)};
});
fs.writeFileSync('.runtime/coffee-research/smoke-initial.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
// Public requests can be exercised with the staff tools only in this disposable database.
const prep=await page.evaluate(async()=>{const r=await window.api('dev/command',{command:'add_food',recipeId:'nachos',value:20,requestId:crypto.randomUUID()}).catch(e=>({error:e.message}));return r.error?{error:r.error}:{ok:true}});console.log('food',JSON.stringify(prep));
const request=await page.waitForFunction(()=>window.events.flatMap(e=>e.actors??[]).find(a=>a.coffeeRequestId&&a.state==='thirsty'),{},{timeout:150000}).then(h=>h.jsonValue()).catch(e=>({error:e.message}));
if(request.coffeeRequestId){const serve=await page.evaluate(async(actor)=>{const before=await window.api('coffees');const body={machineId:window.machine.unitId,actorId:actor.id,coffeeRequestId:actor.coffeeRequestId,requestId:crypto.randomUUID()};const after=await window.api('coffees/serve',body);const retry=await window.api('coffees/serve',body);return {before:{energy:before.playerState.energy.current,gold:before.playerState.gold},after:{energy:after.playerState.energy.current,gold:after.playerState.gold,mastery:after.mastery},retry:{energy:retry.playerState.energy.current,gold:retry.playerState.gold,mastery:retry.mastery}}},request);fs.writeFileSync('.runtime/coffee-research/smoke-serve.json',JSON.stringify(serve,null,2));console.log('serve',JSON.stringify(serve));}else console.log('request',JSON.stringify(request));
await page.evaluate(()=>window.api('cafe-name',{name:'Café de teste',initial:true}));await page.goto('http://127.0.0.1:5199/play');await page.waitForTimeout(12000);await page.screenshot({path:'.runtime/coffee-research/coffee-room.png'});
}finally{await browser.close();}
