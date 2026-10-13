/* Oficina offline. O canvas exportado nunca recebe fundo, guias ou referência de comparação. */
'use strict';
(() => {
  const $ = id => document.getElementById(id), G = globalThis.CafeFurnitureGeometry, F = globalThis.AssetFitGeometry;
  const numeric = ['surface','topHeight','thickness','legInset','legWidth','seatWidth','seatHeight','backHeight','rotation'];
  const fields = [...numeric,'kind','wood','top','seat','pattern'];
  let source = null, points = {}, output = null, reference = null, sequence = 0, sourceLayout = null;
  let loading=false;
  const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error',error); };
  const params = () => G.validate(Object.fromEntries(fields.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : numeric.includes(id) ? Number($(id).value) : $(id).value])));
  const setParams = p => { p = G.validate(p); for (const id of fields) if ($(id).type === 'checkbox') $(id).checked = p[id]; else $(id).value = p[id]; };
  function line(ctx, ps, color, closed = true) {
    ctx.beginPath(); ps.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); if (closed) ctx.closePath();
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  }
  function guides(ctx,p,sourceGuides = true) {
    const m = G.model(p); ctx.save(); ctx.setLineDash([3,3]); line(ctx,m.guide.floor,'#66c79b'); ctx.setLineDash([]);
    line(ctx,m.guide.surface,'#f2b461'); line(ctx,source && sourceGuides ? G.plane(Number($('support').value)) : m.guide.support,'#7bc2e7');
    for (let i = 0; i < 4; i++) line(ctx,[m.guide.floor[i],m.guide.surface[i]],'#666f7c',false);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  const canvasFor = frame => { const c = document.createElement('canvas'); c.width = frame.width; c.height = frame.height; return c; };
  function render(p = params(), template = false) {
    if(loading)throw Error('Abrindo PNG original…');
    if (template) {
      const m = G.model(p), frame = { ...m.frame, top: Math.min(-2,m.frame.top), left: Math.min(-82,m.frame.left) };
      frame.width = Math.max(82,m.frame.left+m.frame.width)-frame.left;
      frame.height = Math.max(82,m.frame.top+m.frame.height)-frame.top;
      const c = canvasFor(frame), ctx = c.getContext('2d'); ctx.translate(-frame.left,-frame.top); guides(ctx,p); return { canvas:c,frame };
    }
    if (!source) {
      const m = G.model(p), c = canvasFor(m.frame), ctx = c.getContext('2d'); ctx.translate(-m.frame.left,-m.frame.top); G.draw(ctx,p); return { canvas:c,frame:m.frame };
    }
    if(source.usage==='reference-only')throw Error('Ícone antigo · referência histórica. Use os ícones atuais na interface.');
    const options={width:p.kind === 'chair' ? p.seatWidth : p.surface,height:p.kind === 'chair' ? p.seatHeight : p.topHeight,support:Number($('support').value)};
    const mapping=!source.fixedTransform && points.groundLeft && points.groundRight ? G.calibratePlanes(points,options) : null;
    const transform=source.fixedTransform??mapping?.topTransform??G.calibrate(points,options);
    const result = mapping ? F.renderMapped(source.data,source.width,source.height,{bounds:mapping.bounds(source.width,source.height),inverse:mapping.inverse}) : F.render(source.data,source.width,source.height,transform);
    const box = F.alphaBox(result.data,result.width,result.height);
    if (!box) throw Error('O PNG não tem pixels visíveis.');
    const work = canvasFor(result), ctx = work.getContext('2d'); ctx.putImageData(new ImageData(result.data,result.width,result.height),0,0);
    const c = canvasFor(box); c.getContext('2d').drawImage(work,box.left,box.top,box.width,box.height,0,0,box.width,box.height);
    return { canvas:c,frame:{...box,left:result.left+box.left,top:result.top+box.top},transform };
  }
  function drawSource() {
    $('sourceArea').hidden = !source;
    $('calibration').hidden = !source || source.usage === 'reference-only';
    $('exportSource').disabled = !source;
    $('exportTemplate').disabled = source?.usage === 'reference-only';
    if (!source) return;
    const c = $('sourceCanvas'), scale = Math.min(2,620/source.width,260/source.height);
    c.width = Math.ceil(source.width*scale); c.height = Math.ceil(source.height*scale);
    const ctx = c.getContext('2d'); ctx.scale(scale,scale); ctx.drawImage(source.image,0,0);
    for (const [key,p] of Object.entries(points)) {
      ctx.strokeStyle = key === 'foot' ? '#74d9a7' : '#ffcd71'; ctx.lineWidth = 1/scale;
      ctx.beginPath(); ctx.arc(p.x,p.y,4/scale,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `${11/scale}px sans-serif`; ctx.fillText(({left:'1',back:'2',right:'3',foot:'4',groundLeft:'5',groundRight:'6'})[key],p.x+6/scale,p.y-4/scale);
    }
    sourceLayout = { scale };
    $('pointInfo').textContent = Object.entries(points).map(([key,p]) => `${key}: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`).join('\n');
    $('sourceDimensions').textContent = `${source.width} × ${source.height} px · alpha preservado`;
  }
  function refresh() {
    try {
      const p = params(); drawSource(); output = render(p);
      const canvas = $('preview'), rect = $('previewViewport').getBoundingClientRect(), dpr = Math.min(devicePixelRatio||1,2);
      canvas.width = Math.max(1,Math.round(rect.width*dpr)); canvas.height = Math.max(1,Math.round(rect.height*dpr));
      const ctx = canvas.getContext('2d');
      const companion = {...p,kind:p.kind !== 'chair' ? 'chair' : 'table',rotation:p.kind !== 'chair' ? 0 : p.rotation};
      const companionX = p.kind !== 'chair' ? -80 : 80;
      const bounds = {left:output.frame.left,top:output.frame.top,right:output.frame.left+output.frame.width,bottom:output.frame.top+output.frame.height};
      if ($('guides').checked) {bounds.left=Math.min(bounds.left,-82);bounds.right=Math.max(bounds.right,82);bounds.bottom=Math.max(bounds.bottom,82);}
      if ($('pair').checked) {
        const f=G.model(companion).frame;bounds.left=Math.min(bounds.left,f.left+companionX);bounds.right=Math.max(bounds.right,f.left+f.width+companionX);
        bounds.top=Math.min(bounds.top,f.top+40);bounds.bottom=Math.max(bounds.bottom,f.top+f.height+40);
      }
      const scale = Math.min(Number($('zoom').value)/100,(rect.width-24)/(bounds.right-bounds.left),(rect.height-24)/(bounds.bottom-bounds.top));
      ctx.scale(dpr,dpr);ctx.translate(rect.width/2-(bounds.left+bounds.right)*scale/2,rect.height/2-(bounds.top+bounds.bottom)*scale/2);ctx.scale(scale,scale);
      ctx.drawImage(output.canvas,output.frame.left,output.frame.top);
      if ($('reference').checked && reference) { ctx.globalAlpha = Number($('opacity').value)/100; const part = reference.parts[p.rotation] ?? reference.parts[0]; ctx.drawImage(part.image,part.left,part.top); ctx.globalAlpha = 1; }
      if ($('guides').checked) guides(ctx,p);
      if ($('pair').checked) {
        ctx.save(); ctx.translate(companionX,40);
        G.draw(ctx,companion); if ($('guides').checked) guides(ctx,companion,false); ctx.restore();
      }
      $('documentName').textContent = source ? source.name : `${({table:'Mesa de madeira',chair:'Cadeira rosa',counter:'Balcão',stove:'Fogão'})[p.kind]} · reconstrução`;
      $('metadata').textContent = `${output.frame.width} × ${output.frame.height} px\nleft: ${output.frame.left}\ntop: ${output.frame.top}\nPlano: ${p.kind !== 'chair' ? p.topHeight : p.seatHeight} px\nOrigem do tile: (0, 0)\nAlpha RGBA · sem fundo`;
      for (const id of ['exportPng','exportJson','exportKit']) $(id).disabled = false;
      status(source ? 'Vista calibrada. Confira os pontos antes de exportar.' : 'Geometria 2:1 pronta. A reconstrução não é um recorte original.');
    } catch (error) {
      output = null; $('metadata').textContent = error.message;
      if(source?.usage==='reference-only') {
        $('documentName').textContent=`Ícone antigo · ${source.name}`;
        const canvas=$('preview');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
      }
      for (const id of ['exportPng','exportJson','exportKit']) $(id).disabled = true;
      status(source?.usage === 'reference-only' ? 'Ícone antigo: referência histórica. A interface do jogo usa os ícones atuais.' : error.message,!loading && source?.usage !== 'reference-only');
    }
  }
  const loadImage = url => new Promise((resolve,reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(Error('Não foi possível abrir o PNG.')); img.src = url; });
  const fileUrl = file => new Promise((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
  async function setSource(url,name,marked = null,usage = 'asset',fixedTransform = null) {
    if(fixedTransform && !F.validTransform(fixedTransform))throw Error('Registro da imagem inválido.');
    const revision = ++sequence;loading=true;refresh();
    try {
    const img = await loadImage(url);
    if (revision !== sequence) return;
    if (img.width*img.height > 16000000 || img.width > 8192 || img.height > 8192) throw Error('PNG muito grande: limite de 16 milhões de pixels.');
    const c = canvasFor({width:img.width,height:img.height}), ctx = c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(img,0,0);
    const data = ctx.getImageData(0,0,c.width,c.height).data;
    if (!data.some((value,i) => i%4 === 3 && value === 0)) throw Error('Este arquivo não contém fundo transparente real. Importe um PNG com alpha.');
    source = { image:img,width:img.width,height:img.height,data,
      url:url.startsWith('data:') ? url : c.toDataURL('image/png'),originalUrl:url,name,usage,fixedTransform };
    points = marked || {}; $('point').value = 'left'; $('pair').checked = false;
    } finally {if(revision===sequence){loading=false;refresh();}}
  }
  async function loadReference() {
    const kind = $('kind').value, items = globalThis.CafeFurnitureLibrary?.current ?? {};
    const entry = items[kind]; reference=null; if (!entry) return;
    const parts = await Promise.all(entry.parts.map(async p => ({...p,image:await loadImage(p.url)})));
    if ($('kind').value !== kind) return; reference = {parts}; refresh();
  }
  const handle = fn => async event => { try { await fn(event); } catch(error) { status(error.message,true); } };
  for (const id of [...fields,'support','guides','pair','zoom','reference','opacity']) $(id).addEventListener('input',() => { refresh(); if (id === 'kind') loadReference().catch(e=>status(e.message,true)); });
  function newModel(kind) {
    sequence++;loading=false; source = null; points = {}; setParams({...G.defaults,kind});
    $('classname').value = kind === 'table' ? 'wood_inlay_table' : 'pink_square_chair';
    $('itemName').value = kind === 'table' ? 'Mesa de Madeira com Moldura' : 'Cadeira Rosa';
    $('itemId').value = kind === 'table' ? 9030001 : 9040001; $('price').value = kind === 'table' ? 500 : 200;
    refresh(); loadReference().catch(e=>status(e.message,true));
  }
  $('newTable').onclick = () => newModel('table'); $('newChair').onclick = () => newModel('chair');
  $('clearSource').onclick = () => { sequence++;loading=false; source = null; points = {}; refresh(); };
  $('importSource').onclick = () => $('sourceFile').click();
  $('sourceFile').onchange = handle(async () => { const file = $('sourceFile').files[0]; $('sourceFile').value = ''; if(file) await setSource(await fileUrl(file),file.name); });
  $('sourceCanvas').onclick = event => {
    if (!sourceLayout) return;
    const rect = $('sourceCanvas').getBoundingClientRect(), key = $('point').value;
    source.fixedTransform=null;
    points[key] = {x:(event.clientX-rect.left)*source.width/rect.width,y:(event.clientY-rect.top)*source.height/rect.height};
    const next = ['left','back','right','foot','groundLeft','groundRight']; $('point').value = next[Math.min(5,next.indexOf(key)+1)]; refresh();
  };
  const download = (blob,name) => { const a = document.createElement('a'),url = URL.createObjectURL(blob); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),5000); };
  const pngBlob = c => new Promise((resolve,reject) => c.toBlob(blob=>blob ? resolve(blob) : reject(Error('É impossível exportar este canvas.')),'image/png'));
  const jsonBlob = data => new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
  function identity() {
    const classname = $('classname').value, id = Number($('itemId').value), priceGold = Number($('price').value), name = $('itemName').value.trim();
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(classname) || !Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(priceGold) || priceGold < 0 || !name) throw Error('Confira classe, nome, ID e preço antes de exportar.');
    return {classname,id,name,priceGold};
  }
  function manifest(parts) {
    if(source?.usage === 'reference-only')throw Error('Ícones antigos são referências históricas e não entram no catálogo de móveis.');
    const p = params(); return {...identity(),type:3,kind:p.kind,purchasable:true,sizeX:1,sizeY:1,
      itemHeight: p.kind === 'chair' ? p.backHeight : p.topHeight,parts,
      source:{art:source ? 'PNG importado e calibrado na Oficina de móveis.' : 'Reconstrução geométrica inspirada nas capturas do Café Mania fornecidas pelo responsável.',
        calibration:'Tile 160×80, origem traseira. Alturas referenciadas em white_cloth_table e classic_chair.',priceGold:'Valor escolhido para o projeto; não confirmado na configuração histórica.'}};
  }
  const part = (r,rotation) => ({file:`rotation-${rotation}.png`,width:r.frame.width,height:r.frame.height,left:r.frame.left,top:r.frame.top,rotation});
  $('exportPng').onclick = handle(async () => { const r=render(), p=params(); identity(); download(await pngBlob(r.canvas),`rotation-${p.rotation}.png`); status('PNG exportado com alpha real, sem guias.'); });
  $('exportTemplate').onclick = handle(async () => { const r=render(params(),true); download(await pngBlob(r.canvas),`gabarito-${params().kind}.png`); status('Gabarito transparente exportado separadamente da arte.'); });
  $('exportJson').onclick = handle(() => download(jsonBlob(manifest([part(render(),params().rotation)])),'item.json'));
  $('exportSource').onclick = handle(() => {
    if(!source)return;
    // Copiar a origem evita o arredondamento de RGB semitransparente do canvas do navegador.
    const a=document.createElement('a');a.href=source.originalUrl;a.download='recorte-original.png';a.click();
    status('Recorte original exportado, sem reamostragem.');
  });
  /** ZIP STORE: um único download preserva nomes de arquivos e não depende de bibliotecas ou rede. */
  function zip(entries) {
    const encoder = new TextEncoder(), chunks = [], central = []; let offset = 0;
    const crc = bytes => { let v=0xffffffff; for(const b of bytes) {v^=b; for(let i=0;i<8;i++) v=(v>>>1)^((v&1)?0xedb88320:0);} return (v^0xffffffff)>>>0; };
    for(const entry of entries) {
      const name=encoder.encode(entry.name),bytes=entry.bytes, checksum=crc(bytes), local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
      l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,checksum,true);l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,name.length,true);local.set(name,30);
      const c=new Uint8Array(46+name.length),v=new DataView(c.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,checksum,true);v.setUint32(20,bytes.length,true);v.setUint32(24,bytes.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);c.set(name,46);
      chunks.push(local,bytes);central.push(c);offset+=local.length+bytes.length;
    }
    const size=central.reduce((sum,c)=>sum+c.length,0), end=new Uint8Array(22),e=new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
    return new Blob([...chunks,...central,end],{type:'application/zip'});
  }
  async function kit() {
    const p=params(), entries=[], parts=[], root=identity().classname+'/';
    for(const rotation of source ? [p.rotation] : [0,1,2,3]) {const r=render({...p,rotation});parts.push(part(r,rotation));entries.push({name:root+`rotation-${rotation}.png`,bytes:new Uint8Array(await (await pngBlob(r.canvas)).arrayBuffer())});}
    const encoder = new TextEncoder(); entries.push({name:root+'item.json',bytes:encoder.encode(JSON.stringify(manifest(parts),null,2)+'\n')});
    entries.push({name:root+'calibration.json',bytes:encoder.encode(JSON.stringify({params:p,points,support:Number($('support').value),fixedTransform:source?.fixedTransform??null,tile:[160,80],origin:'back',source:source?.name??null},null,2)+'\n')});
    return zip(entries);
  }
  $('exportKit').onclick = handle(async()=>{download(await kit(),identity().classname+'.zip');status('Pacote exportado. Originais e geometria preservados.');});
  $('saveProject').onclick = handle(() => download(jsonBlob({format:'cafe-furniture-v1',params:params(),points,support:Number($('support').value),source:source ? {url:source.url,name:source.name,usage:source.usage,fixedTransform:source.fixedTransform} : null,item:identity()}),'oficina-movel.json'));
  $('openProject').onclick = ()=>$('projectFile').click();
  $('projectFile').onchange = handle(async()=>{
    const file=$('projectFile').files[0];$('projectFile').value='';if(!file)return;
    if(file.size>30000000)throw Error('Projeto muito grande.');const data=JSON.parse(await file.text());
    if(data.format!=='cafe-furniture-v1')throw Error('Formato de projeto desconhecido.');
    G.validate(data.params);
    if(data.source && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.source.url))throw Error('A imagem do projeto precisa ser um PNG incorporado.');
    if(!(data.support>0 && data.support<=1))throw Error('Pegada dos pés inválida.');
    setParams(data.params);$('support').value=data.support;for(const [field,value] of Object.entries({classname:data.item.classname,itemId:data.item.id,itemName:data.item.name,price:data.item.priceGold}))$(field).value=value;
    if(data.source)await setSource(data.source.url,data.source.name,data.points,data.source.usage ?? 'asset',data.source.fixedTransform);else {sequence++;source=null;points={};refresh();} await loadReference();
  });
  function library() {
    const entries=globalThis.CafeFurnitureLibrary?.entries??[], filter=$('libraryFilter').value;
    $('library').replaceChildren();
    for(const entry of entries.filter(e=>filter==='all' ? e.category!=='ui' : e.category===filter)) {
      const button=document.createElement('button');button.className='furniture-card';button.title=entry.source;
      const img=new Image();img.src=entry.dataUrl??entry.url;img.alt='';img.loading='lazy';const label=document.createElement('span');label.textContent=entry.category==='ui' ? `Ícone antigo · ${entry.name}` : entry.name;button.append(img,label);
      button.onclick=handle(async()=>{
        const kind=entry.kind ?? (entry.name.startsWith('Poltrona') ? 'chair' : 'table');
        setParams({...G.defaults,kind,surface:entry.surface??G.defaults.surface,topHeight:entry.topHeight??G.defaults.topHeight});$('support').value=entry.support??(kind==='chair'?.4:.76);
        $('classname').value='import_'+entry.url.split('/').slice(-2).join('_').replace('behance-','').replace('.png','').replaceAll('-','_');
        $('itemName').value=entry.name;$('itemId').value=entry.category==='furniture'?9030201+entries.indexOf(entry):9090201+entries.indexOf(entry);$('price').value=kind==='chair'?200:500;
        await setSource(entry.dataUrl??entry.url,entry.name,entry.points,entry.usage??'asset',entry.fixedTransform);await loadReference();
        if(entry.category==='ui')status('Ícone antigo: referência histórica. A interface do jogo usa os ícones atuais.');
        else if(entry.category!=='furniture')status('Recorte disponível para exportar sem transformação. Pisos podem ser preparados no Twister.');
      });
      $('library').append(button);
    }
  }
  $('libraryFilter').onchange=library;
  new ResizeObserver(refresh).observe($('previewViewport'));
  globalThis.CafeFurnitureWorkshop=Object.freeze({render,kit,params,manifest,setSource});
  library();newModel('table');
})();
