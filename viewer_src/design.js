// ================= 3 этаж ИНИТ: современный дизайн (планировка та же) =================
const ACC = { pc: ['#2f80ed', '#f2994a', '#27ae60', '#eb5757', '#9b51e0', '#e0b300'], cls: ['#2d9cdb', '#3cb878', '#f2c94c', '#bb6bd9', '#26b5c9', '#ff8a65'] };
function roomAccent(r) {
  if (!r) return '#8fa3b8';
  if (r.kind === 'pc') return ACC.pc[PC_ROOMS.indexOf(r) % 6];
  if (r.kind === 'class') return ACC.cls[CLASS_ROOMS.indexOf(r) % 6];
  if (r === R_IT) return '#1f5fa8'; if (r === R_COWORK) return '#ff8a3d'; if (r === R_LOUNGE) return '#ff6b81'; if (r === R_DEAN) return '#2c4a8a';
  if (r.kind === 'wc') return '#6cc6d8'; if (r.kind === 'corridor') return '#1f5fa8'; if (r.name === 'Кафедра') return '#5aa58f';
  return '#7f9bb8';
}
const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
let DTEX = null, CTEX = null;
function designTex() {
  const n = SNX * SNY, d = new Uint8Array(n * 4), G0 = GRID[2], G = new Int16Array(G0), dist = new Uint8Array(n); let q = [];
  for (let k = 0; k < n; k++) if (G[k] >= 0) q.push(k); else if (G[k] === -2) G[k] = -1;
  // растягиваем помещения до лица стены (сетка навигации отступает от стен ~0,75 м)
  for (let step = 1; step <= 5; step++) { const nq = []; for (const k of q) { const i = k % SNX; for (const m of [i > 0 ? k - 1 : -1, i < SNX - 1 ? k + 1 : -1, k - SNX, k + SNX]) if (m >= 0 && m < n && G[m] === -1) { G[m] = G[k]; nq.push(m); } } q = nq; }
  for (let k = 0; k < n; k++) { const v = G[k]; if (v < 0) continue; const r = ROOMS[v]; if (!r) continue; const [R, Gc, B] = hexRGB(roomAccent(r)); d[k * 4] = R; d[k * 4 + 1] = Gc; d[k * 4 + 2] = B; d[k * 4 + 3] = r.kind === 'corridor' ? 128 : r.kind === 'pc' ? 200 : r.kind === 'wc' ? 90 : 255; }
  // двери (-2) и тонкие стены: берём ближайшее помещение, чтобы цвет не «рвался» у проёмов
  const cd = new Uint8Array(n * 4); for (let k = 0; k < n; k++) if (G0[k] >= 0 || G0[k] === -2) cd[k * 4] = 255;
  CTEX = new THREE.DataTexture(cd, SNX, SNY, THREE.RGBAFormat); CTEX.magFilter = CTEX.minFilter = THREE.NearestFilter; CTEX.needsUpdate = true;
  DTEX = new THREE.DataTexture(d, SNX, SNY, THREE.RGBAFormat); DTEX.magFilter = DTEX.minFilter = THREE.NearestFilter; DTEX.needsUpdate = true;
}
const GLSL_HEAD = `uniform sampler2D uRoom; uniform sampler2D uCore; uniform vec4 uGrid; uniform float uFloor; varying vec3 vWP; varying vec3 vWN;
float coreAt(vec2 p){ vec2 uv = (p - uGrid.xy) / uGrid.zw; if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.; return texture2D(uCore, uv).r; }
vec4 roomAtP(vec2 p){ vec2 uv = (p - uGrid.xy) / uGrid.zw; if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.); return texture2D(uRoom, uv); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`;
const GLSL = {
  wall: `
  { float h = vWP.y - uFloor;
    if (h > -0.02 && h < 3.5 && abs(vWN.y) < 0.5) {
      vec2 p = vec2(vWP.x, -vWP.z) + vec2(vWN.x, -vWN.z) * 0.03;
      vec4 r = roomAtP(p); vec2 nn = vec2(vWN.x, -vWN.z);
      float core = max(max(coreAt(p + nn * 0.55), coreAt(p + nn * 0.85)), coreAt(p + nn * 1.1));
      if (r.a > 0.01 && core > 0.5) {
        vec3 acc = pow(r.rgb, vec3(2.2));
        bool corr = abs(r.a - 0.502) < 0.03;
        vec3 c = vec3(0.90, 0.885, 0.86);
        if (h < 1.05) c = corr ? mix(acc, vec3(0.86), 0.8) : mix(acc, vec3(0.9), 0.18);
        if (h > 1.05 && h < 1.14) c = acc * (corr ? 1.0 : 0.75);
        if (h < 0.1) c = vec3(0.06);
        diffuseColor.rgb = c;
      }
    } }`,
  floor: `
  { float h = vWP.y - uFloor;
    if (vWN.y > 0.6 && abs(h) < 0.35) {
      vec2 p = vec2(vWP.x, -vWP.z); vec4 r = roomAtP(p);
      if (r.a < 0.01) r = roomAtP(p + vec2(0.2, 0.0));
      if (r.a > 0.01) {
        vec3 c;
        if (abs(r.a - 0.502) < 0.03) { vec2 q = fract(p / 0.6); float seam = step(q.x, 0.012) + step(q.y, 0.012); float n = hash2(floor(p / 0.6)); c = vec3(0.60, 0.60, 0.585) * (0.92 + 0.08 * n); c = mix(c, vec3(0.38), min(1., seam) * 0.55); }
        else if (abs(r.a - 0.784) < 0.03) { vec2 cell = floor(p / 0.5); float n = hash2(cell); float ck = mod(cell.x + cell.y, 2.); c = vec3(0.105, 0.13, 0.175) * (0.88 + 0.14 * n + ck * 0.08); }
        else if (r.a < 0.4) { vec2 q = fract(p / 0.3); float seam = step(q.x, 0.03) + step(q.y, 0.03); c = mix(vec3(0.78, 0.82, 0.83), vec3(0.5), min(1., seam) * 0.5); }
        else { float row = floor(p.y / 0.19); float off = fract(row * 0.37) * 1.2; float col = floor((p.x + off) / 1.2); float n = hash2(vec2(row, col));
          float seam = step(fract(p.y / 0.19), 0.035) + step(fract((p.x + off) / 1.2), 0.004); float grain = 0.5 + 0.5 * sin(p.x * 40.0 + sin(p.y * 9.0 + row) * 2.0);
          c = vec3(0.55, 0.39, 0.23) * (0.86 + 0.18 * n) * (0.94 + 0.06 * grain); c = mix(c, c * 0.55, min(1., seam)); }
        diffuseColor.rgb = c;
      }
    } }`,
  ceil: `
  { float h = vWP.y - uFloor; if (vWN.y < -0.6 && h > 2.4 && h < 3.8) { vec2 p = vec2(vWP.x, -vWP.z); vec4 r = roomAtP(p); if (r.a > 0.01) { vec2 q = fract(p / 0.6); float seam = step(q.x, 0.01) + step(q.y, 0.01); diffuseColor.rgb = mix(vec3(0.88), vec3(0.62), min(1., seam) * 0.5); } } }`,
};
function designMat(mat, kind) {
  const m = mat.clone(); m.name = (mat.name || '') + '#' + kind;
  m.onBeforeCompile = sh => {
    sh.uniforms.uRoom = { value: DTEX }; sh.uniforms.uCore = { value: CTEX }; sh.uniforms.uGrid = { value: new THREE.Vector4(SX0, SY0, SNX * SR, SNY * SR) }; sh.uniforms.uFloor = { value: FZ[2] };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_HEAD).replace('#include <map_fragment>', '#include <map_fragment>\n' + GLSL[kind]);
  };
  m.customProgramCacheKey = () => 'design-' + kind;
  return m;
}
// мебель: классы по габаритам, новые материалы
const DM = {};
function dmat(key, o) { return DM[key] || (DM[key] = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, envMapIntensity: 0.6, flatShading: true, side: THREE.DoubleSide, ...o })); }
const LIN = h => new THREE.Color(h);
function furnClass(geo) {
  geo.computeBoundingBox(); const s = new THREE.Vector3(); geo.boundingBox.getSize(s); const [a, b, c] = [s.x, s.y, s.z].sort((p, q) => p - q);
  const near = (x, v, e = 0.04) => Math.abs(x - v) < e;
  if (near(a, 0.4) && (near(c, 0.75, 0.06) || near(c, 0.8, 0.05)) && b < 0.45) return 'chair';
  if (near(a, 0.6) && near(b, 0.7) && near(c, 0.72)) return 'pcdesk';
  if (near(a, 0.6) && near(b, 0.72) && near(c, 1.2)) return 'pcdesk';
  if (near(a, 0.17, 0.03) && near(b, 0.37) && near(c, 0.5)) return 'monitor';
  if (near(a, 0.2) && near(b, 0.39) && near(c, 0.4)) return 'tower';
  if (a < 0.04 && near(b, 0.17) && near(c, 0.47)) return 'kbd';
  if (a < 0.04 && c < 0.13) return 'mouse';
  if (a < 0.13 && b > 0.9 && c > 1.9) return 'board';
  if (c > 1.9 && a > 0.35 && a < 0.65 && b > 0.75) return 'cabinet';
  if (near(a, 0.85, 0.05)) return 'bigtable';
  if (c > 0.88 && c < 1.4 && a > 0.45 && b > 0.55) return 'armchair';
  if (b > 0.55 && b < 0.8 && c >= 0.95 && c <= 2.05 && a < 0.7) return 'desk';
  return null;
}
function srgbOf(mat) { const c = mat.color.clone().convertLinearToSRGB(); return [c.r, c.g, c.b]; }
const isC = (s, t, e = 0.03) => Math.abs(s[0] - t[0]) < e && Math.abs(s[1] - t[1]) < e && Math.abs(s[2] - t[2]) < e;
function furnMat(cls, s, obj) {
  const beige = isC(s, [0.7, 0.64, 0.54]) || isC(s, [0.63, 0.62, 0.52]), grey = isC(s, [0.29, 0.28, 0.29]) || isC(s, [0.29, 0.29, 0.29]) || isC(s, [0.42, 0.42, 0.43]) || isC(s, [0.28, 0.26, 0.26]), black = isC(s, [0, 0, 0]) || isC(s, [0.1, 0.1, 0.1]) || isC(s, [0.05, 0.05, 0.04]), white = isC(s, [0.89, 0.89, 0.89]) || isC(s, [0.81, 0.81, 0.81]) || isC(s, [0.94, 0.94, 0.94]), brown = isC(s, [0.4, 0.2, 0]) || isC(s, [0.29, 0.12, 0.04]);
  const graphite = dmat('graphite', { color: LIN(0x2a2e35), roughness: 0.42, metalness: 0.55 });
  const whiteM = dmat('white', { color: LIN(0xf1f0ec), roughness: 0.5 });
  const oak = dmat('oak', { color: LIN(0xcfb08a), roughness: 0.55 });
  const walnut = dmat('walnut', { color: LIN(0x6e4a32), roughness: 0.5 });
  const blackG = dmat('blackG', { color: LIN(0x101114), roughness: 0.28, metalness: 0.2 });
  const alu = dmat('alu', { color: LIN(0xc9ced4), roughness: 0.35, metalness: 0.7 });
  if (cls === 'chair') return beige ? 'ACCENT' : black ? blackG : graphite;
  if (cls === 'pcdesk') return beige ? whiteM : graphite;
  if (cls === 'monitor' || cls === 'tower') return white ? dmat('dk2', { color: LIN(0x1c1f24), roughness: 0.35, metalness: 0.3 }) : blackG;
  if (cls === 'kbd') return white ? dmat('keys', { color: LIN(0x2b2e34), roughness: 0.5 }) : blackG;
  if (cls === 'mouse') return dmat('mouse', { color: LIN(0xe9e9e9), roughness: 0.3 });
  if (cls === 'board') return black ? dmat('smart', { color: LIN(0x0c1220), roughness: 0.15, metalness: 0.2, emissive: LIN(0x16325a), emissiveIntensity: 0.55 }) : white ? dmat('wb', { color: LIN(0xfbfbfb), roughness: 0.2 }) : alu;
  if (cls === 'cabinet') return beige ? whiteM : grey ? graphite : dmat('glassG', { color: LIN(0xdfe5ea), roughness: 0.2 });
  if (cls === 'bigtable') return oak;
  if (cls === 'armchair') return brown ? walnut : black ? blackG : 'ACCENT_D';
  if (cls === 'desk') return brown ? walnut : beige ? oak : white ? whiteM : graphite;
  return null;
}
const _m4 = new THREE.Matrix4(), _v3 = new THREE.Vector3();
function accentAt(obj, i) { if (obj.isInstancedMesh) obj.getMatrixAt(i, _m4); else _m4.identity(); _m4.premultiply(obj.matrixWorld); _v3.setFromMatrixPosition(_m4); const r = ROOMS[roomAt(2, _v3.x, -_v3.z)]; return roomAccent(r && r.kind !== 'corridor' ? r : null); }
function designFloor3() {
  designTex();
  // стены, пол, потолок
  const cache = new Map();
  const wallKeys = /STUKATURKA|KRASKA_-_PESOCNO|KRASKA_-_SVETLO/;
  storeyG[2].children.forEach(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.material || o.material.transparent) return;
    const key = o.material.name || ''; let kind = null;
    if (/PEREKR/.test(o.userData.m ? '' : '') ) kind = null;
    if (o.userData.t === 'IfcSlab' && /KRASKA_-_ZOLOTISTO|BETON/.test(key)) kind = 'floor';
    else if (o.userData.t === 'IfcWall' && wallKeys.test(key)) kind = 'wall';
    else if (o.userData.t === 'IfcWall' && /DEREVO_-_SOSNA/.test(key)) { const ck = 'frames'; if (!cache.has(ck)) { const m = o.material.clone(); m.map = null; m.color = LIN(0xeeeeea); m.roughness = 0.45; cache.set(ck, m); } o.material = cache.get(ck); return; }
    if (!kind) return;
    const ck = key + kind; if (!cache.has(ck)) cache.set(ck, designMat(o.material, kind)); o.material = cache.get(ck);
  });
  if (storeyG[3]) storeyG[3].children.forEach(o => { if (!o.isMesh || o.isInstancedMesh || !o.material || o.material.transparent) return; if (o.userData.t !== 'IfcSlab') return; const ck = (o.material.name || '') + 'ceil'; if (!cache.has(ck)) cache.set(ck, designMat(o.material, 'ceil')); o.material = cache.get(ck); });
  // стекло 3 этажа: своё, чтобы светилось сильнее остальных
  const gcache = new Map(); W.glass.forEach(o => { if (o.userData.s !== 2) return; const k = o.material.uuid; if (!gcache.has(k)) gcache.set(k, o.material.clone()); o.material = gcache.get(k); });
  // мебель
  const accM = dmat('accent', { color: new THREE.Color(1, 1, 1), roughness: 0.42 }), accD = dmat('accentD', { color: new THREE.Color(1, 1, 1), roughness: 0.8 });
  const stats = {};
  storeyG[2].children.forEach(o => {
    if (!o.material || !(o.userData.t === 'IfcFurnishingElement' || o.userData.t === 'IfcBuildingElementProxy')) return;
    const cls = furnClass(o.geometry); if (!cls) return; stats[cls] = (stats[cls] || 0) + 1;
    const sc = srgbOf(o.material); o.userData.dbg = [cls, sc.map(x => +x.toFixed(2)), o.isInstancedMesh ? o.count : 1];
    const nm = furnMat(cls, sc, o); o.userData.dbg.push(nm === 'ACCENT' || nm === 'ACCENT_D' ? nm : nm ? Object.keys(DM).find(k => DM[k] === nm) : null); if (!nm) return;
    if (nm === 'ACCENT' || nm === 'ACCENT_D') {
      const dark = nm === 'ACCENT_D';
      if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { const c = LIN(accentAt(o, i)); if (dark) c.multiplyScalar(0.55); o.setColorAt(i, c); } o.instanceColor.needsUpdate = true; o.material = dark ? accD : accM; }
      else { const c = LIN(accentAt(o, 0)); if (dark) c.multiplyScalar(0.55); o.material = (dark ? accD : accM).clone(); o.material.color = c; o.material.needsUpdate = true; }
    } else o.material = nm;
  });
  ceilingLights();
  return stats;
}
// светильники-панели под потолком
let LAMPS = null;
function ceilingLights() {
  const ray = new THREE.Raycaster(); const up = new THREE.Vector3(0, 1, 0); const targets = (storeyG[3] ? storeyG[3].children : []).filter(o => o.isMesh);
  const pts = [];
  ROOMS.filter(r => r.f === 2 && r.kind !== 'wc').forEach(r => {
    const c = cellsOf(2, r.id); if (!c.length) return; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let k = 0; k < c.length; k += 2) { const x = wx(c[k]), y = wy(c[k + 1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const step = r.kind === 'corridor' ? 3.0 : 2.1; const lx = x1 - x0, ly = y1 - y0; const rot = r.kind === 'corridor' && ly > lx;
    for (let x = x0 + ((lx % step) / 2 || step / 2); x <= x1; x += step) for (let y = y0 + ((ly % step) / 2 || step / 2); y <= y1; y += step) {
      let ok = true; for (const [ox, oy] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) if (roomAt(2, x + ox, y + oy) !== r.id) ok = false;
      if (ok) pts.push([x, y, rot]);
    }
  });
  let hy = FZ[2] + 3.0;
  if (targets.length && pts.length) { const hits = []; for (let k = 0; k < Math.min(12, pts.length); k++) { const p = pts[Math.floor(k * pts.length / 12)]; ray.set(new THREE.Vector3(p[0], FZ[2] + 1.5, -p[1]), up); const h = ray.intersectObjects(targets, false)[0]; if (h && h.point.y < FZ[2] + 4.2) hits.push(h.point.y); } if (hits.length) { hits.sort((a, b) => a - b); hy = hits[Math.floor(hits.length / 2)] - 0.03; } }
  const geo = new THREE.PlaneGeometry(0.6, 1.2); geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
  LAMPS = new THREE.InstancedMesh(geo, mat, pts.length); const m4 = new THREE.Matrix4();
  pts.forEach((p, i) => { m4.makeRotationY(p[2] ? 0 : Math.PI / 2).setPosition(p[0], hy, -p[1]); LAMPS.setMatrixAt(i, m4); });
  LAMPS.frustumCulled = false; scene.add(LAMPS); LAMPS.userData.n = pts.length; LAMPS.userData.y = hy;
}
function lampsFrame() {
  if (!LAMPS) return; LAMPS.visible = floorVis(2) && !explode;
  const on = simT > 420 && simT < 1290 && !holiday() && !(EV.cur && EV.cur.type === 'power') && PERIOD() !== 'vacation';
  LAMPS.material.color.setScalar(on ? 1 : 0.35);
}

// ================= пасхалки =================
// 1) набери на клавиатуре «самса» — во дворе пойдёт дождь из самсы
// 2) нажми на флаг 5 раз подряд — салют над корпусом
// 3) ночью по коридору 3 этажа гуляет кот ИНИТ
let eggBuf = ''; const EGG = { samsa: null, fw: null, flagN: 0, flagT: 0 };
addEventListener('keydown', e => { const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return; if (!e.key || e.key.length !== 1) return; eggBuf = (eggBuf + e.key.toLowerCase()).slice(-8); if (eggBuf.endsWith('самса') || eggBuf.endsWith('samsa')) { eggBuf = ''; samsaRain(); } });
function samsaRain() {
  if (EGG.samsa) return; const N = 260;
  const g = new THREE.TetrahedronGeometry(0.16); g.scale(1.2, 0.55, 1);
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: LIN(0xd9963f), roughness: 0.55 }), N); mesh.castShadow = true; mesh.frustumCulled = false;
  const P = []; for (let i = 0; i < N; i++) P.push({ x: PLAZA.x + rr(-16, 16), y: PLAZA.y + rr(-16, 16), z: rr(8, 30), v: rr(2, 4), r: rr(0, 6), land: -1 });
  scene.add(mesh); EGG.samsa = { mesh, P, t: 0 };
  toast('🥟 Самса с неба!'); news('🥟 Над двором ИНИТ пошёл дождь из самсы', true);
  NPCS.forEach(n => { if (n.spawned && n.f === 3 && chance(0.5)) { say(n, pick(['Самса с неба! 🥟', 'Ловите!', 'Это чудо!', 'Бесплатный обед 😂']), 3.5); n.evMood = '🥟'; n.evMoodT = simT + 3; } });
}
function fireworks() {
  if (EGG.fw) return; const B = 7, K = 140, N = B * K; const pos = new Float32Array(N * 3), col = new Float32Array(N * 3); const V = [];
  const pal = [0xff4d4d, 0xffd24a, 0x4dd2ff, 0x7dff6a, 0xff7ad9, 0xffffff].map(c => new THREE.Color(c));
  for (let b = 0; b < B; b++) { const cxp = rr(-20, 28), cyp = rr(-18, 20), cz = rr(22, 34), c = pick(pal), t0 = b * 0.55; for (let k = 0; k < K; k++) { const i = b * K + k; const th = rr(0, Math.PI * 2), ph = Math.acos(rr(-1, 1)), sp = rr(5, 8); V.push({ x: cxp, y: cz, z: -cyp, vx: Math.sin(ph) * Math.cos(th) * sp, vy: Math.cos(ph) * sp, vz: Math.sin(ph) * Math.sin(th) * sp, t0 }); col.set([c.r, c.g, c.b], i * 3); pos.set([cxp, -100, -cyp], i * 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 1, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; scene.add(pts);
  EGG.fw = { pts, V, t: 0, boom: new Array(B).fill(false), B, K }; toast('🎆 Салют над корпусом!'); news('🎆 Над корпусом ИНИТ салют!', true);
  NPCS.forEach(n => { if (n.spawned && n.f === 3 && chance(0.5)) { n.evMood = '🎆'; n.evMoodT = simT + 4; if (chance(0.4)) say(n, pick(['Ура-а-а! 🎆', 'Вау, салют!', 'Красота!', 'Сфоткай!']), 3); } });
}
function eggFrame(dt) {
  const S = EGG.samsa;
  if (S) { S.t += dt; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    S.P.forEach((p, i) => { if (p.z > OUTZ + 0.08) { p.z -= p.v * dt; p.r += dt * 4; } else p.z = OUTZ + 0.08; const fade = S.t > 14 ? Math.max(0, 1 - (S.t - 14) / 3) : 1; e.set(p.z > OUTZ + 0.1 ? p.r : 0, p.r * 0.7, 0); q.setFromEuler(e); sc.setScalar(fade); m4.compose(v.set(p.x, p.z, -p.y), q, sc); S.mesh.setMatrixAt(i, m4); });
    S.mesh.instanceMatrix.needsUpdate = true; if (S.t > 17) { scene.remove(S.mesh); S.mesh.geometry.dispose(); EGG.samsa = null; } }
  const F = EGG.fw;
  if (F) { F.t += dt; const a = F.pts.geometry.attributes.position.array;
    for (let b = 0; b < F.B; b++) { const lt = F.t - b * 0.55; if (lt > 0 && !F.boom[b]) { F.boom[b] = true; if (SND.on && SND.C) { const C = SND.C, s = C.createBufferSource(); s.buffer = SND.noise; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; const g = C.createGain(); const t = C.currentTime; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); s.connect(lp).connect(g).connect(SND.master); s.start(t, 0, 0.9); } }
      for (let k = 0; k < F.K; k++) { const i = b * F.K + k, p = F.V[i]; if (lt <= 0) continue; a[i * 3] = p.x + p.vx * lt; a[i * 3 + 1] = p.y + p.vy * lt - 4.9 * lt * lt * 0.35; a[i * 3 + 2] = p.z + p.vz * lt; } }
    F.pts.geometry.attributes.position.needsUpdate = true; F.pts.material.opacity = Math.max(0, 1 - Math.max(0, F.t - 3.2) / 2.2); if (F.t > 6) { scene.remove(F.pts); F.pts.geometry.dispose(); EGG.fw = null; } }
  catFrame(dt);
}
renderer.domElement.addEventListener('pointerup', e => {
  if (!W.flag) return; const r = renderer.domElement.getBoundingClientRect(); const m = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(m, camera); if (!rc.intersectObject(W.flag, false).length) return;
  const now = performance.now(); if (now - EGG.flagT > 4000) EGG.flagN = 0; EGG.flagT = now; EGG.flagN++; if (EGG.flagN >= 5) { EGG.flagN = 0; fireworks(); }
});
// кот ИНИТ
const CAT = { g: null, path: null, pi: 0, x: 0, y: 0, a: 0, wait: 0, ph: 0 };
function buildCat() {
  const g = new THREE.Group(); const fur = new THREE.MeshStandardMaterial({ color: LIN(0xd9893a), roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: LIN(0x6b3f1d), roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.26, 4, 8), fur); body.rotation.z = Math.PI / 2; body.position.y = 0.2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), fur); head.position.set(0.22, 0.29, 0); g.add(head);
  [-1, 1].forEach(s => { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), dark); ear.position.set(0.23, 0.37, s * 0.045); g.add(ear); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0x9be36b })); eye.position.set(0.295, 0.305, s * 0.035); g.add(eye); });
  const legs = []; [[0.12, 1], [0.12, -1], [-0.12, 1], [-0.12, -1]].forEach(([x, s]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.16, 6), fur); l.position.set(x, 0.08, s * 0.05); g.add(l); legs.push(l); });
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.3, 6), dark); tail.position.set(-0.26, 0.32, 0); tail.rotation.z = 0.6; g.add(tail);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.visible = false; scene.add(g); CAT.g = g; CAT.legs = legs; CAT.tail = tail;
  const s = corridorSpotNear(2, 0, 0, 40); if (s) { CAT.x = s.x; CAT.y = s.y; }
}
function catFrame(dt) {
  if (!CAT.g) return; const night = simT < 420 || simT > 1270 || holiday();
  CAT.g.visible = night && floorVis(2) && showPeople && !explode;
  if (!CAT.g.visible) return;
  const sp = 0.55 * Math.min(simSpeed || 1, 3);
  if (CAT.wait > 0) { CAT.wait -= dt; CAT.tail.rotation.x = Math.sin(performance.now() / 300) * 0.4; }
  else if (!CAT.path || CAT.pi >= CAT.path.length) { const t = corridorSpotNear(2, rr(-20, 22), rr(-24, 22), 30); CAT.path = t ? floorPath(2, CAT.x, CAT.y, t.x, t.y) : null; CAT.pi = 0; CAT.wait = rr(2, 6); }
  else { const p = CAT.path[CAT.pi]; const dx = p.x - CAT.x, dy = p.y - CAT.y, d = Math.hypot(dx, dy); if (d < sp * dt) { CAT.x = p.x; CAT.y = p.y; CAT.pi++; } else { CAT.x += dx / d * sp * dt; CAT.y += dy / d * sp * dt; CAT.a = lerpAng(CAT.a, Math.atan2(dy, dx), Math.min(1, dt * 6)); } CAT.ph += dt * 10; CAT.legs.forEach((l, i) => l.rotation.z = Math.sin(CAT.ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.45); }
  CAT.g.position.set(CAT.x, FZ[2] + floorYOff(2), -CAT.y); CAT.g.rotation.y = CAT.a;
}
// подключение
const _evInit0 = evInit; evInit = () => { _evInit0(); try { const st = designFloor3(); console.log('design', JSON.stringify(st)); } catch (e) { console.error('design', e); } buildCat(); };
const _simFrame1 = simFrame; simFrame = () => { const now = performance.now(); const dt = Math.min(0.1, (now - (eggFrame._t || now)) / 1000); eggFrame._t = now; _simFrame1(); lampsFrame(); eggFrame(dt); };
