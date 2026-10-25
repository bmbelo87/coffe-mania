import {chromium} from 'file:///C:/Users/Ulisses/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';import path from 'node:path';import fs from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--allow-file-access-from-files']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('.runtime/visual-polish/offline/index.html')).href);await page.waitForFunction(()=>window.polishPreview?.ready);await page.waitForTimeout(100);
 const bubbles=await page.evaluate(()=>window.polishPreview.bubbles.map(b=>{const i=b.icon,l=window.polishPreview.layout;return {width:i.width,height:i.height,left:i.x-i.width/2,right:i.x+i.width/2,top:i.y,bottom:i.y+i.height,topClickable:b.view.hitArea.contains(0,i.y+5),ovalTop:l.oval.y-l.oval.height/2,ovalBottom:l.oval.y+l.oval.height/2}}));
 for(const b of bubbles){assert.ok(b.left>=-84&&b.right<=84);assert.ok(b.bottom<=-50+.001);assert.equal(b.top,b.ovalTop-10);assert.equal(b.topClickable,true);}
 const anchors=await page.evaluate(()=>window.polishPreview.tableAnchors);assert.deepEqual(anchors,[{x:-3,y:-10.14},{x:-3,y:-10.14}]);
 const title=()=>page.evaluate(()=>window.polishPreview.supply.balloon.title.text);
 assert.match(await title(),/Premium.*00:00:05/);await page.screenshot({path:'.runtime/visual-polish/preview.png'});
 await page.evaluate(()=>window.polishPreview.advance(1000));assert.match(await title(),/00:00:04/);
 await page.evaluate(()=>window.polishPreview.canInteract(false));assert.equal(await page.evaluate(()=>window.polishPreview.supply.balloon.view.visible),false);
 await page.evaluate(()=>window.polishPreview.canInteract(true));assert.equal(await page.evaluate(()=>window.polishPreview.supply.balloon.view.visible),true);
 await page.evaluate(()=>window.polishPreview.advance(5000));assert.match(await title(),/Express.*00:00:09/);
 await page.evaluate(()=>window.polishPreview.advance(10000));assert.equal(await page.evaluate(()=>Boolean(window.polishPreview.supply.balloon)),false);assert.equal(await page.evaluate(()=>window.polishPreview.actions.length),0);assert.deepEqual(errors,[]);
 const report={offline:true,portsOpened:0,bubbles,persistentCountdown:true,serverClock:true,transitionAndModal:true,automaticPayments:0,tableMealAnchors:anchors,errors};fs.writeFileSync('.runtime/visual-polish/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
