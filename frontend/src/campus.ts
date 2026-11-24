// ================= 1 корпус «как в жизни» (по фото 2ГИС, 2026-11-24) =================
// Бежевый фасад с тёмно-коричневым низом, коричневая крыша, кондиционеры, портрет-силуэт Арабаева на торце,
// ряд флагов вдоль корпуса с соснами и белым забором-зигзагом, юрта-беседка, мачта-антенна, топиарии,
// коридор (ламинат, двери, LED-панели), общежитие через ул. Раззакова с переходом и светофором.

const CAMPUS: any = { flags: [], led: null, roofMat: null, roofBrown: null, mastLight: null, yurt: null, yurtP: null, t0: performance.now(), pineCrowns: [], yurtRoof: null };

// ---------- 1. фасад ----------
const FACADE_HEAD = `uniform sampler2D uCoreF; uniform vec4 uGridF; uniform float uBaseF; varying vec3 vWPf; varying vec3 vWNf;
float coreF(vec2 p){ vec2 uv = (p - uGridF.xy) / uGridF.zw; if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.; return texture2D(uCoreF, uv).r; }
float hashF(vec2 p){ return fract(sin(dot(p, vec2(41.31, 289.17))) * 15731.743); }`;
const FACADE_GLSL = `
  { vec2 p = vec2(vWPf.x, -vWPf.z); vec2 nn = vec2(vWNf.x, -vWNf.z);
    if (abs(vWNf.y) < 0.5 && dot(nn, nn) > 0.1) {
      // смотрим с той стороны, с которой видна грань (нормали в IFC бывают вывернуты): если там нет помещения — это фасад
      nn = normalize(nn) * (gl_FrontFacing ? 1.0 : -1.0);
      float front = max(max(coreF(p + nn * 0.3), coreF(p + nn * 0.8)), coreF(p + nn * 1.5));
      if (front < 0.5) {
        float n = hashF(floor(vec2(p.x + p.y, vWPf.y) * 9.0)) * 0.06;
        vec3 c = vWPf.y < uBaseF ? vec3(0.085, 0.045, 0.03) : vec3(0.80, 0.70, 0.49);
        if (vWPf.y > uBaseF - 0.12 && vWPf.y < uBaseF + 0.05) c = vec3(0.05, 0.03, 0.02);
        diffuseColor.rgb = c * (0.96 + n);
      }
    } }`;
function facadeMat(mat) {
  const m = mat.clone(); m.name = (mat.name || '') + '#facade';
  const prev = mat.onBeforeCompile && mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ? mat.onBeforeCompile : null;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uCoreF = { value: CTEX }; sh.uniforms.uGridF = { value: new THREE.Vector4(SX0, SY0, SNX * SR, SNY * SR) }; sh.uniforms.uBaseF = { value: 2.9 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPf; varying vec3 vWNf;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPf = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNf = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FACADE_HEAD).replace('#include <map_fragment>', '#include <map_fragment>\n' + FACADE_GLSL);
  };
  m.customProgramCacheKey = () => 'facade-' + prevKey;
  return m;
}
function campusFacade() {
  if (!CTEX) return;
  const cache = new Map();
  const wallRe = /STUKATURKA|KRASKA_-_PESOCNO|KRASKA_-_SVETLO|BETON|GRANIT/;
  storeyG.forEach(g => g.children.forEach(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.material || o.material.transparent) return;
    const key = o.material.name || '';
    if (/PERSIKOVAA/.test(key)) { // кровля
      if (!CAMPUS.roofMat) { const m = new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide, flatShading: true }); m.name = key + '#roof'; CAMPUS.roofMat = m; CAMPUS.roofBrown = m.color.clone(); }
      o.material = CAMPUS.roofMat; return;
    }
    if (o.userData.t !== 'IfcWall' || !wallRe.test(key) || /#floor|#ceil/.test(key)) return;
    if (!cache.has(o.material)) cache.set(o.material, facadeMat(o.material));
    o.material = cache.get(o.material);
  }));
}

// ---------- геометрия корпуса по сетке ----------
const fpAt = (x, y) => { const i = cx(x), j = cy(y); return i >= 0 && j >= 0 && i < SNX && j < SNY && !!GRID.FP[j * SNX + i]; };
// первая клетка здания при движении из (x, y) по направлению (dx, dy)
function hitFP(x, y, dx, dy, max = 60) { for (let d = 0; d < max; d += SR / 2) if (fpAt(x + dx * d, y + dy * d)) return { x: x + dx * d, y: y + dy * d, d }; return null; }

// ---------- 2. кондиционеры ----------
function campusAC() {
  const FP = GRID.FP, spots = [];
  const ok = (x, y) => !ENTR.some(e => Math.hypot(e.out[0] - x, e.out[1] - y) < 3.5);
  for (let t = 0; t < 4000 && spots.length < 46; t++) {
    const i = 2 + Math.floor(rnd() * (SNX - 4)), j = 2 + Math.floor(rnd() * (SNY - 4)), k = j * SNX + i; if (!FP[k]) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (FP[k + di + dj * SNX]) continue;
      // прямая стена: 8 клеток вдоль, снаружи пусто
      let straight = true; for (let s = -8; s <= 8 && straight; s++) { const kk = k + (dj ? s : 0) + (di ? s * SNX : 0); if (!FP[kk] || FP[kk + di + dj * SNX]) straight = false; }
      if (!straight) continue;
      const x = wx(i) + di * (SR / 2 + 0.16), y = wy(j) + dj * (SR / 2 + 0.16);
      if (!ok(x, y) || spots.some(s => Math.hypot(s.x - x, s.y - y) < 4.2)) continue;
      spots.push({ x, y, a: Math.atan2(dj, di), z: chance(0.55) ? 2.25 : 5.15 });
    }
  }
  const g = new THREE.BoxGeometry(0.3, 0.55, 0.8); const grill = new THREE.CircleGeometry(0.2, 14);
  const body = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.5 }), spots.length);
  const fan = new THREE.InstancedMesh(grill, new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.6 }), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  spots.forEach((s, i) => {
    q.setFromAxisAngle(Y, s.a); m4.compose(new THREE.Vector3(s.x, s.z, -s.y), q, new THREE.Vector3(1, 1, 1)); body.setMatrixAt(i, m4);
    const f = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(0.152, 0, 0.12); fan.setMatrixAt(i, m4.clone().multiply(f));
  });
  body.castShadow = true; scene.add(body, fan);
}

// ---------- 3. портрет-силуэт Арабаева на торце ----------
function portraitTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 640; const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 640); g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineCap = 'round'; g.lineJoin = 'round';
  // калпак
  g.beginPath(); g.moveTo(140, 190); g.bezierCurveTo(150, 90, 260, 30, 330, 60); g.bezierCurveTo(380, 80, 400, 150, 395, 205); g.bezierCurveTo(330, 175, 220, 175, 140, 190); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(170, 175); g.bezierCurveTo(190, 120, 260, 80, 320, 90); g.lineWidth = 7; g.strokeStyle = '#fff'; g.stroke();
  g.beginPath(); g.moveTo(230, 165); g.quadraticCurveTo(270, 120, 330, 125); g.stroke(); g.strokeStyle = '#111'; g.fillStyle = '#111';
  // поля калпака (отворот)
  g.beginPath(); g.moveTo(125, 200); g.quadraticCurveTo(260, 160, 410, 210); g.lineTo(405, 232); g.quadraticCurveTo(260, 190, 132, 222); g.closePath(); g.fill();
  // лицо: контур, ухо, брови, глаза, нос, усы
  g.lineWidth = 12;
  g.beginPath(); g.moveTo(168, 232); g.bezierCurveTo(150, 300, 165, 380, 215, 420); g.bezierCurveTo(255, 445, 320, 440, 355, 395); g.bezierCurveTo(385, 350, 385, 280, 372, 232); g.stroke();
  g.beginPath(); g.ellipse(380, 300, 16, 30, 0.1, -1.4, 1.6); g.stroke();
  g.lineWidth = 10; g.beginPath(); g.moveTo(200, 262); g.quadraticCurveTo(230, 248, 262, 260); g.stroke(); g.beginPath(); g.moveTo(292, 258); g.quadraticCurveTo(320, 248, 348, 262); g.stroke();
  g.beginPath(); g.ellipse(232, 286, 14, 6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(318, 286, 14, 6, 0, 0, 7); g.fill();
  g.lineWidth = 9; g.beginPath(); g.moveTo(278, 280); g.quadraticCurveTo(268, 330, 262, 345); g.quadraticCurveTo(280, 356, 300, 346); g.stroke();
  g.beginPath(); g.moveTo(222, 382); g.bezierCurveTo(245, 360, 270, 362, 282, 372); g.bezierCurveTo(296, 362, 322, 360, 345, 380); g.bezierCurveTo(320, 376, 296, 380, 282, 386); g.bezierCurveTo(268, 380, 245, 377, 222, 382); g.fill();
  g.lineWidth = 7; g.beginPath(); g.moveTo(250, 408); g.quadraticCurveTo(282, 416, 315, 406); g.stroke();
  // плечи и ворот
  g.lineWidth = 13; g.beginPath(); g.moveTo(205, 425); g.quadraticCurveTo(170, 460, 80, 490); g.stroke(); g.beginPath(); g.moveTo(350, 418); g.quadraticCurveTo(390, 455, 470, 480); g.stroke();
  g.beginPath(); g.moveTo(225, 440); g.lineTo(280, 520); g.lineTo(330, 438); g.stroke();
  g.beginPath(); g.moveTo(80, 490); g.quadraticCurveTo(90, 520, 120, 530); g.stroke(); g.beginPath(); g.moveTo(470, 480); g.quadraticCurveTo(455, 515, 420, 528); g.stroke();
  // подпись
  g.font = 'italic 64px "Brush Script MT", "Segoe Script", cursive, serif'; g.textAlign = 'center'; g.fillText('И.Арабаев', 280, 612);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
}
function campusPortrait() {
  // восточный торец южного крыла смотрит во двор, к воротам
  const yy = -21; const h = hitFP(20, yy, -1, 0); if (!h) return;
  let fx = h.x; while (fpAt(fx + SR * 0.5, yy)) fx += SR * 0.5; // точная грань
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.25), new THREE.MeshStandardMaterial({ map: portraitTex(), transparent: true, alphaTest: 0.4, roughness: 0.35, metalness: 0.6, color: 0x222222 }));
  m.position.set(fx + 0.12, 5.6, -yy); m.rotation.y = Math.PI / 2; m.castShadow = true; scene.add(m);
  CAMPUS.portrait = m;
}

// ---------- 4. флаги, сосны, забор-зигзаг ----------
const FLAG_SPECS: any[] = [
  ['KG'], ['h', '#0099b5', '#0099b5', '#0099b5', 'KZ'], ['h', '#ffffff', '#0039a6', '#d52b1e'], ['TR'], ['CN'], ['US'], ['h', '#000000', '#dd0000', '#ffce00'], ['v', '#0055a4', '#ffffff', '#ef4135'],
  ['h', '#1eb53a', '#ffffff', '#0099b5', 'UZ'], ['h', '#cc0000', '#ffffff', '#006600'], ['KR'], ['JP'], ['v', '#009246', '#ffffff', '#ce2b37'], ['GB'], ['h', '#ff9933', '#ffffff', '#138808'],
  ['h', '#ffffff', '#ffffff', '#dc143c'], ['h', '#ae1c28', '#ffffff', '#21468b'], ['h', '#00732f', '#ffffff', '#000000', 'AE'], ['KG']];
function flagTex(spec) {
  const c = document.createElement('canvas'); c.width = 240; c.height = 150; const g = c.getContext('2d'); const W2 = 240, H = 150;
  const t = spec[0];
  if (t === 'h' || t === 'v') { const cols = spec.slice(1, 4); cols.forEach((col, i) => { g.fillStyle = col; if (t === 'h') g.fillRect(0, i * H / 3, W2, H / 3 + 1); else g.fillRect(i * W2 / 3, 0, W2 / 3 + 1, H); }); if (spec[4] === 'KZ') { g.fillStyle = '#fec50c'; g.beginPath(); g.arc(120, 70, 26, 0, 7); g.fill(); } if (spec[4] === 'UZ') { g.fillStyle = '#ce1126'; g.fillRect(0, 48, W2, 4); g.fillRect(0, 98, W2, 4); } if (spec[4] === 'AE') { g.fillStyle = '#ff0000'; g.fillRect(0, 0, 60, H); } }
  else if (t === 'KG') { g.fillStyle = '#e8112d'; g.fillRect(0, 0, W2, H); g.save(); g.translate(120, 75); g.fillStyle = '#ffef00'; for (let i = 0; i < 40; i++) { g.rotate(Math.PI / 20); g.beginPath(); g.moveTo(-4, 0); g.lineTo(0, -44); g.lineTo(4, 0); g.fill(); } g.beginPath(); g.arc(0, 0, 28, 0, 7); g.fill(); g.strokeStyle = '#e8112d'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 20, 0, 7); g.stroke(); g.restore(); }
  else if (t === 'TR') { g.fillStyle = '#e30a17'; g.fillRect(0, 0, W2, H); g.fillStyle = '#fff'; g.beginPath(); g.arc(95, 75, 38, 0, 7); g.fill(); g.fillStyle = '#e30a17'; g.beginPath(); g.arc(105, 75, 30, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(148, 75, 10, 0, 7); g.fill(); }
  else if (t === 'CN') { g.fillStyle = '#de2910'; g.fillRect(0, 0, W2, H); g.fillStyle = '#ffde00'; [[40, 40, 16], [78, 18, 5], [92, 34, 5], [92, 56, 5], [78, 70, 5]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }
  else if (t === 'US') { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#b22234'; g.fillRect(0, i * H / 13, W2, H / 13 + 1); } g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 96, 81); g.fillStyle = '#fff'; for (let y = 8; y < 80; y += 14) for (let x = 8; x < 95; x += 16) g.fillRect(x, y, 3, 3); }
  else if (t === 'KR') { g.fillStyle = '#fff'; g.fillRect(0, 0, W2, H); g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(120, 75, 30, Math.PI, 0); g.fill(); g.fillStyle = '#0047a0'; g.beginPath(); g.arc(120, 75, 30, 0, Math.PI); g.fill(); g.fillStyle = '#000'; [[45, 30], [195, 30], [45, 120], [195, 120]].forEach(([x, y]) => g.fillRect(x - 14, y - 10, 28, 20)); }
  else if (t === 'JP') { g.fillStyle = '#fff'; g.fillRect(0, 0, W2, H); g.fillStyle = '#bc002d'; g.beginPath(); g.arc(120, 75, 42, 0, 7); g.fill(); }
  else if (t === 'GB') { g.fillStyle = '#012169'; g.fillRect(0, 0, W2, H); g.strokeStyle = '#fff'; g.lineWidth = 26; g.beginPath(); g.moveTo(0, 0); g.lineTo(W2, H); g.moveTo(W2, 0); g.lineTo(0, H); g.stroke(); g.strokeStyle = '#c8102e'; g.lineWidth = 9; g.stroke(); g.fillStyle = '#fff'; g.fillRect(100, 0, 40, H); g.fillRect(0, 55, W2, 40); g.fillStyle = '#c8102e'; g.fillRect(108, 0, 24, H); g.fillRect(0, 63, W2, 24); }
  const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; return tx;
}
function campusFlagsRow() {
  // южная (дворовая) грань северного крыла
  const face = hitFP(4, -1.5, 0, 1); if (!face) return; const fy = face.y; // ≈ 11.5
  const door = ENTR.reduce((b, e) => Math.abs(e.in[1] - fy) < Math.abs(b.in[1] - fy) ? e : b, ENTR[0]);
  const x0 = -15, x1 = 23.5;
  const gap = x => Math.abs(x - door.in[0]) < 2.6;
  const flagY = fy - 4.6, pineY = fy - 1.9, fenceY = fy - 3.2;
  // сосны с побелёнными стволами
  const pines = []; for (let x = x0 + 0.6; x <= x1; x += 3.3) if (!gap(x) && !fpAt(x, pineY)) pines.push({ x, y: pineY + rr(-0.2, 0.2), h: rr(5.5, 7.5) });
  const trunkG = new THREE.CylinderGeometry(0.12, 0.17, 1, 7); trunkG.translate(0, 0.5, 0);
  const coneG = new THREE.ConeGeometry(1, 1, 10); coneG.translate(0, 0.5, 0);
  const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x5a4434, roughness: 1 }), pines.length);
  const white = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.9 }), pines.length);
  const crowns = new THREE.InstancedMesh(coneG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), pines.length * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  pines.forEach((p, i) => {
    m4.compose(v.set(p.x, OUTZ, -p.y), q.setFromAxisAngle(Y, rnd() * 6), sc.set(1, p.h * 0.55, 1)); trunk.setMatrixAt(i, m4);
    m4.compose(v.set(p.x, OUTZ, -p.y), q, sc.set(1.08, 1.05, 1.08)); white.setMatrixAt(i, m4);
    for (let k = 0; k < 3; k++) { const r = (1.55 - k * 0.38) * p.h / 6.5, hh = p.h * (0.5 - k * 0.08); m4.compose(v.set(p.x, OUTZ + p.h * (0.28 + k * 0.22), -p.y), q.setFromAxisAngle(Y, rnd() * 6), sc.set(r, hh, r)); crowns.setMatrixAt(i * 3 + k, m4); crowns.setColorAt(i * 3 + k, new THREE.Color(pick([0x1f3a26, 0x24432c, 0x2b4a30])).offsetHSL(0, 0, rr(-0.03, 0.03))); }
    blockDisk(p.x, p.y, 0.55);
  });
  [trunk, white, crowns].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  CAMPUS.pineCrowns.push(crowns);
  // белый забор-зигзаг (двойной), разрыв у входа
  const segs = []; const step = 0.55;
  for (let x = x0; x < x1; x += step) { if (gap(x) || gap(x + step)) continue; const k = Math.round((x - x0) / step) % 2; segs.push([x, k], [x, k + 2]); }
  const barG = new THREE.BoxGeometry(Math.hypot(step, 0.75), 0.05, 0.05);
  const bars = new THREE.InstancedMesh(barG, new THREE.MeshStandardMaterial({ color: 0xf6f6f3, roughness: 0.6 }), segs.length);
  segs.forEach(([x, k], i) => { const up = k % 2 === 0, lo = k >= 2; const a = Math.atan2(0.75, step) * (up ? 1 : -1); m4.compose(v.set(x + step / 2, OUTZ + (lo ? 0.42 : 0.62), -fenceY), q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a), sc.set(lo ? 0.62 : 1, 1, 1)); bars.setMatrixAt(i, m4); });
  bars.castShadow = true; scene.add(bars);
  for (let x = x0; x < x1; x += 1) if (!gap(x)) blockRect(x + 0.5, fenceY, 1.05, 0.25, 0);
  // флаги на мачтах с бетонными тумбами
  const poles = []; for (let x = x0 + 0.4; x <= x1; x += 2.05) if (!gap(x)) poles.push(x);
  const pole = new THREE.InstancedMesh((() => { const c = new THREE.CylinderGeometry(0.035, 0.055, 7.2, 8); c.translate(0, 3.6 + 0.5, 0); return c; })(), new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.4, metalness: 0.6 }), poles.length);
  const base = new THREE.InstancedMesh((() => { const c = new THREE.BoxGeometry(0.55, 0.5, 0.55); c.translate(0, 0.25, 0); return c; })(), new THREE.MeshStandardMaterial({ color: 0x8d8a85, roughness: 0.95 }), poles.length);
  poles.forEach((x, i) => {
    m4.makeTranslation(x, OUTZ, -flagY); pole.setMatrixAt(i, m4); base.setMatrixAt(i, m4); blockDisk(x, flagY, 0.4);
    const geo = new THREE.PlaneGeometry(1.5, 0.95, 10, 4); geo.translate(0.75, 0, 0);
    const fm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTex(FLAG_SPECS[i % FLAG_SPECS.length]), side: THREE.DoubleSide, roughness: 0.85 }));
    fm.position.set(x + 0.04, OUTZ + 7.1, -flagY); fm.castShadow = true; scene.add(fm);
    CAMPUS.flags.push({ m: fm, base: Float32Array.from(geo.attributes.position.array as any), ph: rnd() * 6 });
  });
  pole.castShadow = true; scene.add(pole, base);
  // топиарии в кашпо у входа
  const tp = [[door.in[0] - 2.2, fy - 1.0], [door.in[0] + 2.2, fy - 1.0], [door.in[0] - 2.2, fy - 6.2], [door.in[0] + 2.2, fy - 6.2]];
  const pot = new THREE.InstancedMesh((() => { const c = new THREE.CylinderGeometry(0.42, 0.34, 0.6, 12); c.translate(0, 0.3, 0); return c; })(), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.8 }), tp.length);
  const ball = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.48, 2), new THREE.MeshStandardMaterial({ color: 0x3d6a35, roughness: 0.95, flatShading: true }), tp.length);
  tp.forEach(([x, y], i) => { m4.makeTranslation(x, OUTZ, -y); pot.setMatrixAt(i, m4); m4.makeTranslation(x, OUTZ + 1.0, -y); ball.setMatrixAt(i, m4); blockDisk(x, y, 0.45); });
  ball.castShadow = pot.castShadow = true; scene.add(pot, ball);
}
function flagsFrame(t) {
  const wind = 0.6 + 0.4 * Math.sin(t * 0.13);
  CAMPUS.flags.forEach(f => {
    const P = f.m.geometry.attributes.position, b = f.base;
    for (let i = 0; i < P.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; const k = x / 1.5; P.setZ(i, Math.sin(x * 4.2 - t * 5 * wind + f.ph) * 0.16 * k * wind + Math.sin(y * 3 + t * 3) * 0.03 * k); P.setX(i, x * (1 - 0.06 * k * wind)); }
    P.needsUpdate = true;
  });
}

// ---------- 5. юрта-беседка ----------
function campusYurt() {
  const p = freeDisk(2.5, -20.5, 3.3, 12); if (!p) return; CAMPUS.yurtP = p;
  const g = new THREE.Group(); g.position.set(p.x, OUTZ, -p.y);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.7 }), red = new THREE.MeshStandardMaterial({ color: 0x8c1d22, roughness: 0.7 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.15, 24), new THREE.MeshStandardMaterial({ color: 0x8e8578, roughness: 0.9 })); floor.position.y = 0.075; floor.receiveShadow = true; g.add(floor);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.2, 8), wood); post.position.set(Math.cos(a) * 2.85, 1.25, Math.sin(a) * 2.85); post.castShadow = true; g.add(post); }
  // решётка-кереге по низу
  const ker = new THREE.Mesh(new THREE.CylinderGeometry(2.86, 2.86, 0.75, 40, 1, true), new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const q = c.getContext('2d'); q.clearRect(0, 0, 256, 64); q.strokeStyle = '#7a4524'; q.lineWidth = 5; for (let x = -64; x < 320; x += 16) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x + 64, 64); q.moveTo(x + 64, 0); q.lineTo(x, 64); q.stroke(); } q.fillStyle = '#7a4524'; q.fillRect(0, 0, 256, 6); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(5, 1); t.encoding = THREE.sRGBEncoding; return t; })(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
  ker.position.y = 0.55; g.add(ker);
  // купол с белым орнаментом и тундук
  const rc = document.createElement('canvas'); rc.width = 512; rc.height = 128; const rg = rc.getContext('2d'); rg.fillStyle = '#5a3a26'; rg.fillRect(0, 0, 512, 128); rg.fillStyle = '#f1ece2'; rg.fillRect(0, 96, 512, 14); rg.strokeStyle = '#f1ece2'; rg.lineWidth = 4; for (let x = 0; x < 512; x += 32) { rg.beginPath(); rg.arc(x + 16, 84, 9, Math.PI, 0); rg.stroke(); }
  const rt = new THREE.CanvasTexture(rc); rt.encoding = THREE.sRGBEncoding; rt.wrapS = THREE.RepeatWrapping; rt.repeat.set(3, 1);
  const roofM = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.85, side: THREE.DoubleSide }); CAMPUS.yurtRoof = roofM;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.35, 1.55, 40, 1, true), roofM); roof.position.y = 2.35 + 0.77; roof.castShadow = true; g.add(roof);
  const tund = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 6, 18), red); tund.rotation.x = Math.PI / 2; tund.position.y = 3.9; g.add(tund);
  // скамьи по кругу и столик
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2; if (i === 0) continue; const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.42), wood); b.position.set(Math.cos(a) * 2.35, 0.47, Math.sin(a) * 2.35); b.rotation.y = -a + Math.PI / 2; b.castShadow = true; g.add(b); }
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 20), wood); tb.position.y = 0.76; const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 8), wood); tl.position.y = 0.4; g.add(tb, tl);
  scene.add(g); CAMPUS.yurt = g;
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; blockDisk(p.x + Math.cos(a) * 2.85, p.y + Math.sin(a) * 2.85, 0.2); }
  blockDisk(p.x, p.y, 0.8);
}

// ---------- 6. мачта-антенна ----------
function campusMast() {
  const p = { x: 32.5, y: 29.5 }; const H = 26;
  const g = new THREE.Group(); g.position.set(p.x, OUTZ, -p.y);
  const steel = new THREE.MeshStandardMaterial({ color: 0x55595d, roughness: 0.5, metalness: 0.6 });
  const w = (h) => 0.55 * (1 - h / H) + 0.12;
  const corners = h => [0, 1, 2].map(k => { const a = k / 3 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * w(h), h, Math.sin(a) * w(h)); });
  const rod = (a, b, r = 0.025) => { const d = b.clone().sub(a); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 5), steel); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m); };
  for (let k = 0; k < 3; k++) rod(corners(0)[k], corners(H)[k], 0.04);
  for (let h = 0; h < H; h += 1.6) { const A = corners(h), B = corners(h + 1.6); for (let k = 0; k < 3; k++) { rod(A[k], A[(k + 1) % 3]); rod(A[k], B[(k + 1) % 3]); } }
  rod(new THREE.Vector3(0, H, 0), new THREE.Vector3(0, H + 4, 0), 0.03);
  rod(new THREE.Vector3(-1.4, H + 2.5, 0), new THREE.Vector3(1.4, H + 2.5, 0), 0.02); rod(new THREE.Vector3(0, H + 1.5, -1.1), new THREE.Vector3(0, H + 1.5, 1.1), 0.02);
  const lm = new THREE.MeshStandardMaterial({ color: 0x661111, emissive: 0xff2010, emissiveIntensity: 0 }); const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lm); light.position.y = H + 4.05; g.add(light);
  CAMPUS.mastLight = lm; scene.add(g); blockDisk(p.x, p.y, 0.9);
}

// ---------- 7. коридор: ламинат, LED-панели, тёмные двери ----------
function campusInterior() {
  // GLSL дизайна 3 этажа: коридор — серый ламинат вместо плитки; потолок — «Армстронг» с LED-панелями
  const wood = (DM as any).doorWood || ((DM as any).doorWood = new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const q = c.getContext('2d'); q.fillStyle = '#4a2a1a'; q.fillRect(0, 0, 128, 256); for (let i = 0; i < 90; i++) { q.strokeStyle = `rgba(${30 + Math.random() * 30},${15 + Math.random() * 15},8,0.5)`; q.lineWidth = 1; q.beginPath(); const x = Math.random() * 128; q.moveTo(x, 0); q.bezierCurveTo(x + 6, 80, x - 6, 170, x + 3, 256); q.stroke(); } q.strokeStyle = 'rgba(0,0,0,0.45)'; q.lineWidth = 4; q.strokeRect(18, 20, 92, 92); q.strokeRect(18, 134, 92, 102); q.strokeStyle = 'rgba(255,220,180,0.12)'; q.lineWidth = 2; q.strokeRect(21, 23, 86, 86); q.strokeRect(21, 137, 86, 96); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })(), roughness: 0.45, side: THREE.DoubleSide }));
  // UV у створок нет — даём простую проекцию по габариту
  DOORS.forEach(d => d.leaves.forEach(L => L.pivot.children.forEach((ms: any) => {
    const g = ms.geometry, P = g.attributes.position; g.computeBoundingBox(); const bb = g.boundingBox; const ax = bb.max.x - bb.min.x > bb.max.y - bb.min.y ? 0 : 1;
    const uv = new Float32Array(P.count * 2); for (let i = 0; i < P.count; i++) { const u = ax === 0 ? (P.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1) : (P.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1); uv[i * 2] = u; uv[i * 2 + 1] = (P.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z || 1); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); ms.material = wood; ms.castShadow = true;
  })));
}

// ---------- 8. общежитие через ул. Раззакова ----------
function campusDorm() {
  const b = CITY.blocks.find(q => q[6] === 'Общежитие'); if (!b) return;
  const [x0, x1, y0, y1, H] = b; const fl = 5, fh = 3, w = x1 - x0, l = y1 - y0;
  const g = new THREE.Group(); scene.add(g);
  const ft = boxTex(fl, 0xe8dcc0, 'plaster', 77);
  const side = (len) => { const map = ft.map.clone(), em = ft.em.clone(); map.needsUpdate = em.needsUpdate = true; map.repeat.set(Math.round(len / 3.4), fl); em.repeat.copy(map.repeat); const m = new THREE.MeshStandardMaterial({ map, roughness: 0.9 }); m.userData.em = em; W.cityGlass = W.cityGlass || []; W.cityGlass.push(m); return m; };
  const top = new THREE.MeshStandardMaterial({ color: 0x8b8f93 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, fl * fh, l), [side(l), side(l), top, top, side(w), side(w)]); body.position.set((x0 + x1) / 2, 1.0 + OUTZ + fl * fh / 2, -(y0 + y1) / 2); body.castShadow = body.receiveShadow = true; g.add(body);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 1.0, l + 0.2), new THREE.MeshStandardMaterial({ color: 0x4a3328, roughness: 0.9 })); plinth.position.set((x0 + x1) / 2, OUTZ + 0.5, -(y0 + y1) / 2); g.add(plinth);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.7, metalness: 0.15, flatShading: true })); roof.scale.set(w + 1.2, 3.2, l + 1.2); roof.position.set((x0 + x1) / 2, OUTZ + 1 + fl * fh + 1.6, -(y0 + y1) / 2); roof.castShadow = true; g.add(roof);
  // балконы на фасаде к улице
  const balM = new THREE.MeshStandardMaterial({ color: 0xd9cfba, roughness: 0.85 }), glassM = new THREE.MeshStandardMaterial({ color: 0x9fb7c4, roughness: 0.2, metalness: 0.3 });
  for (let f = 1; f < fl; f++) for (let y = y0 + 3; y < y1 - 2; y += 6.8) { const bm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 2.6), balM); bm.position.set(x1 + 0.55, OUTZ + 1 + f * fh + 0.55, -(y + 1.3)); g.add(bm); const gl = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 2.5), glassM); gl.position.set(x1 + 0.6, OUTZ + 1 + f * fh + 1.55, -(y + 1.3)); g.add(gl); }
  // вход с козырьком и вывеской, лицом к Раззакова
  const ey = -31.3; const porch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 4.2), new THREE.MeshStandardMaterial({ color: 0x9a948a })); porch.position.set(x1 + 1.1, OUTZ + 0.3, -ey); g.add(porch);
  const can = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 4.6), new THREE.MeshStandardMaterial({ color: 0x4a3326 })); can.position.set(x1 + 1.2, OUTZ + 3.4, -ey); g.add(can);
  const dr = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.4), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.5 })); dr.position.set(x1 + 0.02, OUTZ + 1.8, -ey); dr.rotation.y = Math.PI / 2; g.add(dr);
  const sc2 = document.createElement('canvas'); sc2.width = 1024; sc2.height = 160; const sq = sc2.getContext('2d'); sq.fillStyle = '#1d3f73'; sq.fillRect(0, 0, 1024, 160); sq.fillStyle = '#fff'; sq.textAlign = 'center'; sq.font = 'bold 56px sans-serif'; sq.fillText('ОБЩЕЖИТИЕ  КГУ им. И. АРАБАЕВА', 512, 75); sq.font = '38px sans-serif'; sq.fillStyle = '#e9c46a'; sq.fillText('Жатакана · ул. Раззакова', 512, 130);
  const st = new THREE.CanvasTexture(sc2); st.encoding = THREE.sRGBEncoding; const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.1), new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.15 })); sign.position.set(x1 + 0.03, OUTZ + 4.3, -ey); sign.rotation.y = Math.PI / 2; g.add(sign);
  // площадка со скамейками перед входом
  const benchM = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.8 });
  [-6, -3.5, 3.5, 6].forEach(dy => { const bn = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 1.7), benchM); bn.position.set(x1 + 2.6, OUTZ + 0.46, -(ey + dy)); g.add(bn); });
  // переход через Раззакова и светофоры
  const zebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 4), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 }), 9);
  const m4 = new THREE.Matrix4(); for (let i = 0; i < 9; i++) { m4.makeRotationX(-Math.PI / 2).setPosition(-43.2 + i * 0.95, OUTZ + 0.035, -ey); zebra.setMatrixAt(i, m4); } scene.add(zebra);
  CAMPUS.tl = [];
  [[-47.5, ey + 2.4], [-32.2, ey - 2.4]].forEach(([x, y]) => {
    const t = new THREE.Group(); t.position.set(x, OUTZ, -y);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3), new THREE.MeshStandardMaterial({ color: 0x333 })); pl.position.y = 1.5; t.add(pl);
    const bx = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1a1a })); bx.position.y = 3.2; t.add(bx);
    const r = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 0 }), gr = new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x20ff60, emissiveIntensity: 0 });
    [[r, 3.4], [gr, 3.0]].forEach(([m, h]: any) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), m); s.position.set(0, h, 0.16); t.add(s); const s2 = s.clone(); s2.position.z = -0.16; t.add(s2); });
    scene.add(t); CAMPUS.tl.push({ r, gr });
  });
}

// ---------- 9. интерфейс: панели сворачиваются, скорость — только в режиме директора ----------
function campusUI() {
  const st = document.createElement('style');
  st.textContent = `body.clean #ctrl, body.clean #exp { display: none !important; }
  #cleanBtn { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 6; border: 1px solid var(--line, #ddd); background: var(--panel, #fff); border-radius: 18px; padding: 6px 14px; font: 600 12.5px system-ui, sans-serif; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.12); }
  body:not(.director) #sSpeed button:not([data-s="live"]), body:not(.director) #sMorning, body:not(.director) #sJumpPair, body:not(.director) #sJumpBreak { display: none; }`;
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'cleanBtn'; b.textContent = '⤢ Во весь экран';
  b.onclick = () => { document.body.classList.toggle('clean'); b.textContent = document.body.classList.contains('clean') ? '☰ Показать панели' : '⤢ Во весь экран'; };
  (document.getElementById('app') || document.body).appendChild(b);
  const setDir = () => document.body.classList.toggle('director', typeof IS_ADMIN !== 'undefined' && !!IS_ADMIN || /[?&]admin/.test(location.search));
  setDir(); setInterval(setDir, 3000);
}

// ---------- кадр: флаги, огонь мачты, светофор, снег ----------
function campusFrame() {
  const t = (performance.now() - CAMPUS.t0) / 1000;
  if (CAMPUS.flags.length && floorVis(3)) flagsFrame(t);
  const night = simT < 420 || simT > 1110;
  if (CAMPUS.mastLight) CAMPUS.mastLight.emissiveIntensity = night ? (Math.sin(t * 3) > 0.2 ? 3 : 0.2) : 0.4;
  if (CAMPUS.tl) { const green = Math.floor(t / 20) % 2 === 0; CAMPUS.tl.forEach(q => { q.r.emissiveIntensity = green ? 0.1 : 2.5; q.gr.emissiveIntensity = green ? 2.5 : 0.1; }); }
  const snow = typeof WX !== 'undefined' && (WX.kind === 'snow' || seasonOf(SUN.doy) === 'winter') ? 1 : 0;
  if (CAMPUS.snow !== snow) {
    CAMPUS.snow = snow;
    if (CAMPUS.roofMat) CAMPUS.roofMat.color.copy(CAMPUS.roofBrown).lerp(new THREE.Color(0xf4f6f8), snow * 0.85);
    if (CAMPUS.yurtRoof) CAMPUS.yurtRoof.color.set(snow ? 0xdde3e8 : 0xffffff);
    CAMPUS.pineCrowns.forEach(m => m.material.color.set(snow ? 0xc9d2cf : 0xffffff));
  }
}

function buildCampus() {
  const steps: [string, () => void][] = [['facade', campusFacade], ['ac', campusAC], ['portrait', campusPortrait], ['flags', campusFlagsRow], ['yurt', campusYurt], ['mast', campusMast], ['interior', campusInterior], ['dorm', campusDorm], ['ui', campusUI]];
  for (const [n, f] of steps) { try { f(); } catch (e) { console.error('campus ' + n, e); } }
  // точки во дворе, которые теперь заняты, убираем из списка мест для прогулок
  for (let i = YARD.length - 1; i >= 0; i--) { const [x, y] = YARD[i]; const k = cy(y) * SNX + cx(x); if (GRID[3][k] !== -2) YARD.splice(i, 1); }
}

// студенты собираются у юрты на переменах
const _yardSpotCampus = yardSpot; yardSpot = (nearX?, nearY?, rad?) => {
  if (nearX == null && CAMPUS.yurtP && chance(0.3)) { const a = rr(0, 6.28), r = rr(3.6, 5.5); const s = spotNear(3, CAMPUS.yurtP.x + Math.cos(a) * r, CAMPUS.yurtP.y + Math.sin(a) * r, 3); if (s) return s; }
  return _yardSpotCampus(nearX, nearY, rad);
};

const _evInitCampus = evInit; evInit = () => { _evInitCampus(); buildCampus(); };
const _simFrameCampus = simFrame; simFrame = () => { _simFrameCampus(); try { campusFrame(); } catch (e) { } };
