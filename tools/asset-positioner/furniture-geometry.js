/* Geometria nativa: origem no vértice traseiro do tile, +u=(80,40), +v=(-80,40). */
'use strict';
(() => {
  const defaults = Object.freeze({ kind: 'table', surface: 1, topHeight: 49.2, thickness: 8,
    legInset: .12, legWidth: .08, seatWidth: .48, seatHeight: 32, backHeight: 97.4,
    wood: '#a66c3f', top: '#b67f4c', seat: '#f68bb5', pattern: true, rotation: 0 });
  const project = (u, v, z = 0) => ({ x: (u - v) * 80, y: (u + v) * 40 - z });
  const rotate = (u, v, rotation = 0) => {
    for (let i = 0; i < rotation; i++) [u, v] = [1 - v, u];
    return [u, v];
  };
  const validate = (input = {}) => {
    const p = { ...defaults, ...input };
    if (!['table', 'chair', 'counter', 'stove'].includes(p.kind) || !Number.isInteger(p.rotation) || p.rotation < 0 || p.rotation > 3) throw Error('Tipo ou rotação inválidos.');
    for (const key of ['surface', 'legInset', 'legWidth', 'seatWidth']) {
      if (!Number.isFinite(p[key]) || p[key] <= 0 || p[key] > 1) throw Error(`Medida inválida: ${key}.`);
    }
    for (const key of ['topHeight', 'thickness', 'seatHeight', 'backHeight']) {
      if (!Number.isFinite(p[key]) || p[key] <= 0 || p[key] > 512) throw Error(`Altura inválida: ${key}.`);
    }
    if (p.thickness >= Math.min(p.topHeight, p.seatHeight) || p.backHeight <= p.seatHeight + p.thickness ||
      p.legInset <= p.legWidth / 2 || 2 * p.legInset + p.legWidth >= p.surface || p.seatWidth < .2) throw Error('Espessura, recuo dos pés ou encosto incompatíveis.');
    for (const key of ['wood', 'top', 'seat']) if (!/^#[0-9a-f]{6}$/i.test(p[key])) throw Error('Use cores hexadecimais de seis dígitos.');
    return p;
  };
  function plane(width = 1, height = 0) {
    const a = (1 - width) / 2, b = 1 - a;
    return [[a, a], [b, a], [b, b], [a, b]].map(([u, v]) => project(u, v, height));
  }
  const shade = (color, factor) => '#' + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * factor).toString(16).padStart(2, '0')).join('');
  function model(input) {
    const p = validate(input), faces = [], solids = [];
    let serial = 0;
    const box = (u0, v0, u1, v1, z0, z1, color, role = 'body') => {
      const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => rotate(u, v, p.rotation));
      const minU = Math.min(...corners.map(c => c[0])), maxU = Math.max(...corners.map(c => c[0]));
      const minV = Math.min(...corners.map(c => c[1])), maxV = Math.max(...corners.map(c => c[1]));
      solids.push({role,minU,maxU,minV,maxV,z0,z1});
      const add = (vertices, fill) => faces.push({ points: vertices.map(c => project(...c)), fill,
        depth: vertices.reduce((s, [u, v, z]) => s + (u + v) * 40 + z * .5, 0) / vertices.length, serial: serial++ });
      add([[minU,maxV,z0],[maxU,maxV,z0],[maxU,maxV,z1],[minU,maxV,z1]], shade(color, .88));
      add([[maxU,minV,z0],[maxU,maxV,z0],[maxU,maxV,z1],[maxU,minV,z1]], shade(color, .72));
      add([[minU,minV,z1],[maxU,minV,z1],[maxU,maxV,z1],[minU,maxV,z1]], color);
    };
    const width = p.kind !== 'chair' ? p.surface : p.seatWidth;
    const a = (1 - width) / 2, b = 1 - a, height = p.kind !== 'chair' ? p.topHeight : p.seatHeight;
    const inset = p.kind !== 'chair' ? p.legInset : .04;
    const half = (p.kind !== 'chair' ? p.legWidth : .045) / 2;
    for (const u of [a + inset, b - inset]) for (const v of [a + inset, b - inset]) box(u-half,v-half,u+half,v+half,0,height-p.thickness,p.wood);
    box(a,a,b,b,height-p.thickness,height,p.kind !== 'chair' ? p.top : p.seat);
    if (p.kind === 'chair') {
      for (const v of [a+.03,b-.03]) box(a,v-.02,a+.055,v+.02,height-p.thickness,p.backHeight,p.wood,'back-post');
      // A placa termina na face interna dos postes; volumes sobrepostos fazem a madeira cortar o painel.
      box(a,a+.05,a+.055,b-.05,p.seatHeight+18,p.backHeight,p.seat,'back-panel');
    }
    faces.sort((l, r) => l.depth - r.depth || l.serial - r.serial);
    const guide = { floor: plane(), surface: plane(width, height), support: plane(width - inset * 2),
      center: project(.5,.5,height), height, backHeight: p.kind === 'chair' ? p.backHeight : height };
    const points = faces.flatMap(f => f.points);
    const left = Math.floor(Math.min(...points.map(c => c.x))) - 2, top = Math.floor(Math.min(...points.map(c => c.y))) - 2;
    const frame = { left, top, width: Math.ceil(Math.max(...points.map(c => c.x))) + 2 - left,
      height: Math.ceil(Math.max(...points.map(c => c.y))) + 2 - top };
    return { params: p, faces, solids, guide, frame };
  }
  function draw(ctx, input) {
    const m = model(input);
    ctx.lineJoin = 'round'; ctx.lineWidth = .65;
    for (const f of m.faces) {
      ctx.beginPath(); f.points.forEach((p, i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath();
      ctx.fillStyle = f.fill; ctx.fill(); ctx.strokeStyle = shade(f.fill,.78); ctx.stroke();
    }
    if (m.params.kind === 'table' && m.params.pattern) {
      for (const width of [m.params.surface*.78,m.params.surface*.63]) {
        const points = plane(width,m.params.topHeight);
        ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath();
        ctx.strokeStyle = shade(m.params.top,.77); ctx.lineWidth = 3; ctx.stroke();
      }
    }
    return m;
  }
  /** Marca três cantos do tampo/assento e um pé frontal; as verticais continuam verticais. */
  function calibrate({ left, back, right, foot }, { width = 1, height = defaults.topHeight, support = .76 } = {}) {
    if (![left,back,right,foot].every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)) ||
      !(left.x < back.x && back.x < right.x) || !(width > 0 && width <= 1) || !(height > 0 && height <= 512) || !(support > 0 && support <= width)) throw Error('Marque cantos e apoio válidos.');
    const [B,R,,L] = plane(width,height), floorFront = plane(support)[2];
    const aL = (B.x-L.x)/(back.x-left.x), aR = (R.x-B.x)/(right.x-back.x);
    const mL = (back.y-left.y)/(back.x-left.x), mR = (right.y-back.y)/(right.x-back.x);
    const dx = foot.x-back.x, a = dx <= 0 ? aL : aR, slope = dx <= 0 ? -.5 : .5, sourceSlope = dx <= 0 ? mL : mR;
    const denominator = foot.y-back.y-sourceSlope*dx;
    const c = (floorFront.y-B.y-slope*a*dx)/denominator;
    if (!(c > 0 && c < 20)) throw Error('O apoio precisa estar abaixo do plano marcado.');
    const bL = -.5*aL-c*mL, bR = .5*aR-c*mR;
    return { k: back.x, aL, aR, bL, bR, c, x: B.x-aL*back.x, y: B.y-c*back.y-bL*back.x };
  }
  /** Tampo e apoios têm planos separados; variar altura não pode alterar o ângulo do pé. */
  function calibratePlanes(points, { width = 1, height = defaults.topHeight, support = .76 } = {}) {
    const F = globalThis.AssetFitGeometry;
    const { left:L, back:B, right:R, groundLeft:GL, foot:GF, groundRight:GR } = points;
    if (![L,B,R,GL,GF,GR].every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)) ||
      !(L.x < B.x && B.x < R.x && GL.x < GF.x && GF.x < GR.x) || !(width>0 && width<=1) || !(support>0 && support<=1) || !(height>0 && height<=512)) throw Error('Marque os três cantos do tampo e os três apoios no chão.');
    const [TB,TR,,TL] = plane(width,height), aL=(TB.x-TL.x)/(B.x-L.x), aR=(TR.x-TB.x)/(R.x-B.x), c=(aL+aR)/2;
    const bL=-.5*aL-c*(B.y-L.y)/(B.x-L.x), bR=.5*aR-c*(R.y-B.y)/(R.x-B.x);
    const topTransform={k:B.x,aL,aR,bL,bR,c,x:TB.x-aL*B.x,y:TB.y-c*B.y-bL*B.x};
    const front={x:L.x+R.x-B.x,y:L.y+R.y-B.y};
    const vLine=(l,f,r,x)=> x<=f.x ? f.y+(x-f.x)*(f.y-l.y)/(f.x-l.x) : f.y+(x-f.x)*(r.y-f.y)/(r.x-f.x);
    const footX=F.map(topTransform,GF).x;
    const footY=40+40*support-Math.abs(footX)/2;
    const section=x=>{
      const sourceY=vLine(L,front,R,x), mapped=F.map(topTransform,{x,y:sourceY});
      const sourceGround=vLine(GL,GF,GR,x), targetGround=footY-Math.abs(mapped.x-footX)/2;
      const scale=(targetGround-mapped.y)/(sourceGround-sourceY);
      if(!(scale>0 && Number.isFinite(scale)))throw Error('Os apoios precisam ficar abaixo do tampo em toda a imagem.');
      return {sourceY,targetY:mapped.y,scale};
    };
    const map=p=>{
      const s=section(p.x), q=F.map(topTransform,p);
      if(p.y>s.sourceY)q.y=s.targetY+(p.y-s.sourceY)*s.scale;
      return q;
    };
    const inverse=p=>{
      const q=F.inverse(topTransform,p),s=section(q.x);
      if(p.y>s.targetY)q.y=s.sourceY+(p.y-s.targetY)/s.scale;
      return q;
    };
    const bounds=(imageWidth,imageHeight)=>{
      const edge=[];
      for(let x=0;x<=imageWidth;x+=.5) {edge.push(map({x,y:0}),map({x,y:imageHeight}));}
      return {minX:Math.min(...edge.map(p=>p.x)),maxX:Math.max(...edge.map(p=>p.x)),minY:Math.min(...edge.map(p=>p.y)),maxY:Math.max(...edge.map(p=>p.y))};
    };
    return {map,inverse,bounds,topTransform,foot:{x:footX,y:footY}};
  }
  globalThis.CafeFurnitureGeometry = Object.freeze({ defaults, project, rotate, plane, validate, model, draw, calibrate, calibratePlanes });
})();
