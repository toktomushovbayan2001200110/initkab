// ================= МИР: двор, деревья, горы, небо по времени суток =================
// Солнце Бишкека (42.9° с.ш., 74.6° в.д., UTC+6): солнечный полдень ≈ 12:58 по местному времени
const SUN = { rise: 470, set: 1060, noon: 778, maxEl: 30, doy: 327 };
function setSunDay(doy) {
  SUN.doy = doy;
  const decl = 23.44 * Math.sin(2 * Math.PI * (doy - 81) / 365);
  const B = 2 * Math.PI * (doy - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  SUN.noon = 12 * 60 + (90 - 74.6) * 4 - eot;
  const lat = 42.9 * Math.PI / 180, d = decl * Math.PI / 180;
  const H = Math.acos(Math.max(-1, Math.min(1, (Math.sin(-0.83 * Math.PI / 180) - Math.sin(lat) * Math.sin(d)) / (Math.cos(lat) * Math.cos(d))))) * 180 / Math.PI;
  SUN.rise = SUN.noon - H * 4; SUN.set = SUN.noon + H * 4; SUN.maxEl = 90 - 42.9 + decl; SUN.lat = lat; SUN.decl = d;
  applySeason();
}
function sunPos(t) {   // возвращает высоту (°) и направление в мире three (восток +x, юг +z)
  const h = (t - SUN.noon) / 4 * Math.PI / 180, lat = SUN.lat, d = SUN.decl;
  const el = Math.asin(Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(h));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(lat) - Math.tan(d) * Math.cos(lat)); // 0 = юг, + = запад
  const ce = Math.cos(el);
  return { el: el * 180 / Math.PI, dir: new THREE.Vector3(-Math.sin(az) * ce, Math.sin(el), Math.cos(az) * ce) };
}

// ---------- ресурсы двора ----------
const CITY = {
  // [x0, x1, y0, y1] в координатах симуляции (x — восток, y — север), по карте OSM вокруг ул. Раззакова 51
  roads: [[-44, -35.5, -300, 300, 'Раззакова', 'S'], [-300, 300, -97, -83, 'Токтогула', 'W'], [72, 79, -300, 300, 'Эркиндик', 'S'], [134, 141, -300, 300, 'Эркиндик', 'N'], [-300, 300, 131, 139, 'Киевская', 'E']],
  walks: [[-48, -44, -300, 300], [-35.5, -31.3, -300, 300], [-300, 300, -100, -97], [-300, 300, -83, -79.5], [69, 72, -300, 300], [141, 144, -300, 300], [-300, 300, 128, 131], [-300, 300, 139, 142]],
  blocks: [
    [40, 58, -54, 7, 12, 0xd9ccb2, 'Дипакадемия МИД'], [44, 60, -62, -79, 7, 0xcbb89c], [29, 66, 37, 52, 13, 0xe6dac4, 'КГУ'], [-14, 8, 99, 124, 16, 0xe6dac4, 'КГУ'], [44, 66, 86, 104, 13, 0xe6dac4], [20, 54, -62, -77, 7, 0xd6cfc4],
    [-84, -58, 8, 46, 12, 0xd8c7a8, 'Лицей №3'], [-86, -60, -22, -6, 9, 0xc9c2b4], [-80, -62, -44, -74, 15, 0xb9c3c9], [-125, -95, 55, 95, 12, 0xd0bfa4], [-125, -95, -30, 20, 9, 0xcfc8bb],
    [-28, 40, -108, -140, 16, 0xd4c6ae], [-80, -52, -106, -128, 9, 0xc9bfae], [150, 176, 40, 82, 12, 0xd6c9b4], [150, 172, -22, 22, 9, 0xc4cdd0], [148, 182, -58, -80, 10, 0xd2c3a8], [150, 180, 100, 125, 14, 0xcbbca4],
    [-80, -50, 60, 120, 15, 0xd0c4ae], [60, 70, 145, 175, 10, 0xd8cbb4], [-20, 30, 146, 180, 18, 0xc9c0b0]],
  field: [-29, 14, -76, -39],
};
const W = { lampMats: [], lights: [], flag: null, stars: null, mts: [], glass: [], amb: null, treeCrowns: [], grassMats: [] };
const C = (h) => new THREE.Color(h);
function seasonOf(doy) { const m = new Date(Date.UTC(2026, 0, doy)).getUTCMonth(); return m <= 1 || m === 11 ? 'winter' : m <= 3 ? 'spring' : m <= 7 ? 'summer' : m === 8 ? 'early' : 'autumn'; }
const SEASON = {
  autumn: { grass: 0x8d8c55, crown: [0xd0a52c, 0xc27a2b, 0xdcb540, 0xa86c2c, 0x8e8a3c, 0xe0c25a], poplar: [0xd9bb3e, 0xc9a332, 0xb89a3b], k: 0.78, leaves: true },
  early: { grass: 0x7c8a4c, crown: [0x6e8f3a, 0x8f9a3a, 0xb59b35, 0x5f8436], poplar: [0x7d9a3d, 0xa79f3a], k: 0.95, leaves: false },
  summer: { grass: 0x6a8a45, crown: [0x557f34, 0x4b7330, 0x628a3a, 0x3f6a2c], poplar: [0x4f7a32, 0x5b8738], k: 1, leaves: false },
  spring: { grass: 0x77984c, crown: [0x8fc060, 0x9ccb6a, 0xd9e6a8, 0x7fb558], poplar: [0x8dbb5c, 0x9cc66a], k: 0.9, leaves: false },
  winter: { grass: 0xc9cdcc, crown: [0x6b5a4a, 0x5f5044, 0x74624f], poplar: [0x6b5d4e], k: 0.5, leaves: false },
};

// убираем площадку двора из ArchiCAD (она перекрывает новый двор), оставляем плиту под зданием
function trimSiteSlab() {
  const v = new THREE.Vector3(), FP = GRID.FP;
  pickables.forEach(o => {
    if (o.isInstancedMesh || o.userData.s !== 0 || o.userData.t !== 'IfcSlab') return;
    o.geometry.computeBoundingBox(); const sz = new THREE.Vector3(); o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).getSize(sz);
    if (sz.x < 60) return;
    const P = o.geometry.attributes.position, keep = [];
    for (let t = 0; t < P.count; t += 3) {
      let mx = 0, my = 0; for (let k = 0; k < 3; k++) { v.fromBufferAttribute(P, t + k).applyMatrix4(o.matrixWorld); mx += v.x / 3; my += -v.z / 3; }
      const i = cx(mx), j = cy(my); if (i >= 0 && j >= 0 && i < SNX && j < SNY && FP[j * SNX + i]) keep.push(t);
    }
    const np = new Float32Array(keep.length * 9); keep.forEach((t, q) => { for (let k = 0; k < 9; k++) np[q * 9 + k] = P.array[t * 3 + k]; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(np, 3));
    const uv = o.geometry.attributes.uv; if (uv) { const nu = new Float32Array(keep.length * 6); keep.forEach((t, q) => { for (let k = 0; k < 6; k++) nu[q * 6 + k] = uv.array[t * 2 + k]; }); g.setAttribute('uv', new THREE.BufferAttribute(nu, 2)); }
    g.computeVertexNormals(); o.geometry.dispose(); o.geometry = g;
  });
}
function buildWorld() {
  trimSiteSlab();
  const X1 = SX0 + SNX * SR, Y1 = SY0 + SNY * SR, DW = X1 - SX0, DH = Y1 - SY0;
  const G3 = GRID[3], FP = GRID.FP;
  // ворота
  // ворота: восточные (к Эркиндику), юго-западные и северо-западные (на ул. Раззакова)
  const FX0 = -31.3;   // западная ограда вдоль тротуара ул. Раззакова
  { const G = GRID[3]; for (let j = 0; j < SNY; j++) for (let i2 = 0; i2 < SNX; i2++) if (wx(i2) < FX0 + 0.2) G[j * SNX + i2] = -1; }
  [[36.4, -2, [[38.6, -2], [38.6, 31], [74, 31]], 0.3], [-29.6, -31.4, [[-33.4, -31.4], [-33.4, -84]], 0.45], [-29.6, 30.2, [[-33.4, 30.2], [-33.4, 126]], 0.25]].forEach(([x, y, pts, w]) => { const p = nearestPass(3, x, y, 30); if (p) GATES.push({ x: wx(p[0]), y: wy(p[1]), pts, ox: pts[pts.length - 1][0], oy: pts[pts.length - 1][1], w }); });
  // расстояние до здания (в клетках)
  const n = SNX * SNY, distB = new Int16Array(n).fill(9999), q = [];
  for (let k = 0; k < n; k++) if (FP[k] || G3[k] !== -2) { distB[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) { const k = q[h], i = k % SNX, d = distB[k] + 1; for (const m of [i > 0 ? k - 1 : -1, i < SNX - 1 ? k + 1 : -1, k - SNX, k + SNX]) if (m >= 0 && m < n && distB[m] > d) { distB[m] = d; q.push(m); } }
  // ---- текстура двора
  const PX = 8, cv = document.createElement('canvas'); cv.width = Math.round(DW * PX); cv.height = Math.round(DH * PX); const g = cv.getContext('2d');
  const tx = x => (x - SX0) * PX, ty = y => (Y1 - y) * PX;
  const paved = new Uint8Array(n);
  const markSeg = (x0, y0, x1, y1, w) => { const L = Math.hypot(x1 - x0, y1 - y0); for (let s = 0; s <= L; s += SR * 0.5) { const x = x0 + (x1 - x0) * s / L, y = y0 + (y1 - y0) * s / L; const R = Math.ceil(w / 2 / SR); const i0 = cx(x), j0 = cy(y); for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) if (i >= 0 && j >= 0 && i < SNX && j < SNY && (i - i0) ** 2 + (j - j0) ** 2 <= R * R) paved[j * SNX + i] = 1; } };
  const S = SEASON[seasonOf(SUN.doy)];
  // трава с текстурой
  const gc = new THREE.Color(S.grass);
  g.fillStyle = '#' + gc.getHexString(); g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 26000; i++) { const c = gc.clone().offsetHSL(rr(-0.03, 0.03), rr(-0.08, 0.05), rr(-0.08, 0.06)); g.fillStyle = '#' + c.getHexString(); g.fillRect(rnd() * cv.width, rnd() * cv.height, 2, 2); }
  if (S.leaves) for (let i = 0; i < 5000; i++) { g.fillStyle = pick(['#c8782a', '#d9a531', '#a85a24', '#e3c04e', '#8a4b22']); g.fillRect(rnd() * cv.width, rnd() * cv.height, 2.5, 2); }
  // отмостка и площадка вокруг здания
  const pave = (c1, c2) => { g.fillStyle = c1; };
  const img = g.getImageData(0, 0, cv.width, cv.height);
  for (let j = 0; j < SNY; j++) for (let i = 0; i < SNX; i++) { const k = j * SNX + i; if (distB[k] <= 12 || wx(i) < FX0 + 0.6) paved[k] = 1; }
  // дорожки
  const plaza = { x: 5.5, y: -1.5, r: 6.5 };
  const segs = [];
  GATES.forEach(gt => segs.push([gt.pts[0][0], gt.pts[0][1], gt.x, gt.y, 3.2]));
  segs.push([GATES[0].x, GATES[0].y, plaza.x + plaza.r, plaza.y, 3.4]);
  ENTR.forEach(e => segs.push([e.out[0], e.out[1], plaza.x, plaza.y, 2.6]));
  if (GATES[1]) segs.push([GATES[1].x, GATES[1].y, 4, -31, 2.8], [4, -31, plaza.x, plaza.y - plaza.r, 2.6]);
  if (GATES[2]) segs.push([GATES[2].x, GATES[2].y, 28, 30.2, 3.0], [28, 30.2, 30, 12, 2.6]);
  segs.push([SX0 + 1.5, SY0 + 1.5, X1 - 1.5, SY0 + 1.5, 2.6], [SX0 + 1.5, Y1 - 1.5, X1 - 1.5, Y1 - 1.5, 2.6], [X1 - 1.5, SY0 + 1.5, X1 - 1.5, Y1 - 1.5, 2.6], [FX0 + 1.8, SY0 + 1.5, FX0 + 1.8, Y1 - 1.5, 2.6]);
  segs.forEach(s => markSeg(...s));
  for (let j = 0; j < SNY; j++) for (let i = 0; i < SNX; i++) if (Math.hypot(wx(i) - plaza.x, wy(j) - plaza.y) < plaza.r) paved[j * SNX + i] = 1;
  // рисуем плитку по маске (клетка = 1.6 px)
  g.putImageData(img, 0, 0);
  for (let j = 0; j < SNY; j++) for (let i = 0; i < SNX; i++) {
    const k = j * SNX + i; if (!paved[k]) continue;
    const x = tx(wx(i) - SR / 2), y = ty(wy(j) + SR / 2);
    const checker = ((i >> 2) + (j >> 2)) & 1; const v = 0.62 + checker * 0.035 + rnd() * 0.02;
    g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(250 * v * 0.985)},${Math.round(240 * v * 0.95)})`; g.fillRect(x, y, SR * PX + 0.6, SR * PX + 0.6);
  }
  // бордюры площади, клумба
  g.strokeStyle = '#8f8a80'; g.lineWidth = 3; g.beginPath(); g.arc(tx(plaza.x), ty(plaza.y), plaza.r * PX, 0, 7); g.stroke();
  g.fillStyle = '#4b3a2a'; g.beginPath(); g.arc(tx(plaza.x), ty(plaza.y), 2.6 * PX, 0, 7); g.fill();
  for (let i = 0; i < 300; i++) { const a = rnd() * 6.28, r = rnd() * 2.5; g.fillStyle = pick(S.leaves ? ['#7a2f45', '#b04a3a', '#d9a531', '#5c6b33'] : ['#c0392b', '#e67e22', '#f1c40f', '#8e44ad', '#5c8a3a']); g.fillRect(tx(plaza.x + Math.cos(a) * r), ty(plaza.y + Math.sin(a) * r), 3, 3); }
  W.yardCanvas = cv; const yt = new THREE.CanvasTexture(cv); yt.encoding = THREE.sRGBEncoding; yt.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ym = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), new THREE.MeshStandardMaterial({ map: yt, roughness: 0.95 }));
  ym.rotation.x = -Math.PI / 2; ym.position.set((SX0 + X1) / 2, OUTZ + 0.012, -(SY0 + Y1) / 2); ym.receiveShadow = true; scene.add(ym);
  ground.material.color.set(S.grass).multiplyScalar(1.25); W.grassMats.push(ground.material);
  blockDisk(plaza.x, plaza.y, 2.8);

  // ---- деревья
  const trees = [];
  const ok = (x, y, minB, minT) => { const i = cx(x), j = cy(y); if (i < 2 || j < 2 || i >= SNX - 2 || j >= SNY - 2) return false; const k = j * SNX + i; if (paved[k] || G3[k] !== -2 || distB[k] < minB) return false; return !trees.some(t => Math.hypot(t.x - x, t.y - y) < minT); };
  // тополя рядами вдоль ограды
  for (let x = FX0 + 4; x < X1 - 3; x += rr(7, 10)) for (const y of [SY0 + 3.6, Y1 - 3.6]) if (ok(x, y, 10, 6)) trees.push({ x, y, k: chance(0.5) ? 'poplar' : 'elm' });
  for (let y = SY0 + 4; y < Y1 - 3; y += rr(7, 10)) for (const x of [FX0 + 3.6, X1 - 3.6]) if (ok(x, y, 10, 6)) trees.push({ x, y, k: chance(0.5) ? 'poplar' : 'elm' });
  for (let t = 0; t < 900 && trees.length < 70; t++) { const x = rr(SX0 + 3, X1 - 3), y = rr(SY0 + 3, Y1 - 3); if (ok(x, y, 18, 6.5)) trees.push({ x, y, k: chance(0.25) ? 'archa' : 'elm' }); }
  for (let a = 0; a < 6; a++) trees.push({ x: plaza.x + Math.cos(a * 1.047) * 1.6, y: plaza.y + Math.sin(a * 1.047) * 1.6, k: 'archa', small: true });
  trees.push({ x: plaza.x, y: plaza.y, k: 'archa', big: true });
  // квартал вокруг (по карте OSM): ул. Раззакова — запад, Токтогула — юг, бульвар Эркиндик — восток, Киевская — север
  const far = []; const inR = (x, y, m = 0) => CITY.blocks.some(b => x > b[0] - m && x < b[1] + m && y > b[2] - m && y < b[3] + m) || CITY.roads.some(r => x > r[0] - 1 && x < r[1] + 1 && y > r[2] - 1 && y < r[3] + 1) || (x > SX0 - 2 && x < X1 + 2 && y > SY0 - 2 && y < Y1 + 2);
  for (let y = -290; y < 290; y += rr(7, 9)) { [-34.2, -46.5].forEach(x => { if (!inR(x, y)) far.push({ x, y, k: chance(0.3) ? 'poplar' : 'elm', far: true }); }); [86, 98, 115, 127].forEach(x => { if (!inR(x, y + rr(-1, 1))) far.push({ x, y, k: 'elm', far: true, big: true }); }); }
  for (let x = -290; x < 290; x += rr(7, 9)) [-80.5, -101.5, 128.5, 142].forEach(y => { if (!inR(x, y)) far.push({ x, y, k: chance(0.35) ? 'poplar' : 'elm', far: true }); });
  for (let t = 0; t < 500 && far.length < 700; t++) { const x = rr(-260, 260), y = rr(-260, 260); if (Math.hypot(x, y) < 45 || inR(x, y, 2.5)) continue; far.push({ x, y, k: chance(0.3) ? 'poplar' : 'elm', far: true }); }
  const all = trees.concat(far);
  const trunkG = new THREE.CylinderGeometry(0.11, 0.17, 1, 6); trunkG.translate(0, 0.5, 0);
  const elmG = BGU.mergeBufferGeometries([new THREE.IcosahedronGeometry(1, 1), (() => { const b = new THREE.IcosahedronGeometry(0.75, 1); b.translate(0.55, -0.25, 0.3); return b; })(), (() => { const b = new THREE.IcosahedronGeometry(0.7, 1); b.translate(-0.5, -0.2, -0.35); return b; })()]);
  const popG = new THREE.IcosahedronGeometry(1, 2);
  const archaG = new THREE.ConeGeometry(1, 1, 9); archaG.translate(0, 0.5, 0);
  const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const kinds = { elm: all.filter(t => t.k === 'elm'), poplar: all.filter(t => t.k === 'poplar'), archa: all.filter(t => t.k === 'archa') };
  const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1 }), all.length);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  all.forEach((t, i) => {
    t.h = t.k === 'poplar' ? rr(12, 17) : t.k === 'elm' ? (t.big ? rr(10, 14) : rr(6.5, 9.5)) : (t.big ? 3.6 : t.small ? rr(1.2, 1.7) : rr(2.4, 3.4));
    const th = t.k === 'poplar' ? t.h * 0.25 : t.k === 'elm' ? t.h * 0.42 : 0.3, tw = t.k === 'archa' ? 0.6 : t.k === 'poplar' ? 1.5 : 1.3;
    qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28); m4.compose(ps.set(t.x, OUTZ, -t.y), qq, sc.set(tw, th, tw)); trunk.setMatrixAt(i, m4);
    if (!t.far) blockDisk(t.x, t.y, t.k === 'archa' ? (t.small ? 0.3 : 0.7) : 0.45);
  });
  trunk.castShadow = true; trunk.receiveShadow = true; scene.add(trunk);
  const crown = (geo, list, fn, colors, shadow) => {
    const m = new THREE.InstancedMesh(geo, mat(), list.length);
    list.forEach((t, i) => { const [s, y] = fn(t); qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28); m4.compose(ps.set(t.x, OUTZ + y, -t.y), qq, s); m.setMatrixAt(i, m4); m.setColorAt(i, C(pick(colors)).offsetHSL(rr(-0.02, 0.02), 0, rr(-0.05, 0.04))); });
    m.castShadow = shadow; m.receiveShadow = true; scene.add(m); W.treeCrowns.push(m); return m;
  };
  crown(elmG, kinds.elm, t => { const r = t.h * 0.33 * S.k; return [new THREE.Vector3(r, r * 0.85, r), t.h * 0.66]; }, S.crown, true);
  crown(popG, kinds.poplar, t => { const r = t.h * 0.075 * (0.6 + 0.4 * S.k); return [new THREE.Vector3(r, t.h * 0.4 * (0.7 + 0.3 * S.k), r), t.h * 0.58]; }, S.poplar, true);
  crown(archaG, kinds.archa, t => [new THREE.Vector3(t.h * 0.3, t.h * 0.95, t.h * 0.3), t.h * 0.08], [0x2c4a2e, 0x32533a, 0x284230], true);

  // ---- скамейки (по кругу площади и вдоль дорожек)
  const benchPos = [];
  for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4 + Math.PI / 8; benchPos.push({ x: plaza.x + Math.cos(ang) * (plaza.r - 1.0), y: plaza.y + Math.sin(ang) * (plaza.r - 1.0), a: ang + Math.PI }); }
  for (let t = 0; t < 400 && benchPos.length < 18; t++) {
    const s = pick(segs.slice(0, 6)); const u = rr(0.25, 0.75); const x0 = s[0] + (s[2] - s[0]) * u, y0 = s[1] + (s[3] - s[1]) * u; const L = Math.hypot(s[2] - s[0], s[3] - s[1]); if (L < 6) continue;
    const nx = -(s[3] - s[1]) / L, ny = (s[2] - s[0]) / L, side = chance(0.5) ? 1 : -1; const x = x0 + nx * side * (s[4] / 2 + 0.6), y = y0 + ny * side * (s[4] / 2 + 0.6);
    const k = cy(y) * SNX + cx(x); if (G3[k] !== -2 || distB[k] < 10 || benchPos.some(b => Math.hypot(b.x - x, b.y - y) < 4) || trees.some(tr => Math.hypot(tr.x - x, tr.y - y) < 1.6)) continue;
    benchPos.push({ x, y, a: Math.atan2(-ny * side, -nx * side) });
  }
  const seatG = new THREE.BoxGeometry(1.8, 0.06, 0.42); seatG.translate(0, 0.44, 0);
  const backG = new THREE.BoxGeometry(1.8, 0.4, 0.05); backG.rotateX(-0.12); backG.translate(0, 0.72, -0.22);
  const legG = BGU.mergeBufferGeometries([-0.75, 0.75].map(x => { const b = new THREE.BoxGeometry(0.07, 0.44, 0.44); b.translate(x, 0.22, -0.02); return b; }));
  const wood = new THREE.InstancedMesh(BGU.mergeBufferGeometries([seatG, backG]), new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.8 }), benchPos.length);
  const legs = new THREE.InstancedMesh(legG, new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.4 }), benchPos.length);
  benchPos.forEach((b, i) => {
    // локальная +z скамейки = направление взгляда сидящих
    const yaw = Math.atan2(Math.cos(b.a), Math.sin(b.a)); qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    m4.compose(ps.set(b.x, OUTZ, -b.y), qq, sc.set(1, 1, 1)); wood.setMatrixAt(i, m4); legs.setMatrixAt(i, m4);
    blockRect(b.x, b.y, 1.9, 0.6, b.a + Math.PI / 2);
    const ux = -Math.sin(b.a), uy = Math.cos(b.a);
    [-0.45, 0.45].forEach(o => BENCH_SEATS.push({ id: 'b' + i + o, f: 3, room: YARD_ROOM, p: [b.x + ux * o + Math.cos(b.a) * 0.05, b.y + uy * o + Math.sin(b.a) * 0.05], z: OUTZ, a: b.a, pc: -1, office: false }));
  });
  [wood, legs].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });

  // ---- фонари
  const lampPos = [];
  for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3; lampPos.push([plaza.x + Math.cos(ang) * (plaza.r + 0.6), plaza.y + Math.sin(ang) * (plaza.r + 0.6)]); }
  segs.slice(0, 8).forEach(s => { const L = Math.hypot(s[2] - s[0], s[3] - s[1]); for (let d = 6; d < L - 3; d += 11) { const u = d / L, nx = -(s[3] - s[1]) / L, ny = (s[2] - s[0]) / L; lampPos.push([s[0] + (s[2] - s[0]) * u + nx * (s[4] / 2 + 0.35), s[1] + (s[3] - s[1]) * u + ny * (s[4] / 2 + 0.35)]); } });
  const lp = lampPos.filter(([x, y]) => { const k = cy(y) * SNX + cx(x); return k >= 0 && k < n && G3[k] === -2 && distB[k] > 6; });
  const poleG = new THREE.CylinderGeometry(0.05, 0.08, 4.2, 6); poleG.translate(0, 2.1, 0);
  const headG = new THREE.SphereGeometry(0.22, 10, 8); headG.translate(0, 4.3, 0);
  const pole = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.5, metalness: 0.5 }), lp.length);
  const headM = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffcf8a, emissiveIntensity: 0, roughness: 0.3 }); W.lampMats.push(headM);
  const head = new THREE.InstancedMesh(headG, headM, lp.length);
  lp.forEach(([x, y], i) => { m4.makeTranslation(x, OUTZ, -y); pole.setMatrixAt(i, m4); head.setMatrixAt(i, m4); blockDisk(x, y, 0.2); });
  pole.castShadow = true; scene.add(pole); scene.add(head);
  [[plaza.x, plaza.y], [GATES[0].x - 4, GATES[0].y], [ENTR[0].out[0], ENTR[0].out[1] - 2], [ENTR[1].out[0], ENTR[1].out[1] - 2]].forEach(([x, y]) => { const L = new THREE.PointLight(0xffc98a, 0, 16, 1.6); L.position.set(x, OUTZ + 4.2, -y); scene.add(L); W.lights.push(L); });

  // ---- ограда с воротами
  const fenceRuns = [];
  const gaps = GATES.map(gt => [(gt.x + gt.pts[0][0]) / 2, (gt.y + gt.pts[0][1]) / 2]);
  const addRun = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0); for (let d = 0; d < L; d += 0.16) { const x = x0 + (x1 - x0) * d / L, y = y0 + (y1 - y0) * d / L; if (gaps.some(([gx, gy]) => Math.hypot(gx - x, gy - y) < 2.6)) continue; fenceRuns.push([x, y, Math.atan2(y1 - y0, x1 - x0), d % 2.4 < 0.16]); } };
  const fx0 = FX0, fx1 = X1 - 0.3, fy0 = SY0 + 0.3, fy1 = Y1 - 0.3;
  addRun(fx0, fy0, fx1, fy0); addRun(fx1, fy0, fx1, fy1); addRun(fx1, fy1, fx0, fy1); addRun(fx0, fy1, fx0, fy0);
  const picketG = new THREE.BoxGeometry(0.025, 1.6, 0.025); picketG.translate(0, 0.8, 0);
  const postG = new THREE.BoxGeometry(0.1, 1.8, 0.1); postG.translate(0, 0.9, 0);
  const fm = new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.5, metalness: 0.5 });
  const pk = new THREE.InstancedMesh(picketG, fm, fenceRuns.length), po = new THREE.InstancedMesh(postG, fm, fenceRuns.filter(f => f[3]).length);
  let pi2 = 0; fenceRuns.forEach(([x, y, a, post], i) => { m4.makeTranslation(x, OUTZ, -y); pk.setMatrixAt(i, m4); if (post) po.setMatrixAt(pi2++, m4); });
  scene.add(pk); scene.add(po);
  const railG = new THREE.BoxGeometry(1, 0.04, 0.04);
  const rails = new THREE.InstancedMesh(railG, fm, 8 * 2);
  [[fx0, fy0, fx1, fy0], [fx1, fy0, fx1, fy1], [fx1, fy1, fx0, fy1], [fx0, fy1, fx0, fy0]].forEach(([x0, y0, x1, y1], r) => [0.25, 1.45].forEach((h, k) => {
    qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-(y1 - y0), x1 - x0)); m4.compose(ps.set((x0 + x1) / 2, OUTZ + h, -(y0 + y1) / 2), qq, sc.set(Math.hypot(x1 - x0, y1 - y0), 1, 1)); rails.setMatrixAt(r * 2 + k, m4); }));
  rails.count = 8; scene.add(rails);
  // кирпичные столбы ворот
  const pillarG = new THREE.BoxGeometry(0.6, 2.3, 0.6); pillarG.translate(0, 1.15, 0);
  const pil = new THREE.InstancedMesh(pillarG, new THREE.MeshStandardMaterial({ color: 0x9a4a35, roughness: 0.9 }), GATES.length * 2);
  GATES.forEach((gt, i) => { const gx = (gt.x + gt.pts[0][0]) / 2, gy = (gt.y + gt.pts[0][1]) / 2; const along = Math.abs(gt.pts[0][0] - gt.x) > Math.abs(gt.pts[0][1] - gt.y) ? [0, 1] : [1, 0]; [-1, 1].forEach((s, k) => { m4.makeTranslation(gx + along[0] * s * 2.7, OUTZ, -(gy + along[1] * s * 2.7)); pil.setMatrixAt(i * 2 + k, m4); }); });
  pil.castShadow = true; scene.add(pil);

  // ---- стела у главных ворот и флаг
  const g0 = GATES[1];
  const sx = g0.x + 3.2, sy = g0.y - 1.4;
  const stC = document.createElement('canvas'); stC.width = 1024; stC.height = 300; const sg = stC.getContext('2d');
  sg.fillStyle = '#1d3f73'; sg.fillRect(0, 0, 1024, 300); sg.fillStyle = '#e9c46a'; sg.fillRect(0, 0, 1024, 10); sg.fillRect(0, 290, 1024, 10);
  sg.fillStyle = '#fff'; sg.textAlign = 'center'; sg.font = 'bold 44px sans-serif'; sg.fillText('КЫРГЫЗСКИЙ ГОСУДАРСТВЕННЫЙ', 512, 80); sg.fillText('УНИВЕРСИТЕТ им. И. АРАБАЕВА', 512, 135);
  sg.font = '34px sans-serif'; sg.fillStyle = '#e9c46a'; sg.fillText('1 учебный корпус · Институт новых информационных технологий', 512, 205);
  sg.font = '28px sans-serif'; sg.fillStyle = '#cfd8e3'; sg.fillText('И. Арабаев атындагы Кыргыз мамлекеттик университети', 512, 255);
  const stT = new THREE.CanvasTexture(stC); stT.encoding = THREE.sRGBEncoding; stT.anisotropy = 8;
  const stela = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.9 })); base.position.y = 0.25;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.2, 0.18), [0, 0, 0, 0, 1, 1].map(k => k ? new THREE.MeshStandardMaterial({ map: stT, roughness: 0.5 }) : new THREE.MeshStandardMaterial({ color: 0x1d3f73 }))); plate.position.y = 1.15;
  stela.add(base, plate); stela.position.set(sx, OUTZ, -sy); stela.rotation.y = Math.PI / 2; base.castShadow = plate.castShadow = true; scene.add(stela);
  blockRect(sx, sy, 0.9, 4.6, 0);
  // флаг Кыргызстана
  const fc = document.createElement('canvas'); fc.width = 500; fc.height = 300; const fg = fc.getContext('2d');
  fg.fillStyle = '#e8112d'; fg.fillRect(0, 0, 500, 300); fg.save(); fg.translate(250, 150); fg.fillStyle = '#ffef00';
  for (let i = 0; i < 40; i++) { fg.rotate(Math.PI * 2 / 40); fg.beginPath(); fg.moveTo(-9, 0); fg.lineTo(0, -88); fg.lineTo(9, 0); fg.fill(); }
  fg.beginPath(); fg.arc(0, 0, 56, 0, 7); fg.fill(); fg.strokeStyle = '#e8112d'; fg.lineWidth = 8; fg.beginPath(); fg.arc(0, 0, 40, 0, 7); fg.stroke();
  fg.lineWidth = 5; [-1, 1].forEach(s => { fg.beginPath(); fg.ellipse(s * 13, 0, 28, 40, 0, 0, 7); fg.stroke(); fg.beginPath(); fg.ellipse(s * 26, 0, 22, 40, 0, -1.2, 1.2); fg.stroke(); }); fg.restore();
  const flT = new THREE.CanvasTexture(fc); flT.encoding = THREE.sRGBEncoding;
  const flG = new THREE.PlaneGeometry(2.5, 1.5, 24, 8); flG.translate(1.25, 0, 0);
  const flag = new THREE.Mesh(flG, new THREE.MeshStandardMaterial({ map: flT, side: THREE.DoubleSide, roughness: 0.8 }));
  const fpx = sx + 0.4, fpy = sy + 3.6;
  const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 9, 8), new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 0.6, roughness: 0.3 }));
  fpole.position.set(fpx, OUTZ + 4.5, -fpy); fpole.castShadow = true; scene.add(fpole);
  flag.position.set(fpx + 0.05, OUTZ + 8.1, -fpy); flag.castShadow = true; scene.add(flag); W.flag = flag; W.flagBase = flG.attributes.position.array.slice();
  blockDisk(fpx, fpy, 0.3);

  // ---- горы Ала-Тоо на юге (+z в мире)
  const mtn = (R, hmax, seed, colLow, colSnow, snowAt) => {
    const segs = 220, rows = 6, pos = [], col = [], idx = [];
    const h = a => { let v = 0; for (let k = 1; k <= 6; k++) v += Math.sin(a * (3 + k * 4.3) + seed * k * 1.7) / k ** 1.25; return Math.max(0.12, 0.5 + v * 0.36); };
    for (let i = 0; i <= segs; i++) {
      const a = -1.45 + 2.9 * i / segs; const H = hmax * h(a) * (0.55 + 0.45 * Math.cos(a * 0.9));
      for (let r = 0; r <= rows; r++) { const f = r / rows; const y = -8 + (H + 8) * f; const rr2 = R + (1 - f) * 40; pos.push(Math.sin(a) * rr2, y, Math.cos(a) * rr2);
        const c = f > snowAt + 0.08 * Math.sin(i * 1.7) ? colSnow : colLow.clone().lerp(colSnow, Math.max(0, f - 0.3) * 0.5); col.push(c.r, c.g, c.b); }
    }
    for (let i = 0; i < segs; i++) for (let r = 0; r < rows; r++) { const a = i * (rows + 1) + r, b = a + rows + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); m.position.y = OUTZ; scene.add(m); W.mts.push(m); return m;
  };
  mtn(760, 230, 1.3, C(0x8a97ad), C(0xf4f7fb), 0.6);
  mtn(640, 120, 4.1, C(0x6f7d8f), C(0xe9eef4), 0.82);
  buildCity();

  // ---- звёзды
  const sp = []; for (let i = 0; i < 900; i++) { const u = rnd() * 6.28, v = Math.acos(rr(0.05, 1)); sp.push(Math.sin(v) * Math.cos(u) * 850, Math.cos(v) * 850, Math.sin(v) * Math.sin(u) * 850); }
  const sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  W.stars = new THREE.Points(sg2, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(W.stars);
  W.amb = new THREE.AmbientLight(0xffe2b8, 0); scene.add(W.amb);
  W.glass = pickables.filter(o => o.material && o.material.transparent);
}
function applySeason() {}

// ---------- небо и свет по времени ----------
const SKY_KEYS = [
  { el: 20, top: 0x3f7fc4, hor: 0xdbe7f1, bot: 0x7d8471, sun: 0xfff1dc, si: 2.0, hemi: 0.55, exp: 0.95 },
  { el: 6, top: 0x5179b3, hor: 0xf0d2a8, bot: 0x6e6a5c, sun: 0xffd2a0, si: 1.6, hemi: 0.45, exp: 0.95 },
  { el: 0, top: 0x3b4f7a, hor: 0xf2a46a, bot: 0x5b5048, sun: 0xff9d5c, si: 0.9, hemi: 0.32, exp: 0.95 },
  { el: -5, top: 0x1c2848, hor: 0x7a5068, bot: 0x2a2626, sun: 0x8a96d8, si: 0.25, hemi: 0.2, exp: 1.0 },
  { el: -12, top: 0x060b18, hor: 0x1d2a44, bot: 0x141414, sun: 0x9fb4ff, si: 0.16, hemi: 0.07, exp: 1.0 }];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
let skyT = -1;
function updateSky(t) {
  const { el, dir } = sunPos(t);
  let a = SKY_KEYS[0], b = SKY_KEYS[0], f = 0;
  if (el <= SKY_KEYS[4].el) { a = b = SKY_KEYS[4]; }
  else for (let i = 0; i < 4; i++) if (el <= SKY_KEYS[i].el && el > SKY_KEYS[i + 1].el) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; f = (a.el - el) / (a.el - b.el); }
  const L = (k) => _c1.set(a[k]).lerp(_c2.set(b[k]), f);
  const U = sky.material.uniforms;
  U.top.value.copy(L('top')); U.hor.value.copy(L('hor')); U.bot.value.copy(L('bot')); scene.fog.color.copy(U.hor.value);
  sun.color.copy(L('sun')); sun.intensity = a.si + (b.si - a.si) * f; hemi.intensity = a.hemi + (b.hemi - a.hemi) * f; renderer.toneMappingExposure = a.exp + (b.exp - a.exp) * f;
  if (WX.kind !== 'clear') { const k = WX.kind === 'cloudy' ? 0.5 : 0.3; sun.intensity *= k; hemi.intensity *= WX.kind === 'cloudy' ? 1.15 : 1.05; const grey = _c2.set(0x9aa3ad).multiplyScalar(Math.max(0.15, Math.min(1, (el + 6) / 20))); U.top.value.lerp(grey, 0.75); U.hor.value.lerp(grey, 0.5); scene.fog.color.copy(U.hor.value); scene.fog.near = WX.bad ? 60 : 150; scene.fog.far = WX.bad ? 380 : 650; } else { scene.fog.near = 200; scene.fog.far = 800; }
  if (el > -2) sun.position.copy(dir).multiplyScalar(110).setY(Math.max(6, dir.y * 110)); else sun.position.set(30, 70, -25);
  const night = Math.max(0, Math.min(1, (3 - el) / 9));
  const open = t > 400 && t < 1290 && !holiday() && !(EV.cur && EV.cur.type === 'power') && PERIOD() !== 'vacation';       // в корпусе горит свет
  W.glass.forEach(o => { const m = o.material; if (!m.emissive) m.emissive = new THREE.Color(); m.emissive.set(0xffc27a); m.emissiveIntensity = night * (open ? (o.userData.s === 2 ? 0.95 : 0.22) : 0.08); });
  W.lampMats.forEach(m => m.emissiveIntensity = night * 2.2);
  (W.cityGlass || []).forEach(m => { if (!m.emissive) m.emissive = new THREE.Color(); m.emissive.set(0x6b4a22); m.emissiveIntensity = night * 0.5; m.emissiveMap = m.map; });
  W.lights.forEach(l => l.intensity = night * 1.4);
  if (W.stars) W.stars.material.opacity = Math.max(0, Math.min(1, (-el - 4) / 8)) * 0.9;
  if (W.amb) W.amb.intensity = night * (open ? 0.12 : 0.04);
  const day = Math.max(0.16, Math.min(1, (el + 8) / 22));
  if (!W.envMats) { W.envMats = []; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { if (m.envMapIntensity != null && !W.envMats.includes(m)) { m.userData.envB = m.envMapIntensity; W.envMats.push(m); } }); }); }
  const envK = Math.max(0.06, Math.min(1, (el + 4) / 16)) * (WX.kind === 'clear' ? 1 : 0.75);
  W.envMats.forEach(m => m.envMapIntensity = m.userData.envB * envK);
  const haze = WX.bad ? 0.35 : WX.kind === 'cloudy' ? 0.7 : 1; W.mts.forEach(m => m.visible = haze > 0.4); W.mts.forEach(m => m.material.color.copy(_c1.set(0xffffff).multiplyScalar(day)).lerp(_c2.set(0xffb08a), el > -3 && el < 8 ? 0.25 * (1 - Math.abs(el - 2) / 6) : 0));
}
let flagT = 0, skyAcc = 1;
function worldFrame(dt) {
  trafficFrame(dt); precipFrame(dt); bellFrame(); todayFrame(dt);
  if ((skyAcc += dt) > 0.2 || Math.abs(simT - skyT) > 2) { skyAcc = 0; skyT = simT; updateSky(simT); }
  if (W.flag) {
    flagT += dt; const p = W.flag.geometry.attributes.position, B = W.flagBase;
    for (let i = 0; i < p.count; i++) { const x = B[i * 3], y = B[i * 3 + 1]; p.array[i * 3 + 2] = Math.sin(x * 2.3 - flagT * 4.2 + y * 0.6) * 0.14 * (x / 2.5); p.array[i * 3 + 1] = y - (x / 2.5) * 0.08; }
    p.needsUpdate = true; W.flag.geometry.computeVertexNormals();
  }
}

// ================= погода =================
const MONTH_T = [-2, 0, 7, 14, 18, 23, 26, 24, 19, 11, 4, -1];
const WX = { kind: 'clear', bad: false, temp: 5, parts: null, kindP: null };
function dayHash(d) { let x = (d * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }
function pickWeather(doy, dow) {
  const se = seasonOf(doy); const r = dayHash(doy * 7 + 3);
  const P = se === 'winter' ? [['clear', 0.35], ['cloudy', 0.3], ['snow', 0.35]] : se === 'summer' ? [['clear', 0.7], ['cloudy', 0.2], ['rain', 0.1]] : se === 'autumn' ? [['clear', 0.45], ['cloudy', 0.3], ['rain', 0.15], ['snow', 0.1]] : [['clear', 0.5], ['cloudy', 0.3], ['rain', 0.2]];
  let acc = 0; WX.kind = P[P.length - 1][0]; for (const [k, p] of P) { acc += p; if (r < acc) { WX.kind = k; break; } }
  if (WX.kind === 'snow' && MONTH_T[new Date(Date.UTC(2026, 0, doy)).getUTCMonth()] > 8) WX.kind = 'rain';
  WX.bad = WX.kind === 'rain' || WX.kind === 'snow';
  buildPrecip();
}
function tempAt(t) { const m = new Date(Date.UTC(2026, 0, SUN.doy)).getUTCMonth(); return Math.round(MONTH_T[m] + 5 * Math.cos((t - 900) / 1440 * 2 * Math.PI) - (WX.bad ? 2 : 0) + (dayHash(SUN.doy) - 0.5) * 4); }
const WX_ICON = { clear: '☀', cloudy: '☁', rain: '🌧', snow: '❄' };
function weatherLabel(t) { const el = sunPos(t).el; const ic = WX.kind === 'clear' && el < -2 ? '🌙' : WX_ICON[WX.kind]; const tt = tempAt(t); return `${ic} ${tt > 0 ? '+' : ''}${tt}°`; }
function buildPrecip() {
  if (WX.parts) { scene.remove(WX.parts); WX.parts.geometry.dispose(); WX.parts = null; }
  if (!WX.bad) return;
  const N = WX.kind === 'rain' ? 5000 : 4000, pos = new Float32Array(N * (WX.kind === 'rain' ? 6 : 3));
  for (let i = 0; i < N; i++) { const x = rr(-60, 60), y = rr(-1, 40), z = rr(-60, 60); if (WX.kind === 'rain') pos.set([x, y, z, x + 0.05, y - 0.5, z], i * 6); else pos.set([x, y, z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  WX.parts = WX.kind === 'rain' ? new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.45 }))
    : new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
  WX.parts.frustumCulled = false; scene.add(WX.parts);
}
function precipFrame(dt) {
  if (!WX.parts) return; const a = WX.parts.geometry.attributes.position.array; const rain = WX.kind === 'rain'; const st = rain ? 6 : 3; const v = rain ? 16 : 1.1; const tw = performance.now() / 1000;
  for (let i = 0; i < a.length; i += st) { a[i + 1] -= v * dt; if (!rain) { a[i] += Math.sin(tw + i) * 0.006; } if (rain) a[i + 4] -= v * dt; if (a[i + 1] < OUTZ) { const k = rain ? 40 + rr(0, 2) : 40; a[i + 1] += k; if (rain) a[i + 4] += k; } }
  WX.parts.geometry.attributes.position.needsUpdate = true;
  const T = controls.target; WX.parts.position.set(Math.round(T.x / 10) * 10, 0, Math.round(T.z / 10) * 10);
}

// ================= улица Раззакова: машины и маршрутки =================
const CARS = [];
function buildTraffic() {
  const bodyG = new THREE.BoxGeometry(1.8, 0.7, 4.3); bodyG.translate(0, 0.62, 0);
  const cabG = new THREE.BoxGeometry(1.62, 0.6, 2.2); cabG.translate(0, 1.27, -0.2);
  const wheelG = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12); wheelG.rotateZ(Math.PI / 2);
  const busG = new THREE.BoxGeometry(2.0, 2.05, 5.9); busG.translate(0, 1.33, 0);
  const busWinG = new THREE.BoxGeometry(2.02, 0.62, 5.0); busWinG.translate(0, 1.85, -0.3);
  const lightG = new THREE.BoxGeometry(0.3, 0.14, 0.05);
  const glassM = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.15, metalness: 0.5 });
  const tireM = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const headM = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1c8, emissiveIntensity: 0.2 }); W.lampMats.push(headM);
  const tailM = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2010, emissiveIntensity: 0.2 }); W.lampMats.push(tailM);
  const signC = document.createElement('canvas'); signC.width = 128; signC.height = 48; const sg = signC.getContext('2d'); sg.fillStyle = '#111'; sg.fillRect(0, 0, 128, 48); sg.fillStyle = '#ffb020'; sg.font = 'bold 36px monospace'; sg.textAlign = 'center'; sg.fillText('110', 64, 38);
  const signM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signC) });
  const colors = [0xf2f2f2, 0x1b1b1b, 0xb8bcc2, 0x2a4f8a, 0x8a1c1c, 0xe0e0e0, 0x6d7278, 0x173d2e, 0xd9c9a3, 0x0f0f0f];
  const mk = (bus) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bus ? busG : bodyG, new THREE.MeshStandardMaterial({ color: bus ? 0xf4f4ef : pick(colors), roughness: 0.35, metalness: 0.3 }));
    const cab = new THREE.Mesh(bus ? busWinG : cabG, bus ? glassM : glassM); g.add(body, cab);
    if (!bus) { const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.9), body.material); roof.position.set(0, 1.58, -0.25); g.add(roof); }
    const L = bus ? 2.0 : 1.35; [[-0.86, L], [0.86, L], [-0.86, -L], [0.86, -L]].forEach(([x, z]) => { const w = new THREE.Mesh(wheelG, tireM); w.position.set(x, 0.33, z); g.add(w); });
    const half = bus ? 2.95 : 2.15; [-0.6, 0.6].forEach(x => { const h = new THREE.Mesh(lightG, headM); h.position.set(x, bus ? 0.8 : 0.7, half + 0.01); const t = new THREE.Mesh(lightG, tailM); t.position.set(x, bus ? 0.9 : 0.75, -half - 0.01); g.add(h, t); });
    if (bus) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), signM); s.position.set(0, 2.15, half + 0.02); g.add(s); const st = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.18, 5.92), new THREE.MeshStandardMaterial({ color: 0xf2b705 })); st.position.y = 1.1; g.add(st); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g;
  };
  // маршруты: Раззакова (на юг), Токтогула (на запад, 2 полосы), Эркиндик (юг/север), Киевская (на восток)
  const R = [{ x: -40.5, y: 300, dx: 0, dy: -1, n: 5 }, { x: 300, y: -87, dx: -1, dy: 0, n: 6, stop: -5 }, { x: 300, y: -92.5, dx: -1, dy: 0, n: 5 }, { x: 75.5, y: 300, dx: 0, dy: -1, n: 4, stop: -40 }, { x: 137.5, y: -300, dx: 0, dy: 1, n: 4 }, { x: -300, y: 135, dx: 1, dy: 0, n: 3 }];
  R.forEach((r, ri) => { for (let i = 0; i < r.n; i++) { const bus = r.stop != null && i % 3 === 0; CARS.push({ g: mk(bus), bus, r, s: rr(0, 600), v: bus ? rr(8, 10) : rr(9, 14), stop: 0, stopped: false, active: true }); } });
  // припаркованные машины вдоль Раззакова и у Дипакадемии
  for (let y = -70; y < 120; y += rr(5.5, 9)) { if (Math.abs(y + 31.4) < 6 || Math.abs(y - 30.2) < 6) continue; const g = mk(false); g.position.set(-43, OUTZ + 0.02, -y); scene.add(g); }
  for (let y = -48; y < 4; y += rr(5, 7)) { const g = mk(false); g.position.set(64.5, OUTZ + 0.02, -y); g.rotation.y = Math.PI / 2 + (chance(0.5) ? Math.PI : 0); }
  // остановка маршруток на Токтогула
  const shelter = new THREE.Group();
  const roofS = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 4), new THREE.MeshStandardMaterial({ color: 0x2b5c8a })); roofS.position.y = 2.4;
  const backS = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 4), new THREE.MeshPhysicalMaterial({ color: 0xbfd6e8, transparent: true, opacity: 0.35, roughness: 0.1 })); backS.position.set(-0.75, 1.3, 0);
  const benchS = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 3), new THREE.MeshStandardMaterial({ color: 0x8a5a34 })); benchS.position.set(-0.45, 0.46, 0);
  shelter.add(roofS, backS, benchS); [-1.9, 1.9].forEach(z => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4), new THREE.MeshStandardMaterial({ color: 0x333 })); p.position.set(-0.7, 1.2, z); shelter.add(p); });
  shelter.position.set(-5, OUTZ, 81.6); shelter.rotation.y = Math.PI / 2; scene.add(shelter); shelter.traverse(o => { if (o.isMesh) o.castShadow = true; });
}
function trafficFrame(dt) {
  const k = Math.min(simSpeed, 6); if (!k) return; const d = dt * k;
  const h = simT / 60, busy = h < 6 ? 0.2 : h < 7 ? 0.5 : h < 22 ? 1 : 0.35;
  for (const c of CARS) {
    const r = c.r;
    if (c.stop > 0) { c.stop -= d; } else {
      c.s += c.v * d;
      if (c.bus && r.stop != null && !c.stopped) { const pos = (r.dx ? r.x + r.dx * c.s : r.y + r.dy * c.s); if (Math.abs(pos - r.stop) < 1) { c.stop = 14; c.stopped = true; } }
      if (c.s > 600) { c.s -= 600; c.stopped = false; c.active = rnd() < busy; c.v = c.bus ? rr(8, 10) : rr(9, 14); }
    }
    c.g.visible = c.active; c.g.position.set(r.x + r.dx * c.s, OUTZ + 0.02, -(r.y + r.dy * c.s)); c.g.rotation.y = Math.atan2(r.dx, -r.dy);
  }
}

// ================= звонок =================
let lastBellT = null, bellSound = false, actx = null;
function ring(text) {
  const t = document.getElementById('bellToast'); if (t) { t.textContent = '🔔 ' + text; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3500); }
  if (bellSound) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const now = actx.currentTime; for (let i = 0; i < 10; i++) { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, now + i * 0.18); g.gain.exponentialRampToValueAtTime(0.08, now + i * 0.18 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.15); o.connect(g).connect(actx.destination); o.start(now + i * 0.18); o.stop(now + i * 0.18 + 0.16); } } catch (e) { } }
}
function bellFrame() {
  if (lastBellT == null || simT < lastBellT || simT - lastBellT > 30) { lastBellT = simT; return; }
  if (!holiday()) for (let p = 0; p < PAIRS.length; p++) {
    if (lastBellT < PAIRS[p][0] && simT >= PAIRS[p][0]) ring(`Звонок на пару: ${PSH[p]} смена, ${PAIR_NAMES[p]}`);
    if (lastBellT < PAIRS[p][1] && simT >= PAIRS[p][1]) ring(`Звонок с пары: ${PSH[p]} смена, перемена`);
  }
  lastBellT = simT;
}

// ================= «Сегодня в ИНИТ» =================
function todayHTML() {
  const S = STUDENTS.filter(s => s.spawned || s.doneToday);
  const top = (k, f = v => v) => { let b = null; S.forEach(s => { if (s.st[k] > 0 && (!b || s.st[k] > b.st[k])) b = s; }); return b ? `<a data-n="${b.id}">${b.name} ${b.surname[0]}.</a> <span>${f(b.st[k])}</span>` : '<span>пока никто</span>'; };
  const held = PAIRS.filter(p => p[1] <= simT).reduce((a, p, i) => a + Object.keys(SCHED[PAIRS.indexOf(p)]).length, 0);
  const late = S.reduce((a, s) => a + s.st.late, 0), broke = S.reduce((a, s) => a + s.st.broke, 0), km = S.reduce((a, s) => a + s.st.dist, 0) / 1000;
  return `<h2>Сегодня в ИНИТ</h2>
  <div class="today"><div><b>${S.length}</b><span>студентов пришло</span></div><div><b>${held}</b><span>пар проведено</span></div><div><b>${late}</b><span>опозданий</span></div><div><b>${broke}</b><span>ПК сломали</span></div><div><b>${km.toFixed(1).replace('.', ',')}</b><span>км прошли</span></div></div>
  <div class="rank"><div>🗣 Самый общительный</div><div>${top('chat', v => Math.round(v) + ' мин болтал')}</div>
  <div>😴 Главный соня</div><div>${top('sleep', v => 'уснул ' + v + ' раз')}</div>
  <div>⏰ Опоздун дня</div><div>${top('late', v => v + ' раз опоздал')}</div>
  <div>💻 Ломатель компов</div><div>${top('broke', v => v + ' ПК')}</div>
  <div>🏃 Марафонец</div><div>${top('dist', v => Math.round(v) + ' м')}</div>
  <div>⌨ Главный кодер</div><div>${top('code', v => v + ' раз кодил')}</div>
  <div>🙋 Активист</div><div>${top('hand', v => 'тянул руку ' + v + ' раз')}</div></div>`;
}
let todayAcc = 99;
function todayFrame(dt) {
  if ((todayAcc += dt) < 2) return; todayAcc = 0;
  const box = document.getElementById('todayBox'); if (!box) return; box.innerHTML = todayHTML();
  box.querySelectorAll('a[data-n]').forEach(a => a.onclick = () => { const n = NPCS[+a.dataset.n]; if (n.spawned) { selectNPC(n); followN = n; document.getElementById('sFollow')?.classList.add('on'); } });
}

// ================= фото =================
let DL = null;
function takePhoto() {
  if (!DL) return;
  document.body.classList.add('photo');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    renderer.domElement.toBlob(blob => {
      setTimeout(() => document.body.classList.remove('photo'), 300);
      if (!blob) return;
      DL.save({ filename: `kgu-korpus-${hhmm(simT).replace(':', '-')}.png`, data: blob }).catch(e => {
        if (!['declined', 'rate_limited'].includes(e && e.code)) { DL = null; const b = document.getElementById('sPhoto'); if (b) b.style.display = 'none'; }
      });
    }, 'image/png');
  }));
}
function worldUI() {
  const box = document.getElementById('simBox');
  const extra = document.createElement('div'); extra.className = 'seg';
  extra.innerHTML = `<button id="sPhoto">📸 Фото</button><button id="sBell">🔕 Звонок</button>`;
  box.appendChild(extra);
  const pb = document.getElementById('sPhoto'); pb.onclick = takePhoto; pb.style.display = 'none';
  try { window.claude?.use?.('downloads').then(d => { if (d) { DL = d; pb.style.display = ''; } }).catch(() => {}); } catch (e) {}
  document.getElementById('sBell').onclick = e => { bellSound = !bellSound; e.target.textContent = bellSound ? '🔔 Звонок' : '🔕 Звонок'; e.target.classList.toggle('on', bellSound); if (bellSound) ring('Звук звонка включён'); };
  const toast = document.createElement('div'); toast.id = 'bellToast'; host.appendChild(toast);
  const tb = document.createElement('div'); tb.id = 'todayBox'; const exp = document.getElementById('exp'); exp.insertBefore(tb, document.getElementById('tbl'));
  const h2 = exp.querySelector('h2'); if (h2) { h2.textContent = 'Состав модели'; exp.insertBefore(tb, h2); }
}

// ================= город вокруг =================
function boxTex(floors, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  const base = new THREE.Color(color); g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#' + base.clone().multiplyScalar(0.8).getHexString(); g.fillRect(0, 120, 128, 8);
  for (let x = 0; x < 4; x++) { g.fillStyle = '#3e4a56'; g.fillRect(10 + x * 30, 30, 18, 52); g.fillStyle = '#f4efe6'; g.fillRect(18 + x * 30, 30, 2, 52); g.fillRect(10 + x * 30, 54, 18, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
}
function buildCity() {
  const flat = (x0, x1, y0, y1, color, h = 0.02, rough = 0.95) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshStandardMaterial({ color, roughness: rough })); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, OUTZ + h, -(y0 + y1) / 2); m.receiveShadow = true; scene.add(m); return m; };
  CITY.walks.forEach(w => flat(w[0], w[1], w[2], w[3], 0xa9a49a, 0.022));
  CITY.roads.forEach((r, i) => flat(r[0], r[1], r[2], r[3], 0x3a3d41, 0.026 + i * 0.001));
  // аллея бульвара Эркиндик: газон + центральная дорожка
  flat(79, 134, -300, 300, 0x7f8a4f, 0.018); flat(104, 110, -300, 300, 0xb3a98f, 0.024);
  // разметка
  const dashes = []; CITY.roads.forEach(r => { const vert = r[1] - r[0] < r[3] - r[2]; const c = vert ? (r[0] + r[1]) / 2 : (r[2] + r[3]) / 2; for (let u = -296; u < 296; u += 6) { const x = vert ? c : u, y = vert ? u : c; if (CITY.roads.some(o => o !== r && x > o[0] && x < o[1] && y > o[2] && y < o[3])) continue; dashes.push([x, y, vert]); } });
  const dm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 2.6), new THREE.MeshBasicMaterial({ color: 0xdedbd2 }), dashes.length); const m4 = new THREE.Matrix4(), r4 = new THREE.Matrix4();
  dashes.forEach(([x, y, v], i) => { m4.makeRotationX(-Math.PI / 2); if (!v) m4.premultiply(r4.makeRotationY(Math.PI / 2)); m4.setPosition(x, OUTZ + 0.04, -y); dm.setMatrixAt(i, m4); }); scene.add(dm);
  // зебры
  const zebra = []; const zAt = (x, y, vert) => { for (let k = -4; k < 5; k++) zebra.push([vert ? x + k * 0.9 : x, vert ? y : y + k * 0.9, vert]); };
  zAt(-39.75, -31.4, true); zAt(-39.75, 30.2, true); zAt(-25, -90, false); zAt(75.5, -40, true);
  const zm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 3.2), new THREE.MeshBasicMaterial({ color: 0xf0eee8 }), zebra.length);
  zebra.forEach(([x, y, v], i) => { m4.makeRotationX(-Math.PI / 2); if (v) m4.premultiply(r4.makeRotationY(Math.PI / 2)); m4.setPosition(x, OUTZ + 0.045, -y); zm.setMatrixAt(i, m4); }); scene.add(zm);
  // соседние здания
  CITY.blocks.forEach(b => {
    const [x0, x1, y0, y1, h, col] = b; const fl = Math.max(1, Math.round(h / 3.2));
    const side = (len) => { const t = boxTex(fl, col); t.repeat.set(Math.max(1, Math.round(len / 7)), fl); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); };
    const top = new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 0.95 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, y1 - y0), [side(y1 - y0), side(y1 - y0), top, top, side(x1 - x0), side(x1 - x0)]);
    m.position.set((x0 + x1) / 2, OUTZ + h / 2, -(y0 + y1) / 2); m.castShadow = m.receiveShadow = true; scene.add(m);
    W.cityGlass = W.cityGlass || []; m.material.forEach(mm => { if (mm.map) W.cityGlass.push(mm); });
  });
  // спортплощадка к югу от корпуса
  const [fx0, fx1, fy0, fy1] = CITY.field;
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 512; const g = fc.getContext('2d');
  g.fillStyle = '#3f7d3a'; g.fillRect(0, 0, 256, 512); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3a7436' : '#438340'; g.fillRect(0, i * 64, 256, 64); }
  g.strokeStyle = '#f2f2f2'; g.lineWidth = 3; g.strokeRect(12, 12, 232, 488); g.beginPath(); g.moveTo(12, 256); g.lineTo(244, 256); g.stroke(); g.beginPath(); g.arc(128, 256, 36, 0, 7); g.stroke(); g.strokeRect(68, 12, 120, 56); g.strokeRect(68, 444, 120, 56);
  const ft = new THREE.CanvasTexture(fc); ft.encoding = THREE.sRGBEncoding;
  const field = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0, fy1 - fy0), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 })); field.rotation.x = -Math.PI / 2; field.rotation.z = Math.PI / 2;
  field.geometry = new THREE.PlaneGeometry(fy1 - fy0, fx1 - fx0); field.position.set((fx0 + fx1) / 2, OUTZ + 0.03, -(fy0 + fy1) / 2); field.receiveShadow = true; scene.add(field);
  const goalM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  [fx0 + 1, fx1 - 1].forEach(x => { const gl = new THREE.Group(); [-1.5, 1.5].forEach(z => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2), goalM); p.position.set(0, 1, z); gl.add(p); }); const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), goalM); cb.rotation.x = Math.PI / 2; cb.position.y = 2; gl.add(cb); gl.position.set(x, OUTZ, -(fy0 + fy1) / 2); gl.traverse(o => o.castShadow = true); scene.add(gl); });
  // таблички улиц
  const plate = (text, x, y, rotY) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 110; const q = c.getContext('2d');
    q.fillStyle = '#1f4e8c'; q.fillRect(0, 0, 512, 110); q.strokeStyle = '#fff'; q.lineWidth = 6; q.strokeRect(8, 8, 496, 94); q.fillStyle = '#fff'; q.font = 'bold 46px sans-serif'; q.textAlign = 'center'; q.fillText(text, 256, 72);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const gr = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8), new THREE.MeshStandardMaterial({ color: 0x55595e })); pole.position.y = 1.4;
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.34), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); pm.position.y = 2.6;
    gr.add(pole, pm); gr.position.set(x, OUTZ, -y); gr.rotation.y = rotY; scene.add(gr);
  };
  plate('ул. Раззакова', -34.3, -79.2, Math.PI / 2); plate('ул. Токтогула', -32.5, -81.8, 0); plate('бул. Эркиндик', 70.5, -81.5, Math.PI / 2);
  plate('ул. Раззакова 51', -32.2, -30.8, Math.PI / 2); plate('ул. Киевская', -34.3, 129.5, 0);
}
