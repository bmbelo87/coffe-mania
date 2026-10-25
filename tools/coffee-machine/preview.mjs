import {chromium} from 'file:///C:/Users/Ulisses/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:810}}); const errors=[];
page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:5199/dev/coffee.html'); await page.waitForFunction(()=>window.coffeePreview?.modal?.art);await page.waitForTimeout(1200);
await page.screenshot({path:'.runtime/coffee-research/coffee-basic.png'});
console.log(JSON.stringify({errors,labels:await page.evaluate(()=>window.coffeePreview.modal.panel.children.map(c=>c.label||c.text).filter(Boolean))}));
await browser.close();
