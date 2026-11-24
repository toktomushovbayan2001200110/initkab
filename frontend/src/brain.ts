// ================= «УМ»: взгляд, приветствия, диалоги, память, учёба =================
const hhmmS = t => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function remember(n, text) { if (PREWARM_Q && n.mem && n.mem.length > 30) n.mem.shift(); (n.mem || (n.mem = [])).push([simT, text]); if (n.mem.length > 40) n.mem.shift(); }
let PREWARM_Q = false;
const isStu = n => n.role === 'student';
const teacherIn = roomId => NPCS.find(m => m.spawned && m.tasks[0] && m.tasks[0].t === 'teach' && m.tasks[0].room.id === roomId);
const polite = t => (t.g === 'm' ? 'агай' : 'эжей');
const genS = t => t.g === 'f' ? t.surname.replace(/а$/, 'ой') : t.surname + 'а';
const fr = (a, b) => a.friends.get(b.id) || 0;
function addFr(a, b, v) { a.friends.set(b.id, Math.max(0, Math.min(1, fr(a, b) + v))); b.friends.set(a.id, Math.max(0, Math.min(1, fr(b, a) + v))); }

// ---------- учёба: знания, оценки, посещаемость ----------
function initStudy() {
  STUDENTS.forEach(s => { if (s.archDb && typeof ARCH !== 'undefined' && ARCH[s.archDb] && typeof setArch === 'function') setArch(s, s.archDb); });
  STUDENTS.forEach(s => {
    s.know = {}; s.grades = []; s.att = { came: 0, total: 0 }; s.labs = { done: 0, total: 0 }; s.mem = [];
    const base = 0.25 + s.traits.diligent * 0.55 + s.traits.curious * 0.1;
    // «семестр до сегодняшнего дня»
    const weeks = 10; s.att.total = weeks * 12; s.att.came = Math.round(s.att.total * Math.min(1, 0.62 + s.traits.punctual * 0.2 + s.traits.diligent * 0.2 + rr(-0.06, 0.06)));
    s.labs.total = 8; s.labs.done = Math.max(0, Math.min(8, Math.round(8 * (base + rr(-0.15, 0.2)))));
    for (let k = 0; k < 6; k++) s.grades.push({ subj: pick(chance(0.5) ? SUBJ_PC : SUBJ_CL), g: gradeOf(base + rr(-0.2, 0.2)), old: true });
    s.base = base;
  });
  NPCS.forEach(n => { if (!n.mem) n.mem = []; });
}
const gradeOf = k => k > 0.78 ? 5 : k > 0.55 ? 4 : k > 0.33 ? 3 : 2;
const knowOf = (s, subj) => s.know[subj] ?? (s.know[subj] = Math.max(0.05, Math.min(0.95, s.base + rr(-0.15, 0.15))));
const avgGrade = s => s.grades.length ? s.grades.reduce((a, g) => a + g.g, 0) / s.grades.length : 0;
const attPct = s => s.att.total ? Math.round(100 * s.att.came / s.att.total) : 100;
function giveGrade(s, subj, g, why) {
  s.grades.push({ subj, g, t: simT }); remember(s, `получил${s.g === 'f' ? 'а' : ''} ${g} по «${subj}»${why ? ' — ' + why : ''}`);
  s.evMood = g >= 5 ? '🤩' : g === 4 ? '😊' : g === 3 ? '😐' : '😣'; s.evMoodT = simT + 4; s.lastGrade = { subj, g, t: simT };
  if (g === 5 && !PREWARM && typeof news === 'function' && chance(0.25)) news(`⭐ ${s.name} ${s.surname} (${s.group.name}) — пятёрка по «${subj}»`);
}
function groupStats(g) {
  const S = STUDENTS.filter(s => s.group === g); if (!S.length) return { avg: 0, att: 0, labs: 0, n: 0 };
  return { n: S.length, avg: S.reduce((a, s) => a + avgGrade(s), 0) / S.length, att: Math.round(S.reduce((a, s) => a + attPct(s), 0) / S.length), labs: Math.round(100 * S.reduce((a, s) => a + s.labs.done, 0) / Math.max(1, S.reduce((a, s) => a + s.labs.total, 0))) };
}
let lastPairSeen = {};
function studyTick(dt) {
  // посещаемость: через 12 минут после начала пары
  for (let p = 0; p < PAIRS.length; p++) {
    const key = simDay + ':' + p;
    if (!lastPairSeen[key] && simT >= PAIRS[p][0] + 12 && simT < PAIRS[p][1]) {
      lastPairSeen[key] = 1;
      STUDENTS.forEach(s => { const L = SCHED[p][s.group.id]; if (!L || s.offToday || s.vac) return; s.att.total++; const here = s.spawned && s.seat && s.seat.room === L.room; if (here) s.att.came++; else { remember(s, `пропустил${s.g === 'f' ? 'а' : ''} пару «${L.subj}»`); } });
    }
    const ekey = key + 'e';
    if (!lastPairSeen[ekey] && simT >= PAIRS[p][1] - 4 && simT < PAIRS[p][1]) {
      lastPairSeen[ekey] = 1;
      // сдача лабораторных в компьютерных классах
      STUDENTS.forEach(s => { const L = SCHED[p][s.group.id]; if (!L || !s.spawned || !s.seat || s.seat.room !== L.room || s.seat.pc < 0) return; if (roomById(L.room).kind !== 'pc') return; s.labs.total++; const k = knowOf(s, L.subj) + (s.st.code > 20 ? 0.15 : 0) - (s.gameMode ? 0.3 : 0); if (chance(0.25 + k * 0.7)) { s.labs.done++; remember(s, `сдал${s.g === 'f' ? 'а' : ''} лабораторную по «${L.subj}»`); if (chance(0.3)) giveGrade(s, L.subj, gradeOf(k + rr(-0.1, 0.15)), 'за лабораторную'); } else { s.debt = (s.debt || 0) + 1; remember(s, `не успел${s.g === 'f' ? 'а' : ''} сдать лабораторную по «${L.subj}»`); } });
    }
  }
  // знания растут, когда слушаешь; падают от телефона и сна
  for (const s of STUDENTS) {
    const T = s.tasks[0]; if (!s.spawned || !T || T.t !== 'sit' || T.kind !== 'lesson') continue;
    const p = pairAt(simT, s.group.shift), L = lessonFor(s, p); if (!L) continue;
    const r = s.sub === 'type' || s.sub === 'write' ? 0.006 : s.sub === 'listen' || s.sub === 'hand' ? 0.004 : s.sub === 'talk' ? -0.001 : -0.003;
    s.know[L.subj] = Math.max(0.02, Math.min(0.99, knowOf(s, L.subj) + r * dt * (s.gameMode ? -0.5 : 1)));
  }
}

// ---------- взгляд ----------
function gazeFor(n) {
  const T = n.tasks[0]; if (!T) return null;
  const now = performance.now();
  if (n.glance && now < n.glance.until && n.glance.who.spawned) { const m = n.glance.who; return { x: m.x, y: m.y, z: m.z + 1.55 * m.k }; }
  if (T.t === 'chat' && n.conv) {
    const c = n.conv, sp = c.speaker && c.speaker !== n && c.speaker.conv === c ? c.speaker : null;
    if (sp) return { x: sp.x, y: sp.y, z: sp.z + 1.55 * sp.k };
    const o = c.listener && c.listener !== n ? c.listener : c.members.find(m => m !== n && m.tasks[0] && m.tasks[0].t === 'chat');
    return o ? { x: o.x, y: o.y, z: o.z + 1.55 * o.k } : null;
  }
  if (T.t === 'sit') {
    if (T.kind === 'lesson' || T.kind === 'pre') {
      if (n.sub === 'talk' || n.sub === 'sleep' || n.sub === 'phone') return null;
      const room = n.seat ? n.seat.room : -1; const hand = n.gazeHand && n.gazeHand.sub === 'hand' ? n.gazeHand : null;
      if (hand) return { x: hand.x, y: hand.y, z: hand.z + 1.2 };
      const t = teacherIn(room);
      if (t) { if (t.sub === 'board' && T.spotB) return T.spotB; return { x: t.x, y: t.y, z: t.z + 1.6 * t.k }; }
      return null;
    }
    return null;
  }
  if (T.t === 'teach') {
    const hand = seatsIn(T.room.id).find(s => s.occ && s.occ.sub === 'hand'); if (hand) return { x: hand.occ.x, y: hand.occ.y, z: hand.occ.z + 1.2 };
    if (n.sub === 'explain') { if (!n.gazeS || now > n.gazeU) { const ss = seatsIn(T.room.id).filter(s => s.occ && s.occ !== n); n.gazeS = ss.length ? pick(ss).occ : null; n.gazeU = now + 1500 + Math.random() * 2500; } const s = n.gazeS; return s && s.spawned ? { x: s.x, y: s.y, z: s.z + 1.2 } : null; }
    return null;
  }
  if (T.t === 'queue') return null;
  return null;
}
let brainK = 0;
function brainFrame(dt) {
  const N = NPCS.length; const now = performance.now();
  // взгляд — по 40 человек за кадр
  for (let c = 0; c < 40; c++) { const n = NPCS[brainK = (brainK + 1) % N]; if (n.spawned) n.look = gazeFor(n); }
  if (simSpeed <= 0 || simSpeed > 20) return;
  // встречи в коридоре: приветствия, обход справа
  const W = [];
  for (const n of NPCS) if (n.spawned && !n.hidden && n.pose === 'stand') W.push(n);
  for (const a of W) {
    if (a.walk < 0.5) continue;
    const ca = Math.cos(a.a), sa = Math.sin(a.a);
    for (const b of W) {
      if (a === b || a.f !== b.f || Math.abs(a.z - b.z) > 0.5) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 > 9) continue;
      const d = Math.sqrt(d2), fwd = (dx * ca + dy * sa) / (d || 1); if (fwd < 0.55) continue;
      // обход: держимся правее
      if (d < 1.3) { const lat = dx * -sa + dy * ca; if (Math.abs(lat) < 0.5) { const s = (b.walk > 0.5 && Math.cos(b.a - a.a) < -0.3) || lat > 0 ? -1 : 1; const st = dt * Math.min(simSpeed, 3) * 0.55 * s; const nx = a.x - sa * st, ny = a.y + ca * st; if (pass(a.f, cx(nx), cy(ny))) { a.x = nx; a.y = ny; } } }
      // приветствие
      if (d < 2.6 && d > 0.7 && now > (a.greetCd || 0)) {
        const key = b.id; a.greeted = a.greeted || {};
        if (a.greeted[key] && simT - a.greeted[key] < 240) continue;
        const f = fr(a, b), teach = isStu(a) && (b.role === 'teacher' || b.role === 'dean'), same = isStu(a) && isStu(b) && a.group === b.group;
        if (!(teach || f > 0.35 || (same && chance(0.3)) || (a.role === 'teacher' && b.role === 'teacher'))) { a.greeted[key] = simT; continue; }
        a.greeted[key] = simT; (b.greeted = b.greeted || {})[a.id] = simT; a.greetCd = now + 2500; b.greetCd = now + 1500;
        a.glance = { who: b, until: now + 1800 }; b.glance = { who: a, until: now + 2200 };
        if (teach) { say(a, b.role === 'dean' ? 'Саламатсызбы!' : pick([`Саламатсызбы, ${polite(b)}!`, `Здравствуйте, ${polite(b)}!`, 'Саламатсызбы!']), 2.2); a.nodT = now + 700; setTimeout(() => { if (b.spawned) { b.nodT = performance.now() + 700; if (chance(0.5)) say(b, pick(['Саламатсыңбы', 'Здравствуй', 'Салам, на пару не опаздывай']), 2); } }, 700); }
        else if (f > 0.6) { say(a, pick([`Салам, ${b.name}!`, `${b.name}, салам!`, 'О, салам! Кандайсың?', `Привет, ${b.name}!`]), 2.2); a.waveT = now + 1100; setTimeout(() => { if (b.spawned) { b.waveT = performance.now() + 900; say(b, pick(['Салам!', 'Жакшы! Өзүң?', 'Привет!', `Салам, ${a.name}!`]), 2); } }, 800); addFr(a, b, 0.01); }
        else { a.nodT = now + 600; b.nodT = now + 900; if (chance(0.4)) say(a, pick(['Салам', 'Привет', 'Салам!']), 1.6); }
        break;
      }
    }
  }
}

// ---------- осмысленные диалоги ----------
const nextInfo = n => { if (!n.group) return null; const sh = n.group.shift, np = nextPair(simT, sh), cp = pairAt(simT, sh); const p = cp >= 0 && lessonFor(n, cp) ? cp : np; if (p < 0) return null; const L = lessonFor(n, p); if (!L) return null; const room = roomById(L.room); const t = TEACHERS.find(tt => tt.lessons && tt.lessons[p] && tt.lessons[p].room === L.room); return { L, room, t, min: Math.max(0, Math.round(PAIRS[p][0] - simT)), now: p === cp }; };
const SCRIPTS = [
  // [условие, вес, генератор реплик (a говорит первым)]
  { w: 3, ok: (a, b) => isStu(a) && nextInfo(a) && !nextInfo(a).now, mk: (a, b) => { const i = nextInfo(a); return [[0, 'Что у нас следующей парой?'], [1, `${i.L.subj}${i.room.num ? ', в ' + i.room.num : ''}`], [0, i.t ? pick([`У ${genS(i.t)}? Надо не опоздать`, 'Ок, пойдём вместе', 'Опять… ну ладно']) : 'Ок, пойдём вместе']]; } },
  { w: 2, ok: (a) => isStu(a) && nextInfo(a) && nextInfo(a).min > 0 && nextInfo(a).min < 40, mk: (a) => { const i = nextInfo(a); return [[0, 'Сколько до пары?'], [1, i.min <= 3 ? 'Уже звонок почти, пошли!' : `Минут ${i.min} ещё`], [0, i.min <= 3 ? 'Бежим!' : pick(['Успеем чай попить', 'Тогда ещё постоим', 'Норм'])]]; } },
  { w: 3, ok: (a, b) => isStu(a) && a.needs.hunger > 0.45 && R_COWORK && a.f === 2, mk: (a, b) => [[0, pick(['Я голодный, пойдём в буфет?', 'Курсак ачты… пошли за самсой?', 'Пойдём чай попьём?'])], [1, b.needs.hunger > 0.25 ? pick(['Пошли, я тоже хочу', 'Го, самсу возьмём', 'Давай, угощаешь? 😄']) : 'Иди, я не хочу'], [0, 'Пошли']], after: (a, b, c) => { [a, b].forEach((m, k) => { if (k === 1 && b.needs.hunger <= 0.25) return; const ni = nextInfo(m); if (ni && ni.min < 7) return; m.tasks.length = 0; leaveConv(m); m.needs.hunger = 0.05; m.why = 'проголодался, идёт в буфет с другом'; remember(m, `пош${m.g === 'f' ? 'ла' : 'ёл'} в буфет с ${k ? a.name : b.name}`); goTo(m, randomCellIn(2, R_COWORK.id), 'идёт в буфет с другом'); wait(m, rr(5, 10), 'eat', 'ест самсу и пьёт чай'); }); addFr(a, b, 0.05); } },
  { w: 3, ok: (a, b) => isStu(a) && isStu(b) && a.group === b.group, mk: (a, b) => { const subj = pick(SUBJ_PC), kb = knowOf(b, subj), ka = knowOf(a, subj); if (kb > 0.6 && ka < 0.5) return [[0, `Ты лабу по «${subj}» сделал${b.g === 'f' ? 'а' : ''}?`], [1, 'Да, вчера сдал' + (b.g === 'f' ? 'а' : '')], [0, 'Объяснишь? Я не понял' + (a.g === 'f' ? 'а' : '')], [1, pick(['Давай после пар покажу', 'Смотри, там всё просто…', 'Ок, скину в телегу'])]]; if (kb < 0.4) return [[0, `Ты лабу по «${subj}» сделал${b.g === 'f' ? 'а' : ''}?`], [1, pick(['Нет ещё… дедлайн когда?', 'Даже не открывал' + (b.g === 'f' ? 'а' : ''), 'Какую лабу?! 😱'])], [0, pick(['В пятницу. Давай вместе сделаем', 'Завтра! Садись делай'])]]; return [[0, `Как тебе «${subj}»?`], [1, pick(['Нормально, интересно даже', 'Сложно, но разберёмся', 'Много задают'])]]; }, after: (a, b) => { const subj = SUBJ_PC[0]; if (knowOf(b, subj) > 0.6) { a.know[subj] = Math.min(0.95, knowOf(a, subj) + 0.04); remember(a, `${b.name} объяснил${b.g === 'f' ? 'а' : ''} лабораторную`); } addFr(a, b, 0.03); } },
  { w: 4, ok: (a) => a.lastGrade && simT - a.lastGrade.t < 90, mk: (a, b) => { const g = a.lastGrade; return g.g >= 4 ? [[0, `Мне ${g.g} поставили по «${g.subj}»!`], [1, pick(['Красавчик!', 'Ого, молодец!', 'Азамат! 👏'])]] : [[0, `Мне ${g.g} поставили по «${g.subj}»…`], [1, pick(['Ничего, пересдашь', 'Эчтеке эмес, исправишь', 'Давай вместе подготовимся'])], [0, 'Рахмат']]; }, after: (a, b) => addFr(a, b, 0.03) },
  { w: 2, ok: () => PCS.some(p => p.err), mk: () => { const p = PCS.find(q => q.err), r = ROOMS.find(q => q.f === 2 && q.kind === 'pc' && SEATS.some(s => s.pc === p.id && s.room === q.id)); return [[0, `В ${r && r.num ? r.num : 'классе'} опять компьютер сломался`], [1, pick([`${IT ? IT.name : 'Айтишник'} байке починит`, 'Опять? Кто-то в игры играл', 'Надо в 314 сказать'])]]; } },
  { w: 3, ok: () => WX.bad || tempAt(simT) < 3, mk: () => WX.kind === 'snow' ? [[0, 'Снег идёт, видел?'], [1, pick(['Красиво! После пар пойдём снеговика лепить', 'Опять маршрутки стоять будут'])]] : WX.kind === 'rain' ? [[0, 'Дождь идёт… зонт есть?'], [1, pick(['Нету, промокну', 'Есть, провожу до остановки'])]] : [[0, `На улице ${tempAt(simT)}°, холодно`], [1, pick(['Да, чай хочу горячий', 'Зима близко', 'Я в двух кофтах'])]] },
  { w: 2, ok: (a) => a.st.late > 0, mk: (a, b) => [[1, `Ты опять опоздал${a.g === 'f' ? 'а' : ''}?`], [0, pick(['Маршрутка застряла на Советской', 'Проспал' + (a.g === 'f' ? 'а' : '') + ', будильник не сработал', 'Пробка на Жибек Жолу была'])], [1, pick(['Классика 😄', 'Выходи пораньше'])]] },
  { w: 2, ok: (a, b) => a.traits.gamer > 0.6 && b.traits.gamer > 0.4, mk: () => [[0, pick(['Вечером в доту?', 'Катку в CS сегодня?', 'Го в мобайл ледженс вечером'])], [1, pick(['Го, в девять', 'Не могу, лабу делаю', 'Давай, только недолго'])]], after: (a, b) => addFr(a, b, 0.03) },
  { w: 5, ok: (a, b) => a.love === b.id, mk: (a, b) => a.quarrel ? [[0, 'Ты почему вчера не отвечал' + (b.g === 'f' ? 'а' : '') + '?'], [1, 'Я готовил' + (b.g === 'f' ? 'ась' : 'ся') + ' к паре…'], [0, 'Ладно, прощаю']] : [[0, pick(['Пойдём после пар в кино?', 'После пар гулять пойдём?', 'Я тебе кофе взял' + (a.g === 'f' ? 'а' : '')])], [1, pick(['Давай ❤️', 'Конечно!', 'Ой, рахмат 🥰'])]], after: (a) => { a.quarrel = false; } },
  { w: 2, ok: (a) => typeof EV !== 'undefined' && EV.cur && ['wifi', 'power', 'inspect', 'hack'].includes(EV.cur.type), mk: () => ({ wifi: [[0, 'У тебя вайфай работает?'], [1, 'Нет, у всех отвалился'], [0, 'Как теперь лабу сдавать…']], power: [[0, 'Свет отключили!'], [1, 'Ура, пару отменят? 😄']], inspect: [[0, 'Говорят, комиссия из министерства'], [1, 'Тихо, вон они идут']], hack: [[0, 'Вы какой проект делаете?'], [1, pick(['Бот для расписания', 'Приложение для буфета', 'Нейросеть для оценок 😄'])]] }[EV.cur.type]) },
  { w: 2, ok: (a) => isStu(a) && (a.debt || 0) > 0, mk: (a) => [[0, 'У меня долг по лабам уже'], [1, pick(['Сходи на пересдачу в пятницу', 'Давай помогу, там несложно'])], [0, 'Надо закрыть до сессии']] },
  { w: 2, ok: (a) => simT > 1000, mk: () => [[0, pick(['Домой как едешь?', 'Ты на какой маршрутке?'])], [1, pick(['На 212-й, до Аламедина', 'Пешком, я рядом живу', 'На троллейбусе до Востока-5'])], [0, 'А, нам по пути']] },
  { w: 1, ok: () => true, mk: (a, b) => [[0, pick(['Кандайсың?', 'Что нового?', 'Как дела?'])], [1, pick(['Жакшы, өзүң?', 'Нормально, учёба-учёба', 'Сплю на ходу'])], [0, pick(['Тоже жакшы', 'Понимаю 😄'])]] },
];
function pickScript(a, b) { const ok = SCRIPTS.filter(s => { try { return s.ok(a, b); } catch (e) { return false; } }); let tot = ok.reduce((x, s) => x + s.w, 0), r = rnd() * tot; for (const s of ok) { if ((r -= s.w) <= 0) return s; } return ok[ok.length - 1]; }
convTick = function (dt) {
  const now = performance.now();
  for (const c of CONVS) {
    const here = c.members.filter(m => m.tasks[0] && m.tasks[0].t === 'chat');
    if (here.length < 2) { c.speaker = null; continue; }
    if (c.script) {
      if (now >= c.lineAt) {
        const [who, text] = c.script.lines[c.si]; const sp = who === 0 ? c.script.a : c.script.b, ot = who === 0 ? c.script.b : c.script.a;
        if (sp.conv !== c || ot.conv !== c) { c.script = null; c.speaker = null; }
        else { say(sp, text, 2.8); c.speaker = sp; c.listener = ot; sp.lastSpeech = simT; c.si++; c.lineAt = now + 2700 / Math.max(1, Math.min(simSpeed, 4)); if (c.si >= c.script.lines.length) { const s = c.script; c.script = null; c.next = rr(0.3, 0.8); if (s.def.after) try { s.def.after(s.a, s.b, c); } catch (e) { } } }
      }
    } else {
      c.next -= dt;
      if (c.next <= 0) {
        if (c.t < 0.1) { const sp = pick(here); say(sp, 'hello'); c.speaker = sp; c.next = 0.12; }
        else { const a = pick(here), b = pick(here.filter(m => m !== a)); const def = pickScript(a, b); let lines = null; try { lines = def.mk(a, b); } catch (e) { } if (lines && lines.length) { c.script = { def, a, b, lines }; c.si = 0; c.lineAt = now; } else c.next = 0.3; }
      }
    }
    c.t += dt;
    here.forEach(a => { a.st.chat += dt; a.needs.social = Math.min(1, a.needs.social + dt * 0.02); here.forEach(b => { if (a !== b) a.friends.set(b.id, Math.min(1, (a.friends.get(b.id) || 0.1) + dt * 0.004)); }); });
  }
};

// ---------- урок: вопросы, ответы, списывание ----------
const _teach0 = teachBehaviour;
teachBehaviour = function (n, T, dt) {
  _teach0(n, T, dt);
  if (n.tasks[0] !== T || simT < PAIRS[T.p][0]) return;
  // опрос: преподаватель вызывает студента
  if (!T.askAt) T.askAt = simT + rr(6, 14);
  if (simT >= T.askAt && T.mode !== 'walk') {
    T.askAt = simT + rr(7, 16);
    const ss = seatsIn(T.room.id).map(s => s.occ).filter(s => s && isStu(s) && s.tasks[0] && s.tasks[0].t === 'sit');
    if (!ss.length) return;
    const hand = ss.find(s => s.sub === 'hand'); const s = hand || pick(ss); const subj = T.lesson.subj; const k = knowOf(s, subj);
    if (PREWARM) { if (chance(0.3)) { const good = chance(0.15 + k * 0.85); giveGrade(s, subj, good ? (k > 0.7 ? 5 : 4) : (k < 0.25 ? 2 : 3), good ? 'за ответ на паре' : 'не ответил на паре'); } return; }
    say(n, hand ? `Да, ${s.name}?` : pick([`${s.name}, к доске`, `${s.name}, ответь на вопрос`, `А что скажет ${s.name}?`]), 2.6); n.gazeS = s; n.gazeU = performance.now() + 5000;
    const sp = Math.max(1, Math.min(simSpeed, 4));
    setTimeout(() => { if (!s.spawned || s.tasks[0]?.t !== 'sit') return; const good = chance(0.15 + k * 0.85); if (s.sub === 'sleep' || s.sub === 'phone') { say(s, pick(['А? Что?', 'Э-э… можно повторить вопрос?']), 2.4); s.sub = 'listen'; s.subNext = simT + 2; s.caughtN = (s.caughtN || 0) + 1; remember(s, 'преподаватель застал врасплох'); setTimeout(() => { if (n.spawned) { say(n, pick(['Телефон убери', 'Не спим на паре!', 'Слушаем внимательно']), 2.4); n.shakeT = performance.now() + 900; } }, 2400 / sp); return; }
      say(s, good ? pick(['Это будет цикл for', 'Ответ — 42', 'Нужно сделать JOIN по id', 'Сложность O(n)', 'Через рекурсию', 'Это первичный ключ']) : pick(['Э-э… не знаю', 'Я забыл' + (s.g === 'f' ? 'а' : ''), 'Можно подсказку?']), 2.6); s.sub = 'talk'; s.talkSide = 0; s.subNext = simT + 1.2;
      setTimeout(() => { if (!n.spawned) return; if (good) { say(n, pick(['Правильно, молодец!', 'Туура! Отлично', 'Верно, садись — пять']), 2.6); n.nodT = performance.now() + 800; if (chance(0.45)) giveGrade(s, subj, k > 0.7 ? 5 : 4, 'за ответ на паре'); s.know[subj] = Math.min(0.99, k + 0.02); } else { say(n, pick(['Нет, подумай ещё', 'Неправильно. Кто поможет?', 'Надо повторить тему']), 2.6); n.shakeT = performance.now() + 900; if (chance(0.2)) giveGrade(s, subj, k < 0.25 ? 2 : 3, 'не ответил на паре'); } }, 2500 / sp);
    }, 2300 / sp);
  }
};
const _seat0b = seatedBehaviour;
seatedBehaviour = function (n, T, dt) {
  const prev = n.sub; _seat0b(n, T, dt);
  if (isStu(n) && T.kind === 'lesson' && n.sub === 'talk' && prev !== 'talk' && n.seat) {
    // сосед рядом
    const nb = SEATS.filter(s => s.room === n.seat.room && s.occ && s.occ !== n && Math.hypot(s.p[0] - n.seat.p[0], s.p[1] - n.seat.p[1]) < 1.4).map(s => s.occ)[0];
    if (!nb) { n.sub = 'listen'; n.say = null; return; }
    const side = wrapA(Math.atan2(nb.y - n.y, nb.x - n.x) - n.a); n.talkSide = Math.max(-1, Math.min(1, side));
    const p = pairAt(simT, n.group.shift), L = lessonFor(n, p); if (!L) return; const ka = knowOf(n, L.subj), kb = knowOf(nb, L.subj);
    const sp = Math.max(1, Math.min(simSpeed, 4)); if (PREWARM) return;
    if (ka < 0.4 && kb > 0.55) { say(n, pick(['Дай списать…', 'Что там в третьем?', 'Покажи, как ты сделал']), 2.4); setTimeout(() => { if (nb.spawned && nb.tasks[0]?.t === 'sit') { const yes = fr(n, nb) > 0.3 || nb.traits.social > 0.5; say(nb, yes ? pick(['На, только быстро', 'Смотри сюда', 'Тсс… вот']) : pick(['Сам делай', 'Отстань, эжей смотрит']), 2.2); if (yes) { n.know[L.subj] = Math.min(0.9, ka + 0.03); addFr(n, nb, 0.02); remember(n, `списал${n.g === 'f' ? 'а' : ''} у ${nb.name}`); n.cheat = (n.cheat || 0) + 1; } else nb.shakeT = performance.now() + 800; } }, 2000 / sp); }
    else if (ka > 0.6 && kb < 0.4 && chance(0.5)) { say(n, pick(['Смотри, тут надо вот так', 'Ты скобку забыл', 'Давай помогу']), 2.4); nb.know[L.subj] = Math.min(0.9, kb + 0.03); addFr(n, nb, 0.02); remember(n, `помог${n.g === 'f' ? 'ла' : ''} ${nb.name} на паре`); }
  }
};

// ---------- цели и причины ----------
function whyOf(n) {
  const T = n.tasks[0], a = n.act || '', N = n.needs, i = nextInfo(n);
  if (n.why && T && (T.t === 'go' || T.t === 'wait') && /буфет/.test(a)) return n.why;
  if (/опаздыва/.test(a)) return 'пара уже началась — торопится, чтобы не отметили';
  if (/на пару|занимает место/.test(a)) return i ? `${i.now ? 'идёт' : 'через ' + i.min + ' мин'} «${i.L.subj}»${i.t ? ' у ' + genS(i.t) : ''}` : 'скоро пара';
  if (/на паре/.test(a)) { const L = i && i.L; const k = L && n.know ? knowOf(n, L.subj) : 0.5; return n.sub === 'phone' ? 'скучно — отвлёкся на телефон' : n.sub === 'sleep' ? 'не выспался, энергия на нуле' : n.sub === 'hand' ? 'знает ответ и хочет оценку' : n.sub === 'talk' ? (k < 0.4 ? 'не понимает тему — спрашивает соседа' : 'шепчется с соседом') : k < 0.35 ? 'тема сложная, старается разобраться' : n.seat && n.seat.pc >= 0 ? 'делает лабораторную, чтобы сдать сегодня' : n.traits.diligent > 0.6 ? 'конспектирует — хочет хорошую оценку' : 'слушает лекцию'; }
  if (/туалет/.test(a)) return 'перемена — успеть до звонка';
  if (/буфет|самс|кофе|чай/.test(a)) return N.hunger < 0.3 ? 'проголодался после пары' : 'время перекусить';
  if (/столов/.test(a)) return 'в буфете очередь — пошёл в столовую';
  if (/друз|общается|болтает|гуляет с/.test(a)) return n.traits.social > 0.6 ? 'общительный — не может без компании' : 'увидел друзей';
  if (/домой/.test(a)) return 'пары закончились';
  if (/телефон/.test(a)) return 'до пары есть время';
  if (/домашк|коворкинг/.test(a)) return (n.debt || 0) > 0 ? 'закрывает долг по лабораторным' : 'делает задание заранее';
  if (/отдых/.test(a)) return N.energy < 0.5 ? 'устал, набирается сил' : 'окно между парами';
  if (/чинит|чинить/.test(a)) return 'студент сообщил о поломке';
  if (/ведёт пару/.test(a)) return 'по расписанию';
  if (/кружк/.test(a)) return 'сам записался — нравится тема';
  if (/кафедр/.test(a)) return 'окно между парами — проверяет работы';
  if (/двор|скамейк/.test(a)) return 'подышать свежим воздухом';
  if (/очеред/.test(a)) return 'за самсой — она тут лучшая';
  return '';
}
function logTick() { for (const n of NPCS) { if (!n.spawned) { if (n._wasSp) { n._wasSp = false; remember(n, n.act || 'ушёл'); } continue; } if (!n._wasSp) { n._wasSp = true; n._la = null; remember(n, n.role === 'student' ? `приш${n.g === 'f' ? 'ла' : 'ёл'} в университет` : `приш${n.g === 'f' ? 'ла' : 'ёл'} на работу`); } const a = n.act; if (a && a !== n._la) { n._la = a; if (!/гуляет по коридору|стоит|ждёт пару|листает/.test(a)) remember(n, a); } } }

// ---------- интерфейс: карточка, журнал, рейтинг, поиск, экскурсия ----------
const _card0b = cardHTML;
cardHTML = n => {
  let h = _card0b(n);
  const why = whyOf(n);
  if (why) h = h.replace(/(<div class="na">[^<]*<\/div>)/, `$1<div class="ns">Почему: ${why}</div>`);
  if (isStu(n) && n.grades) {
    const gs = n.grades.slice(-8).map(g => `<b class="g g${g.g}"${g.old ? '' : ' style="outline:1px solid var(--accent)"'} title="${g.subj}">${g.g}</b>`).join('');
    if (n.club) h = h.replace('<div class="nt">', `<div class="ns">Кружок: ${n.club.icon} ${n.club.name}</div><div class="nt">`);
    h = h.replace('<div class="nt">', `<div class="ns" style="margin-top:6px">Оценки: ${gs} · средний ${avgGrade(n).toFixed(1)}</div><div class="ns">Посещаемость ${attPct(n)}% · лабораторные ${n.labs.done}/${n.labs.total}${n.debt ? ' · долгов: ' + n.debt : ''}</div><div class="nt">`);
    h = h.replace('<button id="cardFollow">', `<button id="cardJournal" data-g="${n.group.id}">📒 Журнал ${n.group.name}</button><button id="cardFollow">`);
  }
  const mem = (n.mem || []).slice(-6).reverse();
  if (mem.length) h = h.replace('<div class="seg">', `<details class="mem"><summary>История дня</summary>${mem.map(([t, s]) => `<div><i>${hhmmS(t)}</i> ${s}</div>`).join('')}</details><div class="seg">`);
  return h;
};
function journalHTML(g) {
  const S = STUDENTS.filter(s => s.group === g).sort((a, b) => avgGrade(b) - avgGrade(a)); const st = groupStats(g);
  return `<div class="jh"><b>Журнал группы ${g.name}</b><span>${g.course} курс · ${g.shift} смена · ${S.length} студентов · средний балл ${st.avg.toFixed(2)} · посещаемость ${st.att}%</span><button id="jClose">✕</button></div>
  <table><tr><th>#</th><th>Студент</th><th>Сегодня</th><th>Оценки</th><th>Ср.</th><th>Посещ.</th><th>Лабы</th></tr>${S.map((s, i) => `<tr data-n="${s.id}"><td>${i + 1}</td><td>${s.surname} ${s.name}${s.arch === 'sta' ? ' <i>староста</i>' : ''}</td><td>${s.spawned ? '<span class="on">в корпусе</span>' : s.doneToday ? 'ушёл' : s.offToday ? 'нет' : '—'}</td><td>${s.grades.slice(-7).map(x => `<b class="g g${x.g}">${x.g}</b>`).join('')}</td><td>${avgGrade(s).toFixed(1)}</td><td>${attPct(s)}%</td><td>${s.labs.done}/${s.labs.total}</td></tr>`).join('')}</table>`;
}
function openJournal(g) { const j = document.getElementById('journal'); j.innerHTML = journalHTML(g); j.style.display = 'block'; j.dataset.g = g.id; document.getElementById('jClose').onclick = () => j.style.display = 'none'; j.querySelectorAll('tr[data-n]').forEach(tr => tr.onclick = () => { const n = NPCS[+tr.dataset.n]; selectNPC(n); if (n.spawned) { followN = n; } j.style.display = 'none'; }); }
function ratingHTML() {
  const G = GROUP_OBJS().map(g => ({ g, s: groupStats(g) })).filter(x => x.s.n).sort((a, b) => b.s.avg - a.s.avg);
  return `<h2>Рейтинг групп</h2><table class="rate"><tr><th></th><th>Группа</th><th>Ср. балл</th><th>Посещ.</th><th>Лабы</th></tr>${G.map((x, i) => `<tr data-g="${x.g.id}"><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td><a>${x.g.name}</a></td><td>${x.s.avg.toFixed(2)}</td><td>${x.s.att}%</td><td>${x.s.labs}%</td></tr>`).join('')}</table>`;
}
const GROUP_OBJS = () => { const m = new Map(); STUDENTS.forEach(s => m.set(s.group.id, s.group)); return [...m.values()]; };
// экскурсия
let TOUR = null;
function tourStops() {
  const c = r => r ? { x: r.c[0], y: r.c[1] } : { x: 0, y: 0 }; const z = FZ[2];
  const S = [];
  const add = (t, tx, ty, tz, px, py, pz, floor) => S.push({ t, tgt: new THREE.Vector3(tx, tz, -ty), pos: new THREE.Vector3(px, pz, -py), floor });
  const bc = new THREE.Vector3(); BB.getCenter(bc);
  add('КГУ им. И. Арабаева, 1 учебный корпус. Бишкек, ул. Раззакова, 51', bc.x, -bc.z, 4, bc.x + 55, -bc.z - 60, 38, 'all');
  add('Третий этаж целиком — Институт новых информационных технологий', bc.x, -bc.z, z, bc.x + 8, -bc.z - 22, z + 46, '2');
  const pcr = PC_ROOMS[0], cl = CLASS_ROOMS[0];
  const room = (r, text) => { if (!r) return; const p = c(r); add(text, p.x, p.y, z + 0.8, p.x + 5.5, p.y - 6.5, z + 8.5, '2'); };
  room(pcr, `Компьютерный класс${pcr && pcr.num ? ' ' + pcr.num : ''}: здесь пишут код и сдают лабораторные`);
  room(cl, `Лекционная аудитория${cl && cl.num ? ' ' + cl.num : ''}: студенты слушают, отвечают и получают оценки`);
  room(R_IT, 'Кабинет 314 — IT-отдел. Отсюда приходят чинить компьютеры');
  room(R_DEAN, 'Дирекция ИНИТ');
  room(R_COWORK, 'Коворкинг и буфет: самса, чай и очередь на большой перемене');
  add('Двор: здесь встречаются до пар и гуляют после', bc.x + 4, -bc.z + 2, 0, bc.x + 30, -bc.z - 34, 16, 'all');
  return S;
}
function tourStart() { TOUR = { S: tourStops(), i: -1, t: 0 }; followN = null; document.body.classList.add('tour'); tourNext(); }
function tourNext() { const T = TOUR; if (!T) return; T.i++; if (T.i >= T.S.length) return tourStop(); const s = T.S[T.i]; if (s.floor && typeof setFloor === 'function') setFloor(s.floor); tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: s.pos, t1: s.tgt, k: 0 }; T.t = 0; const el = document.getElementById('tourCap'); el.innerHTML = `<b>${T.i + 1}/${T.S.length}</b> ${s.t} <button id="tourNx">Дальше ›</button><button id="tourX">✕</button>`; el.style.display = 'flex'; document.getElementById('tourNx').onclick = tourNext; document.getElementById('tourX').onclick = tourStop; }
function tourStop() { TOUR = null; document.body.classList.remove('tour'); document.getElementById('tourCap').style.display = 'none'; }
function brainUI() {
  const css = document.createElement('style'); css.textContent = `
  .g{display:inline-block;min-width:16px;text-align:center;border-radius:4px;font-size:11px;font-weight:600;margin-right:2px;color:#fff;padding:0 3px}.g5{background:#2e9e5b}.g4{background:#4a86d8}.g3{background:#d9982b}.g2{background:#d9534f}
  #npcCard details.mem{margin-top:6px;font-size:11.5px}#npcCard details.mem summary{cursor:pointer;color:var(--muted)}#npcCard details.mem div{padding:2px 0;border-top:1px solid var(--line)}#npcCard details.mem i{font-style:normal;font-family:var(--f-mono);color:var(--muted);margin-right:6px}
  #journal{display:none;position:absolute;z-index:60;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,calc(100% - 24px));max-height:min(78vh,720px);overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.35);padding:14px;font-size:12.5px}
  #journal .jh{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;margin-bottom:8px;padding-right:34px;position:relative}#journal .jh b{font-size:15px}#journal .jh span{color:var(--muted)}#journal #jClose{position:absolute;right:0;top:-4px}
  #journal table,.rate{width:100%;border-collapse:collapse}#journal th,#journal td,.rate th,.rate td{text-align:left;padding:4px 6px;border-top:1px solid var(--line);white-space:nowrap}#journal th,.rate th{font-weight:500;color:var(--muted);font-size:11px}#journal tr[data-n],.rate tr[data-g]{cursor:pointer}#journal tr[data-n]:hover,.rate tr[data-g]:hover{background:var(--chip)}#journal td i{color:var(--accent);font-style:normal;font-size:10.5px}#journal .on{color:#2e9e5b}
  .rate{font-size:12px;margin-bottom:10px}.rate a{color:var(--accent);text-decoration:underline}
  #findBox{position:relative}#findBox input{width:100%;font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--chip);color:var(--fg);box-sizing:border-box}#findRes{display:none;position:absolute;left:0;right:0;top:100%;z-index:9;background:var(--panel);border:1px solid var(--line);border-radius:8px;max-height:220px;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.2)}#findRes div{padding:6px 9px;cursor:pointer;font-size:12.5px}#findRes div:hover{background:var(--chip)}#findRes span{color:var(--muted);font-size:11px;margin-left:6px}
  #tourCap{display:none;position:absolute;z-index:7;left:50%;transform:translateX(-50%);top:max(14px,env(safe-area-inset-top,0px));max-width:min(680px,calc(100% - 24px));gap:10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 12px;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.25)}#tourCap b{font-family:var(--f-mono);font-size:11px;color:var(--muted);flex:none}#tourCap button{flex:none}
  body.tour #ctrl,body.tour #exp,body.tour .hint,body.tour #mbar,body.tour #mtop{display:none!important}`;
  document.head.appendChild(css);
  const j = document.createElement('div'); j.id = 'journal'; host.appendChild(j);
  const tc = document.createElement('div'); tc.id = 'tourCap'; host.appendChild(tc);
  const fb = document.createElement('div'); fb.className = 'grp'; fb.id = 'findBox'; fb.innerHTML = `<input id="findIn" placeholder="🔎 Найти человека или группу" autocomplete="off"><div id="findRes"></div><div class="seg" style="margin-top:8px"><button id="tourBtn">🎬 Экскурсия</button><button id="rateBtn">🏆 Рейтинг групп</button></div>`;
  const sb = document.getElementById('simBox'); sb.after(fb);
  const inp = fb.querySelector('#findIn'), res = fb.querySelector('#findRes');
  inp.oninput = () => { const q = inp.value.trim().toLowerCase(); if (q.length < 2) { res.style.display = 'none'; return; } const out = []; GROUP_OBJS().filter(g => g.name.toLowerCase().includes(q)).slice(0, 4).forEach(g => out.push(`<div data-g="${g.id}">📒 ${g.name}<span>журнал группы</span></div>`)); NPCS.filter(n => (n.name + ' ' + n.surname).toLowerCase().includes(q) || (n.surname + ' ' + n.name).toLowerCase().includes(q)).slice(0, 12).forEach(n => out.push(`<div data-n="${n.id}">${n.name} ${n.surname}<span>${n.group ? n.group.name : (n.role === 'teacher' ? 'преподаватель' : '')}${n.spawned ? ' · в корпусе' : ''}</span></div>`)); res.innerHTML = out.join('') || '<div>Никого не нашлось</div>'; res.style.display = 'block'; res.querySelectorAll('[data-n]').forEach(d => d.onclick = () => { const n = NPCS[+d.dataset.n]; selectNPC(n); if (n.spawned) { followN = n; if (n.f < 3 && typeof setFloor === 'function') setFloor('2'); } res.style.display = 'none'; inp.value = ''; }); res.querySelectorAll('[data-g]').forEach(d => d.onclick = () => { openJournal(GROUP_OBJS().find(g => g.id == d.dataset.g)); res.style.display = 'none'; inp.value = ''; }); };
  inp.onblur = () => setTimeout(() => res.style.display = 'none', 250);
  fb.querySelector('#tourBtn').onclick = tourStart;
  fb.querySelector('#rateBtn').onclick = () => { const j2 = document.getElementById('journal'); j2.innerHTML = `<div class="jh"><b>Рейтинг групп ИНИТ</b><span>средний балл, посещаемость и сданные лабораторные</span><button id="jClose">✕</button></div>${ratingHTML().replace('<h2>Рейтинг групп</h2>', '')}`; j2.style.display = 'block'; document.getElementById('jClose').onclick = () => j2.style.display = 'none'; j2.querySelectorAll('tr[data-g]').forEach(tr => tr.onclick = () => openJournal(GROUP_OBJS().find(g => g.id == tr.dataset.g))); };
  document.getElementById('npcCard').addEventListener('click', e => { const b = e.target.closest('#cardJournal'); if (b) openJournal(GROUP_OBJS().find(g => g.id == b.dataset.g)); });
}
// ---------- подключение ----------
const _simTick0b = simTick; let logAcc = 0;
simTick = dt => { _simTick0b(dt); studyTick(dt); if ((logAcc += dt) > 0.25) { logAcc = 0; logTick(); } };
const _simFrame0b = simFrame; let _bl = performance.now();
simFrame = () => { const now = performance.now(), dt = Math.min(0.1, (now - _bl) / 1000); _bl = now; brainFrame(dt); _simFrame0b(); if (TOUR) { TOUR.t += dt; if (TOUR.t > 9) tourNext(); } };
const _reset0b = resetDay; resetDay = () => { _reset0b(); NPCS.forEach(n => { n.mem = []; n._wasSp = false; n.greeted = {}; n.lastGrade = null; n.look = null; n.J = null; }); };
const _evInit0b = evInit; evInit = () => { _evInit0b(); initStudy(); brainUI(); };
// телефон на ходу и «ест» в буфете
const _startGo0 = startGo; startGo = (n, task) => { n.walkPhone = isStu(n) && !/опаздыва|на пару|буфет/.test(task.act || '') && chance(0.16); _startGo0(n, task); };

// ---------- кружки после пар ----------
const CLUBS = [
  { name: 'Олимпиадное программирование', icon: '🏆', pc: true, days: [1, 3, 5] },
  { name: 'Робототехника', icon: '🤖', pc: true, days: [2, 4] },
  { name: 'CTF и кибербезопасность', icon: '🛡', pc: true, days: [2, 5] },
  { name: 'Веб-студия', icon: '🌐', pc: true, days: [1, 4] },
  { name: 'Английский разговорный клуб', icon: '🗣', pc: false, days: [3, 6] },
  { name: 'Шахматный клуб', icon: '♟', pc: false, days: [2, 5] },
];
function initClubs() { STUDENTS.forEach(s => { const want = s.traits.curious * 0.5 + s.traits.diligent * 0.3 + rr(0, 0.4); s.club = want > 0.62 ? pick(CLUBS) : null; }); }
function clubRoom(club, t) {
  const day = simDay; if (club._day === day && club._room) return club._room;
  const busy = new Set(); for (let p = 0; p < PAIRS.length; p++) if (PAIRS[p][1] > t && PAIRS[p][0] < t + 75) Object.values(SCHED[p]).forEach((s: any) => busy.add(s.room));
  CLUBS.forEach((c: any) => { if (c !== club && c._day === day && c._room) busy.add(c._room.id); });
  const pool = (club.pc ? PC_ROOMS : CLASS_ROOMS).filter(r => !busy.has(r.id) && r.name !== 'Лекционная аудитория');
  club._day = day; club._room = pool.length ? pool[0] : null; club._news = false; return club._room;
}
const _decStu0 = decideStudent;
decideStudent = function (n, t, p, np) {
  const P = typeof PERIOD === 'function' ? PERIOD() : 'normal';
  if (n.club && !n.clubDone && t >= n.leave && t < 1050 && n.f === 2 && n.club.days.includes(simDow) && P === 'normal' && !(typeof EV !== 'undefined' && EV.cur)) {
    n.clubDone = true;
    const room = clubRoom(n.club, t);
    if (room) {
      const seat = freeSeat(room.id, s => !s.office && (!n.club.pc || s.pc >= 0)) || freeSeat(room.id);
      if (seat) {
        const dur = rr(45, 70);
        if (!n.club._news) { n.club._news = true; if (!PREWARM && typeof news === 'function') news(`${n.club.icon} В ${room.num || 'аудитории'} начинается кружок «${n.club.name}»`); }
        remember(n, `остал${n.g === 'f' ? 'ась' : 'ся'} на кружок «${n.club.name}»`);
        return takeSeat(n, seat, `идёт на кружок «${n.club.name}»`, { until: t + dur, kind: 'club', sitAct: `на кружке: ${n.club.name}` });
      }
    }
  }
  return _decStu0(n, t, p, np);
};
const _seat0c = seatedBehaviour;
seatedBehaviour = function (n, T, dt) {
  _seat0c(n, T, dt);
  if (T.kind === 'club' && (n.sub === 'phone' || n.sub === 'lean')) { n.sub = n.seat && n.seat.pc >= 0 ? 'type' : (chance(0.5) ? 'write' : 'talk'); if (n.sub === 'talk') { n.talkSide = chance(0.5) ? 0.7 : -0.7; if (chance(0.4)) say(n, pick(['А если через динамику?', 'Смотри, работает!', 'Шах!', 'Давай ещё раз', 'How do you say «лаба»?', 'Флаг нашёл!']), 2.4); } }
};
const _reset0c = resetDay; resetDay = () => { _reset0c(); NPCS.forEach(n => { n.clubDone = false; }); };
const _evInit0c = evInit; evInit = () => { _evInit0c(); initClubs(); };
