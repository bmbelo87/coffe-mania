import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const source = await build({ stdin: { contents: `export { createSceneBackgroundView, sceneBackgroundOffset } from './game/src/screens/room/iso-art'; export {tileToScreen} from './game/src/world/iso'; export {wallGeometry, WALL_THICKNESS} from './game/src/world/wallGeometry'; export { Texture, TextureSource, Point, Matrix } from 'pixi.js';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false });
const M = await import('data:text/javascript;base64,' + Buffer.from(source.outputFiles[0].text).toString('base64'));
const texture = () => new M.Texture({ source: new M.TextureSource({ width: 160, height: 80 }) });

test('Legacy background keeps native bounds and camera-relative registration', () => {
  const view = M.createSceneBackgroundView({ left: -3200, top: -1630 }, texture());
  const bounds = view.getBounds();
  assert.deepEqual([bounds.x, bounds.y, bounds.width, bounds.height], [-3200, -1630, 160, 80]);
  assert.equal(view.eventMode, 'none');
  view.destroy({ children: true });
});

test('Adjacent modular strips meet in world coordinates under the same isometric basis', () => {
  const a = M.createSceneBackgroundView({ left: -1024, top: 12, width: 1024, height: 64, matrix: [1, -.5, 0, 1], repeat: { x: 4, y: 1 } }, texture());
  const b = M.createSceneBackgroundView({ left: 0, top: -500, width: 1024, height: 64, matrix: [1, -.5, 0, 1], repeat: { x: 4, y: 1 } }, texture());
  const end = a.toGlobal(new M.Point(1024, 32));
  const start = b.toGlobal(new M.Point(0, 32));
  assert.deepEqual([end.x, end.y], [start.x, start.y]);
  assert.deepEqual([a.children[0].tileScale.x, a.children[0].tileScale.y], [4, 1]);
  a.destroy({ children: true }); b.destroy({ children: true });
});

test('Terrain clipping stays local to its part instead of clipping neighboring scenery', () => {
  const view = M.createSceneBackgroundView({ left: 90, top: 60, width: 100, height: 100, matrix: [1, .5, 0, 1], clip: [0, 0, 100, 0, 100, 100] }, texture());
  assert.equal(view.children[0].mask, view.children[1]);
  assert.equal(view.children[1].parent, view);
  const origin = view.toGlobal(new M.Point(0, 0));
  assert.deepEqual([origin.x, origin.y], [90, 60]);
  view.destroy({ children: true });
});

test('Published urban scene resolves every raster part and keeps camera coverage finite', async () => {
  const folder = path.resolve('game/public/assets/indoor');
  const scene = JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json', 'utf8'));
  assert.equal(new Set(scene.tiles.map(part => part.file)).size, 25);
  assert.equal(scene.horizontalCover.left, -4028);
  assert.equal(scene.horizontalCover.right, 4000);
  for (const part of scene.tiles) {
    assert.ok([part.left, part.top, part.width, part.height].every(Number.isFinite), part.id);
    assert.ok(part.width > 0 && part.height > 0, part.id);
    const png = await fs.readFile(path.resolve(folder, part.file));
    assert.equal(png.subarray(1,4).toString(), 'PNG', part.id);
    if (part.matrix) assert.ok(Math.abs(part.matrix[0]*part.matrix[3]-part.matrix[1]*part.matrix[2]) > 0, part.id);
    if (part.clip) assert.ok(part.clip.length >= 6 && part.clip.length % 2 === 0 && part.clip.every(Number.isFinite), part.id);
  }
});

test('Crossing markings lie on the road plane and span its width', async () => {
  const scene = JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json', 'utf8'));
  const crossing = scene.tiles.find(part => part.id === 'crossing');
  const png = await fs.readFile(path.resolve('game/public/assets/indoor',crossing.file));
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[crossing.width*2,crossing.height*2]);
  const [a,b,c,d] = crossing.matrix;
  // The long axis of each bar follows the road; the row spans across it.
  assert.equal(d - .5*c, 0);
  assert.equal(b + .5*a, 0);
  const corners = [[0,0],[crossing.width,0],[0,crossing.height],[crossing.width,crossing.height]];
  const depths = corners.map(([x,y]) => crossing.top + b*x + d*y - .5*(crossing.left + a*x + c*y));
  const road=scene.tiles.find(part=>part.id==='city-road');
  const far=road.top-.5*road.left;
  assert.ok(Math.min(...depths) > far && Math.max(...depths) < far+road.height);
  assert.ok(Math.max(...depths)-Math.min(...depths)>240);
});

test('Walkway stones keep their proportions independently of both diagonal silhouettes', async () => {
  const scene = JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json', 'utf8'));
  for (const part of scene.tiles.filter(p=>p.id.endsWith('walkway'))) {
    const view = M.createSceneBackgroundView(part,texture());
    const uv = view.children[0].tileTransform.matrix;
    const world = new M.Matrix(...part.matrix).append(uv);
    assert.ok(Math.abs(world.b)<1e-9 && Math.abs(world.c)<1e-9,part.id);
    assert.ok(Math.abs(world.a-world.d)<1e-9,part.id);
    view.destroy({children:true});
  }
});

test('Both sidewalks meet the outer wall footprint without moving room tiles', async () => {
  const scene = JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json', 'utf8'));
  const offset = M.sceneBackgroundOffset(scene);
  assert.deepEqual(offset,{x:0,y:-M.WALL_THICKNESS});
  assert.deepEqual(M.sceneBackgroundOffset({}),{x:0,y:0},'legacy scenes keep their registration');
  for (const [id,rotation,tx,ty,slope] of [['coast-walkway',0,0,8,-.5],['cafe-walkway',1,8,0,.5]]) {
    const walk = scene.tiles.find(p=>p.id===id);
    const start = walk.top+offset.y-slope*(walk.left+offset.x);
    const origin = M.tileToScreen(tx,ty);
    const geometry=M.wallGeometry(rotation);
    const outerB=geometry.end[2];
    const innerA=geometry.face[3];
    const outerA={x:innerA.x-(rotation%2===0?1:-1)*M.WALL_THICKNESS,y:innerA.y-M.WALL_THICKNESS/2};
    for(const p of [outerA,outerB]) {
      const edge = origin.y+p.y-slope*(origin.x+p.x);
      assert.ok(edge>=start && edge<=start+walk.height,id);
      assert.ok(Math.abs(edge-start-walk.height)<1e-9,id);
    }
    const inner=geometry.face[2];
    assert.equal(origin.y+inner.y-slope*(origin.x+inner.x)-start-walk.height,M.WALL_THICKNESS);
  }
});

test('Tree ground shadows clear the sidewalks instead of using canopy bounds for placement', async () => {
  const scene = JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json', 'utf8'));
  for(const p of scene.tiles.filter(p=>p.id.startsWith('tree-'))) {
    const x=p.left+p.width*.5,y=p.top+p.height*.94;
    assert.ok(y+.5*x>70,p.id+' coast clearance');
    assert.ok(y-.5*x< -620,p.id+' road clearance');
  }
});

test('Existing exterior actor lanes stay inside both cafe sidewalks', async () => {
  const scene = JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json', 'utf8'));
  const coast = scene.tiles.find(part => part.id === 'coast-walkway');
  const city = scene.tiles.find(part => part.id === 'cafe-walkway');
  const offset=M.sceneBackgroundOffset(scene);
  const coastStart = coast.top + offset.y + .5*coast.left;
  const cityStart = city.top + offset.y - .5*city.left;
  for(let n=0;n<=40;n++) {
    const left = M.tileToScreen(-1,n), right = M.tileToScreen(n,-1);
    // Actors stand at the center of their tile, not its top vertex.
    const coastDepth = left.y + 40 + .5*left.x - coastStart;
    const cityDepth = right.y + 40 - .5*right.x - cityStart;
    assert.ok(coastDepth > 0 && coastDepth < coast.height);
    assert.ok(cityDepth > 0 && cityDepth < city.height);
  }
});

test('Grass edge has no riser, while sand and near street edges expose only block tops',async()=>{
  const scene=JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json','utf8'));
  assert.equal(scene.tiles.find(p=>p.id==='coast-curb'),undefined);
  const walk=scene.tiles.find(p=>p.id==='coast-walkway');
  const coast=scene.tiles.find(p=>p.id==='coast-curb-top');
  assert.equal(coast.top+.5*coast.left,walk.top+.5*walk.left,'border is on the sand side');
  for (const id of ['coast-curb-top','near-curb-top']) {
    const edge=scene.tiles.find(p=>p.id===id);
    assert.equal(edge.height,24,'do not compress the whole face into the top');
    assert.equal(Math.max(...edge.clip.filter((_,i)=>i%2===1)),5,'clip before the vertical shaded face');
    const [a,b,c,d]=edge.matrix;
    assert.equal(Math.abs(b/a),.5);
    assert.equal(Math.abs(d/c),.5);
    assert.equal(Math.sign(b/a),-Math.sign(d/c),'block tops use both ground axes, not a vertical riser');
  }
  assert.equal(scene.tiles.find(p=>p.id==='far-curb').height,24,'street-facing riser stays visible');
});

test('Street sidewalks have equal depth and meet the same road boundaries', async () => {
  const scene=JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json','utf8'));
  const near=scene.tiles.find(p=>p.id==='cafe-walkway'),far=scene.tiles.find(p=>p.id==='far-walkway');
  const road=scene.tiles.find(p=>p.id==='city-road');
  const edge=p=>p.top-.5*p.left;
  assert.equal(near.height,far.height);
  assert.equal(edge(far)+far.height,edge(road));
  assert.equal(edge(road)+road.height,edge(near));
});

test('Both ends of every lane dash follow the transverse ground axis',async()=>{
  const scene=JSON.parse(await fs.readFile('game/public/assets/scenery/coast-city/scene.json','utf8'));
  const paint=scene.tiles.find(p=>p.id==='road-markings');
  const [a,b,c,d]=paint.matrix;
  assert.equal(2*b-a,0,'dash length follows one floor axis');
  assert.equal(c+2*d,0,'both short ends follow the other floor axis');
  const png=await fs.readFile(path.resolve('game/public/assets/indoor',paint.file));
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[256,16]);
});
