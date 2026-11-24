// ================= ДВЕРИ: открываются, когда кто-то проходит =================
const DOORS: Door[] = [];
function buildDoors() {
  const f = 2, G = GRID[f], seen = new Uint8Array(G.length);
  // проёмы = связные группы клеток -2 на сетке 3 этажа
  const boxes = [];
  for (let k = 0; k < G.length; k++) {
    if (G[k] !== -2 || seen[k]) continue;
    const q = [k], c = []; seen[k] = 1;
    while (q.length) { const a = q.pop(); c.push(a); const i = a % SNX; for (const m of [i > 0 ? a - 1 : -1, i < SNX - 1 ? a + 1 : -1, a - SNX, a + SNX]) if (m >= 0 && m < G.length && G[m] === -2 && !seen[m]) { seen[m] = 1; q.push(m); } }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; c.forEach(a => { const x = wx(a % SNX), y = wy(Math.floor(a / SNX)); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    if (c.length >= 8) boxes.push([x0 - 0.45, y0 - 0.45, x1 + 0.45, y1 + 0.45]);
  }
  const z0 = FZ[f];
  const src = storeyG[f].children.filter(m => m.isMesh && !m.isInstancedMesh && m.userData && /SOSNA_PRODOL_NAA_GORI|METALL|STEKLO/.test(m.userData.m || ''));
  for (const bx of boxes) {
    // 1) рамка двери: деревянные треугольники в проёме
    let mn = [1e9, 1e9], mx = [-1e9, -1e9], found = 0;
    for (const m of src) { if (!/SOSNA/.test(m.userData.m)) continue; const p = m.geometry.attributes.position; for (let t = 0; t < p.count; t++) { const x = p.getX(t), y = p.getY(t), z = p.getZ(t) - z0; if (x > bx[0] && x < bx[2] && y > bx[1] && y < bx[3] && z > -0.2 && z < 2.3) { mn[0] = Math.min(mn[0], x); mn[1] = Math.min(mn[1], y); mx[0] = Math.max(mx[0], x); mx[1] = Math.max(mx[1], y); found++; } } }
    if (found < 30) continue;
    const ax = (mx[0] - mn[0]) > (mx[1] - mn[1]) ? 0 : 1, ox = 1 - ax;      // ось стены
    const W = mx[ax] - mn[ax]; if (W < 0.6 || W > 1.6) continue;
    const lo = mn[ax] + 0.05, hi = mx[ax] - 0.05;
    // 2) полотно: треугольники целиком внутри просвета и ниже притолоки
    const dbl = W > 1.3, mid = (lo + hi) / 2;
    const parts = [];
    let tmin = 1e9, tmax = -1e9;
    for (const m of src) {
      const p = m.geometry.attributes.position, keep = [];
      for (let t = 0; t < p.count; t += 3) {
        let ok = true;
        for (let k = 0; k < 3 && ok; k++) { const v = [p.getX(t + k), p.getY(t + k)], z = p.getZ(t + k) - z0; if (v[ax] < lo - 0.003 || v[ax] > hi + 0.003 || v[ox] < mn[ox] - 0.01 || v[ox] > mx[ox] + 0.01 || z < 0.005 || z > 1.985) ok = false; }
        if (ok && dbl) { const vs = [0, 1, 2].map(k => [p.getX(t + k), p.getY(t + k)][ax]); if (Math.min(...vs) < mid - 0.03 && Math.max(...vs) > mid + 0.03) ok = false; }
        if (ok) keep.push(t);
      }
      if (!keep.length) continue;
      const arr = new Float32Array(keep.length * 9), half = new Uint8Array(keep.length);
      keep.forEach((t, j) => { half[j] = dbl && ([p.getX(t), p.getY(t)][ax] + [p.getX(t + 1), p.getY(t + 1)][ax] + [p.getX(t + 2), p.getY(t + 2)][ax]) / 3 > mid ? 1 : 0; for (let k = 0; k < 3; k++) { arr[j * 9 + k * 3] = p.getX(t + k); arr[j * 9 + k * 3 + 1] = p.getY(t + k); arr[j * 9 + k * 3 + 2] = p.getZ(t + k); const o = [p.getX(t + k), p.getY(t + k)][ox]; tmin = Math.min(tmin, o); tmax = Math.max(tmax, o); p.setXYZ(t + k, 0, 0, -50); } });
      p.needsUpdate = true;
      parts.push({ arr, half, mat: m.material });
    }
    if (!parts.length) continue;
    // 3) петли с одной стороны, открывается в комнату (не в коридор)
    const cxm = (mn[0] + mx[0]) / 2, cym = (mn[1] + mx[1]) / 2;
    const nrm = ax === 0 ? [0, 1] : [1, 0];
    const side = s => { const r = roomAt(f, cxm + nrm[0] * s * 1.2, cym + nrm[1] * s * 1.2); return r >= 0 && !CORR[f].includes(r) ? 1 : 0; };
    const into = side(1) >= side(-1) ? 1 : -1;
    const u = [0, 0]; u[ax] = 1; const perp = [-u[1], u[0]]; const base = (perp[0] * nrm[0] + perp[1] * nrm[1]) * into > 0 ? 1 : -1;
    const leaves = [];
    for (const h of dbl ? [0, 1] : [0]) {
      const hp = [0, 0]; hp[ax] = h ? hi : lo; hp[ox] = into > 0 ? tmax : tmin;
      const pivot = new THREE.Group(); pivot.position.set(hp[0], hp[1], z0);
      for (const pt of parts) {
        const idx = []; for (let j = 0; j < pt.half.length; j++) if (pt.half[j] === h) idx.push(j);
        if (!idx.length) continue;
        const a = new Float32Array(idx.length * 9); idx.forEach((j, q) => { for (let k = 0; k < 9; k += 3) { a[q * 9 + k] = pt.arr[j * 9 + k] - hp[0]; a[q * 9 + k + 1] = pt.arr[j * 9 + k + 1] - hp[1]; a[q * 9 + k + 2] = pt.arr[j * 9 + k + 2] - z0; } });
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.computeVertexNormals();
        const ms = new THREE.Mesh(g, pt.mat); ms.castShadow = !pt.mat.transparent; ms.receiveShadow = true; ms.userData = { t: 'IfcDoor', s: f, door: true }; pivot.add(ms);
      }
      storeyG[f].add(pivot); leaves.push({ pivot, sgn: h ? -base : base });
    }
    DOORS.push({ f, x: cxm, y: cym, leaves, open: 0, want: 0, w: W });
  }
  if (window.DEBUG_DOORS) console.log('doors', DOORS.length);
}
let doorK = 0;
function doorsFrame(dt: number): void {
  if (!DOORS.length) return;
  // кто рядом с дверью: проверяем часть дверей за кадр
  const per = Math.max(4, Math.ceil(DOORS.length / 3));
  for (let c = 0; c < per; c++) {
    const d = DOORS[doorK = (doorK + 1) % DOORS.length]; let near = false;
    for (const n of NPCS) { if (!n.spawned || n.hidden || n.f !== d.f) continue; const dx = n.x - d.x, dy = n.y - d.y; if (dx * dx + dy * dy < 1.45 * 1.45) { near = true; break; } }
    if (!near && typeof fpvOn !== 'undefined' && fpvOn && typeof FPV !== 'undefined' && FPV && FPV.f === d.f && Math.hypot(FPV.x - d.x, FPV.y - d.y) < 1.6) near = true;
    if (near) d.hold = performance.now() + 1600;
    d.want = performance.now() < (d.hold || 0) ? 1 : 0;
  }
  const k = 1 - Math.exp(-dt * 5);
  for (const d of DOORS) { if (Math.abs(d.want - d.open) < 0.002) continue; d.open += (d.want - d.open) * k; for (const L of d.leaves) L.pivot.rotation.z = L.sgn * d.open * 1.45; }
}
const _evInit0d = evInit; evInit = () => { _evInit0d(); try { buildDoors(); } catch (e) { console.warn('doors', e); } };
const _simFrame0d = simFrame; let _dl = performance.now();
simFrame = () => { const now = performance.now(), dt = Math.min(0.1, (now - _dl) / 1000); _dl = now; _simFrame0d(); doorsFrame(dt); };
