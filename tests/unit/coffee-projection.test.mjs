import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readPng} from '../../scripts/png.mjs';
const dir='game/public/assets/items/coffee_machine/stages';
const reports=JSON.parse(fs.readFileSync('tools/coffee-machine/room-projection.json'));
test('support controls align at 2:1, canvases and cup pixels remain unchanged',()=>{
 for(const r of reports){
  const old=readPng(`${dir}/stage-${r.stage}-room-source.png`),now=readPng(`${dir}/${r.file}`);
  assert.deepEqual([old.width,old.height],[now.width,now.height]);
  const [l,f,right]=r.targetCorners;
  assert.ok(Math.abs((f.y-l.y)/(f.x-l.x)-.5)<1e-9);
  assert.ok(Math.abs((right.y-f.y)/(right.x-f.x)+.5)<1e-9);
  const cup=r.controls.protectedCup;
  for(let y=cup.y;y<cup.y+cup.height;y++)for(let x=cup.x;x<cup.x+cup.width;x++){
   const i=(y*old.width+x)*4;assert.deepEqual(now.data.subarray(i,i+4),old.data.subarray(i,i+4),`stage ${r.stage}, cup ${x},${y}`);
  }
 }
});
