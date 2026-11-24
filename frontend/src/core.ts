const DATA_B64="__DATA__";
const TYPE_RU={IfcWallStandardCase:'Стены',IfcWall:'Стены',IfcWindow:'Окна',IfcDoor:'Двери',IfcSlab:'Перекрытия',IfcStair:'Лестницы',IfcRailing:'Ограждения',
  IfcFurnishingElement:'Мебель',IfcBuildingElementProxy:'Оборудование',IfcEnergyConversionDevice:'Радиаторы',IfcFlowTerminal:'Сантехника'};
const ONE_RU={IfcWallStandardCase:'Стена',IfcWall:'Стена',IfcWindow:'Окно',IfcDoor:'Дверь',IfcSlab:'Перекрытие',IfcStair:'Лестница',IfcRailing:'Ограждение',
  IfcFurnishingElement:'Мебель',IfcBuildingElementProxy:'Объект',IfcEnergyConversionDevice:'Радиатор',IfcFlowTerminal:'Сантехприбор',IfcRoof:'Кровля'};
const FURN=new Set(['IfcFurnishingElement','IfcBuildingElementProxy','IfcEnergyConversionDevice','IfcFlowTerminal']);
const FLOOR_NAMES=['1 этаж','2 этаж','3 этаж','Чердак / кровля'];

async function loadData(){
  const raw=Uint8Array.from(atob(DATA_B64),c=>c.charCodeAt(0));
  const ds=new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf=await new Response(ds).arrayBuffer();
  const jl=new DataView(buf).getUint32(0,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,jl)));
  let bo=4+jl; bo=(bo+3)&~3;
  return {J:json,B:buf.slice(bo)};
}

const host=document.getElementById('view');
const LITE=location.search.includes('lite');
const MOBILE=LITE||matchMedia('(max-width:760px), (pointer:coarse)').matches;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(LITE?1:Math.min(devicePixelRatio,MOBILE?1.5:2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
THREE.ColorManagement.legacyMode=false;
renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.95;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,1,0.1,1500);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=0.12; controls.rotateSpeed=0.6; controls.panSpeed=1.0; controls.zoomSpeed=0.9;
// как в градостроительных играх: левая кнопка тащит карту по земле, правая вращает, колесо — масштаб к курсору
controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_ROTATE};
controls.screenSpacePanning=false;
controls.addEventListener('change',()=>{ const t=controls.target; const cl=(v,a,b)=>Math.max(a,Math.min(b,v)); const nx=cl(t.x,-160,160), nz=cl(t.z,-160,160), ny=cl(t.y,-1,12); if(nx!==t.x||nz!==t.z||ny!==t.y){ const d=new THREE.Vector3(nx-t.x,ny-t.y,nz-t.z); t.add(d); camera.position.add(d); } });
controls.maxPolarAngle=Math.PI*0.485; controls.minDistance=1.2; controls.maxDistance=320;

function skyMaterial(){
  return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:new THREE.Color(0x3f7fc4)},hor:{value:new THREE.Color(0xdbe7f1)},bot:{value:new THREE.Color(0x7d8471)}},
    vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'uniform vec3 top,hor,bot; varying vec3 vD; void main(){ float h=vD.y; vec3 c = h>0.0 ? mix(hor,top,pow(h,0.55)) : mix(hor,bot,pow(-h,0.35)); gl_FragColor=vec4(c,1.0); }'});
}
const sky=new THREE.Mesh(new THREE.SphereGeometry(900,32,16),skyMaterial()); scene.add(sky);
scene.fog=new THREE.Fog(0xdbe7f1,200,800);
(function(){
  const es=new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),skyMaterial()));
  const sb=new THREE.Mesh(new THREE.SphereGeometry(4,16,8),new THREE.MeshBasicMaterial({color:0xfff3d6})); sb.position.set(-25,28,18); es.add(sb);
  scene.environment=new THREE.PMREMGenerator(renderer).fromScene(es,0.03).texture;
})();
const hemi=new THREE.HemisphereLight(0xdbeaff,0x6d6a5c,0.55); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1dc,2.0);
sun.position.set(-45,60,35); sun.castShadow=true;
sun.shadow.mapSize.set(LITE?1024:MOBILE?2048:4096,LITE?1024:MOBILE?2048:4096); sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.04;
Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:200});
scene.add(sun);

// ground: lawn + paved apron around the building
function canvasTex(px,draw,rep){const c=document.createElement('canvas');c.width=c.height=px;draw(c.getContext('2d'),px);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=renderer.capabilities.getMaxAnisotropy();if(rep)t.repeat.set(rep,rep);return t;}
const grassT=canvasTex(256,(g,n)=>{g.fillStyle='#6f8a4a';g.fillRect(0,0,n,n);for(let i=0;i<5000;i++){g.fillStyle=`hsl(${80+Math.random()*25},${30+Math.random()*20}%,${28+Math.random()*16}%)`;g.fillRect(Math.random()*n,Math.random()*n,1.5,1.5);}},120);
const paveT=canvasTex(256,(g,n)=>{g.fillStyle='#b9b4aa';g.fillRect(0,0,n,n);g.strokeStyle='#9d978c';g.lineWidth=2;for(let i=0;i<=8;i++){g.beginPath();g.moveTo(i*n/8,0);g.lineTo(i*n/8,n);g.stroke();g.beginPath();g.moveTo(0,i*n/8);g.lineTo(n,i*n/8);g.stroke();}},1);
const ground=new THREE.Mesh(new THREE.CircleGeometry(600,64),new THREE.MeshStandardMaterial({map:grassT,roughness:1}));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

const model=new THREE.Group(); model.rotation.x=-Math.PI/2; scene.add(model);  // IFC is Z-up
const storeyG=[]; const pickables=[]; const furnObjs=[]; const roofObjs=[];
let STO=[], BB=new THREE.Box3();

function makeMat(m,type?){
  const c=new THREE.Color().setRGB(m.c[0],m.c[1],m.c[2]).convertSRGBToLinear();
  const t=m.t||0;
  if(t>0.05) return new THREE.MeshPhysicalMaterial({color:c,roughness:0.05,metalness:0,transparent:true,opacity:Math.max(0.18,1-t),envMapIntensity:1.2,depthWrite:false,side:THREE.DoubleSide,flatShading:true});
  return new THREE.MeshStandardMaterial({color:c,roughness:0.82,metalness:0.0,side:THREE.DoubleSide,flatShading:true,envMapIntensity:0.6});
}

async function build(){
  const {J,B}=await loadData();
  STO=[['1-й этаж',-3],['2-этаж',0],['3-этаж',3],['чердак',6.3]];
  STO.forEach((s,i)=>{const g=new THREE.Group(); g.userData.i=i; storeyG.push(g); model.add(g);});
  const texCache={};
  function tex(name){ if(!texCache[name]){ const t=new THREE.TextureLoader().load(J.texs[name]); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.encoding=THREE.sRGBEncoding; t.anisotropy=renderer.capabilities.getMaxAnisotropy(); texCache[name]=t; } return texCache[name]; }
  const LAYER_T={'KONSTRUKTIV_-_STEN__NESUSIE':'IfcWall','KONSTRUKTIV_-_PEREKR_TIA':'IfcSlab','KONSTRUKTIV_-_LESTNIC_':'IfcStair','KONSTRUKTIV_-_KR_SI':'IfcRoof'};
  const shellMats={};
  for(const p of J.shell){
    const key=p.m;
    if(!shellMats[key]){
      const c=new THREE.Color().setRGB(p.c[0],p.c[1],p.c[2]).convertSRGBToLinear();
      let mat;
      if(p.tr>0.05) mat=new THREE.MeshPhysicalMaterial({color:c,roughness:0.04,metalness:0,transparent:true,opacity:0.32,envMapIntensity:1.4,depthWrite:false,side:THREE.DoubleSide});
      else {
        mat=new THREE.MeshStandardMaterial({color:c,roughness:/METALL/.test(key)?0.45:0.85,metalness:/METALL/.test(key)?0.35:0,side:THREE.DoubleSide,envMapIntensity:0.7});
        if(p.tex){ mat.map=tex(p.tex); mat.color.setRGB(1,1,1); if(/STUKAT|BETON|KIRPIC/.test(key)) mat.color.copy(c).multiplyScalar(1/Math.max(c.r,c.g,c.b)); }
      }
      mat.name=key; shellMats[key]=mat;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(B,p.po,p.vn*3),3));
    if(p.uo>=0) geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(B,p.uo,p.vn*2),2));
    geo.setIndex(new THREE.BufferAttribute(p.big?new Uint32Array(B,p.io,p.n):new Uint16Array(B,p.io,p.n),1));
    // flat normals for crisp architecture
    const g2=geo.toNonIndexed(); g2.computeVertexNormals();
    const mesh=new THREE.Mesh(g2,shellMats[key]);
    const glass=shellMats[key].transparent;
    mesh.castShadow=!glass; mesh.receiveShadow=!glass;
    mesh.userData={t:LAYER_T[p.l]||'IfcWall',m:key,s:p.s};
    storeyG[p.s].add(mesh); pickables.push(mesh);
    if(p.s===3) roofObjs.push(mesh);
  }
  const mats=J.mats.map(m=>makeMat(m));
  const geoParts=J.geoms.map(g=>{
    const pos=new Float32Array(B,g.vo,g.vn*3);
    return g.p.map(([mi,io,n,big])=>{
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      geo.setIndex(new THREE.BufferAttribute(big?new Uint32Array(B,io,n):new Uint16Array(B,io,n),1));
      return {geo,mi};
    });
  });
  const m4=new THREE.Matrix4();
  for(const grp of J.inst){
    const G=storeyG[grp.s];
    for(const {geo,mi} of geoParts[grp.g]){
      const mat=mats[mi]; let obj;
      if(grp.m.length===1){ obj=new THREE.Mesh(geo,mat); obj.matrixAutoUpdate=false; setM(m4,grp.m[0]); obj.matrix.copy(m4); }
      else { obj=new THREE.InstancedMesh(geo,mat,grp.m.length); grp.m.forEach((a,k)=>{setM(m4,a); obj.setMatrixAt(k,m4);}); obj.instanceMatrix.needsUpdate=true; obj.frustumCulled=false; }
      obj.castShadow=false; obj.receiveShadow=true;
      obj.userData={t:grp.t,s:grp.s};
      G.add(obj); pickables.push(obj);
      if(grp.t!=='IfcRailing') furnObjs.push(obj);
    }
  }
  model.updateMatrixWorld(true);
  model.traverse((o: any)=>{ if(o.isMesh&&!o.isInstancedMesh){ o.geometry.computeBoundingBox(); BB.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }});
  ground.position.y=BB.min.y+0.02;
  const counts={}; for(const [si,c] of Object.entries(J.counts)){ counts[si]={}; for(const [t,n] of Object.entries(c)){ const tr=TYPE_RU[t]||t; counts[si][tr]=(counts[si][tr]||0)+n; } }
  fillTable(counts);
  setView('iso',true);
  document.getElementById('load').textContent='Оживляю корпус: студенты идут на пары…';
}
function setM(m4,a){ // a = 12 numbers: 3x4 row-major? (stored as M[:3,:].T flattened -> columns)
  m4.set(a[0],a[3],a[6],a[9], a[1],a[4],a[7],a[10], a[2],a[5],a[8],a[11], 0,0,0,1);
}

function fillTable(counts){
  const cols=['Стены','Окна','Двери','Мебель'];
  let h='<tr><th>Этаж</th>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr>';
  const tot={};
  STO.forEach((s,i)=>{const c=counts[i]||{};
    const furn=(c['Мебель']||0)+(c['Оборудование']||0)+(c['Радиаторы']||0)+(c['Сантехника']||0);
    const row={...c,'Мебель':furn}; cols.forEach(k=>tot[k]=(tot[k]||0)+(row[k]||0));
    h+=`<tr class="fl" data-f="${i<3?i:'all'}"><td>${FLOOR_NAMES[i]}<br><span style="color:var(--muted);font-family:var(--f-mono);font-size:11px">${i<3?fmtLvl(s[1]+3):'конёк +'+(BB.max.y).toFixed(1).replace('.',',')}</span></td>`+cols.map(k=>`<td class="a">${row[k]||'—'}</td>`).join('')+'</tr>';});
  h+='<tr><td><b>Итого</b></td>'+cols.map(k=>`<td class="a"><b>${tot[k]}</b></td>`).join('')+'</tr>';
  const tb=document.getElementById('tbl'); tb.innerHTML=h;
  tb.querySelectorAll('tr.fl').forEach(r=>r.onclick=()=>setFloor(r.dataset.f));
  const sz=new THREE.Vector3(); BB.getSize(sz);
  document.getElementById('dims').innerHTML=`Габариты корпуса в плане ≈ ${sz.x.toFixed(1).replace('.',',')} × ${sz.z.toFixed(1).replace('.',',')} м, высота до конька ≈ ${(BB.max.y-0).toFixed(1).replace('.',',')} м. Отметки этажей: ±0,000 · +3,000 · +6,000 (от пола 1 этажа; в проекте ArchiCAD нулём принят пол 2 этажа).`;
}
function fmtLvl(v){ if(Math.abs(v)<1e-6) return '±0,000'; return (v>0?'+':'−')+Math.abs(v).toFixed(3).replace('.',','); }

// ---- floors
let curFloor='all', explode=false;
function setFloor(f){
  curFloor=f;
  if(BB&&!BB.isEmpty()){ const ty=f==='all'?3.5:(+f)*3+1.2; const dy=ty-controls.target.y; if(Math.abs(dy)>0.3) tween={p0:camera.position.clone(),t0:controls.target.clone(),p1:camera.position.clone().setY(camera.position.y+dy),t1:controls.target.clone().setY(ty),k:0}; }
  document.querySelectorAll('[data-f]').forEach(b=>{ if(b.tagName==='BUTTON') b.classList.toggle('on',b.dataset.f===String(f)); });
  applyVis();
}
function applyVis(){
  const roofOn=document.getElementById('cRoof').checked, furnOn=document.getElementById('cFurn').checked;
  storeyG.forEach((g,i)=>{
    g.visible = curFloor==='all' ? (i<3 || roofOn) : i<=+curFloor;
    g.position.z = explode ? i*4.5 : 0;   // model group is Z-up
  });
  furnObjs.forEach(o=>o.visible=furnOn&&o.userData.s>=2);   // мебель только на 3 этаже (ИНИТ)
  // when a floor is isolated, hide the slab of the storey above (the floor's ceiling) — it belongs to the next storey, so it's already hidden
}
document.querySelectorAll('#floors button,#mFloors button').forEach(b=>b.onclick=()=>setFloor(b.dataset.f));
document.getElementById('cRoof').onchange=applyVis;
document.getElementById('cFurn').onchange=applyVis;
document.getElementById('cExplode').onchange=e=>{explode=e.target.checked; applyVis();};
document.getElementById('cRotate').onchange=e=>{controls.autoRotate=e.target.checked; controls.autoRotateSpeed=0.8;};

// ---- views
let tween=null;
function setView(v,instant?){
  document.querySelectorAll('#views button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  const c=new THREE.Vector3(); BB.getCenter(c); const sz=new THREE.Vector3(); BB.getSize(sz);
  const R=Math.max(sz.x,sz.z);
  const tgt=new THREE.Vector3(c.x,3.5,c.z); let pos;
  if(v==='top') pos=new THREE.Vector3(c.x,R*1.55,c.z+0.01);
  else if(v==='s') pos=new THREE.Vector3(c.x,6,c.z+R*1.25);
  else if(v==='n') pos=new THREE.Vector3(c.x,6,c.z-R*1.25);
  else if(v==='e') pos=new THREE.Vector3(c.x+R*1.25,6,c.z);
  else if(v==='w') pos=new THREE.Vector3(c.x-R*1.25,6,c.z);
  else pos=new THREE.Vector3(c.x+R*0.75,R*0.62,c.z+R*0.95);
  if(instant){camera.position.copy(pos);controls.target.copy(tgt);controls.update();return;}
  tween={p0:camera.position.clone(),t0:controls.target.clone(),p1:pos,t1:tgt,k:0};
}
document.querySelectorAll('#views button').forEach(b=>b.onclick=()=>setView(b.dataset.v));

// ---- time of day
const TOD=[
  {top:0x3f7fc4,hor:0xdbe7f1,bot:0x7d8471,sun:0xfff1dc,si:2.0,hemi:0.55,exp:0.95,sp:[-45,60,35]},
  {top:0x3b4f7a,hor:0xf2b27a,bot:0x5b5048,sun:0xffb070,si:1.4,hemi:0.35,exp:0.9,sp:[-70,18,30]},
  {top:0x060b18,hor:0x1d2a44,bot:0x141414,sun:0x9fb4ff,si:0.25,hemi:0.12,exp:1.1,sp:[30,60,-20]}];
const winGlow=[];
function setTod(i){
  const t=TOD[i]; const u=sky.material.uniforms;
  u.top.value.set(t.top);u.hor.value.set(t.hor);u.bot.value.set(t.bot); scene.fog.color.set(t.hor);
  sun.color.set(t.sun); sun.intensity=t.si; sun.position.set(...(t.sp as [number, number, number])); hemi.intensity=t.hemi; renderer.toneMappingExposure=t.exp;
  pickables.forEach(o=>{ if(o.material.transparent){ o.material.emissive=o.material.emissive||new THREE.Color(); o.material.emissive.set(i===2?0xffc27a:i===1?0x553311:0x000000); o.material.emissiveIntensity=i===2?0.9:0.4; }});
  document.querySelectorAll('#tod button').forEach(b=>b.classList.toggle('on',+b.dataset.t===i));
}


// ---- picking
const ray=new THREE.Raycaster(); const mp=new THREE.Vector2(); let down=null;
renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5) return;
  const r=renderer.domElement.getBoundingClientRect();
  mp.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(mp,camera);
  if(typeof pickNPC==='function'){ const nn=pickNPC(ray); if(nn){ selectNPC(nn); if(MOBILE) document.body.classList.add('exp-open'); return; } }
  const p=document.getElementById('pick'); p.style.display='none'; return;
  const hit=ray.intersectObjects(pickables.filter(o=>o.visible&&o.parent.visible),false)[0];
  if(!hit){return;}
  const u=hit.object.userData;
  p.style.display='block';
  p.innerHTML=`<b>${ONE_RU[u.t]||u.t}</b> · ${FLOOR_NAMES[u.s]}<br>Высота точки: ${fmtLvl(hit.point.y)} м`;
  if(MOBILE) document.body.classList.add('exp-open');
});

// ---- mobile sheets
document.getElementById('mMenu').onclick=()=>{document.body.classList.toggle('menu-open');document.body.classList.remove('exp-open');};
document.getElementById('mInfo').onclick=()=>{document.body.classList.toggle('exp-open');document.body.classList.remove('menu-open');};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>document.body.classList.remove('menu-open','exp-open'));

// ---- камера: зум к курсору, двойной клик — фокус, WASD
const _ray=new THREE.Raycaster(), _mv=new THREE.Vector2(), _pl=new THREE.Plane(), _hit=new THREE.Vector3();
function cursorPoint(e){ const r=renderer.domElement.getBoundingClientRect(); _mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); _ray.setFromCamera(_mv,camera);
  _pl.set(new THREE.Vector3(0,1,0),-controls.target.y); return _ray.ray.intersectPlane(_pl,_hit)?_hit.clone():null; }
host.addEventListener('wheel',e=>{ if(e.target!==renderer.domElement) return; e.preventDefault(); e.stopPropagation(); tween=null;
  const k=Math.exp(Math.max(-0.6,Math.min(0.6,e.deltaY*(e.ctrlKey?0.01:0.0015))));
  const dist=camera.position.distanceTo(controls.target); const nk=Math.max(controls.minDistance/dist,Math.min(controls.maxDistance/dist,k));
  const P=cursorPoint(e)||controls.target.clone();
  camera.position.sub(P).multiplyScalar(nk).add(P); controls.target.sub(P).multiplyScalar(nk).add(P);
  if(typeof followN!=='undefined'&&followN&&nk<1){} },{capture:true,passive:false});
renderer.domElement.addEventListener('dblclick',e=>{ const r=renderer.domElement.getBoundingClientRect(); _mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); _ray.setFromCamera(_mv,camera);
  const h=_ray.intersectObjects(pickables.filter(o=>o.visible&&o.parent.visible),false)[0]; const P=h?h.point:cursorPoint(e); if(!P) return;
  const off=camera.position.clone().sub(controls.target); const L=Math.min(off.length(),Math.max(9,off.length()*0.55)); off.setLength(L);
  tween={p0:camera.position.clone(),t0:controls.target.clone(),p1:P.clone().add(off),t1:P.clone(),k:0}; });
const keys: any={}; addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return; keys[e.code]=true; }); addEventListener('keyup',e=>keys[e.code]=false); addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
function keyMove(dt){ let f=0,s=0,r=0; if(keys.KeyW||keys.ArrowUp)f++; if(keys.KeyS||keys.ArrowDown)f--; if(keys.KeyD||keys.ArrowRight)s++; if(keys.KeyA||keys.ArrowLeft)s--; if(keys.KeyQ)r--; if(keys.KeyE)r++;
  if(!f&&!s&&!r) return; tween=null; const fw=controls.target.clone().sub(camera.position); fw.y=0; fw.normalize(); const rt=new THREE.Vector3(-fw.z,0,fw.x);
  const sp=Math.max(4,camera.position.distanceTo(controls.target)*0.9)*dt; const mv=fw.multiplyScalar(f*sp).add(rt.multiplyScalar(s*sp)); camera.position.add(mv); controls.target.add(mv);
  if(r){ const off=camera.position.clone().sub(controls.target); off.applyAxisAngle(new THREE.Vector3(0,1,0),-r*dt*1.2); camera.position.copy(controls.target).add(off); } }
let _lt=performance.now();
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize); resize();
function loop(){
  requestAnimationFrame(loop);
  if(tween){tween.k=Math.min(1,tween.k+0.04);const e=1-Math.pow(1-tween.k,3);
    camera.position.lerpVectors(tween.p0,tween.p1,e);controls.target.lerpVectors(tween.t0,tween.t1,e);if(tween.k>=1)tween=null;}
  if(window.simReady) simFrame();
  const _n=performance.now(); if(!window.fpvOn){ keyMove(Math.min(0.05,(_n-_lt)/1000)); controls.update(); } _lt=_n;
  renderer.render(scene,camera);
}
