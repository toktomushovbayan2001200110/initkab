// ================= ЖИВОЙ КОРПУС: студенты, преподаватели, айтишник =================
// Координаты симуляции: x,y — план (м), z — высота; мир three.js: (x, z, -y)
const SIM: SimData = JSON.parse(document.getElementById('simdata').textContent);
const FZ = [0, 3, 6, -0.58];          // 3 = двор (улица), уровень земли
const OUTZ = -0.58;
const SR = SIM.R, SX0 = SIM.X0, SY0 = SIM.Y0, SNX = SIM.NX, SNY = SIM.NY;
let GRID = null;                       // Int16Array по этажам: -1 стена, -2 дверь, >=0 помещение
const ROOMS = SIM.rooms, SEATS = SIM.seats, PCS = SIM.pcs, BOARDS = SIM.boards, STAIRS = SIM.stairs, ENTR = SIM.entrances;

// ---------- seeded random ----------
let _seed = 20251123;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }
const rr = (a, b) => a + rnd() * (b - a);
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

async function decodeGrid() {
  const raw = Uint8Array.from(atob(SIM.grid), c => c.charCodeAt(0));
  const buf = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const all = new Int16Array(buf); const n = SNX * SNY;
  GRID = [0, 1, 2].map(f => all.subarray(f * n, (f + 1) * n));
}

// ---------- grid helpers ----------
const cx = x => Math.floor((x - SX0) / SR), cy = y => Math.floor((y - SY0) / SR);
const wx = i => SX0 + (i + 0.5) * SR, wy = j => SY0 + (j + 0.5) * SR;
function cellV(f, i, j) { if (i < 0 || j < 0 || i >= SNX || j >= SNY) return -1; return GRID[f][j * SNX + i]; }
const pass = (f, i, j) => cellV(f, i, j) !== -1;
const passW = (f, x, y) => pass(f, cx(x), cy(y));
// тело ~0.2 м: проверяем центр и четыре стороны, чтобы не влезать плечом в стену
function clearW(f, x, y, r = 0.2) { return passW(f, x, y) && passW(f, x + r, y) && passW(f, x - r, y) && passW(f, x, y + r) && passW(f, x, y - r); }
function roomAt(f, x, y) { const v = cellV(f, cx(x), cy(y)); return v >= 0 ? v : -1; }
function nearestPass(f, x, y, maxR = 18) {
  const i0 = cx(x), j0 = cy(y);
  if (pass(f, i0, j0)) return [i0, j0];
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) {
      if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
      if (pass(f, i, j)) { const d = (i - i0) ** 2 + (j - j0) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
    }
    if (best) return best;
  }
  return null;
}
// A* (8-связность, без срезания углов)
const AN = SNX * SNY;
const gS = new Float32Array(AN), came = new Int32Array(AN), stamp = new Uint32Array(AN), closedA = new Uint32Array(AN);
let gen = 1;
const heap = { a: [], f: [], push(n, s) { const a = this.a, f = this.f; a.push(n); f.push(s); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[p] <= f[i]) break;[a[p], a[i]] = [a[i], a[p]];[f[p], f[i]] = [f[i], f[p]]; i = p; } },
  pop() { const a = this.a, f = this.f; const top = a[0]; const la = a.pop(), lf = f.pop(); if (a.length) { a[0] = la; f[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && f[l] < f[m]) m = l; if (r < a.length && f[r] < f[m]) m = r; if (m === i) break;[a[m], a[i]] = [a[i], a[m]];[f[m], f[i]] = [f[i], f[m]]; i = m; } } return top; },
  clear() { this.a.length = 0; this.f.length = 0; } };
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
function astar(f, s, g) {
  gen++; heap.clear(); const G = GRID[f];
  const si = s[1] * SNX + s[0], gi = g[1] * SNX + g[0];
  if (si === gi) return [s];
  gS[si] = 0; stamp[si] = gen; came[si] = -1;
  const h = (i, j) => { const dx = Math.abs(i - g[0]), dy = Math.abs(j - g[1]); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
  heap.push(si, h(s[0], s[1])); let it = 0;
  while (heap.a.length && it++ < 250000) {
    const cur = heap.pop(); if (closedA[cur] === gen) continue; closedA[cur] = gen;
    if (cur === gi) break;
    const ci = cur % SNX, cj = (cur / SNX) | 0;
    for (const [dx, dy, c] of DIRS) {
      const ni = ci + dx, nj = cj + dy; if (ni < 0 || nj < 0 || ni >= SNX || nj >= SNY) continue;
      const n = nj * SNX + ni; const v = G[n]; if (v === -1) continue;
      if (dx && dy && (G[cj * SNX + ni] === -1 || G[nj * SNX + ci] === -1)) continue;
      const ng = gS[cur] + c + (v === -2 ? 0.3 : 0);
      if (stamp[n] !== gen || ng < gS[n]) { stamp[n] = gen; gS[n] = ng; came[n] = cur; heap.push(n, ng + 1.25 * h(ni, nj)); }
    }
  }
  if (stamp[gi] !== gen) return null;
  const out = []; let c = gi; while (c !== -1) { out.push([c % SNX, (c / SNX) | 0]); c = came[c]; if (out.length > 5000) break; }
  return out.reverse();
}
function los(f, a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.ceil(d * 2.5);
  for (let k = 1; k < n; k++) { const t = k / n; const i = Math.round(a[0] + (b[0] - a[0]) * t), j = Math.round(a[1] + (b[1] - a[1]) * t); if (!pass(f, i, j)) return false; }
  return true;
}
function smooth(f, cells) {
  if (cells.length < 3) return cells;
  const out = [cells[0]]; let a = 0;
  while (a < cells.length - 1) { let b = cells.length - 1; while (b > a + 1 && !los(f, cells[a], cells[b])) b--; out.push(cells[b]); a = b; }
  return out;
}
function floorPath(f, x0, y0, x1, y1) {
  const s = nearestPass(f, x0, y0), g = nearestPass(f, x1, y1);
  if (!s || !g) return null;
  const c = astar(f, s, g); if (!c) return null;
  return smooth(f, c).map(([i, j]) => ({ f, x: wx(i), y: wy(j), z: FZ[f] }));
}
// маршрут с учётом двора (f=3) и входов
function nearestEntr(ox, oy, ix, iy) { let b = ENTR[0], bd = 1e9; for (const e of ENTR) { const d = Math.hypot(e.out[0] - ox, e.out[1] - oy) + Math.hypot(e.in[0] - ix, e.in[1] - iy) * 0.8; if (d < bd) { bd = d; b = e; } } return b; }
function route(from, to) {
  if (from.f === 3 && to.f === 3) { const p = floorPath(3, from.x, from.y, to.x, to.y); if (p) p.push({ f: 3, x: to.x, y: to.y, z: OUTZ }); return p; }
  if (from.f === 3) { const e = nearestEntr(from.x, from.y, to.x, to.y); const a = floorPath(3, from.x, from.y, e.out[0], e.out[1]); if (!a) return null; const b = routeIn({ f: 0, x: e.in[0], y: e.in[1] }, to); if (!b) return null; return [...a, { f: 3, x: e.out[0], y: e.out[1], z: OUTZ }, { f: 0, x: e.in[0], y: e.in[1], z: 0, st: 1 }, ...b]; }
  if (to.f === 3) { const e = nearestEntr(to.x, to.y, from.x, from.y); const a = routeIn(from, { f: 0, x: e.in[0], y: e.in[1] }); if (!a) return null; const b = floorPath(3, e.out[0], e.out[1], to.x, to.y); if (!b) return null; return [...a, { f: 0, x: e.in[0], y: e.in[1], z: 0 }, { f: 3, x: e.out[0], y: e.out[1], z: OUTZ, st: 1 }, ...b, { f: 3, x: to.x, y: to.y, z: OUTZ }]; }
  return routeIn(from, to);
}
function routeIn(from, to) {
  const pts = [];
  let cur = { ...from };
  let guard = 0;
  while (cur.f !== to.f && guard++ < 4) {
    const up = to.f > cur.f; const ff = up ? cur.f : cur.f - 1;   // пролёт этажа ff соединяет ff и ff+1
    const fl = STAIRS.filter(s => s.f === ff);
    let best = null, bd = 1e9;
    for (const s of fl) {
      const a = up ? s.lo : s.hi, b = up ? s.hi : s.lo;
      const d = Math.hypot(a[0] - cur.x, a[1] - cur.y) + Math.hypot(b[0] - to.x, b[1] - to.y) * 0.7;
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return null;
    const A = up ? best.lo : best.hi, B = up ? best.hi : best.lo;
    const p1 = floorPath(cur.f, cur.x, cur.y, A[0], A[1]); if (!p1) return null;
    pts.push(...p1);
    const zA = FZ[ff] + (up ? 0 : 3), zB = FZ[ff] + (up ? 3 : 0);
    pts.push({ f: cur.f, x: A[0], y: A[1], z: zA, st: 1 });
    pts.push({ f: up ? cur.f : to.f, x: best.land[0], y: best.land[1], z: FZ[ff] + 1.5, st: 1 });
    const nf = up ? cur.f + 1 : cur.f - 1;
    pts.push({ f: nf, x: B[0], y: B[1], z: zB, st: 1 });
    cur = { f: nf, x: B[0], y: B[1] };
  }
  const p2 = floorPath(cur.f, cur.x, cur.y, to.x, to.y); if (!p2) return null;
  pts.push(...p2);
  pts.push({ f: to.f, x: to.x, y: to.y, z: to.z ?? FZ[to.f] });
  return pts;
}

// ---------- помещения ----------
const R3 = ROOMS.filter(r => r.f === 2);
const roomById = id => ROOMS[id];
const PC_ROOMS = R3.filter(r => r.kind === 'pc');
const CLASS_ROOMS = R3.filter(r => r.kind === 'class');
const KAF = R3.filter(r => r.name === 'Кафедра');
const R_IT = ROOMS.find(r => r.num === '314');
const R_DEAN = ROOMS.find(r => r.name === 'Деканат ИНИТ');
// буфета в корпусе нет: это обычная аудитория, поесть ходят в столовую вне корпуса
const R_COWORK: any = null;
const R_LOUNGE = ROOMS.find(r => r.name === 'Зона отдыха');
const R_WC = R3.find(r => r.kind === 'wc');
const CORR = [0, 1, 2].map(f => ROOMS.filter(r => r.f === f && r.kind === 'corridor').map(r => r.id));
const seatsIn = id => SEATS.filter(s => s.room === id);
const roomCells = {};
function cellsOf(f, id) {
  const k = f + ':' + id; if (roomCells[k]) return roomCells[k];
  const out = []; const G = GRID[f];
  for (let j = 0; j < SNY; j++) for (let i = 0; i < SNX; i++) if (G[j * SNX + i] === id) out.push(i, j);
  return (roomCells[k] = out);
}
function randomCellIn(f, id) { const c = cellsOf(f, id); if (!c.length) return null; const k = Math.floor(rnd() * c.length / 2) * 2; return { f, x: wx(c[k]) + rr(-0.08, 0.08), y: wy(c[k + 1]) + rr(-0.08, 0.08) }; }
function corridorSpotNear(f, x, y, rad = 6) {
  for (let t = 0; t < 30; t++) {
    const px = x + rr(-rad, rad), py = y + rr(-rad, rad);
    const v = roomAt(f, px, py);
    if (v >= 0 && CORR[f].includes(v)) {
      // запас от стен
      const i = cx(px), j = cy(py); let ok = true;
      for (let a = -3; a <= 3 && ok; a++) for (let b = -3; b <= 3; b++) if (!pass(f, i + a, j + b)) { ok = false; break; }
      for (let a = -6; a <= 6 && ok; a += 2) for (let b = -6; b <= 6; b += 2) if (cellV(f, i + a, j + b) === -2) { ok = false; break; }   // не встаём в дверях
      if (ok && CONVS.some(c => c.f === f && (c.x - px) ** 2 + (c.y - py) ** 2 < 2.6 * 2.6)) ok = false;   // кружки не слипаются в толпу
      if (ok) return { f, x: px, y: py };
    }
  }
  const c = CORR[f][0]; return c != null ? randomCellIn(f, c) : null;
}
// доска / точка преподавателя
// ближайшая свободная клетка именно внутри комнаты (не за стеной в коридоре), с отступом от стен
function nearestInRoom(f, x, y, roomId, maxR = 25) {
  const i0 = cx(x), j0 = cy(y);
  const good = (i, j) => { for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const v = cellV(f, i + a, j + b); if (v === -1) return false; } return cellV(f, i, j) === roomId; };
  for (let r = 0; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) {
      if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
      if (good(i, j)) { const d = (i - i0) ** 2 + (j - j0) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
    }
    if (best) return best;
  }
  return null;
}
function teacherSpot(room) {
  const b = BOARDS.find(b => b.room === room.id);
  if (b) { const p = nearestInRoom(room.f, b.t[0], b.t[1], room.id) || nearestPass(room.f, b.t[0], b.t[1], 8); return { f: room.f, x: p ? wx(p[0]) : b.t[0], y: p ? wy(p[1]) : b.t[1], a: Math.atan2(b.p[1] - b.t[1], b.p[0] - b.t[0]), board: b.p }; }
  const ss = seatsIn(room.id).filter(s => !s.office);
  if (ss.length) { // перед рядами: противоположно среднему направлению взгляда студентов
    let ax = 0, ay = 0; ss.forEach(s => { ax += Math.cos(s.a); ay += Math.sin(s.a); });
    const n = Math.hypot(ax, ay) || 1; ax /= n; ay /= n;
    let far = -1e9, px = room.c[0], py = room.c[1];
    ss.forEach(s => { const d = s.p[0] * ax + s.p[1] * ay; if (d > far) { far = d; px = s.p[0]; py = s.p[1]; } });
    const p = nearestInRoom(room.f, px + ax * 1.6, py + ay * 1.6, room.id) || nearestPass(room.f, px + ax * 1.6, py + ay * 1.6, 10);
    return { f: room.f, x: p ? wx(p[0]) : px, y: p ? wy(p[1]) : py, a: Math.atan2(-ay, -ax), board: [px + ax * 2.5, py + ay * 2.5] };
  }
  return { f: room.f, x: room.c[0], y: room.c[1], a: 0 };
}

// ---------- расписание: две смены, пары по 80 минут, перемены по 10 ----------
// 1 смена: 08:00–09:20, 09:30–10:50, 11:00–12:20 · 2 смена: 12:00–13:20, 13:30–14:50, 15:00–16:20, 16:30–17:50
const SLOTS = [[480, 560, 1], [570, 650, 1], [660, 740, 1], [720, 800, 2], [810, 890, 2], [900, 980, 2], [990, 1070, 2]];
const PAIRS = SLOTS.map(s => [s[0], s[1]]), PSH = SLOTS.map(s => s[2]);
const PAIR_NAMES = SLOTS.map((s, i) => `${PSH[i] === 1 ? i + 1 : i - 2}-я пара`);
// данные из Django (window.KGU), если модель открыта с сервера института
const KGU = (typeof window !== 'undefined' && window.KGU) || null;
const kClean = v => String(v == null ? '' : v).replace(/[<>&"'`\\]/g, '').slice(0, 40);   // имена попадают в разметку
const KGU_GROUPS = KGU && Array.isArray(KGU.groups) && KGU.groups.length ? KGU.groups.slice(0, 16) : null;
const GROUPS = (KGU_GROUPS ? KGU_GROUPS.map(g => kClean(g.name)) : ['ПИ-1-25', 'ПИ-2-24', 'ИВТ-1-25', 'ИВТ-2-24', 'ПМИ-1-25', 'ИСТ-2-24', 'ИБ-1-25', 'ИБ-2-24', 'ИВТ-3-23', 'ПИ-3-23', 'КИ-1-25', 'ПИ-4-22'])
  .map((n, i) => { const K = KGU_GROUPS ? KGU_GROUPS[i] : null; const yy = +n.split('-')[2]; const def = 9 + Math.floor(rnd() * 6);
    return { id: i, name: n, course: K && K.course ? K.course : (yy === 25 ? 1 : (yy ? Math.max(1, 26 - yy) : 1)), size: K ? Math.min(18, K.students.length) : def, roster: K ? K.students.slice(0, 18) : null, first: 0, last: 0, shift: K && K.shift ? K.shift : (i % 2 === 0 ? 1 : 2) }; });
const SUBJ_PC = ['Программирование на Python', 'Базы данных', 'Веб-разработка', 'Алгоритмы и структуры данных', 'Компьютерные сети', 'Мобильная разработка', 'Машинное обучение', 'Кибербезопасность', 'Операционные системы', 'Компьютерная графика'];
const SUBJ_CL = ['Высшая математика', 'Дискретная математика', 'Английский язык', 'Кыргызский язык', 'Физика', 'История Кыргызстана', 'Теория вероятностей', 'Экономика IT'];
GROUPS.forEach((g, i) => {
  const k = (i >> 1) % 6;
  if (g.shift === 1) { g.first = [0, 0, 1, 0, 0, 0][k]; g.last = [2, 1, 2, 2, 2, 1][k]; }
  else { g.first = [3, 3, 4, 3, 4, 3][k]; g.last = [6, 5, 6, 6, 6, 5][k]; }
});
const teachRooms = [...PC_ROOMS, ...CLASS_ROOMS];
const overlaps = (p, q) => p !== q && PAIRS[p][0] < PAIRS[q][1] && PAIRS[q][0] < PAIRS[p][1];
const SCHED = PAIRS.map(() => ({}));    // SCHED[p][groupId] = {room, subj, teacher, lecture}
for (let p = 0; p < PAIRS.length; p++) {
  const busy = new Set(); for (let q = 0; q < p; q++) if (overlaps(p, q)) Object.values(SCHED[q]).forEach((s: any) => busy.add(s.room));
  const free = shuffle(teachRooms.filter(r => r.name !== 'Лекционная аудитория' && !busy.has(r.id)));
  const lect = CLASS_ROOMS.find(r => r.name === 'Лекционная аудитория');
  const act = shuffle(GROUPS.filter(g => g.shift === PSH[p] && p >= g.first && p <= g.last && !(p === g.first + 1 && g.id % 5 === 0 && g.last > g.first + 1)));
  // поточная лекция: 2-3 группы одного курса
  if (lect && !busy.has(lect.id) && act.length > 2 && p % 2 === 0) {
    const c = act[0].course; const pot = act.filter(g => g.course === c).slice(0, 3);
    const subj = pick(SUBJ_CL);
    pot.forEach(g => SCHED[p][g.id] = { room: lect.id, subj, lecture: true });
  }
  for (const g of act) {
    if (SCHED[p][g.id]) continue;
    const wantPc = chance(0.62);
    let i = free.findIndex(r => (r.kind === 'pc') === wantPc && seatsIn(r.id).filter(s => !s.office).length >= g.size);
    if (i < 0) i = free.findIndex(r => seatsIn(r.id).filter(s => !s.office).length >= g.size);
    if (i < 0) continue;
    const r = free.splice(i, 1)[0];
    SCHED[p][g.id] = { room: r.id, subj: r.kind === 'pc' ? pick(SUBJ_PC) : pick(SUBJ_CL) };
  }
}

// ---------- имена ----------
const M_NAMES = ['Азамат', 'Бакыт', 'Нурлан', 'Эрлан', 'Тимур', 'Данияр', 'Айбек', 'Улан', 'Бекжан', 'Адилет', 'Нурсултан', 'Эмир', 'Арсен', 'Чынгыз', 'Мирлан', 'Кубаныч', 'Алихан', 'Руслан', 'Нуржигит', 'Санжар', 'Аман', 'Максат', 'Жаныбек', 'Артём', 'Дмитрий', 'Байэл', 'Темирлан', 'Илим', 'Эльдар', 'Самат'];
const F_NAMES = ['Айгерим', 'Айпери', 'Бегимай', 'Нурай', 'Жибек', 'Мээрим', 'Айжан', 'Асель', 'Динара', 'Камила', 'Алина', 'Элиза', 'Айдана', 'Аружан', 'Сезим', 'Гулина', 'Назира', 'Акылай', 'Бермет', 'Чолпон', 'Адина', 'Мадина', 'Каныкей', 'Анастасия', 'Диана', 'Мира', 'Аяна', 'Томирис', 'Нургиза', 'Бактыгуль'];
const SURN = ['Асанов', 'Жумабеков', 'Мамытов', 'Абдыкадыров', 'Осмонов', 'Сыдыков', 'Касымов', 'Бекболотов', 'Турдубаев', 'Иманалиев', 'Кадыров', 'Эсенов', 'Орозбеков', 'Байышев', 'Сатыбалдиев', 'Чотонов', 'Алымкулов', 'Исаков', 'Ниязбеков'];
const PATR_M = ['Асанович', 'Бакирович', 'Кубатович', 'Мамытович', 'Сагынович', 'Токтогулович'];
const PATR_F = ['Асановна', 'Бакировна', 'Кубатовна', 'Мамытовна', 'Сагыновна', 'Токтогуловна'];
const fem = s => s.endsWith('ов') || s.endsWith('ев') ? s + 'а' : s;

// ---------- фразы ----------
const PH = {
  evening: ['Жай-жай гуляем 😎', 'Айда в Дордой Плазу?', 'Кто в шашлычку?', 'Завтра первая пара, капец', 'Скинь фотки в инсту', 'Го в кафешку', 'Сегодня так устал…', 'Кто завтра на хакатон?', 'Айда в парк Панфилова', 'Такси вызовем?', 'Мама звонит, надо идти', 'Давай фото на фоне корпуса!', 'Кечки тамак кайда?', 'Холодно уже, пошли', 'Маршрутка 110 идёт?'],
  rain: ['Зонт забыл…', 'Бежим внутрь!', 'Опять дождь', 'Кроссовки промокли'],
  snow: ['Снег пошёл! ❄', 'Айда снежками!', 'Холодно-о-о', 'Красиво как'],
  yard: ['Какая погода классная', 'Пошли на солнышко', 'Смотри, горы видно!', 'Лабу сдал, свобода!', 'Сфоткай меня', 'Кофе с собой взял?', 'Ветер сегодня…'],
  react: ['Ха-ха 😂', 'Серьёзно?', 'Ооо, жакшы!', 'Ну да', 'Капец', 'Айда!', 'Согласен', 'Не-е-е', 'Тоже хочу', 'Красава!'],
  hello: ['Салам!', 'Привет!', 'Кандайсың?', 'Жакшы, сен?', 'О, здорово!', 'Салам, бро'],
  study: ['Ты лабу по базам сделал?', 'Я вчера до двух ночи код писал', 'У меня Python не запускается…', 'Скинь конспект в чат', 'Когда сдавать курсовую?', 'Я завис на рекурсии', 'Препод сказал, будет модуль', 'Git опять конфликт выдал 😅', 'Кто понял про индексы в SQL?', 'Давай вместе сделаем проект', 'Я React начал учить', 'Нейросеть наконец обучилась!'],
  life: ['Пойдём в буфет?', 'Самсы бы сейчас…', 'Кофе нужно срочно ☕', 'В субботу на Иссык-Куль?', 'Видел новый матч?', 'Скоро сессия, капец', 'Я хакатон выиграл!', 'Стипендию дали?', 'Чай пьём после пары?', 'Рахмат, брат!', 'Мага бүгүн эмне болду?'],
  game: ['Вечером в Dota?', 'Я в CS ранг поднял', 'Новая игра вышла, видел?', 'Сегодня турнир по Valorant'],
  whisper: ['Ты понял?', 'Дай ручку', 'Скинь код', 'Сколько до конца?', 'Я не успеваю…', 'Смотри, работает!'],
  teacherLec: ['Откройте тетради', 'Тема сегодняшнего занятия…', 'Запишите определение', 'Обратите внимание на доску', 'Кто может ответить?', 'Вопросы есть?', 'Это будет на экзамене', 'Тише, пожалуйста!', 'Продолжаем'],
  teacherPc: ['Откройте Visual Studio Code', 'Запустите программу', 'Проверьте вывод в консоли', 'Сохраните проект в Git', 'Кто сделал лабораторную?', 'Сделайте коммит', 'Покажите результат', 'Создайте новую таблицу', 'Закрой игру!', 'Хорошо, молодец'],
  answer: ['Можно я отвечу?', 'Это O(n log n)!', 'Я сделал!', 'Можно вопрос?', 'Готово!'],
  it: ['Перезагрузил, всё работает', 'Опять Windows обновляется…', 'Кто трогал кабель?', 'Так, сейчас посмотрим', 'Драйвер слетел', 'Сеть поднял ✅', 'Не выключайте компы из розетки!'],
  pcBroke: ['Компьютер завис!', 'Агай, комп не работает', 'Синий экран 😱', 'Интернет пропал'],
  dean: ['Расписание обновили', 'Где журнал 3-го курса?', 'Не опаздываем!', 'Студсовет в 15:00'],
};
const say = (n, list, dur = 3.2) => { if (typeof sayHook === 'function') list = sayHook(n, list); n.say = PH[list] ? pick(PH[list]) : list; n.sayT = performance.now() + dur * 1000; n.lastSaid = n.say; };

// ---------- геометрия человечков (instancing) ----------
const BGU = THREE.BufferGeometryUtils;
function cap(r, L) { const g = new THREE.CapsuleGeometry(r, Math.max(0.001, L - 2 * r), 3, 8); g.translate(0, -L / 2, 0); return g; }
const PART: any = {};
function mkPart(name, geo, n, opts: any = {}) {
  const mat = opts.mat || new THREE.MeshStandardMaterial({ roughness: opts.rough ?? 0.8, metalness: 0 });
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false;
  m.castShadow = opts.shadow !== false; m.receiveShadow = false;
  m.setColorAt(0, new THREE.Color(1, 1, 1));
  PART[name] = m; return m;
}
const people = new THREE.Group(); scene.add(people);

// ---------- NPC ----------
const NPCS: NPC[] = [];
const SKIN = [0xe9c6a1, 0xdcb08a, 0xcf9e76, 0xf0d3b5, 0xc28c64, 0xe2b996, 0xd6a47e].map(c => new THREE.Color(c));
const HAIR = [0x1b1512, 0x221a15, 0x2b1d14, 0x3a2717, 0x15100d, 0x4a3221, 0x6b4a2e, 0x1a1a1a].map(c => new THREE.Color(c));
const HAIR_DYED = [0x8a5a35, 0xa36b3d, 0xc9a26b, 0x5a2a2a].map(c => new THREE.Color(c));
const TOPS = [0x2d3e50, 0x1f2a36, 0x6d7b88, 0xece8e1, 0x8b2e2e, 0x2e5e4e, 0x4b4f8c, 0xb8a07e, 0x111111, 0x9aa3ad, 0x5c3d2e, 0xd9cfc1, 0x37628c, 0x7a1f3d, 0x3f6b3a, 0xc46a3a].map(c => new THREE.Color(c));
const PANTS = [0x22324a, 0x1c2533, 0x2b2b2b, 0x3c4a5c, 0x4a3f35, 0x111316, 0x5f6b78, 0x2f3b2c].map(c => new THREE.Color(c));
const SHOES = [0x111111, 0xeeeeee, 0x3a2a1f, 0x222833, 0x6b4a33].map(c => new THREE.Color(c));
const BAGS = [0x1d1d1d, 0x2c3e50, 0x7f1d1d, 0x3d5a40, 0x5b4636, 0x23395d].map(c => new THREE.Color(c));
const SUIT = [0x1f2733, 0x2a2a2e, 0x3b3f46, 0x4a3b30, 0x23314a].map(c => new THREE.Color(c));

let NID = 0;
function makeNPC(role: Role, opts: any = {}): NPC {
  const g = opts.gender || (chance(0.5) ? 'm' : 'f');
  const n: NPC = {
    id: NID++, role, g, spawned: false, f: 0, x: 0, y: 0, z: 0, a: 0,
    h: g === 'm' ? rr(1.66, 1.88) : rr(1.55, 1.72), build: rr(0.9, 1.12),
    tasks: [], path: null, pi: 0, speed: pick([rr(0.85, 1.0), rr(1.0, 1.2), rr(1.05, 1.25), rr(1.25, 1.45)]), walk: 0, phase: rr(0, 6.28), pose: 'stand', poseT: 0, sub: 'listen', subT: 0,
    say: null, sayT: 0, act: 'дома', needs: { energy: rr(0.6, 1), hunger: rr(0.1, 0.5), social: rr(0.2, 0.7), bladder: rr(0, 0.4) },
    friends: new Map(), conv: null, seat: null, lookAt: null, st: { late: 0, sleep: 0, broke: 0, chat: 0, dist: 0, code: 0, hand: 0 }, ...opts,
  };
  n.k = n.h / 1.75;
  n.name = g === 'm' ? pick(M_NAMES) : pick(F_NAMES);
  n.surname = g === 'm' ? pick(SURN) : fem(pick(SURN));
  n.traits = { social: rr(0, 1), diligent: rr(0, 1), punctual: rr(0, 1), gamer: rr(0, 1), curious: rr(0, 1) };
  // внешность
  n.cSkin = pick(SKIN);
  n.cHair = role === 'teacher' && chance(0.4) ? new THREE.Color(0x8d8a86) : (g === 'f' && chance(0.18) ? pick(HAIR_DYED) : pick(HAIR));
  n.cTop = role === 'teacher' || role === 'dean' ? pick(SUIT) : pick(TOPS);
  n.cShirt = role === 'teacher' || role === 'dean' ? new THREE.Color(pick([0xf2f2f0, 0xdfe6ee, 0xeae3d6])) : n.cTop;
  n.cPants = role === 'teacher' ? pick(SUIT) : pick(PANTS);
  n.cShoes = pick(SHOES);
  n.cBag = pick(BAGS);
  n.hair = g === 'm' ? (role === 'teacher' && chance(0.25) ? 'bald' : 'short') : (chance(0.12) && role === 'student' ? 'hijab' : pick(['long', 'long', 'pony', 'bun', 'bob']));
  n.skirt = g === 'f' && chance(role === 'teacher' ? 0.7 : 0.4);
  n.bag = role === 'student' && chance(0.75);
  n.glasses = chance(role === 'teacher' ? 0.5 : 0.22);
  NPCS.push(n); return n;
}

// ---------- экраны компьютеров ----------
let screenMesh = null; const SCREEN_TILES = 9;
function screenAtlas() {
  const W = 128, H = 80, c = document.createElement('canvas'); c.width = W * SCREEN_TILES; c.height = H; const g = c.getContext('2d');
  const tile = (k, fn) => { g.save(); g.translate(k * W, 0); g.beginPath(); g.rect(0, 0, W, H); g.clip(); fn(); g.restore(); };
  tile(0, () => { g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H); const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
  tile(1, () => { g.fillStyle = '#0b3d91'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; [[50, 26], [65, 26], [50, 41], [65, 41]].forEach(([x, y]) => g.fillRect(x, y, 13, 13)); g.fillRect(44, 62, 40, 2); });
  tile(2, () => { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1d6fb8'); gr.addColorStop(1, '#6fb7e0'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 4; i++) g.fillRect(6, 6 + i * 15, 10, 10); g.fillStyle = '#1b1f24'; g.fillRect(0, H - 8, W, 8); });
  tile(3, () => { g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, W, H); g.fillStyle = '#252526'; g.fillRect(0, 0, 22, H); g.fillStyle = '#007acc'; g.fillRect(0, H - 5, W, 5); const cols = ['#569cd6', '#ce9178', '#4ec9b0', '#dcdcaa', '#9cdcfe', '#6a9955', '#c586c0'];
    for (let l = 0; l < 13; l++) { let x = 26 + (l % 4 === 0 ? 0 : 8 * ((l * 7) % 3)); for (let s = 0; s < 4; s++) { const w = 6 + ((l * 13 + s * 7) % 22); g.fillStyle = cols[(l + s * 3) % cols.length]; g.fillRect(x, 4 + l * 5.6, w, 3); x += w + 3; if (x > W - 10) break; } } });
  tile(4, () => { g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, W, H); g.fillStyle = '#dde3ea'; g.fillRect(0, 0, W, 10); g.fillStyle = '#2b6cb0'; g.fillRect(10, 16, 60, 6); g.fillStyle = '#9aa5b1'; for (let l = 0; l < 8; l++) g.fillRect(10, 28 + l * 6, 40 + ((l * 37) % 60), 3); g.fillStyle = '#c3d4e6'; g.fillRect(88, 18, 32, 40); });
  tile(5, () => { g.fillStyle = '#1565c0'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.fillText(':(', 12, 34); g.fillRect(12, 44, 80, 3); g.fillRect(12, 52, 60, 3); g.fillRect(12, 62, 20, 12); });
  tile(6, () => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a1650'); gr.addColorStop(1, '#0f5132'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#e9c46a'; g.beginPath(); g.arc(90, 22, 9, 0, 7); g.fill(); g.fillStyle = '#e76f51'; g.fillRect(24, 46, 16, 20); g.fillStyle = '#2a9d8f'; g.fillRect(0, 66, W, 14); g.fillStyle = '#fff'; g.fillRect(6, 4, 30, 4); });
  tile(7, () => { g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, H); g.fillStyle = '#3fb950'; g.font = '9px monospace'; ['$ python main.py', 'Epoch 12/50', 'loss: 0.214', 'acc:  0.931', '$ git push', '✓ done'].forEach((s, l) => g.fillText(s, 4, 12 + l * 11)); });
  tile(8, () => { g.fillStyle = '#1f2937'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f87171'; g.lineWidth = 4; g.beginPath(); for (let r = 1; r <= 3; r++) { g.arc(64, 56, r * 11, Math.PI * 1.25, Math.PI * 1.75); g.moveTo(64, 56); } g.stroke(); g.fillStyle = '#f87171'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('Нет сети', 64, 74); });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function buildScreens() {
  const geo = new THREE.PlaneGeometry(1, 1);
  const tileAttr = new THREE.InstancedBufferAttribute(new Float32Array(PCS.length), 1); tileAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aTile', tileAttr);
  const mat = new THREE.MeshBasicMaterial({ map: screenAtlas(), toneMapped: false });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTile;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_UV\n vUv = vec2((uv.x + aTile) / ${SCREEN_TILES}.0, uv.y);\n#endif`);
  };
  screenMesh = new THREE.InstancedMesh(geo, mat, PCS.length); screenMesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  PCS.forEach((p, i) => {
    const [x0, y0, z0, x1, y1, z1] = p.bb; const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    // в какую сторону смотрит экран: к стулу, который на него смотрит
    let seat = SEATS.find(s => s.pc === p.id);
    // у iMac в IT-отделе место может быть не привязано: берём ближайший стул, иначе экран смотрел в стену и висел позади монитора
    if (!seat || Math.hypot(seat.p[0] - p.c[0], seat.p[1] - p.c[1]) > 2) { let bd = 1.6; SEATS.forEach(s => { if (s.f !== p.f) return; const d = Math.hypot(s.p[0] - p.c[0], s.p[1] - p.c[1]); if (d < bd) { bd = d; seat = s; } }); }
    const tx = seat ? seat.p[0] : roomById(p.room)?.c[0] ?? p.c[0], ty = seat ? seat.p[1] : roomById(p.room)?.c[1] ?? p.c[1];
    let nx, ny, wdt;
    if (sx < sy) { nx = Math.sign(tx - p.c[0]) || 1; ny = 0; wdt = sy; } else { nx = 0; ny = Math.sign(ty - p.c[1]) || 1; wdt = sx; }
    const thick = Math.min(sx, sy);
    const hgt = p.imac ? sz * 0.62 : Math.min(sz * 0.62, wdt * 0.62);
    const zc = z1 - hgt / 2 - sz * 0.05;
    const off = p.imac ? 0.055 : thick / 2 + 0.006;
    const px = p.c[0] + nx * off, py = p.c[1] + ny * off;
    p.screen = { x: px, y: py, z: zc, w: wdt * 0.9, h: hgt, nx, ny };
    p.state = 0; p.tile = 0; p.user = null; p.err = false;
  });
  people.add(screenMesh);
  updateScreens(true);
}
function updateScreens(all?) {
  if (!screenMesh) return;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  PCS.forEach((p, i) => {
    const S = p.screen; const f = p.f;
    const vis = floorVis(f);
    const ang = Math.atan2(S.ny, S.nx);            // направление нормали в плане
    q.setFromEuler(new THREE.Euler(0, ang + Math.PI / 2, 0, 'YXZ'));
    // PlaneGeometry смотрит в +Z; поворот вокруг Y: +Z -> (sin, 0, cos)
    const dir = new THREE.Vector3(S.nx, 0, -S.ny);
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    v.set(S.x, S.z + floorYOff(f), -S.y); s.set(vis ? S.w : 0, vis ? S.h : 0, 1);
    m.compose(v, q, s); screenMesh.setMatrixAt(i, m);
    screenMesh.geometry.attributes.aTile.array[i] = p.tile;
  });
  screenMesh.instanceMatrix.needsUpdate = true; screenMesh.geometry.attributes.aTile.needsUpdate = true;
}
function pcOn(p, n) {
  p.user = n; if (p.err) { p.tile = 5; return; }
  if (p.tile === 0 || p.tile === 1) { p.tile = 1; p.bootT = simT + rr(0.4, 0.9); }
}
function pcTick__base() {
  PCS.forEach(p => {
    if (p.err) { p.tile = 5; return; }
    if (p.tile === 1 && simT >= p.bootT) p.tile = 2;
    if (p.user) {
      if (p.tile === 2 && chance(0.02)) p.tile = 3;
      const u = p.user;
      if (u.sub === 'type' && p.tile !== 1) p.tile = u.traits.gamer > 0.85 && u.gameMode ? 6 : (u.traits.curious > 0.7 ? 7 : (p.prefTile ?? (p.prefTile = pick([3, 3, 4, 7]))));
    } else if (p.tile !== 0 && p.tile !== 1) {
      if (!p.offAt) p.offAt = simT + rr(8, 25);
      if (simT >= p.offAt) { p.tile = 0; p.offAt = null; }
    }
    if (p.user) p.offAt = null;
  });
}

// ---------- задачи ----------
const pathQ = [];
function goTo(n, tgt, act, after?, pace?) { n.tasks.push({ t: 'go', tgt, act, after, pace: pace || 1 }); }
const aph = dt => Math.min(dt, ANIM_DT * 1.6);   // шаг анимации ног не быстрее реального
function startGo__base(n, task) {
  n.path = null; n.waitPath = true; n.act = task.act || n.act;
  pathQ.push({ n, task });
}
function processPaths(budget = 6) {
  while (budget-- > 0 && pathQ.length) {
    const { n, task } = pathQ.shift();
    if (n.tasks[0] !== task) continue;
    const p = route({ f: n.f, x: n.x, y: n.y }, task.tgt);
    n.waitPath = false;
    if (!p) { n.tasks.shift(); continue; }
    n.path = p; n.pi = 0;
  }
}
// идут друг за другом: если прямо впереди кто-то есть, притормаживаем, а не лезем сквозь него
function followGap(n) {
  n.dodge = 0;
  if (n.f > 3) return 1;
  const ca = Math.cos(n.a), sa = Math.sin(n.a); let k = 1;
  for (const m of NPCS) {
    if (m === n || !m.spawned || m.hidden || m.f !== n.f || Math.abs(m.z - n.z) > 0.5) continue;
    const dx = m.x - n.x, dy = m.y - n.y; if (dx > 1.6 || dx < -1.6 || dy > 1.6 || dy < -1.6) continue;
    const ahead = dx * ca + dy * sa, lat = -dx * sa + dy * ca, side = Math.abs(lat);
    const same = Math.cos(m.a - n.a) > 0.3 && m.walk > 0.2;
    // встречный или стоящий на пути: заранее уходим вправо, как люди в коридоре
    if (!same && ahead > 0.1 && ahead < 1.5 && side < 0.55) n.dodge = Math.max(n.dodge, 1 - side / 0.55);
    if (ahead > 0.05 && ahead < 0.85 && side < 0.38) k = Math.min(k, same ? 0.35 + ahead * 0.6 : 0.6);
  }
  return k;
}
function stepGo(n, dt, task) {
  if (n.waitPath) return;
  if (!n.path) { startGo(n, task); return; }
  n.pose = 'stand';
  // если нас оттолкнули и до точки маршрута уже не видно напрямую — пересчитать путь, а не идти сквозь стену
  if (n.pushed) {
    n.pushed = false; const p = n.path[n.pi];
    if (p && !p.st && p.f === n.f && n.f <= 3 && !los(n.f, [cx(n.x), cy(n.y)], [cx(p.x), cy(p.y)])) { n.repaths = (n.repaths || 0) + 1; if (n.repaths < 40) { n.path = null; startGo(n, task); return; } }
  }
  // точки, которые уже почти пройдены (нас сдвинули мимо), не разворачиваемся к ним
  while (n.pi < n.path.length - 1) {
    const p = n.path[n.pi], q = n.path[n.pi + 1];
    if (p.st || q.st || p.f !== n.f || Math.abs(p.z - n.z) > 0.3 || Math.hypot(p.x - n.x, p.y - n.y) > 0.4) break;
    if (n.f <= 3 && !los(n.f, [cx(n.x), cy(n.y)], [cx(q.x), cy(q.y)])) break;
    n.pi++;
  }
  const pace = (task.pace || 1) * followGap(n); let rem = n.speed * pace * dt;
  const ox = n.x, oy = n.y; let onStair = false;
  while (rem > 0 && n.pi < n.path.length) {
    const p = n.path[n.pi]; if (p.st) onStair = true;
    const dx = p.x - n.x, dy = p.y - n.y, dz = p.z - n.z; const d = Math.hypot(dx, dy, dz * 0.6);
    const sp = p.st ? 0.55 : 1;
    if (d <= rem * sp) { n.st.dist += d; n.x = p.x; n.y = p.y; n.z = p.z; n.f = p.f; n.pi++; rem -= d / sp; }
    else { n.st.dist += rem * sp; n.x += dx / d * rem * sp; n.y += dy / d * rem * sp; n.z += dz / d * rem * sp; if (Math.hypot(dx, dy) > 0.15) n.a = lerpAng(n.a, Math.atan2(dy, dx), Math.min(1, dt * 6)); rem = 0; }
  }
  // расходимся: шаг вправо, только если там свободно
  if (n.dodge > 0 && !onStair && n.f <= 3 && n.pi < n.path.length) {
    const s2 = n.speed * dt * 0.55 * n.dodge, rx = Math.sin(n.a) * s2, ry = -Math.cos(n.a) * s2;
    if (clearW(n.f, n.x + rx, n.y + ry)) { n.x += rx; n.y += ry; n.pushed = true; }
  }
  // никогда не заходим в стену
  if (!onStair && n.f <= 3 && !passW(n.f, n.x, n.y) && passW(n.f, ox, oy)) { n.x = ox; n.y = oy; n.path = null; startGo(n, task); return; }
  n.walk = Math.min(1, n.walk + dt * 4); n.phase += n.speed * pace * aph(dt) * 4.6;
  if (n.pi >= n.path.length) { n.path = null; n.repaths = 0; n.tasks.shift(); if (task.after) task.after(n); }
}
function lerpAng(a, b, t) { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; }
function wcCount() { let c = 0; for (const m of NPCS) { const T = m.tasks[0]; if (m.spawned && T && T.t === 'wait' && T.hide) c++; else if (m.spawned && T && T.t === 'go' && T.act === 'идёт в туалет') c++; } return c; }
function wait(n, dur, sub, act, opts = {}) { n.tasks.push({ t: 'wait', until: null, dur, sub, act, ...opts }); }

// ---------- время ----------
let simT = 7 * 60 + 40;      // минуты от полуночи (время Бишкека)
let simDay = 1, simDow = 1;  // день недели: 0 — воскресенье
let simSpeed = 1;            // во сколько раз быстрее реального времени
let liveMode = true;         // синхронно с реальным временем Бишкека
let ANIM_DT = 0.05;          // реальные секунды на тик (для анимации шагов)
const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
function bishkekNow() { const b = new Date(Date.now() + 6 * 3600e3); return { min: b.getUTCHours() * 60 + b.getUTCMinutes() + b.getUTCSeconds() / 60, dow: b.getUTCDay(), doy: Math.floor((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(b.getUTCFullYear(), 0, 0)) / 864e5) }; }
const holiday = () => simDow === 0;
function pairAt(t, sh) { for (let p = 0; p < PAIRS.length; p++) if ((sh == null || PSH[p] === sh) && t >= PAIRS[p][0] && t < PAIRS[p][1]) return p; return -1; }
function nextPair(t, sh) { for (let p = 0; p < PAIRS.length; p++) if ((sh == null || PSH[p] === sh) && t < PAIRS[p][0]) return p; return -1; }
const hhmm = t => { const h = Math.floor(t / 60) % 24, m = Math.floor(t % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };

// ---------- двор: сетка улицы, ворота, скамейки ----------
const GATES = []; const YARD = []; const BENCH_SEATS = [];
const YARD_ROOM = -100;
function buildOutdoor() {
  const n = SNX * SNY; let fp = new Uint8Array(n);
  for (let f = 0; f < 3; f++) { const G = GRID[f]; for (let k = 0; k < n; k++) if (G[k] !== -1) fp[k] = 1; }
  for (let r = 0; r < 4; r++) { const nx = fp.slice(); for (let j = 1; j < SNY - 1; j++) for (let i = 1; i < SNX - 1; i++) { const k = j * SNX + i; if (fp[k]) { nx[k - 1] = nx[k + 1] = nx[k - SNX] = nx[k + SNX] = 1; } } fp = nx; }
  const out = new Int16Array(n).fill(-1); const q = [];
  for (let i = 0; i < SNX; i++) { q.push(i, SNX * (SNY - 1) + i); } for (let j = 0; j < SNY; j++) { q.push(j * SNX, j * SNX + SNX - 1); }
  while (q.length) { const k = q.pop(); if (out[k] === -2 || fp[k]) continue; out[k] = -2; const i = k % SNX, j = (k / SNX) | 0; if (i > 0) q.push(k - 1); if (i < SNX - 1) q.push(k + 1); if (j > 0) q.push(k - SNX); if (j < SNY - 1) q.push(k + SNX); }
  GRID[3] = out; GRID.FP = fp;
  try { blockOutdoorProps(); } catch (e) { console.warn('outdoor props', e); }
  try { buildWallCaps(); } catch (e) { console.warn('wall caps', e); }
}
// крышки стен: без верхнего этажа стены сверху выглядели пустыми (две тонкие плоскости).
// Берём верхние рёбра вертикальных граней стен и закрываем щель между парами параллельных граней точно по их контуру
// (раньше крышки собирались из клеток сетки 0,2 м и выходили ступенчатыми «плитами» шире стен).
function buildWallCaps() {
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), mm = new THREE.Matrix4(), mi = new THREE.Matrix4();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9d4ca, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  for (let f = 0; f < 3; f++) {
    const g = storeyG[f]; if (!g) continue;
    const E = [];   // верхние рёбра: [x0, y0, x1, y1, z, nx, ny]
    for (const o of g.children as any[]) {
      if (!o.isMesh || !o.userData || o.userData.t !== 'IfcWall') continue;
      const m = o.material; if (!m || m.transparent || /#floor|#ceil|#roof/.test(m.name || '')) continue;
      const pos = o.geometry && o.geometry.attributes.position; if (!pos) continue;
      const idx = o.geometry.index; const triN = idx ? idx.count / 3 : pos.count / 3;
      const cnt = o.isInstancedMesh ? o.count : 1;
      for (let q = 0; q < cnt; q++) {
        if (o.isInstancedMesh) { o.getMatrixAt(q, mi); mm.multiplyMatrices(o.matrix, mi); } else mm.copy(o.matrix);
        for (let k = 0; k < triN; k++) {
          const ia = idx ? idx.getX(k * 3) : k * 3, ib = idx ? idx.getX(k * 3 + 1) : k * 3 + 1, ic = idx ? idx.getX(k * 3 + 2) : k * 3 + 2;
          A.fromBufferAttribute(pos, ia).applyMatrix4(mm); B.fromBufferAttribute(pos, ib).applyMatrix4(mm); C.fromBufferAttribute(pos, ic).applyMatrix4(mm);
          const zt = Math.max(A.z, B.z, C.z), zb = Math.min(A.z, B.z, C.z); if (zt - zb < 0.3) continue;
          const ux = B.x - A.x, uy = B.y - A.y, uz = B.z - A.z, vx = C.x - A.x, vy = C.y - A.y, vz = C.z - A.z;
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; if (Math.abs(nz / nl) > 0.05) continue;
          for (const [P, Q] of [[A, B], [B, C], [C, A]]) { if (Math.abs(P.z - zt) > 0.005 || Math.abs(Q.z - zt) > 0.005) continue; if (Math.hypot(Q.x - P.x, Q.y - P.y) < 0.02) continue; E.push([P.x, P.y, Q.x, Q.y, zt, nx / nl, ny / nl]); }
        }
      }
    }
    // пары параллельных рёбер на одной высоте, смотрящих в разные стороны, на расстоянии толщины стены
    const P = []; const cell = new Map(); const key = (x, y) => Math.floor(x / 2) + ',' + Math.floor(y / 2);
    E.forEach((e, i) => { const k = key((e[0] + e[2]) / 2, (e[1] + e[3]) / 2); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(i); });
    const seen = new Set();
    E.forEach((e, i) => {
      const dx = e[2] - e[0], dy = e[3] - e[1], L = Math.hypot(dx, dy), tx = dx / L, ty = dy / L;
      const cxm = (e[0] + e[2]) / 2, cym = (e[1] + e[3]) / 2; let best = null, bd = 1e9;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const lst = cell.get((Math.floor(cxm / 2) + a) + ',' + (Math.floor(cym / 2) + b)); if (!lst) continue;
        for (const j of lst) {
          if (j === i) continue; const o = E[j]; if (Math.abs(o[4] - e[4]) > 0.02) continue;
          if (e[5] * o[5] + e[6] * o[6] > -0.95) continue;   // грани смотрят навстречу/врозь
          const ox = o[2] - o[0], oy = o[3] - o[1], oL = Math.hypot(ox, oy); if (Math.abs(tx * oy - ty * ox) / oL > 0.03) continue;
          const d = Math.abs((o[0] - e[0]) * -ty + (o[1] - e[1]) * tx); if (d < 0.04 || d > 0.75) continue;
          // перекрытие проекций
          const s0 = (o[0] - e[0]) * tx + (o[1] - e[1]) * ty, s1 = (o[2] - e[0]) * tx + (o[3] - e[1]) * ty;
          const lo = Math.max(0, Math.min(s0, s1)), hi = Math.min(L, Math.max(s0, s1)); if (hi - lo < 0.02) continue;
          if (d < bd) { bd = d; best = [j, lo, hi, d]; }
        }
      }
      if (!best) return;
      const [j, lo, hi] = best; const o = E[j];
      const pk = Math.min(i, j) + '/' + Math.max(i, j) + '/' + lo.toFixed(2); if (seen.has(pk)) return; seen.add(pk);
      // нормаль из e к o
      const sgn = ((o[0] - e[0]) * -ty + (o[1] - e[1]) * tx) > 0 ? 1 : -1; const px = -ty * sgn * bd, py = tx * sgn * bd;
      const ax = e[0] + tx * lo, ay = e[1] + ty * lo, bx = e[0] + tx * hi, by = e[1] + ty * hi, z = e[4] + 0.002;
      P.push(ax, ay, z, bx, by, z, bx + px, by + py, z, ax, ay, z, bx + px, by + py, z, ax + px, ay + py, z);
    });
    if (!P.length) continue;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.computeVertexNormals();
    const cap = new THREE.Mesh(geo, mat); cap.receiveShadow = true; cap.userData = { t: 'cap', s: f }; g.add(cap);
  }
}

// перила и ступени крылец снаружи здания: на перила нельзя вставать, у ступеней не стоим толпой
const OUT_STAIRS: number[][] = [];
function blockOutdoorProps() {
  const G = GRID[3], FP = GRID.FP, mi = new THREE.Matrix4(), mm = new THREE.Matrix4();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const block = (x, y) => { const i = cx(x), j = cy(y); if (i < 1 || j < 1 || i >= SNX - 1 || j >= SNY - 1) return; const c = j * SNX + i; if (FP[c]) return; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const cc = c + b * SNX + a; if (G[cc] === -2) G[cc] = -1; } };
  const stairSeen = new Set();
  for (let f = 0; f < 3; f++) {
    if (!storeyG[f]) continue;
    for (const o of storeyG[f].children as any[]) {
      const t = o.userData && o.userData.t;
      // крыльца: парапеты (стены), перила и ступени у входов — на них не встают
      if (f !== 0 && t !== 'IfcRailing') continue;
      if (t !== 'IfcRailing' && t !== 'IfcStair' && t !== 'IfcWall') continue;
      const pos = o.geometry && o.geometry.attributes.position; if (!pos) continue;
      const idx = o.geometry.index; const triN = idx ? idx.count / 3 : pos.count / 3;
      const cnt = o.isInstancedMesh ? o.count : 1;
      for (let q = 0; q < cnt; q++) {
        if (o.isInstancedMesh) { o.getMatrixAt(q, mi); mm.multiplyMatrices(o.matrix, mi); } else mm.copy(o.matrix);
        for (let k = 0; k < triN; k++) {
          const ia = idx ? idx.getX(k * 3) : k * 3, ib = idx ? idx.getX(k * 3 + 1) : k * 3 + 1, ic = idx ? idx.getX(k * 3 + 2) : k * 3 + 2;
          A.fromBufferAttribute(pos, ia).applyMatrix4(mm); B.fromBufferAttribute(pos, ib).applyMatrix4(mm); C.fromBufferAttribute(pos, ic).applyMatrix4(mm);
          if (Math.min(A.z, B.z, C.z) > FZ[0] + 2.2) continue;
          const mx = (A.x + B.x + C.x) / 3, my = (A.y + B.y + C.y) / 3; const ci = cx(mx), cj = cy(my);
          if (ci >= 0 && cj >= 0 && ci < SNX && cj < SNY && FP[cj * SNX + ci] && FP[cy(A.y) * SNX + cx(A.x)]) continue;   // внутри здания
          if (t === 'IfcStair') { const key = cx(mx) + ',' + cy(my); if (!stairSeen.has(key)) { stairSeen.add(key); OUT_STAIRS.push([mx, my]); } continue; }
          for (const [P, Q] of [[A, B], [B, C], [C, A]]) { const L = Math.hypot(Q.x - P.x, Q.y - P.y); for (let d = 0; d <= L; d += 0.1) block(P.x + (Q.x - P.x) * d / L, P.y + (Q.y - P.y) * d / L); if (L === 0) block(P.x, P.y); }
        }
      }
    }
  }
  // выходы из дверей должны остаться проходимыми
  for (const e of ENTR) { const i0 = cx(e.out[0]), j0 = cy(e.out[1]); for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) { const c = (j0 + b) * SNX + i0 + a; if (c >= 0 && c < G.length && !FP[c] && G[c] === -1) G[c] = -2; } }
}
function blockDisk(x, y, r) { const G = GRID[3]; const i0 = cx(x), j0 = cy(y), R = Math.ceil(r / SR); for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) if (i >= 0 && j >= 0 && i < SNX && j < SNY && (i - i0) ** 2 + (j - j0) ** 2 <= R * R) G[j * SNX + i] = -1; }
function blockRect(x, y, w, h, a) { const G = GRID[3]; const c = Math.cos(a), s = Math.sin(a), R = Math.hypot(w, h) / 2 + SR; for (let yy = y - R; yy <= y + R; yy += SR * 0.5) for (let xx = x - R; xx <= x + R; xx += SR * 0.5) { const dx = xx - x, dy = yy - y, u = dx * c + dy * s, v = -dx * s + dy * c; if (Math.abs(u) <= w / 2 + 0.1 && Math.abs(v) <= h / 2 + 0.1) { const i = cx(xx), j = cy(yy); if (i >= 0 && j >= 0 && i < SNX && j < SNY) G[j * SNX + i] = -1; } } }
function finishOutdoor() {
  // точки для прогулок: открытые места двора не у самых стен
  const G = GRID[3];
  for (let j = 3; j < SNY - 3; j += 2) for (let i = 3; i < SNX - 3; i += 2) {
    if (G[j * SNX + i] !== -2) continue; let ok = true;
    for (let b = -5; b <= 5 && ok; b++) for (let a = -5; a <= 5; a++) if (G[(j + b) * SNX + i + a] === -1) { ok = false; break; }
    if (ok && OUT_STAIRS.some(p => (p[0] - wx(i)) ** 2 + (p[1] - wy(j)) ** 2 < 2.5 * 2.5)) ok = false;   // не у крыльца
    if (ok) YARD.push([wx(i), wy(j)]);
  }
}
function yardSpot__base(nearX?, nearY?, rad?) {
  for (let t = 0; t < 40; t++) { const p = pick(YARD); if (nearX == null || Math.hypot(p[0] - nearX, p[1] - nearY) < rad) return { f: 3, x: p[0] + rr(-0.15, 0.15), y: p[1] + rr(-0.15, 0.15) }; }
  const p = pick(YARD); return { f: 3, x: p[0], y: p[1] };
}

// ---------- население ----------
const TEACHERS = [], STUDENTS = []; let IT = null, DEAN = null; const STAFF = [];
function populate() {
  const kafSeats = KAF.map(r => seatsIn(r.id).filter(s => s.office));
  for (let i = 0; i < 14; i++) {
    const KT = KGU && Array.isArray(KGU.teachers) ? KGU.teachers[i] : null;
    const t: any = makeNPC('teacher', { gender: KT && KT.g ? KT.g : (chance(0.55) ? 'f' : 'm') });
    t.patr = t.g === 'm' ? pick(PATR_M) : pick(PATR_F);
    t.kaf = KAF[i % KAF.length]; t.age = Math.floor(rr(28, 63)); t.speed = rr(0.95, 1.25) - (t.age > 55 ? 0.15 : 0);
    t.title = pick(['ст. преподаватель', 'доцент', 'преподаватель', 'профессор', 'к.т.н., доцент']);
    TEACHERS.push(t);
  }
  // назначение преподавателей на пары (без наложений по времени)
  for (let p = 0; p < PAIRS.length; p++) {
    const byRoom = {};
    for (const [gid, s] of Object.entries(SCHED[p])) { (byRoom[(s as any).room] = byRoom[(s as any).room] || []).push(+gid); }
    const free = shuffle(TEACHERS.filter(t => !Object.keys(t.lessons || {}).some(q => overlaps(p, +q))));
    for (const [rid, gids] of Object.entries(byRoom)) {
      const t = free.pop(); if (!t) break;
      (gids as any).forEach(g => SCHED[p][g].teacher = t.id);
      (t.lessons = t.lessons || {})[p] = { room: +rid, subj: SCHED[p][gids[0]].subj, groups: gids };
    }
  }
  if (KGU && Array.isArray(KGU.teachers)) KGU.teachers.slice(0, TEACHERS.length).forEach((d, i) => { const t = TEACHERS[i]; if (d.last) t.surname = kClean(d.last); if (d.first) t.name = kClean(d.first); if (d.patr) t.patr = kClean(d.patr); if (d.title) t.title = kClean(d.title); });
  TEACHERS.forEach(t => { const ks = Object.keys(t.lessons || {}).map(Number); t.arrive = ks.length ? Math.min(...ks.map(k => PAIRS[k][0])) - rr(15, 35) : rr(480, 560); });
  GROUPS.forEach(g => {
    for (let i = 0; i < g.size; i++) {
      const R0 = g.roster ? g.roster[i] : null;
      const s: any = makeNPC('student', R0 && R0.g ? { gender: R0.g } : {}); s.group = g; if (R0) { s.name = kClean(R0.first) || s.name; s.surname = kClean(R0.last) || s.surname; s.dbId = R0.id; if (R0.arch) s.archDb = R0.arch; } s.age = 16 + g.course + Math.floor(rr(0, 3));
      s.arrive = PAIRS[g.first][0] - rr(5, 28) + (s.traits.punctual < 0.2 ? rr(6, 18) : 0);
      s.leave = PAIRS[g.last][1] + rr(0, 6);
      STUDENTS.push(s);
    }
  });
  // дружба: в группе, иногда с другого потока
  STUDENTS.forEach(a => STUDENTS.forEach(b => { if (a.id < b.id && (a.group === b.group ? chance(0.35) : chance(0.012))) { const v = rr(0.3, 0.9); a.friends.set(b.id, v); b.friends.set(a.id, v); } }));
  IT = makeNPC('it', { gender: 'm' }); IT.name = 'Эрлан'; IT.surname = 'Сыдыков'; IT.arrive = 465; IT.age = 27; IT.cTop = new THREE.Color(0x2f3b4a); IT.glasses = true; IT.bag = false; IT.speed = 1.3;
  const KD = KGU && KGU.director ? KGU.director : null;
  DEAN = makeNPC('dean', KD && KD.g ? { gender: KD.g } : {}); DEAN.arrive = 470; DEAN.age = 52; DEAN.patr = DEAN.g === 'm' ? pick(PATR_M) : pick(PATR_F); DEAN.speed = 1.0; if (KD) { if (KD.last) DEAN.surname = kClean(KD.last); if (KD.first) DEAN.name = kClean(KD.first); if (KD.patr) DEAN.patr = kClean(KD.patr); }
  if (KGU && KGU.it) { if (KGU.it.first) IT.name = kClean(KGU.it.first); if (KGU.it.last) IT.surname = kClean(KGU.it.last); }
  const offices = ROOMS.filter(r => r.f === 1 && r.kind === 'office');
  offices.forEach(r => seatsIn(r.id).filter(s => s.office).slice(0, 1).forEach(seat => { const s: any = makeNPC('staff'); s.home = seat; s.arrive = rr(470, 520); s.age = Math.floor(rr(25, 60)); STAFF.push(s); }));
  const guard: any = makeNPC('guard', { gender: 'm' }); guard.arrive = 400; guard.age = 58; guard.cTop = new THREE.Color(0x26323f); guard.speed = 0.9; STAFF.push(guard);
  const gym = ROOMS.find(r => r.kind === 'gym');
  if (gym) for (let i = 0; i < 4; i++) { const s: any = makeNPC('gym'); s.gym = gym; s.arrive = rr(500, 900); s.age = Math.floor(rr(18, 24)); s.cTop = pick(TOPS); STAFF.push(s); }
}

// ---------- приход и уход через ворота двора ----------
function pickGate() { const r = rnd(); let a = 0; for (const g of GATES) { a += g.w; if (r < a) return g; } return GATES[0]; }
function spawn(n) {
  const g = pickGate(); const P = g.pts.slice().reverse(); const o = P[0];
  n.spawned = true; n.f = 3; n.x = o[0] + rr(-0.8, 0.8); n.y = o[1] + rr(-0.8, 0.8); n.z = OUTZ; n.a = 0;
  n.tasks.length = 0; n.path = null; n.hidden = false; n.hung = false;
  const act = n.role === 'student' ? 'идёт в универ' : 'идёт на работу';
  P.slice(1).forEach(p => n.tasks.push({ t: 'step', x: p[0] + rr(-0.4, 0.4), y: p[1] + rr(-0.4, 0.4), f: 3, act }));
  n.tasks.push({ t: 'step', x: g.x, y: g.y, f: 3, act });
  n.bagOn = true;
}
function leave(n, why?) {
  releaseSeat(n); leaveConv(n);
  const g = pickGate();
  goTo(n, { f: 3, x: g.x, y: g.y }, why || 'идёт домой', m => { m.tasks.push({ t: 'out', pts: g.pts.map(p => [p[0] + rr(-0.4, 0.4), p[1] + rr(-0.4, 0.4)]), k: 0 }); }, n.role === 'student' && simT > 1060 ? 0.8 : 1);
}
function releaseSeat(n) { if (n.seat) { if (n.seat.occ === n) n.seat.occ = null; if (n.seat.pc >= 0 && PCS[n.seat.pc].user === n) PCS[n.seat.pc].user = null; n.seat = null; } }
function takeSeat(n, seat, act, opts: any = {}) {
  releaseSeat(n); seat.occ = n; n.seat = seat;
  const p = nearestPass(seat.f, seat.p[0] - Math.cos(seat.a) * 0.15, seat.p[1] - Math.sin(seat.a) * 0.15, 10);
  const app = p ? { f: seat.f, x: wx(p[0]), y: wy(p[1]) } : { f: seat.f, x: seat.p[0], y: seat.p[1] };
  goTo(n, app, act, m => { m.tasks.unshift({ t: 'sit', seat, act: opts.sitAct || act, until: opts.until, kind: opts.kind }); }, opts.pace);
}
function freeSeat(roomId, filter = s => !s.office) {
  const ss = (roomId === YARD_ROOM ? BENCH_SEATS : seatsIn(roomId)).filter(s => filter(s) && !s.occ);
  return ss.length ? pick(ss) : null;
}

// ---------- разговоры ----------
const CONVS = [];
function makeConv(f, x, y, topic, dur) { const c = { f, x, y, topic, members: [], t: 0, next: 0, dur: dur || rr(6, 18) }; CONVS.push(c); return c; }
function joinConv(n, c, act?) {
  if (c.members.length >= 6) return false;
  c.members.push(n); n.conv = c;
  // места по кругу, равномерно, чтобы люди не стояли друг в друге
  if (c.ang0 == null) c.ang0 = rnd() * Math.PI * 2;
  c.slots = c.slots || [];
  const R = 0.62 + Math.min(6, c.members.length) * 0.07;
  let px = c.x, py = c.y, placed = false;
  for (let tr = 0; tr < 12 && !placed; tr++) {
    const ang = c.ang0 + (c.slots.length + tr) * 2.39996;
    const qx = c.x + Math.cos(ang) * R, qy = c.y + Math.sin(ang) * R;
    if (!pass(c.f, cx(qx), cy(qy))) continue;
    if (c.slots.some(s => (s[0] - qx) ** 2 + (s[1] - qy) ** 2 < 0.5 * 0.5)) continue;
    px = qx; py = qy; placed = true;
  }
  if (!placed) { const ang = rnd() * Math.PI * 2; px = c.x + Math.cos(ang) * 0.6; py = c.y + Math.sin(ang) * 0.6; if (!pass(c.f, cx(px), cy(py))) { px = c.x; py = c.y; } }
  c.slots.push([px, py]);
  goTo(n, { f: c.f, x: px, y: py }, c.f === 3 ? 'идёт к друзьям во двор' : 'идёт к друзьям', m => { m.tasks.unshift({ t: 'chat', conv: c, act: act || (c.f === 3 ? (simT > 1060 ? 'жай-жай гуляет с друзьями' : 'болтает во дворе') : 'общается') }); }, c.f === 3 ? 0.8 : 1);
  return true;
}
function leaveConv(n) { const c = n.conv; if (!c) return; c.members = c.members.filter(m => m !== n); n.conv = null; if (!c.members.length) CONVS.splice(CONVS.indexOf(c), 1); }
function convTick__base(dt) {
  for (const c of CONVS) {
    const here = c.members.filter(m => m.tasks[0] && m.tasks[0].t === 'chat');
    if (here.length < 2) continue;
    c.next -= dt;
    if (c.next <= 0) {
      const sp = pick(here); const first = c.t < 0.1;
      const kind = first ? 'hello' : (c.f === 3 ? (WX.bad && chance(0.4) ? WX.kind : simT > 1060 ? pick(['evening', 'evening', 'life']) : pick(['life', 'yard', 'study'])) : (c.topic === 'game' && chance(0.5) ? 'game' : (chance(0.55) ? 'study' : 'life')));
      say(sp, kind);
      if (chance(0.25)) setTimeout(() => { const o = here.find(m => m !== sp); if (o && o.conv === c) say(o, pick(['react', 'react', 'life'])); }, 1500 / Math.max(1, simSpeed));
      sp.lastSpeech = simT; c.next = rr(0.35, 0.9); // сим-минуты
    }
    c.t += dt;
    here.forEach(a => { a.st.chat += dt; a.needs.social = Math.min(1, a.needs.social + dt * 0.02); here.forEach(b => { if (a !== b) a.friends.set(b.id, Math.min(1, (a.friends.get(b.id) || 0.1) + dt * 0.004)); }); });
  }
}

// ---------- мозг ----------
function lessonFor__base(n, p) { return p >= 0 && n.group ? SCHED[p][n.group.id] : null; }
function decide__base(n) {
  const t = simT, sh = n.group ? n.group.shift : null, p = pairAt(t, sh), np = nextPair(t, sh);
  if (n.role === 'student') return decideStudent(n, t, p, np);
  if (n.role === 'teacher') return decideTeacher(n, t);
  if (n.role === 'it') return decideIT(n, t);
  if (n.role === 'dean') return decideDean(n, t);
  return decideStaff(n, t);
}
const daylight = () => simT > SUN.rise + 20 && simT < SUN.set + 25 && !WX.bad;
// погулять / посидеть во дворе с друзьями
function yardHang__base(n, dur) {
  const friends = [...n.friends.entries()].filter(([, v]) => v > 0.3).map(([id]) => NPCS[id]);
  const conv = CONVS.find(c => c.f === 3 && c.members.length < 6 && c.members.some(m => friends.includes(m) || m.group === n.group));
  if (conv && joinConv(n, conv)) return true;
  if (chance(0.3)) { const b = freeSeat(YARD_ROOM, () => true); if (b) { takeSeat(n, b, 'идёт посидеть на скамейке', { until: simT + dur, kind: 'bench', pace: 0.75 }); return true; } }
  const spot = yardSpot(n.x, n.y, 25); if (!spot) return false;
  const c = makeConv(3, spot.x, spot.y, 'yard', dur); joinConv(n, c); return true;
}
function decideStudent__base(n, t, p, np) {
  if (t >= n.leave) {
    // после пар: «жай-жай» — постоять с друзьями во дворе, потом домой
    if (!n.hung && t < 1170 && chance((0.25 + n.traits.social * 0.55) * (WX.bad ? 0.35 : 1))) { n.hung = true; if (yardHang(n, t > 1060 ? rr(15, 55) : rr(8, 25))) return; }
    return leave(n);
  }
  const cur = lessonFor(n, p);
  if (cur && n.skip !== p) {
    const room = roomById(cur.room);
    const lateBy = t - PAIRS[p][0];
    if (lateBy > 25 && n.traits.punctual < 0.15 && chance(0.5)) { n.skip = p; }
    else {
      const seat = (n.seatPref && n.seatPref.room === room.id && !n.seatPref.occ) ? n.seatPref : freeSeat(room.id, s => !s.office && (room.kind !== 'pc' || s.pc >= 0)) || freeSeat(room.id);
      if (seat) { n.seatPref = seat; if (lateBy > 3 && n.lateMark !== p) { n.lateMark = p; n.st.late++; } return takeSeat(n, seat, lateBy > 3 ? 'опаздывает на пару' : 'идёт на пару', { until: PAIRS[p][1], kind: 'lesson', pace: lateBy > 1 ? 1.4 : 1.1 }); }
    }
  }
  const nx = np >= 0 ? lessonFor(n, np) : null;
  const toNext = np >= 0 ? PAIRS[np][0] - t : 999;
  const lead = 2 + n.traits.punctual * 5;
  if (nx && toNext <= lead + (n.f === 3 ? 4 : 0)) {
    const room = roomById(nx.room);
    const seat = freeSeat(room.id, s => !s.office && (room.kind !== 'pc' || s.pc >= 0)) || freeSeat(room.id);
    if (seat) { n.seatPref = seat; return takeSeat(n, seat, 'занимает место перед парой', { until: PAIRS[np][1], kind: 'pre', pace: toNext < 2 ? 1.35 : 1 }); }
  }
  // пришли рано — ждут во дворе
  if (n.f === 3 && toNext > 9 && toNext < 60 && chance(WX.bad ? 0.1 : 0.55)) { if (yardHang(n, Math.min(toNext - 7, rr(4, 14)))) return; }
  // потребности
  const N = n.needs;
  if (N.bladder > (n.wcT || (n.wcT = rr(0.8, 1.1))) && R_WC && wcCount() < 6) { const c = randomCellIn(2, R_WC.id); N.bladder = 0; goTo(n, c, 'идёт в туалет'); return wait(n, rr(1.5, 3), 'idle', 'в туалете', { hide: true }); }
  if (N.hunger > 0.6 && toNext > 30) { N.hunger = 0.05; N.energy = Math.min(1, N.energy + 0.3); n.backAt = simT + rr(20, 30); return leave(n, 'идёт обедать в столовую'); }
  // друзья
  if (N.social < 0.85 || chance(n.traits.social)) {
    const friendsHere = [...n.friends.entries()].filter(([id, v]) => v > 0.35).map(([id]) => NPCS[id]).filter(m => m.spawned && m.f === n.f && m.f === 2);
    const conv = CONVS.find(c => c.f === n.f && c.members.length < 5 && c.members.some(m => friendsHere.includes(m)));
    if (conv && joinConv(n, conv)) return;
    if (n.f === 2 && (n.traits.social > 0.35 || friendsHere.length)) {
      const base = nx ? roomById(nx.room).c : (cur ? roomById(cur.room).c : [n.x, n.y]);
      const spot = corridorSpotNear(2, base[0], base[1], 7);
      if (spot) { const c = makeConv(2, spot.x, spot.y, n.traits.gamer > 0.7 ? 'game' : 'study', Math.min(rr(6, 18), Math.max(3, toNext - 2))); joinConv(n, c);
        friendsHere.filter(m => !m.conv && m.tasks.length <= 1 && (!m.tasks[0] || m.tasks[0].t === 'wait')).slice(0, 3).forEach(m => { m.tasks.length = 0; releaseSeat(m); joinConv(m, c); }); return; }
    }
  }
  // длинное окно — во двор подышать
  if (toNext > 25 && daylight() && chance(0.3)) { if (yardHang(n, rr(8, 20))) return; }
  if (n.f !== 2) { const c = corridorSpotNear(2, rr(-20, 20), rr(-24, 22), 30); if (c) return goTo(n, c, 'поднимается на 3 этаж'); }
  const r = rnd();
  if (r < 0.22 && R_LOUNGE) { goTo(n, randomCellIn(2, R_LOUNGE.id), 'идёт в зону отдыха', null, 0.8); return wait(n, rr(4, 12), 'phone', 'отдыхает в зоне отдыха'); }
  if (r < 0.36 && R_COWORK) { goTo(n, randomCellIn(2, R_COWORK.id), 'идёт в коворкинг'); return wait(n, rr(5, 15), 'phone', 'делает домашку в коворкинге'); }
  const spot = corridorSpotNear(2, n.x, n.y, 9);
  if (spot) { goTo(n, spot, 'гуляет по коридору', null, rr(0.6, 0.85)); return wait(n, rr(1, 5), chance(0.6) ? 'phone' : 'idle', chance(0.6) ? 'листает телефон' : 'ждёт пару'); }
  wait(n, 2, 'idle', 'стоит');
}
function decideTeacher(n, t) {
  const ks = Object.keys(n.lessons || {}).map(Number);
  const lastEnd = ks.length ? Math.max(...ks.map(k => PAIRS[k][1])) : -1;
  if ((lastEnd >= 0 && t > lastEnd + 25) || (lastEnd < 0 && t > 900)) return leave(n);
  const kc = ks.find(k => t >= PAIRS[k][0] && t < PAIRS[k][1] - 1);
  const kn = ks.find(k => PAIRS[k][0] > t && PAIRS[k][0] - t < 4);
  const k = kc ?? kn;
  if (k != null) { const L = n.lessons[k]; const room = roomById(L.room); const sp = teacherSpot(room); return goTo(n, sp, 'идёт на пару', m => m.tasks.unshift({ t: 'teach', room, spot: sp, until: PAIRS[k][1], lesson: L, p: k, early: kc == null })); }
  if (chance(0.2) && n.f === 2 && R_DEAN && chance(0.4)) { goTo(n, randomCellIn(2, R_DEAN.id), 'идёт в дирекцию'); return wait(n, rr(3, 8), 'talk', 'обсуждает расписание в дирекции'); }
  const seat = seatsIn(n.kaf.id).find(s => s.office && (!s.occ || s.occ === n));
  if (seat) return takeSeat(n, seat, 'идёт на кафедру', { until: t + rr(8, 25), kind: 'kaf' });
  goTo(n, randomCellIn(2, n.kaf.id), 'идёт на кафедру'); wait(n, rr(5, 15), 'phone', 'проверяет работы на кафедре');
}
function decideIT(n, t) {
  if (t > 1080) return leave(n);
  const broken = PCS.find(p => p.err && !p.fixer);
  if (broken) {
    broken.fixer = n; const S = broken.screen; const seat = SEATS.find(s => s.pc === broken.id);
    const pos = seat ? { x: seat.p[0] + Math.sin(seat.a) * 0.55, y: seat.p[1] - Math.cos(seat.a) * 0.55 } : { x: S.x + S.nx * 0.8, y: S.y + S.ny * 0.8 };
    const q = nearestPass(broken.f, pos.x, pos.y, 8);
    releaseSeat(n);
    say(n, 'Иду, сейчас посмотрю');
    return goTo(n, { f: broken.f, x: q ? wx(q[0]) : pos.x, y: q ? wy(q[1]) : pos.y }, 'идёт чинить компьютер', m => m.tasks.unshift({ t: 'fix', pc: broken, until: simT + rr(3, 7) }));
  }
  const ss = seatsIn(R_IT.id).filter(s => s.office); const seat = ss.find(s => s.pc >= 0) || ss[0];
  if (seat) return takeSeat(n, seat, 'возвращается в 314', { until: t + rr(10, 30), kind: 'it' });
  goTo(n, randomCellIn(2, R_IT.id), 'в кабинете 314'); wait(n, 10, 'idle', 'работает');
}
function decideDean(n, t) {
  if (t > 1050) return leave(n);
  if (chance(0.25)) { const s = corridorSpotNear(2, rr(-20, 20), rr(-24, 22), 25); if (s) { goTo(n, s, 'обходит этаж'); return wait(n, rr(1, 3), 'arms', 'проверяет порядок'); } }
  const seat = seatsIn(R_DEAN.id).find(s => s.office) || seatsIn(R_DEAN.id)[0];
  if (seat) return takeSeat(n, seat, 'идёт в дирекцию', { until: t + rr(15, 40), kind: 'dean' });
  wait(n, 10, 'idle', 'в дирекции');
}
function decideStaff(n, t) {
  if (t > (n.role === 'guard' ? 1290 : 1060)) return leave(n);
  if (n.role === 'guard') { const e = ENTR[0]; goTo(n, { f: 0, x: e.in[0] + 0.6, y: e.in[1] + 1.2 }, 'на посту'); return wait(n, 30, chance(0.5) ? 'arms' : 'phone', 'дежурит на вахте'); }
  if (n.role === 'gym') { const c = randomCellIn(0, n.gym.id); goTo(n, c, 'идёт в спортзал'); return wait(n, rr(5, 15), chance(0.5) ? 'run' : 'idle', chance(0.5) ? 'бегает на дорожке' : 'отдыхает между подходами', { jog: true }); }
  if (n.home) return takeSeat(n, n.home, 'идёт в кабинет', { until: t + rr(30, 90), kind: 'work' });
  wait(n, 10, 'idle', 'работает');
}

// ---------- исполнение задач ----------
function runTask__base(n, dt) {
  const T = n.tasks[0];
  if (!T || T.t !== 'wait') n.hidden = false;
  if (!T) { decide(n); return; }
  switch (T.t) {
    case 'go': if (T.manual) { if (!n.path) { n.tasks.shift(); return; } } stepGo(n, dt, T); if (n.path) n.act = T.act || n.act; break;
    case 'out': { const tp = T.pts[T.k]; const dx = tp[0] - n.x, dy = tp[1] - n.y, d = Math.hypot(dx, dy); n.a = lerpAng(n.a, Math.atan2(dy, dx), Math.min(1, dt * 8)); n.walk = 1; n.phase += aph(dt) * n.speed * 4.6; n.z = OUTZ; if (d < n.speed * dt && T.k < T.pts.length - 1) { n.x = tp[0]; n.y = tp[1]; T.k++; } else if (d < n.speed * dt) { n.spawned = false; n.tasks.length = 0; if (n.backAt && n.backAt > simT) { n.act = 'обедает в столовой'; } else { n.act = 'ушёл домой'; n.doneToday = true; n.backAt = null; } } else { n.x += dx / d * n.speed * dt; n.y += dy / d * n.speed * dt; } break; }
    case 'step': { const dx = T.x - n.x, dy = T.y - n.y, d = Math.hypot(dx, dy); n.act = T.act || n.act; n.pose = 'stand'; n.a = lerpAng(n.a, Math.atan2(dy, dx), Math.min(1, dt * 8)); n.walk = Math.min(1, n.walk + dt * 4); n.phase += aph(dt) * n.speed * 4.6; const st = n.speed * dt; if (d <= st) { n.x = T.x; n.y = T.y; n.f = T.f; n.tasks.shift(); } else { n.x += dx / d * st; n.y += dy / d * st; } break; }
    case 'wait': {
      if (T.until == null) { T.until = simT + T.dur; n.sub = T.sub; n.subT = 0; n.act = T.act || n.act; }
      n.walk = Math.max(0, n.walk - dt * 5); n.pose = 'stand'; n.hidden = !!T.hide;
      if (T.jog) { n.sub = 'idle'; if (T.sub === 'run') { n.walk = 0.8; n.phase += aph(dt) * 6; } }
      if (n.sub === 'phone' && chance(0.002)) say(n, chance(0.5) ? 'life' : 'study', 2.5);
      if (simT >= T.until) { n.tasks.shift(); n.hidden = false; }
      break;
    }
    case 'sit': {
      const s = T.seat;
      if (!T.started) {
        T.started = true; n.x = s.p[0]; n.y = s.p[1]; n.a = s.a; n.f = s.f; n.z = s.z; n.seatH = 0.46; n.pose = 'sit'; n.sub = 'listen'; n.subT = 0; n.act = T.act; n.bagOn = false;
        if (s.pc >= 0) pcOn(PCS[s.pc], n);
      }
      n.walk = 0; n.pose = 'sit';
      const sh = n.group ? n.group.shift : null;
      if (T.kind === 'pre' && pairAt(simT, sh) >= 0 && lessonFor(n, pairAt(simT, sh))) { T.kind = 'lesson'; n.act = 'на паре: ' + lessonFor(n, pairAt(simT, sh)).subj; }
      seatedBehaviour(n, T, dt);
      const p = pairAt(simT, sh);
      const end = T.until != null && simT >= T.until;
      if (end || (T.kind === 'pre' && p >= 0 && !lessonFor(n, p)) || n.tasks.length > 1 && n.tasks[1].urgent) {
        n.tasks.shift(); n.pose = 'stand'; n.bagOn = true; n.sub = 'idle';
        if (s.pc >= 0 && PCS[s.pc].user === n) PCS[s.pc].user = null;
        s.occ = null; n.seat = null;
        // выйти из-за стола
        const q = nearestPass(s.f, s.p[0] - Math.cos(s.a) * 0.3, s.p[1] - Math.sin(s.a) * 0.3, 6); if (q) { n.x = wx(q[0]); n.y = wy(q[1]); }
        n.z = FZ[s.f];
        if (T.kind === 'lesson' && n.role === 'student') { n.needs.bladder += 0.12; n.needs.hunger += 0.15; n.needs.social -= 0.2; n.needs.energy -= 0.1; }
      }
      break;
    }
    case 'chat': {
      n.pose = 'stand'; n.walk = Math.max(0, n.walk - dt * 5); n.act = T.act;
      const c = T.conv; if (Math.hypot(c.y - n.y, c.x - n.x) > 0.3) n.a = lerpAng(n.a, Math.atan2(c.y - n.y, c.x - n.x), Math.min(1, dt * 6));   // в самом центре кружка не крутимся
      n.sub = n.say && performance.now() < n.sayT ? 'talk' : (chance(0.004) ? 'phone' : (n.sub === 'phone' ? 'phone' : 'idle'));
      const sh = n.group ? n.group.shift : null, p = pairAt(simT, sh), np = nextPair(simT, sh);
      const mustGo = n.role === 'student' && ((p >= 0 && lessonFor(n, p) && !n.skip) || (np >= 0 && lessonFor(n, np) && PAIRS[np][0] - simT < 1 + n.traits.punctual * 4));
      if (mustGo || c.t > c.dur || (simT >= n.leave && c.f !== 3)) { n.tasks.shift(); leaveConv(n); }
      break;
    }
    case 'teach': teachBehaviour(n, T, dt); break;
    case 'fix': {
      if (!T.p) { n.pose = chance(0.5) ? 'crouch' : 'stand'; n.sub = 'explain'; T.p = true; } n.walk = 0; n.act = 'чинит компьютер';
      const S = T.pc.screen; n.a = Math.atan2(S.y - n.y, S.x - n.x);
      if (chance(0.01)) say(n, 'it');
      if (simT >= T.until) { T.pc.err = false; T.pc.fixer = null; T.pc.tile = 1; T.pc.bootT = simT + 0.5; n.pose = 'stand'; n.tasks.shift(); say(n, pick(['Перезагрузил, всё работает', 'Готово, можно работать ✅', 'Драйвер переустановил'])); }
      break;
    }
    default: n.tasks.shift();
  }
}
function seatedBehaviour__base(n, T, dt) {
  if (n.subNext == null || simT >= n.subNext) {
    const pc = n.seat && n.seat.pc >= 0;
    const lesson = T.kind === 'lesson';
    const r = rnd(); const tr = n.traits;
    let s = 'listen';
    if (n.role !== 'student') s = pc || T.kind === 'it' ? (r < 0.75 ? 'type' : 'listen') : (r < 0.5 ? 'write' : (r < 0.7 ? 'phone' : 'listen'));
    else if (lesson) {
      if (pc) s = r < 0.55 + tr.diligent * 0.3 ? 'type' : (r < 0.85 ? 'listen' : (tr.social > 0.6 ? 'talk' : 'phone'));
      else s = r < 0.35 + tr.diligent * 0.3 ? 'write' : (r < 0.75 ? 'listen' : (r < 0.85 && tr.diligent > 0.6 ? 'hand' : (tr.social > 0.5 ? 'talk' : (n.needs.energy < 0.3 ? 'sleep' : 'phone'))));
      n.gameMode = tr.gamer > 0.85 && chance(0.25);
    } else s = r < 0.5 ? 'phone' : (r < 0.8 && tr.social > 0.4 ? 'talk' : 'lean');
    n.sub = s; n.subT = 0; n.subNext = simT + rr(0.4, 2.2);
    if (s === 'talk') { n.talkSide = chance(0.5) ? 0.7 : -0.7; if (chance(0.5)) say(n, lesson ? 'whisper' : (chance(0.5) ? 'study' : 'life'), 2.4); }
    if (s === 'hand') { say(n, 'answer', 2.6); n.st.hand++; }
    if (s === 'sleep') n.st.sleep++; if (s === 'type') n.st.code++;
    if (s === 'phone' && lesson && chance(0.1)) n.caught = true;
    if (lesson && pc && chance(0.0005 * (1 + tr.gamer))) { const P = PCS[n.seat.pc]; if (!P.err) { P.err = true; n.st.broke++; say(n, 'pcBroke', 3); } }
  }
  if (n.seat && n.seat.pc >= 0) { const P = PCS[n.seat.pc]; if (P.user !== n) pcOn(P, n); }
}
function teachBehaviour__base(n, T, dt) {
  const sp = T.spot; n.act = `ведёт пару: ${T.lesson.subj}`;
  if (simT >= T.until) { n.tasks.shift(); n.pose = 'stand'; say(n, pick(['На сегодня всё, до свидания!', 'Домашнее задание в чате группы', 'Свободны!'])); return; }
  if (T.early && simT < PAIRS[T.p][0]) { n.sub = 'idle'; n.pose = 'stand'; n.walk = 0; return; }
  if (!T.mode || simT >= T.modeUntil) {
    const r = rnd(); const pcRoom = T.room.kind === 'pc';
    T.mode = r < 0.35 ? 'explain' : (r < 0.55 && sp.board ? 'board' : (r < 0.8 ? 'walk' : 'desk'));
    T.modeUntil = simT + rr(1.5, 5); T.wp = null;
    if (T.mode === 'explain' || chance(0.3)) say(n, pcRoom ? 'teacherPc' : 'teacherLec', 3.5);
  }
  const atSpot = Math.hypot(n.x - sp.x, n.y - sp.y) < 0.25;
  if (T.mode === 'walk') {
    if (!T.wp) { const ss = seatsIn(T.room.id).filter(s => s.occ && s.occ.role === 'student'); const s = ss.length ? pick(ss) : null; if (s) { const q = nearestInRoom(T.room.f, s.p[0] - Math.cos(s.a) * 0.7, s.p[1] - Math.sin(s.a) * 0.7, T.room.id, 6); if (q) T.wp = { x: wx(q[0]), y: wy(q[1]), s }; } if (!T.wp) T.wp = { x: sp.x, y: sp.y }; }
    if (!T.path) { T.path = floorPath(T.room.f, n.x, n.y, T.wp.x, T.wp.y) || []; T.pi = 0; }
    if (T.pi < T.path.length) { const p = T.path[T.pi]; const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy); const st = n.speed * 0.6 * dt; if (d <= st) { n.x = p.x; n.y = p.y; T.pi++; } else { n.x += dx / d * st; n.y += dy / d * st; n.a = lerpAng(n.a, Math.atan2(dy, dx), Math.min(1, dt * 10)); } n.walk = Math.min(0.7, n.walk + dt * 4); n.phase += aph(dt) * n.speed * 3.4; }
    else { n.walk = Math.max(0, n.walk - dt * 5); n.sub = 'explain'; if (T.wp.s) { n.a = lerpAng(n.a, Math.atan2(T.wp.s.p[1] - n.y, T.wp.s.p[0] - n.x), Math.min(1, dt * 20)); const st = T.wp.s.occ; if (st && st.gameMode && chance(0.3)) { say(n, 'Закрой игру!'); st.gameMode = false; } } }
    if (simT >= T.modeUntil - 0.3) { T.path = null; T.mode = 'back'; T.modeUntil = simT + 2; }
    return;
  }
  if (!atSpot) {
    if (!T.path || T.mode !== 'back') { T.path = floorPath(T.room.f, n.x, n.y, sp.x, sp.y) || [{ x: sp.x, y: sp.y }]; T.pi = 0; T.mode = 'back'; }
    if (T.pi < T.path.length) { const p = T.path[T.pi]; const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy); const st = n.speed * 0.7 * dt; if (d <= st) { n.x = p.x; n.y = p.y; T.pi++; } else { n.x += dx / d * st; n.y += dy / d * st; n.a = lerpAng(n.a, Math.atan2(dy, dx), Math.min(1, dt * 10)); } n.walk = Math.min(0.8, n.walk + dt * 4); n.phase += aph(dt) * n.speed * 3.6; }
    else { n.x = sp.x; n.y = sp.y; }
    return;
  }
  T.path = null; n.walk = Math.max(0, n.walk - dt * 5); n.pose = 'stand';
  if (T.mode === 'back') { T.mode = 'explain'; }
  // у доски — только если доска рядом (иначе преподаватель «писал» рукой в воздух, стоя лицом к двери)
  if (T.mode === 'board' && !(sp.board && Math.hypot(sp.board[0] - n.x, sp.board[1] - n.y) < 1.6)) T.mode = 'explain';
  if (T.mode === 'board' && sp.board) { n.a = lerpAng(n.a, Math.atan2(sp.board[1] - n.y, sp.board[0] - n.x), Math.min(1, dt * 30)); n.sub = 'board'; }
  else { n.a = lerpAng(n.a, sp.a + Math.PI, Math.min(1, dt * 30)); n.sub = T.mode === 'desk' ? 'arms' : 'explain'; }
  // отвечаем на поднятую руку
  const hand = seatsIn(T.room.id).find(s => s.occ && s.occ.sub === 'hand');
  if (hand && chance(0.02)) { say(n, pick(['Да, слушаю', 'Правильно!', 'Хороший вопрос', 'Почти, подумай ещё'])); hand.occ.sub = 'listen'; }
}

// ---------- лёгкое расталкивание ----------
function separate(dt) {
  const act = NPCS.filter(n => n.spawned && !n.hidden && n.pose === 'stand' && !n.waitPath);
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j]; if (a.f !== b.f || Math.abs(a.z - b.z) > 0.5) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 > 0.25 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), push = (0.5 - d) * 0.5 * Math.min(1, dt * 10);
    let ux = dx / d * push, uy = dy / d * push;
    // лоб в лоб: толкаем вбок, а не назад, иначе стоят друг против друга и крутятся
    const ga = a.tasks[0]?.t === 'go', gb = b.tasks[0]?.t === 'go';
    if (ga && gb && Math.cos(a.a - b.a) < -0.5) { const px = Math.sin(a.a) * push, py = -Math.cos(a.a) * push; ux = -px; uy = -py; }
    const fa = a.tasks[0]?.t === 'sit', fb = b.tasks[0]?.t === 'sit';
    if (!fa && clearW(a.f, a.x - ux, a.y - uy, 0.15)) { a.x -= ux; a.y -= uy; a.pushed = true; }
    if (!fb && clearW(b.f, b.x + ux, b.y + uy, 0.15)) { b.x += ux; b.y += uy; b.pushed = true; }
  }
  // не стоим вплотную к стене/окну: иначе локоть и ноутбук торчат наружу
  const k = Math.min(1, dt * 4);
  for (const n of act) {
    if (n.f > 3 || n.tasks[0]?.t === 'sit') continue; const p = n.path && n.path[n.pi]; if (p && p.st) continue;
    let ax = 0, ay = 0;
    for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4, ox = Math.cos(a), oy = Math.sin(a); if (!passW(n.f, n.x + ox * 0.3, n.y + oy * 0.3)) { ax -= ox; ay -= oy; } }
    const L = Math.hypot(ax, ay); if (L < 0.5) continue;
    const mx = ax / L * 0.06 * k, my = ay / L * 0.06 * k;
    if (passW(n.f, n.x + mx, n.y + my)) { n.x += mx; n.y += my; n.pushed = true; }
  }
}

// ---------- день ----------
function resetDay__base() {
  NPCS.forEach(n => { n.spawned = false; n.tasks.length = 0; n.path = null; n.doneToday = false; n.conv = null; n.seat = null; n.skip = null; n.say = null; n.hung = false; n.backAt = null; n.hidden = false; n.lateMark = null; for (const k in n.st) n.st[k] = 0; n.needs.energy = rr(0.6, 1); n.needs.hunger = rr(0.1, 0.4); n.needs.bladder = rr(0, 0.3); });
  SEATS.forEach(s => s.occ = null); BENCH_SEATS.forEach(s => s.occ = null); PCS.forEach(p => { p.user = null; p.tile = 0; p.err = false; p.fixer = null; p.offAt = null; }); CONVS.length = 0; pathQ.length = 0;
}
function newDay() { simDay++; simDow = (simDow + 1) % 7; simT -= 1440; resetDay(); }
function simTick__base(dtMin) {
  simT += dtMin;
  if (simT >= 1440) newDay();
  const hol = holiday();
  for (const n of NPCS) {
    if (!n.spawned) { if (!n.doneToday && canSpawn(n, hol) && simT >= n.arrive && simT < (n.leave ?? 1080) - 10 && (!n.backAt || simT >= n.backAt)) { n.backAt = null; spawn(n); } continue; }
    n.needs.bladder += dtMin * 0.0015; n.needs.hunger += dtMin * 0.003; n.needs.energy -= dtMin * 0.002; n.needs.social -= dtMin * 0.004;
    runTask(n, dtMin * 60);
  }
  convTick(dtMin);
  pcTick();
  processPaths(8);
}

// ---------- пузыри речи и подписи ----------
const bubLayer = document.createElement('div'); bubLayer.id = 'bubbles'; host.appendChild(bubLayer);
const bubPool = []; for (let i = 0; i < 18; i++) { const d = document.createElement('div'); d.className = 'bub'; bubLayer.appendChild(d); bubPool.push(d); }
const _p = new THREE.Vector3();
function project(x, y, z) { _p.set(x, z, -y).project(camera); return [(_p.x * 0.5 + 0.5) * host.clientWidth, (-_p.y * 0.5 + 0.5) * host.clientHeight, _p.z]; }
function overlays() {
  const now = performance.now();
  const cam = camera.position;
  const speakers = NPCS.filter(n => n.spawned && n.say && now < n.sayT && npcVisible(n));
  speakers.sort((a, b) => dist3(a) - dist3(b));
  bubPool.forEach((d, i) => {
    const n = speakers[i];
    if (!n || !showBubbles) { d.style.display = 'none'; return; }
    const [sx, sy, sz] = project(n.x, n.y, n.z + floorYOff(n.f) + (n.pose === 'sit' ? 1.45 : 1.95) * n.k);
    if (sz > 1) { d.style.display = 'none'; return; }
    d.style.display = 'block'; d.textContent = n.say; d.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)`;
    d.classList.toggle('t', n.role !== 'student');
  });
}
function dist3(n) { return camera.position.distanceToSquared(new THREE.Vector3(n.x, n.z, -n.y)); }
const floorVis = f => f === 3 || (storeyG[f] && storeyG[f].visible);
function npcVisible(n) { return n.spawned && !n.hidden && floorVis(n.f) && showPeople; }

// ---------- UI ----------
let showPeople = true, showBubbles = true, followN = null, selN = null;
function simUI() {
  const box = document.createElement('div'); box.className = 'grp'; box.id = 'simBox';
  box.innerHTML = `<div class="lbl">Жизнь корпуса</div>
  <div class="clock"><b id="sClock">07:40</b><span id="sDay"></span></div>
  <div class="sstat" id="sStat"></div>
  <div class="seg" id="sSpeed"><button data-s="live" class="on" title="Реальное время Бишкека">● Сейчас</button><button data-s="0" aria-label="Пауза">❚❚</button><button data-s="1">1×</button><button data-s="5">5×</button><button data-s="20">20×</button><button data-s="60">60×</button></div>
  <div class="seg"><button id="sMorning">☀ День с утра</button><button id="sJumpPair">→ пара</button><button id="sJumpBreak">→ перемена</button><button id="sFollow">🎥 Следить</button></div>
  <label class="tog"><input type="checkbox" id="cPeople" checked> Люди</label>
  <label class="tog"><input type="checkbox" id="cBubbles" checked> Реплики</label>`;
  const ctrl = document.getElementById('ctrl'); ctrl.insertBefore(box, ctrl.children[2]);
  box.querySelectorAll('#sSpeed button').forEach(b => b.onclick = () => { if (b.dataset.s === 'live') goLive(); else { liveMode = false; simSpeed = +b.dataset.s; } markSpeed(); });
  document.getElementById('cPeople').onchange = e => showPeople = e.target.checked;
  document.getElementById('cBubbles').onchange = e => showBubbles = e.target.checked;
  document.getElementById('sMorning').onclick = startMorning;
  document.getElementById('sJumpPair').onclick = () => jumpTo(() => { const st = PAIRS.map(p => p[0]).filter(x => x > simT + 3); return st.length ? Math.min(...st) + 4 : null; });
  document.getElementById('sJumpBreak').onclick = () => jumpTo(() => { const en = PAIRS.map(p => p[1]).filter(x => x > simT - 1); return en.length ? Math.min(...en) + 3 : null; });
  document.getElementById('sFollow').onclick = () => { if (followN) { followN = null; document.getElementById('sFollow').classList.remove('on'); return; } const c = NPCS.filter(n => n.spawned && n.role === 'student' && !n.hidden); const n = selN && selN.spawned ? selN : (c.length ? pick(c) : null); if (n) { followN = n; selectNPC(n); document.getElementById('sFollow').classList.add('on'); } };
  const card = document.createElement('div'); card.id = 'npcCard'; document.getElementById('exp').insertBefore(card, document.getElementById('exp').children[1]);
  const ban = document.createElement('div'); ban.id = 'liveBan'; host.appendChild(ban);
}
function markSpeed() { document.querySelectorAll('#sSpeed button').forEach(x => x.classList.toggle('on', liveMode ? x.dataset.s === 'live' : x.dataset.s === String(simSpeed))); }
function prewarm__base(target) {
  resetDay(); ANIM_DT = 1;
  if (target > 400 && target < 1300) { simT = 400; while (simT < target) simTick(Math.min(0.1, target - simT + 1e-6)); }
  else simT = target;
}
function goLive() {
  const now = bishkekNow(); liveMode = true; simSpeed = 1;
  if (now.dow !== simDow || now.min < simT - 0.5 || now.min - simT > 240) { simDow = now.dow; prewarm(now.min); }
  else { ANIM_DT = 1; while (simT < now.min) simTick(0.1); }
  markSpeed();
}
function startMorning() {
  liveMode = false; if (holiday()) simDow = 1;
  resetDay(); simT = 7 * 60 + 20; simSpeed = 5; markSpeed();
}
function jumpTo__base(fn) {
  const target = fn(); if (target == null) return;
  liveMode = false; if (simSpeed === 0) simSpeed = 5; markSpeed();
  ANIM_DT = 1; let steps = 0; while (simT < target && steps++ < 6000) { simTick(0.05); }
}
function selectNPC(n) {
  selN = n; const c = document.getElementById('npcCard'); if (!c) return;
  if (!n) { c.style.display = 'none'; return; }
  c.style.display = 'block';
}
function cardHTML__base(n) {
  const role = { student: n.g === 'm' ? 'Студент' : 'Студентка', teacher: n.title || 'Преподаватель', it: 'Системный администратор ИНИТ', dean: 'Директор ИНИТ', staff: 'Сотрудник', guard: 'Вахтёр', gym: 'Студент (спортзал)' }[n.role] || ROLE_X[n.role] || '';
  const full = n.role === 'student' || n.role === 'gym' ? `${n.name} ${n.surname}` : `${n.surname} ${n.name} ${n.patr || ''}`;
  const sub = n.role === 'student' ? `группа ${n.group.name}, ${n.group.course} курс, ${n.age} лет` : (n.role === 'teacher' ? `${n.kaf.num ? 'каб. ' + n.kaf.num : ''}, ${n.age} лет` : (n.role === 'it' ? 'кабинет 314' : `${n.age || ''} лет`));
  const bar = (l, v) => `<div class="nb"><span>${l}</span><i><em style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></em></i></div>`;
  const tr = n.traits; const tt = [];
  if (tr.social > 0.7) tt.push('общительный'); if (tr.diligent > 0.7) tt.push('отличник'); if (tr.diligent < 0.25) tt.push('ленится'); if (tr.punctual < 0.2) tt.push('опаздывает'); if (tr.gamer > 0.8) tt.push('геймер'); if (tr.curious > 0.75) tt.push('любит ИИ');
  const fr = [...n.friends.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).filter(e => e[1] > 0.4).map(([id]) => NPCS[id].name);
  const room = n.spawned ? ROOMS[roomAt(n.f, n.x, n.y)] : null;
  const where = !n.spawned ? (n.doneToday ? 'ушёл домой' : 'ещё не пришёл') : n.f === 3 ? 'во дворе' : `${n.f + 1} этаж${room && room.kind !== 'corridor' ? ', ' + room.name.toLowerCase() : ', коридор'}`;
  let mood = n.needs.energy < 0.3 ? '😴 устал' : n.needs.hunger > 0.7 ? '🍞 голоден' : n.needs.social > 0.7 ? '😄 в настроении' : '🙂 нормально';
  const think = n.role === 'student' ? (n.needs.hunger > 0.6 ? 'Скорее бы обед…' : n.sub === 'type' ? 'Почему не компилируется?..' : n.conv ? 'Классно поболтать' : tr.diligent > 0.7 ? 'Надо сдать лабу сегодня' : tr.gamer > 0.8 ? 'Вечером катка' : 'Сколько до конца пары?') : (n.role === 'it' ? (PCS.some(p => p.err) ? 'Опять кто-то сломал компьютер' : 'Тихо… подозрительно тихо') : 'Надо проверить работы');
  return `<div class="nh"><span class="av" style="background:#${n.cTop.getHexString()}">${n.name[0]}</span><div><b>${full}</b><div class="ns">${role}</div><div class="ns">${sub}</div></div></div>
  <div class="na">▸ ${n.act}</div><div class="ns">📍 ${where}</div>
  ${n.role === 'student' ? `<div class="ns">${mood}${tt.length ? ' · ' + tt.join(', ') : ''}</div>${bar('Энергия', n.needs.energy)}${bar('Сытость', 1 - n.needs.hunger)}${bar('Общение', n.needs.social)}` : ''}
  ${fr.length ? `<div class="ns">Друзья: ${fr.join(', ')}</div>` : ''}
  <div class="nt">💭 ${think}</div>${n.lastSaid ? `<div class="ns">Последняя фраза: «${n.lastSaid}»</div>` : ''}
  <div class="seg"><button id="cardFollow">${followN === n ? 'Не следить' : '🎥 Следить'}</button><button id="cardClose">Закрыть</button></div>`;
}
let cardTick = 0;
function shiftStatus(sh) {
  const p = pairAt(simT, sh); if (p >= 0) return `${PAIR_NAMES[p]}, до ${hhmm(PAIRS[p][1])}`;
  const np = nextPair(simT, sh); if (np < 0) return 'пары закончились';
  const firstOfShift = PSH.indexOf(sh) === np;
  return firstOfShift ? `начало в ${hhmm(PAIRS[np][0])}` : `перемена, ${PAIR_NAMES[np]} в ${hhmm(PAIRS[np][0])}`;
}
function updateUI__base() {
  document.getElementById('sClock').textContent = hhmm(simT);
  document.getElementById('sDay').innerHTML = `${DAYS[simDow]} · ${weatherLabel(simT)}${liveMode ? ' · <span class="live">● вживую, Бишкек</span>' : ''}`;
  let st;
  if (holiday()) st = 'Воскресенье, выходной. В корпусе только вахтёр';
  else if (simT < 420 || simT > 1260) st = 'Ночь. Корпус закрыт';
  else st = `1 смена: ${shiftStatus(1)}<br>2 смена: ${shiftStatus(2)}`;
  const inB = NPCS.filter(n => n.spawned).length, yard = NPCS.filter(n => n.spawned && n.f === 3).length, les = NPCS.filter(n => n.spawned && n.tasks[0]?.t === 'sit' && n.tasks[0].kind === 'lesson').length, pcs = PCS.filter(x => x.tile > 0).length;
  document.getElementById('sStat').innerHTML = `${st}<br><span>Всего ${inB} чел. · во дворе ${yard} · на парах ${les} · ПК включено ${pcs}/${PCS.length}</span>`;
  const ban = document.getElementById('liveBan');
  const quiet = liveMode && (holiday() || NPCS.filter(n => n.spawned && n.role === 'student').length < 3);
  if (quiet) {
    const why = holiday() ? 'воскресенье, все отдыхают' : simT > 1000 ? 'пары закончились, студенты разошлись по домам' : 'корпус ещё спит';
    const html = `В Бишкеке ${hhmm(simT)}: ${why}. <button id="banGo">▶ Смотреть учебный день</button>`;
    if (ban.dataset.h !== html) { ban.innerHTML = html; ban.dataset.h = html; document.getElementById('banGo').onclick = startMorning; }
    ban.style.display = 'block';
  } else ban.style.display = 'none';
  if (selN && ++cardTick % 10 === 0) {
    const c = document.getElementById('npcCard'); c.innerHTML = cardHTML(selN);
    document.getElementById('cardClose').onclick = () => { selectNPC(null); if (followN) { followN = null; document.getElementById('sFollow').classList.remove('on'); } };
    document.getElementById('cardFollow').onclick = () => { followN = followN === selN ? null : selN; document.getElementById('sFollow').classList.toggle('on', !!followN); };
  }
}
// выбор кликом: ближайший к лучу человечек
function pickNPC(ray) {
  let best = null, bd = 0.5;
  const o = ray.ray.origin, d = ray.ray.direction; const v = new THREE.Vector3();
  NPCS.forEach(n => {
    if (!npcVisible(n)) return;
    const top = n.pose === 'sit' ? 1.3 : 1.75;
    for (let h = 0.4; h <= top; h += 0.3) {
      v.set(n.x, n.z + floorYOff(n.f) + h * n.k, -n.y);
      const t = v.clone().sub(o).dot(d); if (t < 0) continue;
      const dist = o.clone().addScaledVector(d, t).distanceTo(v);
      if (dist < bd) { bd = dist; best = n; }
    }
  });
  return best;
}

// ---------- старт ----------
async function initSim() {
  await decodeGrid();
  buildOutdoor();
  buildWorld();            // двор, деревья, скамейки, горы (world.js)
  finishOutdoor();
  PCS.forEach(p => p.f = p.f ?? 2);
  populate(); evPopulate();
  buildBodies(); evBodies();
  buildScreens();
  simUI(); worldUI(); buildTraffic(); try { buildWalkers(); } catch (e) { console.warn('walkers', e); } evInit();
  const now = bishkekNow(); simDow = now.dow; setSunDay(now.doy); pickWeather(now.doy, now.dow);
  goLive();
}
let lastSim = performance.now(), syncT = 0;
function simFrame__base() {
  const now = performance.now(); let dt = Math.min(0.1, (now - lastSim) / 1000); lastSim = now;
  if (liveMode && (syncT += dt) > 5) { syncT = 0; const b = bishkekNow(); const d = b.min - simT; if (b.dow !== simDow || d < -1 || d > 2) goLive(); }
  const dtMin = dt * simSpeed / 60;
  if (simSpeed > 0) { const steps = Math.max(1, Math.ceil(dtMin / 0.05)); ANIM_DT = dt / steps; for (let s = 0; s < steps; s++) simTick(dtMin / steps); }
  if (simSpeed > 0) separate(dt * Math.min(simSpeed, 5));
  for (let i = 0; i < NPCS.length; i++) { const n = NPCS[i]; n.subT += dt; poseNPC(n, i, npcVisible(n)); }
  Object.values(PART).forEach((m: any) => m.instanceMatrix.needsUpdate = true);
  updateScreens();
  worldFrame(dt);
  if (followN && followN.spawned) {
    const tgt = new THREE.Vector3(followN.x, followN.z + floorYOff(followN.f) + 1, -followN.y);
    const off = camera.position.clone().sub(controls.target);
    controls.target.lerp(tgt, 0.08); camera.position.copy(controls.target).add(off);
  }
  overlays(); updateUI();
}
