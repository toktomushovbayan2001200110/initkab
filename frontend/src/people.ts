// ================= ЛЮДИ: реалистичные фигуры (instancing) =================
// Локальные оси тела: y — вверх, z — вперёд (лицо), x — вправо.
function loft(rings, seg = 14) {
  // rings: [y, rx, rz, zo] снизу вверх; торцы закрыты
  const pos = [], idx = [], R = rings.length;
  rings.forEach(([y, rx, rz, zo = 0]) => { for (let s = 0; s < seg; s++) { const a = s / seg * Math.PI * 2; pos.push(Math.sin(a) * rx, y, Math.cos(a) * rz + zo); } });
  for (let r = 0; r < R - 1; r++) for (let s = 0; s < seg; s++) { const a = r * seg + s, b = r * seg + (s + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, d, a, d, c); }
  const cb = pos.length / 3; pos.push(0, rings[0][0], rings[0][3] || 0); const ct = cb + 1; pos.push(0, rings[R - 1][0], rings[R - 1][3] || 0);
  for (let s = 0; s < seg; s++) { idx.push(cb, (s + 1) % seg, s); idx.push(ct, (R - 1) * seg + s, (R - 1) * seg + (s + 1) % seg); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}
const plain = g => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); if (!n.attributes.normal) n.computeVertexNormals(); return n; };
const mergeG = list => BGU.mergeBufferGeometries(list.map(plain));
// конечность, висящая вниз от сустава (0 … −L)
function limb(L, r0, r1, mid?) {
  const rings = [[-L - r1 * 0.55, r1 * 0.45, r1 * 0.45], [-L - r1 * 0.2, r1 * 0.9, r1 * 0.9], [-L, r1, r1]];
  if (mid) rings.push([-L * mid[0], mid[1], mid[1], mid[2] || 0]);
  rings.push([0, r0, r0], [r0 * 0.5, r0 * 0.85, r0 * 0.85], [r0 * 0.85, r0 * 0.4, r0 * 0.4]);
  return loft(rings, 10);
}
const TORSO_M = [[-0.13, 0.150, 0.104], [-0.115, 0.170, 0.120], [0.0, 0.166, 0.116], [0.12, 0.150, 0.104], [0.22, 0.150, 0.100], [0.34, 0.172, 0.112, 0.004], [0.44, 0.190, 0.118, 0.006], [0.50, 0.186, 0.108, 0.002], [0.545, 0.135, 0.088], [0.575, 0.062, 0.060], [0.59, 0.045, 0.045]];
const TORSO_F = [[-0.13, 0.150, 0.104], [-0.115, 0.172, 0.120], [0.0, 0.168, 0.116], [0.12, 0.138, 0.098], [0.22, 0.128, 0.090], [0.34, 0.150, 0.110, 0.012], [0.42, 0.162, 0.116, 0.014], [0.50, 0.160, 0.098, 0.002], [0.545, 0.118, 0.080], [0.575, 0.055, 0.054], [0.59, 0.040, 0.040]];
function torsoAt(R, y) { for (let i = 0; i < R.length - 1; i++) if (y <= R[i + 1][0]) { const a = R[i], b = R[i + 1], t = (y - a[0]) / (b[0] - a[0]); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * t]; } const l = R[R.length - 1]; return [l[1], l[2], l[3] || 0]; }
// полоса по поверхности торса (вырез рубашки, галстук, молния)
function chestStrip(R, y0, y1, w0, w1, off, steps = 10) {
  const pos = [], idx = [];
  for (let k = 0; k <= steps; k++) { const y = y0 + (y1 - y0) * k / steps; const [rx, rz, zo] = torsoAt(R, y); const w = w0 + (w1 - w0) * k / steps; for (const s of [-1, 0, 1]) { const a = s * w; pos.push(Math.sin(a) * (rx + off), y, Math.cos(a) * (rz + off) + zo); } }
  for (let k = 0; k < steps; k++) { const a = k * 3; idx.push(a, a + 1, a + 4, a, a + 4, a + 3, a + 1, a + 2, a + 5, a + 1, a + 5, a + 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// форма головы: овал с сужением к подбородку
const HR = 0.105;
function headShape(x, y, z) { const t = y < 0 ? -y / HR : 0; const sx = 0.9 * (1 - 0.26 * t * t - 0.07 * t); const sz = z > 0 ? 1 - 0.1 * t : 1 - 0.2 * t; return [x * sx, y * 1.09, z * sz]; }
function headZ(x, y) { const Y = y / 1.09, t = Y < 0 ? -Y / HR : 0, sx = 0.9 * (1 - 0.26 * t * t - 0.07 * t); const X = x / sx; return Math.sqrt(Math.max(0, HR * HR - X * X - Y * Y)) * (1 - 0.1 * t); }
function headGeo(scale: number | number[] = 1, keep?) {
  const s = new THREE.SphereGeometry(HR, 18, 13); const p = s.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = headShape(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, v[0], v[1], v[2]); }
  if (!keep) { s.computeVertexNormals(); return s; }
  const n = s.toNonIndexed(), q = n.attributes.position, out = [];
  for (let i = 0; i < q.count; i += 3) {
    if (keep.lim) {   // ровная линия роста волос: вершины ниже линии подтягиваем к ней
      const v = [0, 1, 2].map(k => [q.getX(i + k), q.getY(i + k), q.getZ(i + k)]); const lm = v.map(p => keep.lim(p[0], p[2])); const below = v.map((p, k) => p[1] < lm[k]);
      if (below[0] && below[1] && below[2]) continue;
      v.forEach((p, k) => { const y = below[k] ? lm[k] : p[1]; out.push(p[0] * scale[0], y * scale[1] + (scale[3] || 0), p[2] * scale[2] + (scale[4] || 0)); });
      continue;
    }
    const c = [0, 0, 0]; for (let k = 0; k < 3; k++) { c[0] += q.getX(i + k) / 3; c[1] += q.getY(i + k) / 3; c[2] += q.getZ(i + k) / 3; } if (keep(c[0], c[1], c[2])) for (let k = 0; k < 3; k++) out.push(q.getX(i + k) * scale[0], q.getY(i + k) * scale[1] + (scale[3] || 0), q.getZ(i + k) * scale[2] + (scale[4] || 0)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.computeVertexNormals(); return g;
}
// линия роста волос: спереди / сбоку / сзади
const hairline = (lf, ls, lb, side = 0) => { const lim = (x, z) => { const phi = Math.atan2(Math.abs(x), z); return (phi < 1.15 ? lf + (ls - lf) * (phi / 1.15) ** 2 : ls + (lb - ls) * ((phi - 1.15) / (Math.PI - 1.15))) + side * x; }; const f = (x, y, z) => y > lim(x, z); f.lim = lim; return f; };
function backHair(len, a0, a1, rTop, rBot, flare = 0.12) {
  const pos = [], idx = [], SA = 10, SY = 7;
  for (let j = 0; j <= SY; j++) { const t = j / SY, y = 0.05 - len * t; const r = rTop + (rBot - rTop) * t; const zo = -0.012 - Math.max(0, t - 0.25) * flare * len; for (let i = 0; i <= SA; i++) { const a = a0 + (a1 - a0) * i / SA; pos.push(Math.sin(a) * r * 0.92, y, Math.cos(a) * r + zo); } }
  for (let j = 0; j < SY; j++) for (let i = 0; i < SA; i++) { const a = j * (SA + 1) + i, b = a + 1, c = a + SA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const PARTS1 = [], PARTS2 = [];
const HAIR_PARTS = ['hShort', 'hFringe', 'hTop', 'hBuzz', 'hSide', 'hLong', 'hPony', 'hBun', 'hBob', 'hBraid', 'hijab'];
const HAIR_OF = { short: 'hShort', fringe: 'hFringe', top: 'hTop', buzz: 'hBuzz', side: 'hSide', long: 'hLong', pony: 'hPony', bun: 'hBun', bob: 'hBob', braid: 'hBraid', hijab: 'hijab' };
const COAT = [0x1d2230, 0x2b2b2b, 0x3a4a3a, 0x5a3b2e, 0x6b6f76, 0x23395d, 0x7a1f2b, 0xc9b9a0, 0x111111, 0x3c5a73].map(c => new THREE.Color(c));
const BEANIE = [0x1b1b1b, 0x7a1f2b, 0x23395d, 0xd8d2c4, 0x3f6b3a, 0x6b6f76, 0xc46a3a].map(c => new THREE.Color(c));
const DENIM = [0x34507a, 0x4a6a96, 0x26344f, 0x6f8fb5].map(c => new THREE.Color(c));
const HOODIE = [0x1c1c1e, 0x6d7278, 0xdcd8d0, 0x26344f, 0x5c6b4f, 0x7a2f3a, 0xb7a58c, 0x3f4a66, 0x8e9aa6, 0xc9a45c].map(c => new THREE.Color(c));
const PASTEL = [0xe7d3d0, 0xd7e0ea, 0xe9e2cf, 0xcfe0d4, 0xdccfe6, 0xf1ece4, 0xc9b3a0, 0xb9485a, 0x2c3a55].map(c => new THREE.Color(c));
const TIE = [0x7a1f2b, 0x1f3358, 0x2d2d33, 0x3d5a40, 0x5b4636].map(c => new THREE.Color(c));
const WHITE = new THREE.Color(1, 1, 1);
let COLD = true;

function styleNPC(n) {
  if (n.styled) return; n.styled = true;
  const stu = n.role === 'student' || n.role === 'gym' || n.role === 'kid' || n.role === 'applicant', m = n.g === 'm';
  const formal = n.role === 'teacher' || n.role === 'dean' || n.role === 'inspector';
  if (m && n.hair === 'short') n.hair = formal ? pick(['short', 'short', 'side', 'buzz']) : pick(['short', 'fringe', 'fringe', 'top', 'top', 'buzz', 'side']);
  if (!m && n.hair === 'long' && chance(0.25)) n.hair = 'braid';
  n.sh = m ? rr(0.96, 1.06) : rr(0.82, 0.9);                 // ширина плеч
  n.hipW = m ? 1 : rr(1.02, 1.1);
  n.fit = formal ? (m ? (chance(0.75) ? 'jacket' : 'shirt') : pick(['jacket', 'blouse', 'blouse', 'cardigan']))
    : n.role === 'it' ? 'hoodie' : n.role === 'worker' ? 'long' : n.role === 'guard' ? 'jacket'
    : stu ? (m ? pick(['hoodie', 'hoodie', 'hoodie', 'long', 'long', 'tee', 'shirt', 'jacket']) : pick(['hoodie', 'hoodie', 'long', 'long', 'blouse', 'blouse', 'cardigan', 'tee'])) : pick(['shirt', 'long', 'cardigan']);
  if (stu && n.cTop0 === undefined) { if (n.fit === 'hoodie') n.cTop = pick(HOODIE); else if (!m && chance(0.6)) n.cTop = pick(PASTEL); if (!n.skirt && chance(0.55)) n.cPants = pick(DENIM); }
  if (n.fit === 'shirt') { n.cShirt = new THREE.Color(pick([0xf2f2f0, 0xdfe6ee, 0xcfdcec, 0xeae3d6, 0xd9c9c9])); }
  if (n.fit === 'blouse') n.cShirt = new THREE.Color(pick([0xf4f1ea, 0xe6dccd, 0xd9e2ec, 0xe8cfd2, 0xcfd8c8]));
  n.cInner = n.fit === 'jacket' || n.fit === 'cardigan' ? (n.cShirt && !n.cShirt.equals(n.cTop) ? n.cShirt : new THREE.Color(pick([0xf2f2f0, 0xdfe6ee, 0xe9e2d2, 0x22252b]))) : null;
  n.tie = m && n.fit === 'jacket' && formal && chance(0.6) ? pick(TIE) : null;
  if (n.hair === 'hijab') { n.skirt = true; n.skL = rr(0.74, 0.8); n.cHijab = new THREE.Color(pick([0xece6dc, 0x2b2b3a, 0x7a4b5e, 0x3c5a73, 0xbfa58a, 0x8b9a8c, 0xd8c2c2])); if (n.fit === 'tee') n.fit = 'long'; }
  else n.skL = n.skirt ? (formal ? rr(0.5, 0.62) : pick([rr(0.4, 0.46), rr(0.5, 0.6), rr(0.7, 0.78)])) : 0;
  n.tights = n.skirt ? (chance(0.55) ? new THREE.Color(pick([0x1d1b1c, 0x2a2522, 0x3a3230])) : null) : null;
  n.cSole = n.cShoes.r > 0.8 ? new THREE.Color(0xdddddd) : (stu && chance(0.6) ? new THREE.Color(0xf0f0ee) : new THREE.Color(0x1a1a1a));
  if (stu && chance(0.55)) n.cShoes = new THREE.Color(pick([0xf2f2f0, 0x1a1a1a, 0x2c3e50, 0x8a8f96, 0xb23b3b, 0xd8d2c4]));
  n.bagKind = n.bag ? (m || chance(0.55) ? 'pack' : 'tote') : (formal && chance(0.5) ? 'folder' : null);
  n.cCoat = pick(COAT); n.coatHas = n.role !== 'ded' && n.role !== 'snow' && n.role !== 'worker';
  n.beanie = n.hair !== 'hijab' && chance(m ? 0.45 : 0.35) ? pick(BEANIE) : null;
  n.scarf = chance(0.4) ? pick(BEANIE) : null;
  n.stub = m && n.hair !== 'buzz' && ((formal && chance(0.3)) || (n.role === 'it' && chance(0.6)) || (stu && n.role !== 'kid' && chance(0.08)));
  n.lip = !m && chance(0.5);
  n.gait = rr(0.85, 1.15); n.armSw = m ? rr(0.8, 1.15) : rr(0.6, 0.95); n.seed = rr(0, 100); n.sitV = rr(-0.25, 0.25);
  n.blinkAt = 0; n.J = null;
}

let PEOPLE_N = 0, COLOR_DIRTY = false;
const PMAP = {};
const USES = {
  glasses: n => n.glasses, stub: n => n.stub, torsoM: n => n.g !== 'f', torsoF: n => n.g === 'f', veeM: n => n.cInner && n.g !== 'f', veeF: n => n.cInner && n.g === 'f', tie: n => n.tie,
  skirt: n => n.skirt, bag: n => n.bagKind === 'pack', tote: n => n.bagKind === 'tote', folder: n => n.bagKind === 'folder', beanie: n => n.beanie && n.coatHas, scarf: n => n.scarf && n.coatHas,
  hood: n => n.fit === 'hoodie' || (n.coatHas && !n.beanie && n.hair !== 'hijab'),
};
['short', 'fringe', 'top', 'buzz', 'side', 'long', 'pony', 'bun', 'bob', 'braid', 'hijab'].forEach(h => { USES[HAIR_OF[h]] = n => (HAIR_OF[n.hair] || (n.hair === 'bald' ? null : 'hShort')) === HAIR_OF[h]; });
const SHADOW_PARTS = new Set(['head', 'torsoM', 'torsoF', 'pelvis', 'thigh', 'shin', 'uarm', 'farm', 'skirt', 'bag', 'hLong', 'hijab']);
function buildBodies() {
  const N = PEOPLE_N = NPCS.length;
  NPCS.forEach(styleNPC);
  const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.62 });
  const clothMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide });
  const shoeMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const P = (name, geo, cnt, mat, shadow = true) => {
    let real = cnt;
    if (USES[name]) { const mp = PMAP[name] = new Int32Array(N).fill(-1); let k = 0; NPCS.forEach((n, i) => { if (USES[name](n)) mp[i] = k++; }); real = Math.max(1, k); }
    const m = mkPart(name, geo, real, { mat, shadow: shadow && SHADOW_PARTS.has(name) }); people.add(m); (cnt === N ? PARTS1 : PARTS2).push(name); for (let i = 0; i < real; i++) { m.setColorAt(i, WHITE); m.setMatrixAt(i, ZERO); } return m; };
  // --- голова и лицо ---
  P('head', headGeo(), N, skinMat);
  P('neck', new THREE.CylinderGeometry(0.043, 0.05, 0.11, 10), N, skinMat);
  const ez = headZ(0.033, 0.012), nz = headZ(0, -0.014), mz = headZ(0, -0.05), bz = headZ(0.034, 0.036);
  const el = (rx, ry, rz, x, y, z, seg = 8) => { const g = new THREE.SphereGeometry(1, seg, 6); g.scale(rx, ry, rz); g.translate(x, y, z); return g; };
  P('eyeW', mergeG([-1, 1].map(s => el(0.0165, 0.0092, 0.006, s * 0.033, 0.012, ez - 0.003))), N, new THREE.MeshStandardMaterial({ color: 0xf3efe9, roughness: 0.35 }), false);
  P('eyes', mergeG([-1, 1].map(s => el(0.0074, 0.0074, 0.004, s * 0.033, 0.0115, ez + 0.0015))), N, new THREE.MeshStandardMaterial({ color: 0x1c130d, roughness: 0.2 }), false);
  P('lids', mergeG([-1, 1].map(s => el(0.019, 0.0115, 0.0085, s * 0.033, 0.0125, ez - 0.002))), N, skinMat, false);
  P('brows', mergeG([-1, 1].map(s => { const b = new THREE.BoxGeometry(0.03, 0.0058, 0.008); b.rotateZ(-s * 0.1); b.translate(s * 0.034, 0.0345, bz - 0.001); return b; })), N, hairMat, false);
  P('face', mergeG([el(0.0105, 0.021, 0.014, 0, -0.012, nz - 0.002), el(0.0125, 0.0085, 0.01, 0, -0.024, nz + 0.001), ...[-1, 1].map(s => el(0.008, 0.021, 0.014, s * 0.0945, 0.002, -0.004))]), N, skinMat, false);
  P('mouth', mergeG([el(0.019, 0.0048, 0.005, 0, -0.049, mz - 0.001), el(0.014, 0.0052, 0.005, 0, -0.0555, mz - 0.003)]), N, new THREE.MeshStandardMaterial({ roughness: 0.55 }), false);
  P('glasses', mergeG([-1, 1].map(s => { const e = new THREE.TorusGeometry(0.02, 0.0028, 4, 12); e.scale(1.1, 0.9, 1); e.translate(s * 0.034, 0.012, ez + 0.012); return e as THREE.BufferGeometry; }).concat([(() => { const b = new THREE.BoxGeometry(0.026, 0.004, 0.004); b.translate(0, 0.016, ez + 0.012); return b; })(), ...[-1, 1].map(s => { const b = new THREE.BoxGeometry(0.003, 0.004, 0.09); b.translate(s * 0.058, 0.014, ez - 0.035); return b; })])), N, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.35, metalness: 0.4 }), false);
  P('stub', headGeo([1.035, 1.03, 1.05, -0.002, 0.002], (x, y, z) => y < -0.028 && z > -0.02 && !(Math.abs(x) < 0.022 && y > -0.062 && y < -0.04 && z > 0.05)), N, hairMat, false);
  // --- причёски ---
  const capG = (sc, lf, ls, lb, side?) => headGeo(sc, hairline(lf, ls, lb, side));
  const S0 = [1.075, 1.07, 1.085, 0.004, -0.003];
  P('hShort', capG(S0, 0.066, 0.004, -0.062), N, hairMat);
  P('hFringe', mergeG([capG([1.08, 1.075, 1.1, 0.005, -0.002], 0.042, 0.0, -0.068), (() => { const b = el(0.085, 0.022, 0.03, 0, 0.062, headZ(0, 0.06) + 0.004, 10); return b; })()]), N, hairMat);
  P('hTop', mergeG([capG([1.07, 1.07, 1.08, 0.004, -0.003], 0.07, 0.03, -0.045), el(0.082, 0.045, 0.098, 0, 0.098, 0.012, 12)]), N, hairMat);
  P('hBuzz', capG([1.03, 1.03, 1.035, 0.002, -0.001], 0.07, 0.012, -0.055), N, hairMat);
  P('hSide', mergeG([capG(S0, 0.058, 0.0, -0.064, 0.22), el(0.07, 0.03, 0.05, -0.03, 0.09, 0.05, 10)]), N, hairMat);
  const fem = capG([1.085, 1.08, 1.1, 0.005, -0.004], 0.062, -0.05, -0.085);
  P('hLong', mergeG([fem.clone(), backHair(0.36, Math.PI * 0.52, Math.PI * 1.48, 0.122, 0.105, 0.16)]), N, hairMat);
  P('hPony', mergeG([fem.clone(), (() => { const t = loft([[-0.25, 0.006, 0.006], [-0.2, 0.017, 0.015], [-0.08, 0.023, 0.021], [0.0, 0.022, 0.022], [0.02, 0.01, 0.01]], 8); t.rotateX(0.3); t.translate(0, 0.05, -0.122); return t; })(), el(0.03, 0.03, 0.03, 0, 0.06, -0.118)]), N, hairMat);
  P('hBun', mergeG([fem.clone(), el(0.048, 0.045, 0.045, 0, 0.085, -0.105, 10)]), N, hairMat);
  P('hBob', mergeG([fem.clone(), backHair(0.15, Math.PI * 0.42, Math.PI * 1.58, 0.119, 0.11, 0.0)]), N, hairMat);
  P('hBraid', mergeG([fem.clone(), ...[0, 1, 2, 3, 4, 5].map(k => el(0.026 - k * 0.002, 0.036, 0.024, k % 2 ? 0.006 : -0.006, -0.04 - k * 0.055, -0.115 - Math.min(k, 3) * 0.012))]), N, hairMat);
  P('hijab', mergeG([headGeo([1.1, 1.09, 1.12, 0.004, -0.004], (x, y, z) => !(z > 0 && (x / 0.074) ** 2 + ((y + 0.012) / 0.082) ** 2 < 1)), loft([[-0.3, 0.2, 0.135], [-0.2, 0.175, 0.125], [-0.11, 0.105, 0.105], [-0.06, 0.09, 0.1]], 16)]), N, clothMat);
  P('beanie', mergeG([headGeo([1.15, 1.13, 1.16, 0.012, -0.004], (x, y, z) => y > 0.038 - z * 0.12), (() => { const t = new THREE.TorusGeometry(0.113, 0.014, 6, 18); t.rotateX(Math.PI / 2 - 0.12); t.scale(0.92, 1, 1.04); t.translate(0, 0.052, -0.004); return t; })()]), N, clothMat);
  P('scarf', loft([[-0.105, 0.085, 0.085], [-0.08, 0.1, 0.1], [-0.04, 0.1, 0.1], [-0.015, 0.082, 0.082]], 12), N, clothMat);
  P('hood', (() => { const h = loft([[0.47, 0.13, 0.05, -0.09], [0.53, 0.14, 0.07, -0.1], [0.6, 0.1, 0.06, -0.09], [0.63, 0.05, 0.03, -0.085]], 12); return h; })(), N, clothMat);
  // --- тело ---
  P('torsoM', loft(TORSO_M, 16), N, clothMat); P('torsoF', loft(TORSO_F, 16), N, clothMat);
  P('veeM', mergeG([chestStrip(TORSO_M, 0.2, 0.585, 0.0, 0.5, 0.006)]), N, clothMat, false);
  P('veeF', mergeG([chestStrip(TORSO_F, 0.24, 0.585, 0.0, 0.5, 0.006)]), N, clothMat, false);
  P('tie', mergeG([chestStrip(TORSO_M, 0.17, 0.53, 0.14, 0.09, 0.011, 6), chestStrip(TORSO_M, 0.52, 0.56, 0.16, 0.16, 0.014, 2)]), N, clothMat, false);
  P('pelvis', loft([[-0.13, 0.06, 0.05], [-0.1, 0.13, 0.095], [-0.03, 0.156, 0.108], [0.06, 0.152, 0.104], [0.09, 0.14, 0.098]], 14), N, clothMat);
  P('skirt', loft([[-1, 0.235, 0.2], [-0.5, 0.2, 0.165], [-0.06, 0.165, 0.118], [0.0, 0.15, 0.106]], 16), N, clothMat);
  P('thigh', limb(0.45, 0.079, 0.056), N * 2, clothMat); P('shin', limb(0.43, 0.054, 0.038, [0.3, 0.058, -0.006]), N * 2, clothMat);
  const shoe = (() => { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(0.052, 0.056, 0.135); g.translate(0, -0.01, 0.055); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i); const z = p.getZ(i); if (z > 0.08) y = -0.045 + (y + 0.045) * (1 - (z - 0.08) / 0.11 * 0.55); p.setY(i, Math.max(-0.045, y)); } g.computeVertexNormals(); return g; })();
  P('shoe', shoe, N * 2, shoeMat);
  P('sole', (() => { const g = new THREE.SphereGeometry(1, 12, 6); g.scale(0.055, 0.02, 0.14); g.translate(0, -0.052, 0.055); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.max(-0.066, Math.min(-0.04, p.getY(i)))); g.computeVertexNormals(); return g; })(), N * 2, shoeMat, false);
  P('uarm', limb(0.29, 0.054, 0.04), N * 2, clothMat); P('farm', limb(0.25, 0.041, 0.03), N * 2, clothMat);
  P('hand', mergeG([el(0.032, 0.05, 0.019, 0, -0.05, 0, 8), el(0.012, 0.024, 0.012, 0, -0.035, 0.024, 6)]), N * 2, skinMat);
  // --- вещи ---
  const rb = (w, h, d, r = 0.03) => { const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const c = v.clone().clamp(new THREE.Vector3(-w / 2 + r, -h / 2 + r, -d / 2 + r), new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r)); v.sub(c).setLength(r).add(c); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
  P('bag', mergeG([(() => { const b = rb(0.27, 0.38, 0.14, 0.05); b.translate(0, 0.33, -0.185); return b; })(), (() => { const b = rb(0.2, 0.14, 0.05, 0.02); b.translate(0, 0.25, -0.265); return b; })(), ...[-1, 1].map(s => { const b = new THREE.BoxGeometry(0.034, 0.34, 0.012); b.rotateX(-0.06); b.translate(s * 0.118, 0.37, 0.121); return b; })]), N, clothMat);
  P('tote', mergeG([(() => { const b = rb(0.07, 0.25, 0.3, 0.025); b.translate(0.215, 0.02, -0.01); return b; })(), (() => { const b = new THREE.BoxGeometry(0.012, 0.5, 0.03); b.rotateZ(-0.1); b.translate(0.2, 0.3, -0.01); return b; })()]), N, clothMat);
  P('folder', (() => { const b = new THREE.BoxGeometry(0.03, 0.31, 0.23); b.translate(0.0, -0.13, 0.04); return b; })(), N, clothMat);
  P('phone', new THREE.BoxGeometry(0.07, 0.14, 0.009), N, new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.3, emissive: 0x2a3d66, emissiveIntensity: 0.7 }), false);
  NPCS.forEach((n, i) => recolor(n, i));
  markColors();
}
function markColors() { Object.values(PART).forEach((m: any) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; }); COLOR_DIRTY = false; }
const _cc = new THREE.Color();
function recolor(n, i) {
  if (!PART.torsoM) return;
  const C = (part, k, c) => { const mp = PMAP[part]; if (mp) { k = mp[k]; if (k < 0) return; } PART[part].setColorAt(k, c); };
  const coat = n.coatOn && n.coatHas;
  const top = coat ? n.cCoat : n.cTop;
  const skin = n.cSkin, skinD = _cc.copy(n.cSkin).multiplyScalar(0.93).clone();
  C('head', i, skin); C('neck', i, skin); C('lids', i, skinD); C('face', i, skinD);
  C('torsoM', i, top); C('torsoF', i, top);
  C('pelvis', i, n.skirt ? (n.fit === 'jacket' || n.fit === 'cardigan' || coat ? n.cPants : top) : n.cPants);
  const inner = n.cInner || WHITE; C('veeM', i, inner); C('veeF', i, inner); C('tie', i, n.tie || WHITE);
  HAIR_PARTS.forEach(p => C(p, i, p === 'hijab' ? (n.cHijab || WHITE) : n.cHair));
  C('stub', i, _cc.copy(n.cHair).lerp(n.cSkin, 0.35).clone()); C('brows', i, _cc.copy(n.cHair).multiplyScalar(0.8).clone());
  C('mouth', i, _cc.copy(n.cSkin).lerp(new THREE.Color(n.lip ? 0xa33a45 : 0x8e4a44), n.lip ? 0.8 : 0.55).clone());
  C('skirt', i, n.hair === 'hijab' || n.fit === 'tee' || n.fit === 'long' && n.skL > 0.6 ? (n.skL > 0.6 ? _cc.copy(n.cPants).lerp(n.cTop, 0.15).clone() : n.cPants) : n.cPants);
  C('bag', i, n.cBag); C('tote', i, n.cBag); C('folder', i, n.cBag);
  C('beanie', i, n.beanie || WHITE); C('scarf', i, n.scarf || WHITE); C('hood', i, top);
  const legSkin = n.tights || _cc.copy(n.cSkin).multiplyScalar(0.95).clone();
  const longSk = n.skirt && n.skL > 0.68;
  for (let s = 0; s < 2; s++) {
    const k = i * 2 + s;
    C('thigh', k, n.skirt ? legSkin : n.cPants); C('shin', k, n.skirt ? (longSk ? legSkin : legSkin) : n.cPants);
    C('shoe', k, n.cShoes); C('sole', k, n.cSole || WHITE);
    C('uarm', k, top); C('farm', k, !coat && n.fit === 'tee' ? skin : top); C('hand', k, skin);
  }
  COLOR_DIRTY = true;
}

// ---------- позирование ----------
const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _j = new THREE.Matrix4(), _r = new THREE.Matrix4(), _t = new THREE.Matrix4(), _s = new THREE.Matrix4();
const _P0 = new THREE.Matrix4(), _Tor = new THREE.Matrix4(), _H = new THREE.Matrix4(), _A = new THREE.Matrix4(), _B = new THREE.Matrix4(), _C2 = new THREE.Matrix4();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
function rot(x, y, z) { _e.set(x, y, z, 'YXZ'); return _r.makeRotationFromEuler(_e); }
function setP(part, i, m) { const mp = PMAP[part]; if (mp) { i = mp[i]; if (i < 0) return; } PART[part].setMatrixAt(i, m); }
function floorYOff(f) { return explode && f < 3 ? f * 4.5 : 0; }
const wrapA = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const JK = ['thL', 'thR', 'shL', 'shR', 'uaL', 'uaR', 'faL', 'faR', 'uaLz', 'uaRz', 'headP', 'headY', 'torsoP', 'torsoY', 'hipY', 'hipX', 'ftL', 'ftR', 'headR'];
let POSE_NOW = 0, POSE_DT = 0.016, POSE_LAST = 0;
const TG = {};
function poseNPC__base(n, i, vis) {
  if (i === 0) { POSE_NOW = performance.now(); POSE_DT = Math.min(0.1, (POSE_NOW - POSE_LAST) / 1000) || 0.016; POSE_LAST = POSE_NOW; if (COLOR_DIRTY) markColors(); }
  if (!vis) { azHide(n); if (n.shown !== false) { n.shown = false; n.J = null; for (const p of PARTS1) setP(p, i, ZERO); for (const p of PARTS2) { setP(p, i * 2, ZERO); setP(p, i * 2 + 1, ZERO); } } return; }
  n.shown = true;
  const k = n.k, t = n.phase, now = POSE_NOW;
  const sit = n.pose === 'sit', crouch = n.pose === 'crouch';
  const w = n.walk, sub = n.sub, st = n.subT, sd = n.seed || 0;
  const wantCoat = COLD && n.f === 3 && n.coatHas; if (wantCoat !== !!n.coatOn) { n.coatOn = wantCoat; recolor(n, i); }
  // ---- целевые углы ----
  const g = n.gait || 1, sw = Math.sin(t) * 0.5 * w * g;
  const T: any = TG;
  T.thL = -sw; T.thR = sw;
  T.shL = (Math.max(0, Math.sin(t + 1.15)) * 0.95 + 0.06) * w; T.shR = (Math.max(0, Math.sin(t + 1.15 + Math.PI)) * 0.95 + 0.06) * w;
  const as = n.armSw || 0.9;
  T.uaL = sw * 0.8 * as; T.uaR = -sw * 0.8 * as;
  T.faL = -0.14 - 0.28 * w - Math.max(0, -T.uaL) * 0.9; T.faR = -0.14 - 0.28 * w - Math.max(0, -T.uaR) * 0.9;
  T.uaLz = 0.07; T.uaRz = -0.07; T.headP = 0; T.headY = 0; T.headR = 0;
  T.torsoP = 0.02 + 0.05 * w; T.torsoY = Math.sin(t) * 0.09 * w; T.hipX = Math.sin(t) * 0.012 * w; T.hipY = 0.92 + Math.abs(Math.cos(t)) * 0.022 * w - 0.012 * w;
  T.ftL = Math.max(0, -sw) * -0.5 + Math.max(0, sw) * 0.75; T.ftR = Math.max(0, sw) * -0.5 + Math.max(0, -sw) * 0.75;
  let freeHead = false, bob = 0;
  if (sit) {
    const v = n.sitV || 0;
    T.thL = -1.5 + v * 0.06; T.thR = -1.5 - v * 0.06; T.shL = 1.45 + v * 0.9; T.shR = 1.45 + v * 0.5; T.hipY = (n.seatH ?? 0.46) / k + 0.035; T.torsoP = 0.07; T.torsoY = 0; T.hipX = 0; T.ftL = T.ftR = v > 0.1 ? 0.5 : 0;
    T.uaL = T.uaR = -0.5; T.faL = T.faR = -1.0; T.uaLz = 0.12; T.uaRz = -0.12; freeHead = true;
    if (sub === 'type') { T.faL = -1.2 + Math.sin(st * 22 + sd) * 0.05; T.faR = -1.2 + Math.sin(st * 19 + 1) * 0.05; T.headP = 0.2 + Math.sin(st * 0.6 + sd) * 0.08; T.torsoP = 0.12; freeHead = false; }
    else if (sub === 'write') { T.faR = -1.18 + Math.sin(st * 9) * 0.05; T.uaR = -0.62; T.headP = 0.42; T.torsoP = 0.2; T.headY = -0.12; T.uaL = -0.55; T.faL = -1.0; freeHead = Math.sin(st * 0.5 + sd) > 0.72; if (freeHead) { T.torsoP = 0.1; } }
    else if (sub === 'phone') { T.uaR = -0.3; T.faR = -1.7; T.headP = 0.55; T.uaL = -0.3; T.faL = -1.3; T.torsoP = 0.16; freeHead = false; }
    else if (sub === 'hand') { T.uaR = -3.0; T.faR = -0.12; T.uaRz = -0.12; T.torsoP = 0.0; }
    else if (sub === 'talk') { T.headY = n.talkSide || 0.6; T.torsoY = (n.talkSide || 0.6) * 0.35; T.faR = -1.3 + Math.sin(st * 6) * 0.15; freeHead = false; }
    else if (sub === 'sleep') { T.headP = 0.9; T.headR = 0.3; T.uaL = T.uaR = -1.0; T.faL = T.faR = -1.45; T.torsoP = 0.42; freeHead = false; }
    else if (sub === 'lean') { T.torsoP = -0.14; T.uaL = T.uaR = -0.15; T.faL = T.faR = -0.7; T.shL = 1.1; T.shR = 1.2; }
    else { T.torsoP = 0.05 + Math.sin(st * 0.3 + sd) * 0.03; if (Math.sin(st * 0.21 + sd) > 0.6) { T.uaL = -0.9; T.faL = -2.2; T.headR = -0.12; T.torsoP = 0.16; } }
  } else if (crouch) {
    T.thL = T.thR = -1.9; T.shL = T.shR = 2.2; T.hipY = 0.42; T.torsoP = 0.45; T.uaL = T.uaR = -1.0; T.faL = T.faR = -0.8 + Math.sin(st * 8) * 0.1; T.ftL = T.ftR = 0.5;
  } else if (w < 0.05) {
    // стойка: перенос веса, дыхание
    const ws = Math.sin(st * 0.23 + sd); T.hipX = ws * 0.022; T.shL = 0.04 + Math.max(0, ws) * 0.16; T.shR = 0.04 + Math.max(0, -ws) * 0.16; T.thL = -Math.max(0, ws) * 0.08; T.thR = -Math.max(0, -ws) * 0.08; T.torsoP = 0.02; T.torsoY = 0;
    freeHead = true;
    if (sub === 'talk') { const a = Math.sin(st * 3.2 + sd), b = Math.sin(st * 5.1); T.uaR = -0.3 + a * 0.2; T.faR = -1.05 + b * 0.3; T.uaRz = -0.15; if (n.traits && n.traits.social > 0.8) { T.uaL = -0.25 - a * 0.15; T.faL = -0.95 + b * 0.25; } else { T.uaL = 0.0; T.faL = -0.25; } T.headP = Math.sin(st * 2.3) * 0.05; }
    else if (sub === 'phone') { T.uaR = -0.3; T.faR = -1.72; T.headP = 0.5; T.uaL = 0.03; T.faL = -0.2; T.uaRz = 0.12; freeHead = false; }
    else if (sub === 'board') { T.uaR = -2.35 + Math.sin(st * 4) * 0.08; T.faR = -0.35; T.uaRz = -0.25 + Math.sin(st * 2.7) * 0.2; T.uaL = 0.05; T.faL = -0.2; T.headP = -0.15; freeHead = false; }
    else if (sub === 'explain') { const a = Math.sin(st * 2.1 + sd), b = Math.sin(st * 3.3 + sd * 2), c = Math.sin(st * 0.7 + sd); T.uaR = -0.35 + a * 0.3; T.faR = -1.35 + b * 0.4; T.uaRz = -0.22 - Math.max(0, a) * 0.2; if (c > 0.2) { T.uaL = -0.25 - a * 0.2; T.faL = -1.1 + b * 0.3; T.uaLz = 0.25; } else { T.uaL = 0.02; T.faL = -0.3; } T.torsoY = c * 0.12; }
    else if (sub === 'arms') { T.uaL = T.uaR = -0.38; T.faL = T.faR = -1.6; T.uaLz = 0.38; T.uaRz = -0.38; }
    else if (sub === 'sweep') { const s2 = Math.sin(st * 2.6); T.uaL = -0.75 + s2 * 0.25; T.uaR = -0.55 + s2 * 0.25; T.faL = -0.5; T.faR = -0.6; T.torsoP = 0.28; T.headP = 0.2; T.uaLz = 0.25; T.uaRz = -0.05; freeHead = false; }
    else if (sub === 'dance') { const d = Math.sin(st * 5); T.uaL = -2.5 + d * 0.3; T.uaR = -2.5 - d * 0.3; T.faL = T.faR = -0.4; T.uaLz = 0.5; T.uaRz = -0.5; T.headY = d * 0.3; T.hipX = d * 0.04; bob = Math.abs(d) * 0.05; freeHead = false; }
    else if (sub === 'cheer') { T.uaL = T.uaR = -2.9; T.faL = T.faR = -0.2; T.uaLz = 0.3; T.uaRz = -0.3; bob = Math.abs(Math.sin(st * 6)) * 0.06; }
    else if (sub === 'play') { T.uaL = -0.9; T.faL = -0.7; T.uaR = -0.45; T.faR = -1.35 + Math.sin(st * 14) * 0.12; T.headP = 0.25; freeHead = false; }
    else if (sub === 'eat') { const b2 = Math.max(0, Math.sin(st * 1.4 + sd)); T.uaR = -0.35 - b2 * 0.5; T.faR = -1.5 - b2 * 0.75; T.uaL = -0.3; T.faL = -1.2; T.headP = b2 * 0.12; }
    else if (sub === 'think') { T.uaR = -0.55; T.faR = -2.25; T.uaL = -0.35; T.faL = -1.5; T.uaLz = 0.3; T.headP = 0.1; T.headR = 0.1; freeHead = false; }
    else if (sub === 'lean') { T.torsoP = -0.06; T.uaL = T.uaR = -0.3; T.faL = T.faR = -1.5; T.uaLz = 0.36; T.uaRz = -0.36; T.shL = 0.3; T.thL = -0.2; }
    else { const br = Math.sin(st * 1.3) * 0.02; T.uaL += br; T.uaR -= br; if (Math.sin(st * 0.17 + sd * 2) > 0.75) { T.uaL = T.uaR = 0.25; T.faL = T.faR = -0.5; T.uaLz = -0.12; T.uaRz = 0.12; } }
  } else {
    freeHead = true;
    if (n.walkPhone) { T.uaR = -0.35; T.faR = -1.65; T.uaRz = 0.1; T.headP = 0.42; freeHead = false; }
    if (n.bagKind === 'folder') { T.uaL = -0.1; T.faL = -1.25; T.uaLz = 0.02; }
  }
  // взгляд
  if (freeHead) {
    const L = n.look;
    if (L) { const yaw = wrapA(Math.atan2(L.y - n.y, L.x - n.x) - n.a); const d = Math.hypot(L.x - n.x, L.y - n.y); const cl = sit ? 1.25 : 1.1; if (Math.abs(yaw) < 2.2) { T.headY = Math.max(-cl, Math.min(cl, yaw)) * 0.85; T.headP = Math.max(-0.35, Math.min(0.45, Math.atan2((n.z + 1.6 * k * (sit ? 0.72 : 1)) - (L.z ?? n.z + 1.5), Math.max(0.4, d)))) + (T.headP || 0) * 0.3; if (!sit && w < 0.05) T.torsoY = T.headY * 0.25; } }
    else if (w < 0.05) { T.headY = Math.sin(st * 0.31 + sd) * 0.35 + Math.sin(st * 0.13 + sd * 3) * 0.2; T.headP += Math.sin(st * 0.19 + sd) * 0.06; }
  }
  if (n.waveT && now < n.waveT) { T.uaR = -2.55; T.faR = -0.55 + Math.sin(now * 0.016) * 0.4; T.uaRz = -0.4; }
  if (n.nodT && now < n.nodT) T.headP += Math.sin((n.nodT - now) * 0.014) * 0.2;
  if (n.shakeT && now < n.shakeT) T.headY += Math.sin((n.shakeT - now) * 0.016) * 0.3;
  // ---- сглаживание ----
  let J = n.J;
  if (!J) { J = n.J = {}; for (const key of JK) J[key] = T[key]; }
  else { const al = 1 - Math.exp(-POSE_DT * (w > 0.3 ? 16 : 9)); for (const key of JK) J[key] += (T[key] - J[key]) * al; }
  if (AZ.ready && n.az === undefined) azMaybe(n);
  if (n.az && azPose(n, i, J, bob)) return;
  // ---- матрицы ----
  const yOff = floorYOff(n.f);
  const coat = n.coatOn ? 1.14 : (n.fit === 'hoodie' || n.fit === 'jacket' || n.fit === 'cardigan' ? 1.05 : 1);
  _b.makeTranslation(n.x, n.z + yOff + bob * k, -n.y);
  _b.multiply(rot(0, n.a + Math.PI / 2, 0)); _b.multiply(_s.makeScale(k, k, k));
  _P0.copy(_b).multiply(_t.makeTranslation(J.hipX, J.hipY, 0));
  const bw = n.build, hw = bw * (n.hipW || 1);
  setP('pelvis', i, _j.copy(_P0).multiply(_s.makeScale(hw, 1, bw)));
  // ноги
  for (let s = 0; s < 2; s++) {
    const side = s ? 1 : -1, th = s ? J.thR : J.thL, sh = s ? J.shR : J.shL, ft = s ? J.ftR : J.ftL;
    _A.copy(_P0).multiply(_t.makeTranslation(0.088 * side * hw, 0, 0)).multiply(rot(th, 0, side * (sit ? 0.06 : 0.015)));
    setP('thigh', i * 2 + s, _j.copy(_A).multiply(_s.makeScale(bw, 1, bw)));
    _A.multiply(_t.makeTranslation(0, -0.45, 0)).multiply(rot(sh, 0, 0));
    setP('shin', i * 2 + s, _j.copy(_A).multiply(_s.makeScale(bw, 1, bw)));
    _A.multiply(_t.makeTranslation(0, -0.43, 0)).multiply(rot(-sh - th + (sit || crouch ? ft : ft * w), 0, 0));
    setP('shoe', i * 2 + s, _A); setP('sole', i * 2 + s, _A);
  }
  // торс
  _Tor.copy(_P0).multiply(rot(J.torsoP, J.torsoY, 0));
  const breath = 1 + Math.sin(st * 1.7 + sd) * 0.012;
  const fem = n.g === 'f';
  _j.copy(_Tor).multiply(_s.makeScale(bw * (fem ? 1 : n.sh || 1) * coat, 1, bw * coat * breath));
  setP('torsoM', i, fem ? ZERO : _j); setP('torsoF', i, fem ? _j : ZERO);
  const vee = !n.coatOn && n.cInner; setP('veeM', i, vee && !fem ? _j : ZERO); setP('veeF', i, vee && fem ? _j : ZERO); setP('tie', i, vee && n.tie ? _j : ZERO);
  setP('hood', i, (n.fit === 'hoodie' && !n.coatOn) || (n.coatOn && !n.beanie && n.hair !== 'hijab') ? _j : ZERO);
  if (n.skirt) { const L = n.skL || 0.5; _j.copy(_P0).multiply(_t.makeTranslation(0, 0.1, sit ? 0.12 : 0)).multiply(sit ? rot(-0.5, 0, 0) : rot(0, 0, 0)).multiply(_s.makeScale(hw * (sit ? 1.05 : 1 + w * 0.05) * (n.coatOn ? 1.14 : 1.05), sit ? Math.min(L, 0.42) : L, bw * (sit ? 1.5 : 1 + w * 0.12) * (n.coatOn ? 1.16 : 1.06))); setP('skirt', i, _j); } else setP('skirt', i, ZERO);
  const bagOn = n.bagOn !== false && !sit;
  setP('bag', i, n.bagKind === 'pack' && bagOn ? _j.copy(_Tor).multiply(_s.makeScale(coat, 1, coat)) : ZERO);
  setP('tote', i, n.bagKind === 'tote' && bagOn ? _j.copy(_Tor).multiply(_s.makeScale(coat, 1, 1)) : ZERO);
  // голова
  _A.copy(_Tor).multiply(_t.makeTranslation(0, 0.6, 0)); setP('neck', i, _A);
  setP('scarf', i, n.coatOn && n.scarf ? _j.copy(_A).multiply(_t.makeTranslation(0, 0.09, 0)) : ZERO);
  _H.copy(_A).multiply(_t.makeTranslation(0, 0.045, 0)).multiply(rot(J.headP, J.headY, J.headR)).multiply(_t.makeTranslation(0, 0.108, 0.006));
  setP('head', i, _H); setP('eyes', i, _H); setP('eyeW', i, _H); setP('brows', i, _H); setP('face', i, _H);
  const speaking = n.say && now < n.sayT;
  setP('mouth', i, speaking ? _j.copy(_H).multiply(_t.makeTranslation(0, -0.052 * (1 - (1 + Math.abs(Math.sin(now * 0.013 + sd)) * 1.4)), 0)).multiply(_s.makeScale(0.9, 1 + Math.abs(Math.sin(now * 0.013 + sd)) * 1.4, 1)) : _H);
  if (now > (n.blinkAt || 0) && POSE_DT < 0.09) { n.blinkAt = now + 1800 + ((i * 7919 + now) % 4200); n.blinkEnd = now + 130; }
  setP('lids', i, now < (n.blinkEnd || 0) || sub === 'sleep' ? _H : ZERO);
  setP('glasses', i, n.glasses ? _H : ZERO); setP('stub', i, n.stub ? _H : ZERO);
  const beanie = n.coatOn && n.beanie;
  const hs = n.hair === 'bald' ? null : HAIR_OF[n.hair] || 'hShort';
  const hideH = beanie && n.g === 'm'; for (const p of HAIR_PARTS) setP(p, i, p === hs && !hideH ? _H : ZERO);
  setP('beanie', i, beanie ? _H : ZERO);
  // руки
  for (let s = 0; s < 2; s++) {
    const side = s ? 1 : -1, ua = s ? J.uaR : J.uaL, fa = s ? J.faR : J.faL, uz = s ? J.uaRz : J.uaLz;
    _A.copy(_Tor).multiply(_t.makeTranslation(0.2 * side * bw * (n.sh || 1) * (fem ? 0.88 : 1) * (n.coatOn ? 1.06 : 1), 0.5, 0)).multiply(rot(ua, 0, uz));
    setP('uarm', i * 2 + s, _j.copy(_A).multiply(_s.makeScale(bw * coat * (fem ? 0.88 : 1), 1, bw * coat * (fem ? 0.88 : 1))));
    _A.multiply(_t.makeTranslation(0, -0.29, 0)).multiply(rot(fa, 0, 0));
    setP('farm', i * 2 + s, _j.copy(_A).multiply(_s.makeScale(coat * (fem ? 0.88 : 1), 1, coat * (fem ? 0.88 : 1))));
    if (s === 0) setP('folder', i, n.bagKind === 'folder' && !sit && n.sub !== 'board' && n.sub !== 'explain' ? _A : ZERO);
    _A.multiply(_t.makeTranslation(0, -0.25, 0));
    setP('hand', i * 2 + s, _A);
    if (s === 1) setP('phone', i, sub === 'phone' || (n.walkPhone && w > 0.05 && !sit) ? _j.copy(_A).multiply(_t.makeTranslation(0, -0.06, 0.035)).multiply(rot(-0.45, 0, 0)) : ZERO);
  }
}
