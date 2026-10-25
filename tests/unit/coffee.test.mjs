import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './game/src/game/coffee-model';export * from './game/src/game/coffee-client';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {coffeeMastery,CoffeeClient}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('mastery uses cumulative goals without resetting total served',()=>{
 assert.deepEqual([0,19,20,49,50,99,100,120].map(n=>{const m=coffeeMastery(n,[20,50,100]);return [m.level,m.goal,m.dominated]}),[[1,20,false],[1,20,false],[2,50,false],[2,50,false],[3,100,false],[3,100,false],[3,100,true],[3,100,true]]);
});
test('ambiguous requests reuse their payment key; a later intent and a definitive rejection retire it',async()=>{
 const original=globalThis.fetch;const requests=[];let mode='network';
 globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));if(mode==='network')throw new Error('timeout');return new Response(JSON.stringify(mode==='ok'?{selected:{}}:{message:'recusado'}),{status:mode==='ok'?200:400});};
 try{
 const client=new CoffeeClient();await assert.rejects(client.act('recharge','machine'));await assert.rejects(client.act('recharge','machine'));assert.equal(requests[0].requestId,requests[1].requestId);
 mode='ok';await client.act('recharge','machine');assert.equal(requests[1].requestId,requests[2].requestId);
 await client.act('recharge','machine');assert.notEqual(requests[2].requestId,requests[3].requestId);
 mode='network';await assert.rejects(client.act('select','machine',{recipeId:'espresso'}));await assert.rejects(client.act('select','machine',{recipeId:'descafeinado'}));assert.notEqual(requests[4].requestId,requests[5].requestId);
 mode='reject';await assert.rejects(client.act('select','machine',{recipeId:'descafeinado'}));assert.equal(requests[5].requestId,requests[6].requestId);
 await assert.rejects(client.act('select','machine',{recipeId:'descafeinado'}));assert.notEqual(requests[6].requestId,requests[7].requestId);
 }finally{globalThis.fetch=original;}
});
test('a truncated success response retains the original operation key',async()=>{
 const original=globalThis.fetch,requests=[];let truncated=true;
 globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return new Response(truncated?'{':JSON.stringify({selected:{}}),{status:200});};
 try{const client=new CoffeeClient();await assert.rejects(client.act('recharge','machine'));truncated=false;await client.act('recharge','machine');assert.equal(requests[0].requestId,requests[1].requestId);}finally{globalThis.fetch=original;}
});
test('room sprite calibration preserves the aspect ratio of all three source machines',async()=>{
 const {readFile}=await import('node:fs/promises');const root='game/public/assets/items/coffee_machine/';
 const catalog=JSON.parse(await readFile(root+'stages/catalog.json','utf8'));
 for(const {stage,frame,source} of catalog.stages){const original=await readFile(root+`stages/stage-${stage}.png`);const w=original.readUInt32BE(16),h=original.readUInt32BE(20);assert.ok(Math.abs(frame.height-h*frame.width/w)<=.51);assert.equal(source.mode,'uniform');assert.ok(Math.abs(frame.top+source.contact.y*source.scale-80)<=.51);}
 const manifest=JSON.parse(await readFile(root+'item.json','utf8'));assert.deepEqual([manifest.sizeX,manifest.sizeY],[1,1]);
});
