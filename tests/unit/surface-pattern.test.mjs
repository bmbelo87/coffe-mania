import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import {readPng} from '../../scripts/png.mjs';
const result=await build({entryPoints:['game/src/game/surface-pattern.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {surfacePatternFrame}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

test('surface phase stays anchored in the room, including negative coordinates and quarter turns',()=>{
 const entry={surfacePattern:{columns:2,rows:2},frames:[0,1,2,3]};
 for(let r=0;r<4;r++)for(let x=-4;x<5;x++)for(let y=-4;y<5;y++){
  // Sample the cell center and rotate in the continuous floor plane before taking the tile index.
  const u=x+.5,v=y+.5;
  const point=r===1?[v,-u]:r===2?[-u,-v]:r===3?[-v,u]:[u,v];
  const phase=n=>((Math.floor(n)%2)+2)%2;
  assert.equal(surfacePatternFrame(entry,x,y,r),phase(point[1])*2+phase(point[0]));
  assert.equal(surfacePatternFrame(entry,x+2,y+2,r),surfacePatternFrame(entry,x,y,r));
 }
 assert.equal(surfacePatternFrame({frames:['legacy']},99,-30,3),'legacy');
 const wall={surfacePattern:{columns:2,rows:1},frames:['a','b']};
 assert.deepEqual([-1,0,1,2,3].map(x=>surfacePatternFrame(wall,x)),['b','a','b','a','b']);
});

test('portfolio surfaces are one-tile cells, or a declared repeat of cells, with transparent projected corners',()=>{
 const root='game/public/assets/items',ids=new Set(),surfaces=[];
 for(const dir of fs.readdirSync(root)){
  if(!fs.existsSync(`${root}/${dir}/item.json`))continue;
  const m=JSON.parse(fs.readFileSync(`${root}/${dir}/item.json`));assert.equal(ids.has(m.id),false,`ID ${m.id}`);ids.add(m.id);
  if(!dir.startsWith('behance_'))continue;surfaces.push(m);
  const cells=m.surfacePattern?m.surfacePattern.columns*m.surfacePattern.rows:1;
  assert.equal(m.parts.length,cells,dir);
  if(m.surfacePattern)assert.deepEqual(m.parts.map(p=>p.rotation),[...Array(cells).keys()]);
  assert.deepEqual([m.sizeX,m.sizeY],[1,1]);
  assert.equal(m.source.provisionalRules.priceGold.value,m.priceGold);
  // A measured repeat far from the tile means misplaced source corners or room scale.
  const measured=m.source.measuredPeriod?Object.entries(m.source.measuredPeriod).filter(([k])=>k!=='correlation').map(([,v])=>v/(m.type===0?160:80)):m.source.measuredTile;
  for(const t of measured)assert.ok(Math.abs(t-1)<.04,`${dir} ${t}`);
  for(const part of m.parts){
   const im=readPng(`${root}/${dir}/${part.file}`);
   assert.deepEqual([im.width,im.height],[part.width,part.height]);
   const alpha=(x,y)=>im.data[(y*im.width+x)*4+3];
   assert.equal(alpha(0,im.height-1),0);assert.equal(alpha(im.width-1,0),0);
   assert.equal(alpha(Math.floor(im.width/2),Math.floor(im.height/2)),255);
  }
 }
 assert.ok(surfaces.filter(m=>m.type===0).length>=12);assert.ok(surfaces.filter(m=>m.type===1).length>=12);
});
