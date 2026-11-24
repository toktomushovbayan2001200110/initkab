// Люди из Blender (GLB) вместо собранных из примитивов тел: студенты, студентки, преподаватели.
// Скелет двигается теми же углами, что и процедурные люди (poseNPC → J), поэтому Азамат умеет всё:
// ходить, сидеть, печатать, писать, поднимать руку, говорить по телефону.
// Набор персонажей (Blender → GLB, общий скелет Азамата): студенты, студентки, преподаватели.
// Файлы лежат рядом со страницей (npc/*.glb), в Django — /static/campus/npc/.
const AZ: any = { ready: false, tpl: {}, list: [], max: 170 };
const AZ_CAST = {
  stuM: ['stu_m1', 'stu_m2', 'stu_m3', 'stu_m4', 'azamat'],
  stuF: ['stu_f1', 'stu_f2', 'stu_f3', 'stu_f4'],
  tchM: ['tch_m1', 'tch_m2'],
  tchF: ['tch_f1', 'tch_f2'],
};
const AZ_BASE = (window as any).NPC_BASE || ((window as any).KGU ? '/static/campus/npc/' : 'npc/');

// Какие кости чем управляются. side: 'R' у процедурных людей = +X = анатомически левая рука/нога (суффикс _l).
type AzDrive = { re: RegExp; get: (J: any, n: any) => number[]; target?: number[]; share?: number };
const AZ_DRIVE: AzDrive[] = [
  { re: /^spine_?0?1$/i, get: J => [J.torsoP * 0.3, J.torsoY * 0.3, 0] },
  { re: /^spine_?0?2$/i, get: J => [J.torsoP * 0.35, J.torsoY * 0.35, 0] },
  { re: /^spine_?0?3$/i, get: J => [J.torsoP * 0.35, J.torsoY * 0.35, 0] },
  { re: /^neck(_?0?1)?$/i, get: J => [J.headP * 0.35, J.headY * 0.35, J.headR * 0.3] },
  { re: /^head$/i, get: J => [J.headP * 0.65, J.headY * 0.65, J.headR * 0.7] },
  { re: /^thigh_r$/i, get: (J, n) => [J.thL, 0, -(n.pose === 'sit' ? 0.06 : 0.015)], target: [0, -1, 0] },
  { re: /^thigh_l$/i, get: (J, n) => [J.thR, 0, (n.pose === 'sit' ? 0.06 : 0.015)], target: [0, -1, 0] },
  { re: /^calf_r$/i, get: J => [J.shL, 0, 0], target: [0, -1, 0] },
  { re: /^calf_l$/i, get: J => [J.shR, 0, 0], target: [0, -1, 0] },
  { re: /^foot_r$/i, get: (J, n) => [-J.shL - J.thL + (n.pose === 'sit' || n.pose === 'crouch' ? J.ftL : J.ftL * n.walk), 0, 0] },
  { re: /^foot_l$/i, get: (J, n) => [-J.shR - J.thR + (n.pose === 'sit' || n.pose === 'crouch' ? J.ftR : J.ftR * n.walk), 0, 0] },
  { re: /^upperarm_r$/i, get: J => [J.uaL, 0, -J.uaLz], target: [0, -1, 0] },
  { re: /^upperarm_l$/i, get: J => [J.uaR, 0, -J.uaRz], target: [0, -1, 0] },
  { re: /^lowerarm_r$/i, get: J => [J.faL, 0, 0], target: [0, -1, 0] },
  { re: /^lowerarm_l$/i, get: J => [J.faR, 0, 0], target: [0, -1, 0] },
];

const _aq = new THREE.Quaternion(), _aq2 = new THREE.Quaternion(), _ae = new THREE.Euler(), _av = new THREE.Vector3(), _av2 = new THREE.Vector3();

function azPrep(scene: any): any {
  const T: any = { src: scene };
  scene.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  const all: any[] = [];
  scene.traverse((o: any) => { if (o.isBone) all.push(o); });
  const byName: any = {}; all.forEach(b => { byName[b.name] = b; });
  const info = new Map();
  let top = 0, foot = Infinity;
  // мировые (в системе модели) повороты и направления костей в позе привязки
  for (const b of all) {
    const m = new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
    const ch = b.children.find((c: any) => c.isBone);
    let dir = null;
    if (ch) { const pc = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(inv, ch.matrixWorld)); dir = pc.sub(p).normalize(); }
    top = Math.max(top, p.y); foot = Math.min(foot, p.y);
    info.set(b, { b, W: q, P: p, dir, L: b.quaternion.clone(), K: new THREE.Quaternion() });
  }
  // поправки K: поворот из позы привязки (A/T-поза) в «руки и ноги вниз», как у процедурных людей
  const order = all.slice();  // traverse = от корня к листьям
  for (const b of order) {
    const I = info.get(b), par = b.parent && info.get(b.parent);
    const d = AZ_DRIVE.find(x => x.re.test(b.name));
    I.drive = d || null;
    if (d && d.target && I.dir) I.K.setFromUnitVectors(I.dir, _av.fromArray(d.target).normalize());
    else if (par) I.K.copy(par.K);
    I.Kp = par ? par.K.clone() : new THREE.Quaternion();
    I.Wp = par ? par.W.clone() : new THREE.Quaternion();
  }
  T.bones = order.map(b => info.get(b)).filter(I => I.drive || !I.K.equals(I.Kp));
  // голова: верх черепа ≈ head + 0.19 м; таз — для посадки на стул
  const head = all.find(b => /^head$/i.test(b.name)), pel = all.find(b => /^pelvis$/i.test(b.name));
  T.h = head ? info.get(head).P.y + 0.19 : top;
  T.hip = pel ? info.get(pel).P.y : T.h * 0.53;
  return T;
}

// local' = Wp⁻¹ · (Kp⁻¹ · R · K) · Wp · L   (R — поворот из углов J в системе модели)
function azSetBone(I: any, bone: any, x: number, y: number, z: number) {
  _ae.set(x, y, z, 'YXZ'); _aq.setFromEuler(_ae);
  _aq2.copy(I.Kp).invert().multiply(_aq).multiply(I.K);            // d
  _aq.copy(I.Wp).invert().multiply(_aq2).multiply(I.Wp).multiply(I.L);
  bone.quaternion.copy(_aq);
}

function azPrepMats(scene: any) {
  scene.traverse((o: any) => {
    if (!o.isMesh) return;
    o.castShadow = /body|vest|shirt|pants|jean|trouser|hoodie|sweater|jacket|blazer|cardigan|skirt/i.test(o.name + (o.material && o.material.name));
    o.receiveShadow = false;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach((m: any) => { if (m.map) m.map.anisotropy = 4; if (/hair|brow|lash/i.test(m.name)) { m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide; } });
  });
}
function azLoad() {
  const GL = (THREE as any).GLTFLoader; if (!GL) return;
  const ids = ([] as string[]).concat(...Object.values(AZ_CAST));
  ids.forEach(id => {
    fetch(AZ_BASE + id + '.glb').then(r => { if (!r.ok) throw new Error(r.status + ''); return r.arrayBuffer(); })
      .then(buf => new GL().parse(buf, '', (g: any) => { const T = azPrep(g.scene); T.id = id; azPrepMats(g.scene); AZ.tpl[id] = T; AZ.ready = true; }, (e: any) => console.warn('персонаж ' + id, e)))
      .catch(e => console.warn('персонаж ' + id + ' не загрузился', e));
  });
}

const AZ_SHIRT = [0xffffff, 0xdfe6ee, 0xcfdcec, 0xeae3d6, 0xe9dada, 0xd7e3d4];
const AZ_PANTS = [0xffffff, 0xb9c4d9, 0xd2c6b4, 0x9aa1aa, 0xc0b6a8];
function azMake(n: any, T: any) {
  const SU = (THREE as any).SkeletonUtils;
  const g = SU ? SU.clone(T.src) : T.src.clone(true);
  const bones: any = {}; g.traverse((o: any) => { if (o.isBone) bones[o.name] = o; });
  const meshes: any = {};
  const rnd2 = (k: number) => { const v = Math.sin((n.seed || 1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  g.traverse((o: any) => {
    if (!o.isMesh) return; meshes[o.name] = o;
    const nm = (o.name + ' ' + (o.material && o.material.name)).toLowerCase();
    // небольшое разнообразие: цвет рубашки и брюк, калпак не у всех, ноутбук только при ходьбе
    if (T.id === 'azamat' && /shirt|рубаш/.test(nm)) { o.material = o.material.clone(); o.material.color.setHex(AZ_SHIRT[Math.floor(rnd2(1) * AZ_SHIRT.length)]); }
    else if (T.id === 'azamat' && /pants|jean|trouser|брюк/.test(nm)) { o.material = o.material.clone(); o.material.color.setHex(AZ_PANTS[Math.floor(rnd2(2) * AZ_PANTS.length)]); }
    if (/kalpak|калпак|hat|cap/.test(nm)) o.visible = false;   // без головных уборов
    if (/backpack|рюкзак/.test(nm) && !n.bag) o.visible = false;
  });
  const drv = T.bones.map((I: any) => ({ I, bone: bones[I.b.name] })).filter((x: any) => x.bone);
  g.visible = false; g.matrixAutoUpdate = true;
  scene.add(g);
  return { g, drv, meshes, T, laptop: Object.values(meshes).filter((m: any) => /laptop|ноут/i.test(m.name + (m.material && m.material.name))), lapOn: true };
}

function azHide(n: any) { if (n.az) n.az.g.visible = false; }

// вызывается из poseNPC после сглаживания углов J; возвращает true — процедурное тело не нужно
const AZ_FAR2 = 42 * 42;          // дальше — обычное лёгкое тело (экономия на слабых компьютерах)
const AZ_BUSY = new Set(['hand', 'phone', 'board', 'explain', 'eat', 'think', 'dance', 'cheer', 'sweep', 'play', 'arms', 'sleep']);
function azPose(n: any, i: number, J: any, bob: number) {
  const A = n.az; if (!A) return false;
  const yOff = floorYOff(n.f), cx = camera.position.x - n.x, cy = camera.position.y - n.z - yOff, cz = camera.position.z + n.y;
  if (cx * cx + cy * cy + cz * cz > AZ_FAR2) { A.g.visible = false; n.azHid = false; return false; }
  if (!n.azHid) { n.azHid = true; for (const p of PARTS1) setP(p, i, ZERO); for (const p of PARTS2) { setP(p, i * 2, ZERO); setP(p, i * 2 + 1, ZERO); } }
  const k = n.k, T = A.T, s = (n.h || 1.75) / T.h;
  const g = A.g; g.visible = true;
  const drop = (0.92 - J.hipY) / 0.92 * T.hip * s;      // сел: таз опускается на сиденье
  g.position.set(n.x + J.hipX * k, n.z + yOff + bob * k - drop, -n.y);
  g.rotation.set(0, n.a + Math.PI / 2, 0);
  g.scale.setScalar(s);
  for (const x of A.drv) { const r = x.I.drive ? x.I.drive.get(J, n) : [0, 0, 0]; azSetBone(x.I, x.bone, r[0], r[1], r[2]); }
  const lap = n.pose !== 'sit' && n.pose !== 'crouch' && !AZ_BUSY.has(n.sub) && !n.walkPhone && !(n.waveT && performance.now() < n.waveT);
  if (lap !== A.lapOn) { A.lapOn = lap; for (const m of A.laptop) m.visible = lap; }
  return true;
}

// кто кем выглядит: студенты и студентки — из набора, преподаватели, директор, айтишник — «взрослые»
function azKind(n: any): string | null {
  const m = n.g !== 'f';
  if (n.role === 'student' || n.role === 'applicant' || n.role === 'gym') return m ? 'stuM' : 'stuF';
  if (n.role === 'teacher' || n.role === 'dean' || n.role === 'inspector' || n.role === 'it') return m ? 'tchM' : 'tchF';
  return null;
}
function azMaybe(n: any) {
  n.az = null;
  const kind = azKind(n); if (!kind || AZ.list.length >= AZ.max) return;
  const ids = AZ_CAST[kind].filter((id: string) => AZ.tpl[id]); if (!ids.length) { n.az = undefined; return; }   // ещё грузится
  const pickI = Math.floor(Math.abs(Math.sin((n.id || 0) * 9.37 + (n.seed || 0)) * 1e4)) % ids.length;
  if (ids.length < AZ_CAST[kind].length && AZ.loadingSince == null) AZ.loadingSince = performance.now();
  if (ids.length < AZ_CAST[kind].length && performance.now() - AZ.loadingSince < 15000) { n.az = undefined; return; }   // ждём весь набор, чтобы не было одинаковых
  n.az = azMake(n, AZ.tpl[ids[pickI]]); n.azHid = false; AZ.list.push(n);
}

const _evInitAz = evInit; evInit = () => { _evInitAz(); azLoad(); };
