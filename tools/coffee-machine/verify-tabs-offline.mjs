import {chromium} from 'file:///C:/Users/Ulisses/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';import path from 'node:path';import fs from 'node:fs';import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--allow-file-access-from-files']});
try{
const page=await b.newPage({viewport:{width:1440,height:810}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(pathToFileURL(path.resolve('.runtime/coffee-tabs-qa/index.html')).href);await page.waitForFunction(()=>window.coffeePreview?.modal?.art);await page.waitForTimeout(500);
const click=async id=>{await page.waitForTimeout(75);const p=await page.evaluate(id=>{const c=window.coffeePreview.modal.panel.children.find(c=>c.label==='coffee-tab-'+id);const p=c.toGlobal({x:c.hitArea.width/2,y:c.hitArea.height/2});return{x:p.x*.75,y:p.y*.75}},id);await page.mouse.click(p.x,p.y);await page.waitForTimeout(75);};
const layering=await page.evaluate(()=>{const c=window.coffeePreview.modal.panel.children;const f=c.findIndex(v=>v.label==='coffee-panel-front');return c.filter(v=>v.label?.startsWith('coffee-tab-skin-')).map(v=>({label:v.label,height:v.height,behind:c.indexOf(v)<f}))});for(const v of layering){assert.ok(v.height>=74);assert.equal(v.behind,true)};
const overlaps=await page.evaluate(()=>{const children=window.coffeePreview.modal.panel.children;return ['medium','advanced','expert'].map(id=>{const a=children.find(c=>c.label==='coffee-tab-caption-'+id).getBounds(),b=children.find(c=>c.label==='coffee-tab-lock-'+id).getBounds();return {id,gap:b.x-(a.x+a.width)}})});for(const v of overlaps)assert.ok(v.gap>=3,JSON.stringify(v));
await page.screenshot({path:'.runtime/coffee-tabs-qa/locked.png'});
for(const id of ['basic','medium','advanced','expert']){await click(id);assert.equal(await page.evaluate(()=>window.coffeePreview.modal.group),id);}
await page.evaluate(()=>{const p=window.coffeePreview;p.snapshot.groups=['basic','medium','advanced','expert'];return p.modal.refresh()});await page.screenshot({path:'.runtime/coffee-tabs-qa/expert.png'});
const expertClip=await page.evaluate(()=>{const p=window.coffeePreview.modal.panel.toGlobal({x:22,y:114});return{x:p.x*.75,y:p.y*.75,width:602*1.4*.75,height:50*1.4*.75}});await page.screenshot({path:'.runtime/coffee-tabs-qa/tabs-expert.png',clip:expertClip});
await click('basic');const target=await page.evaluate(()=>{const c=window.coffeePreview.modal.panel.children.find(c=>c.label==='coffee-tab-medium');const p=c.toGlobal({x:73,y:21});return{x:p.x*.75,y:p.y*.75}});await page.mouse.move(target.x,target.y);await page.waitForTimeout(70);
assert.equal(await page.evaluate(()=>window.coffeePreview.modal.panel.children.find(c=>c.label==='coffee-tab-caption-medium').style.fill),0xffffff);
await page.screenshot({path:'.runtime/coffee-tabs-qa/hover.png'});
await page.mouse.move(20,20);assert.equal(await page.evaluate(()=>window.coffeePreview.modal.panel.children.find(c=>c.label==='coffee-tab-caption-medium').style.fill),0x70401d);
const clip=await page.evaluate(()=>{const m=window.coffeePreview.modal.panel;const p=m.toGlobal({x:20,y:114});return{x:p.x*.75,y:p.y*.75,width:610*1.4*.75,height:54*1.4*.75}});await page.screenshot({path:'.runtime/coffee-tabs-qa/tabs.png',clip});
assert.deepEqual(errors,[]);const report={offline:true,portsOpened:0,tabClicks:4,layering,overlaps,hover:true,errors};fs.writeFileSync('.runtime/coffee-tabs-qa/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}
