import {chromium} from 'file:///C:/Users/Ulisses/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5199/dev/coffee.html');await page.waitForFunction(()=>window.coffeePreview?.modal?.art);await page.waitForTimeout(500);
const click=async label=>{await page.waitForTimeout(100);const b=await page.evaluate(label=>{const m=window.coffeePreview.modal;const c=m.panel.children.find(c=>c.label===label);if(!c)throw Error('No '+label);const b=c.hitArea;const p=c.toGlobal({x:b.width/2,y:b.height/2});return {x:p.x,y:p.y}},label);await page.mouse.click(b.x*.75,b.y*.75);await page.waitForTimeout(100);};
const cases=[];
for(const group of ['basic','medium','advanced','expert']){await click('coffee-tab-'+group);const r=await page.evaluate(()=>({group:window.coffeePreview.modal.group,recipes:window.coffeePreview.modal.panel.children.filter(c=>c.label?.startsWith('coffee-select-')).length}));assert.equal(r.group,group);cases.push(r);}
await page.screenshot({path:'.runtime/coffee-research/coffee-expert-locked.png'});
await click('coffee-tab-basic');await click('coffee-select-descafeinado');await page.waitForFunction(()=>window.coffeePreview.actions.length===1);assert.equal(await page.evaluate(()=>window.coffeePreview.modal.state.selected.preview),'descafeinado');
// A GET begun before a mutation must not restore the previous selection when it resolves late.
await page.evaluate(()=>{const m=window.coffeePreview.modal;window.normalRefresh=m.client.refresh;m.client.refresh=()=>new Promise(resolve=>{window.resolveStale=()=>resolve({...structuredClone(window.coffeePreview.snapshot),selected:{preview:'espresso'}})});void m.refresh();});
await click('coffee-select-cafe_com_leite');await page.waitForFunction(()=>window.coffeePreview.actions.length===2);await page.evaluate(()=>window.resolveStale());await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.coffeePreview.modal.state.selected.preview),'cafe_com_leite');
await page.screenshot({path:'.runtime/coffee-research/coffee-basic-new.png'});
await page.evaluate(()=>{const m=window.coffeePreview.modal;m.client.refresh=window.normalRefresh;window.coffeePreview.snapshot.evolutionStage=3;window.coffeePreview.snapshot.groups=['basic','medium','advanced','expert'];});await page.evaluate(()=>window.coffeePreview.modal.refresh());
await click('coffee-tab-expert');await page.screenshot({path:'.runtime/coffee-research/coffee-expert.png'});
await page.evaluate(()=>{const s=window.coffeePreview.snapshot;for(const [id,count] of Object.entries({frappe:220,chai_com_especiarias:297,iced_coffee_com_menta:261,capuccino_com_laranja:338}))s.mastery[id]=count;return window.coffeePreview.modal.refresh()});await page.screenshot({path:'.runtime/coffee-research/coffee-expert-mastered.png'});
await page.evaluate(()=>{window.coffeePreview.snapshot.evolutionStage=2;return window.coffeePreview.modal.refresh()});await page.screenshot({path:'.runtime/coffee-research/coffee-red-fixed.png'});
await click('coffee-help');assert.equal(await page.evaluate(()=>window.coffeePreview.modal.help),true);await page.screenshot({path:'.runtime/coffee-research/coffee-help.png'});await click('coffee-back');await click('coffee-close');assert.equal(await page.evaluate(()=>window.coffeePreview.modal.isOpen),false);assert.deepEqual(errors,[]);
await page.evaluate(async()=>{const p=window.coffeePreview;p.snapshot.selected.preview='espresso';p.snapshot.mastery={espresso:172,descafeinado:268,cafe_com_leite:288,cafe_com_creme:338};await p.modal.open('preview')});await page.waitForTimeout(500);await page.screenshot({path:'.runtime/coffee-research/coffee-basic-mastered.png'});
const report={cases,selection:true,staleRefreshProtected:true,helpBackClose:true,errors};fs.writeFileSync('.runtime/coffee-research/ui-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
