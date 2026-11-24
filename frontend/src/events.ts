// ================= v4: события, праздники, режим директора =================
const EV: any = { cur: null, lastKey: null, sched: [], period: 'auto', weather: 'auto', crowd: 1, announce: null, names: {}, prevT: null };
const EV_DEF = {
  alarm: { name: 'Пожарная тревога', icon: '🚨', dur: 22 },
  power: { name: 'Отключение света', icon: '💡', dur: 25 },
  wifi: { name: 'Упал Wi‑Fi', icon: '📶', dur: 15 },
  inspect: { name: 'Проверка комиссии', icon: '🕴', dur: 45 },
  clean: { name: 'Субботник', icon: '🍂', dur: 60 },
  hack: { name: 'Хакатон ИНИТ', icon: '💻', dur: 300 },
  openday: { name: 'День открытых дверей', icon: '🎒', dur: 90 },
};
const PERIODS = { auto: 'Авто, по календарю', normal: 'Обычный учебный день', session: 'Сессия, экзамены', nooruz: 'Нооруз', newyear: 'Новый год', grad: 'Выпускной', vacation: 'Каникулы' };
const ARCH = { otl: 'Отличник', tus: 'Тусовщик', tih: 'Тихоня', opz: 'Вечный опоздун', gam: 'Геймер', sta: 'Староста', obs: 'Обычный студент' };
const SPECIAL = new Set(['inspector', 'kid', 'worker', 'ded', 'snow', 'applicant']);
const ROLE_X = { inspector: 'Комиссия Минобразования', kid: 'Школьник, день открытых дверей', worker: 'Рабочий, ремонт', ded: 'Дед Мороз', snow: 'Снегурочка', applicant: 'Абитуриент' };

function autoPeriod() {
  const d = new Date(Date.UTC(2026, 0, SUN.doy)); const m = d.getUTCMonth() + 1, day = d.getUTCDate();
  if ((m === 12 && day >= 20) || (m === 1 && day <= 3)) return 'newyear';
  if ((m === 1 && day >= 5 && day <= 25) || (m === 6 && day <= 20)) return 'session';
  if (m === 3 && day >= 20 && day <= 22) return 'nooruz';
  if (m === 6 && day >= 24 && day <= 27) return 'grad';
  if (m === 7 || m === 8 || (m === 1 && day > 25) || (m === 2 && day <= 7) || (m === 6 && day > 27)) return 'vacation';
  return 'normal';
}
const PERIOD = () => EV.period === 'auto' ? autoPeriod() : EV.period;
const noClasses = () => { const P = PERIOD(); return P === 'nooruz' || P === 'grad' || P === 'vacation'; };

// ---------- фразы ----------
Object.assign(PH, {
  alarm: ['Это учения?', 'Выходим спокойно', 'Я телефон в аудитории оставил!', 'Опять тревога 😅', 'Холодно так стоять…', 'Пары не будет?', 'Кто нажал кнопку?'],
  alarmT: ['Все вышли? Проверяю по списку', 'Группа, становимся вместе!', 'Не расходимся!', 'Спокойно, без паники'],
  power: ['Свет вырубили!', 'Мой код не сохранился 😱', 'Включи фонарик', 'Ура, перерыв!', 'Опять электричества нет', 'Ноутбук на 10%…'],
  powerT: ['Ждём, свет скоро дадут', 'Повторим теорию устно', 'Не расходимся, сейчас включат'],
  wifi: ['Интернет пропал!', 'Wi‑Fi не работает', 'Агай, сети нет', 'Пинг 9999 😭', 'Раздай мне с телефона', 'pip install не качает'],
  inspect: ['Покажите журнал посещаемости', 'Как проходят занятия?', 'Хорошо оборудовано', 'Запишите замечание', 'Сколько студентов на потоке?', 'Где план работы кафедры?'],
  inspectNear: ['Тихо, комиссия идёт!', 'Убери телефон, проверка!', 'Делай вид, что пишешь', 'Кто это в костюмах?'],
  clean: ['Где мои грабли?', 'Листьев так много…', 'Сфоткай, для отчёта', 'Ещё полчаса и всё', 'Субботник — это красиво', 'Айда быстрее, потом чай'],
  cleanT: ['Активнее, ребята!', 'Мешки у ворот', 'После субботника чай с боорсоками'],
  hack: ['Деплой упал!', 'Кто пишет фронт?', 'Осталось два часа!', 'API работает ✅', 'Пицца где?', 'Давай презентацию делать', 'Баг нашёл!', 'Это будет стартап', 'Нейросеть не обучается…', 'Git push --force не делай!'],
  hackT: ['Покажите прототип', 'Хорошая идея, развивайте', 'Не забудьте про презентацию', 'Через час питч'],
  kids: ['Вау, сколько компьютеров!', 'Я тоже хочу программистом', 'А тут сложно учиться?', 'Можно поиграть?', 'Мама, смотри!', 'А игры тут делают?'],
  guide: ['Это наш первый корпус', 'Здесь учатся будущие программисты', 'Это компьютерный класс', 'А здесь лекционная', 'Здесь сидит наш айтишник', 'Вопросы есть?'],
  exam: ['Я ничего не выучил 😱', 'Какой билет попадётся?', 'Дай шпору', 'Я сдал! 🎉', 'Препод злой сегодня', 'Пересдача в пятницу…', 'Тройка — тоже оценка', 'Пожелай удачи!', 'Сколько вопросов в билете?'],
  examT: ['Тяните билет', 'Время пошло', 'Телефоны на стол!', 'Отвечайте', 'Это шпаргалка?', 'Следующий!'],
  nooruz: ['Нооруз майрамыңыз менен! 🌸', 'Сумолок даамдуу!', 'Айда фото у юрты', 'Кто будет танцевать?', 'Как красиво поют!', 'Боорсок ешь, горячий', 'Кок-бору будет?'],
  newyear: ['С наступающим! 🎄', 'Где Дед Мороз?', 'Ёлка классная', 'Сессия после праздника…', 'Подарки будут?', 'Куда на Новый год?'],
  grad: ['Мы выпустились!!! 🎓', 'Не верится', 'Фото всей группой!', 'Спасибо, агай!', 'Куда теперь работать?', 'Будем скучать', 'Четыре года пролетели'],
  love: ['Ты сегодня красивая', 'Пойдём в кафе после пар?', 'Скучал по тебе', 'Давай вместе сделаем лабу', '❤️', 'Проводить тебя до маршрутки?'],
  quarrel: ['Ты опять не ответил!', 'Отстань', 'Ну и ладно!', 'Я обиделась', 'Почему ты лайкнул её фото?'],
  makeup: ['Ладно, мир 💞', 'Прости меня', 'Пойдём за кофе, мирись'],
  starosta: ['Кто отсутствует?', 'Агай, все на месте', 'Скиньте мне домашку', 'Деканат просил список группы', 'Завтра модуль, не забудьте!'],
  ded: ['Хо-хо-хо! С Новым годом!', 'Кто хорошо учился?', 'Подарки для отличников!', 'Расскажи стишок!'],
  snow: ['С Новым годом, ребята!', 'Айда в хоровод!', 'Загадывайте желание ✨'],
  worker: ['Осторожно, окрашено!', 'Подай валик', 'Тут ещё один слой', 'Обед скоро?'],
  applicant: ['Где приёмная комиссия?', 'Какие баллы ОРТ нужны?', 'Хочу на программиста', 'Общежитие есть?'],
  pizza: ['Пицца приехала! 🍕', 'Мне с пепперони', 'Ещё кусочек и кодим'],
});
const POSTFX = new Set(['life', 'yard', 'study', 'evening', 'react', 'game']);
function sayHook(n, list) {
  if (typeof list !== 'string' || !PH[list]) return list;
  const E = EV.cur, P = PERIOD();
  if (E) {
    if (E.type === 'alarm' && n.f === 3) return n.role === 'teacher' ? 'alarmT' : (POSTFX.has(list) && chance(0.6) ? 'alarm' : list);
    if (E.type === 'power' && n.f < 3) return n.role === 'teacher' ? 'powerT' : (POSTFX.has(list) || list === 'whisper' ? (chance(0.6) ? 'power' : list) : list);
    if (E.type === 'wifi' && n.f === 2 && (list === 'whisper' || POSTFX.has(list) || list === 'pcBroke')) return chance(0.6) ? 'wifi' : list;
    if (E.type === 'clean' && n.f === 3) return n.role === 'teacher' ? 'cleanT' : (POSTFX.has(list) && chance(0.6) ? 'clean' : list);
    if (E.type === 'hack' && n.hack && POSTFX.has(list)) return chance(0.6) ? 'hack' : list;
    if (E.type === 'hack' && n.hackMentor && list.startsWith('teacher')) return 'hackT';
  }
  if (n.love != null && n.conv && n.conv.members.includes(NPCS[n.love]) && POSTFX.has(list) && chance(0.35)) return n.quarrel ? 'quarrel' : 'love';
  if (P === 'session') { if (list === 'teacherLec' || list === 'teacherPc') return chance(0.6) ? 'examT' : list; if (POSTFX.has(list) && chance(0.5)) return 'exam'; }
  if ((P === 'nooruz' || P === 'newyear' || P === 'grad') && (list === 'yard' || list === 'life' || list === 'evening' || list === 'react') && chance(0.5)) return P === 'grad' && !n.grad ? 'react' : P;
  return list;
}

// ---------- утилиты ----------
function interrupt(n) {
  const T = n.tasks[0];
  if (T && T.t === 'sit' && T.seat) { const s = T.seat; const q = nearestPass(s.f, s.p[0] - Math.cos(s.a) * 0.3, s.p[1] - Math.sin(s.a) * 0.3, 6); if (q) { n.x = wx(q[0]); n.y = wy(q[1]); } n.z = FZ[s.f]; }
  if (T && T.t === 'fix' && T.pc) T.pc.fixer = null;
  if (T && T.t === 'queue') qLeave(n);
  releaseSeat(n); leaveConv(n); n.tasks.length = 0; n.path = null; n.hidden = false; n.pose = 'stand'; n.sub = 'idle'; n.bagOn = true;
  if (n.f >= 0 && n.f < 3 && Math.abs(n.z - FZ[n.f]) > 0.6) n.z = FZ[n.f];
}
function spotNear(f, x, y, r = 8) { const q = nearestPass(f, x, y, Math.ceil(r / SR)); return q ? { f, x: wx(q[0]) + rr(-0.05, 0.05), y: wy(q[1]) + rr(-0.05, 0.05) } : null; }
function hold(n, o) { n.tasks.push({ t: 'hold', ...o }); }
const EXT_TASK: any = {};
EXT_TASK.hold = (n, T, dt) => {
  if (!T.st) { T.st = true; n.sub = T.sub || 'idle'; n.subT = 0; if (T.act) n.act = T.act; n.pose = 'stand'; }
  n.walk = Math.max(0, n.walk - dt * 5);
  if (T.face) { const fx = T.face.x != null ? T.face.x : T.face[0], fy = T.face.y != null ? T.face.y : T.face[1]; n.a = lerpAng(n.a, Math.atan2(fy - n.y, fx - n.x), Math.min(1, dt * 6)); }
  if (T.subs && (T.nx == null || simT >= T.nx)) { n.sub = pick(T.subs); n.subT = 0; T.nx = simT + rr(0.4, 1.8); }
  if (T.topic && (!n.say || performance.now() > n.sayT) && chance((T.talk || 0.02) * dt)) say(n, T.topic, 3);
  if ((T.until != null && simT >= T.until) || (T.ev && EV.cur !== T.ev)) { n.tasks.shift(); n.sub = 'idle'; }
};
function freeDisk(x, y, r, search = 14) {
  const G = GRID[3]; const R = Math.ceil(r / SR);
  const ok = (i0, j0) => { for (let j = j0 - R; j <= j0 + R; j += 2) for (let i = i0 - R; i <= i0 + R; i += 2) { if ((i - i0) ** 2 + (j - j0) ** 2 > R * R) continue; if (i < 0 || j < 0 || i >= SNX || j >= SNY || G[j * SNX + i] !== -2) return false; } return true; };
  for (let d = 0; d <= search; d += 0.5) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a / 16 * Math.PI * 2) * d, py = y + Math.sin(a / 16 * Math.PI * 2) * d; if (ok(cx(px), cy(py))) return { x: px, y: py }; if (d === 0) break; }
  return { x, y };
}
const BLOCKS = {};
function blockOn(key, x, y, r) {
  if (BLOCKS[key]) return; const G = GRID[3]; const R = Math.ceil(r / SR), i0 = cx(x), j0 = cy(y), saved = [];
  for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) if (i >= 0 && j >= 0 && i < SNX && j < SNY && (i - i0) ** 2 + (j - j0) ** 2 <= R * R) { const k = j * SNX + i; saved.push(k, G[k]); G[k] = -1; }
  BLOCKS[key] = saved;
}
function blockOff(key) { const s = BLOCKS[key]; if (!s) return; const G = GRID[3]; for (let i = 0; i < s.length; i += 2) G[s[i]] = s[i + 1]; delete BLOCKS[key]; }

// ---------- новости (бегущая строка) ----------
const NEWS = []; let newsEl = null;
function news(text, hot?) {
  NEWS.push({ text: `${hhmm(simT)} ${text}`, hot }); if (NEWS.length > 14) NEWS.shift();
  if (!newsEl || PREWARM) return; renderNews();
}
function renderNews() {
  if (!newsEl) return; const inner = newsEl.querySelector('.tk');
  const items = [];
  if (EV.announce && EV.announce.text) items.push(`<b class="ann">📢 ${esc(EV.announce.text)}</b>`);
  NEWS.slice(-7).reverse().forEach(n => items.push(n.hot ? `<b>${esc(n.text)}</b>` : esc(n.text)));
  const html = items.join('<i>·</i>');
  if (inner.dataset.h === html) return; inner.dataset.h = html;
  inner.innerHTML = `<span>${html}</span><span aria-hidden="true">${html}</span>`;
  const w = inner.firstChild.offsetWidth || 600; inner.style.animationDuration = Math.max(20, w / 55) + 's';
  newsEl.style.display = items.length ? 'flex' : 'none';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(text) { const t = document.getElementById('bellToast'); if (!t || PREWARM) return; t.textContent = text; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 4200); }
let PREWARM = false;

// ---------- новые люди и характеры ----------
const INSP = [], KIDS = [], WORKERS = [], APPL = []; let DED = null, SNOWM = null;
const COUPLES = [];
function evPopulate() {
  for (let i = 0; i < 3; i++) { const n: any = makeNPC('inspector', { gender: i === 1 ? 'f' : 'm' }); n.cTop = pick(SUIT); n.cShirt = new THREE.Color(0xf2f2f0); n.cPants = n.cTop; n.patr = n.g === 'm' ? pick(PATR_M) : pick(PATR_F); n.age = Math.floor(rr(40, 60)); n.speed = 0.9; n.bag = false; n.glasses = chance(0.6); INSP.push(n); }
  for (let i = 0; i < 14; i++) { const n: any = makeNPC('kid'); n.h = n.g === 'm' ? rr(1.4, 1.62) : rr(1.38, 1.58); n.k = n.h / 1.75; n.bag = true; n.age = Math.floor(rr(15, 17)); n.speed = rr(1.05, 1.3); KIDS.push(n); }
  for (let i = 0; i < 4; i++) { const n: any = makeNPC('worker', { gender: 'm' }); n.cTop = new THREE.Color(0xe86a1c); n.cPants = new THREE.Color(0x2a3140); n.bag = false; n.age = Math.floor(rr(25, 55)); n.speed = 0.95; WORKERS.push(n); }
  for (let i = 0; i < 6; i++) { const n: any = makeNPC('applicant'); n.age = 17; n.bag = chance(0.5); APPL.push(n); }
  DED = makeNPC('ded', { gender: 'm' }); DED.name = 'Дед'; DED.surname = 'Мороз'; DED.cTop = new THREE.Color(0xb3141b); DED.cPants = new THREE.Color(0xb3141b); DED.cShoes = new THREE.Color(0x111111); DED.bag = true; DED.cBag = new THREE.Color(0xc0262c); DED.hat = 'dm'; DED.beard = true; DED.speed = 0.75; DED.h = 1.84; DED.k = DED.h / 1.75; DED.build = 1.25; DED.hair = 'short'; DED.cHair = new THREE.Color(0xf2f2f2);
  SNOWM = makeNPC('snow', { gender: 'f' }); SNOWM.name = 'Снегурочка'; SNOWM.surname = ''; SNOWM.cTop = new THREE.Color(0x7fc1ec); SNOWM.cPants = new THREE.Color(0x7fc1ec); SNOWM.skirt = true; SNOWM.hair = 'pony'; SNOWM.cHair = new THREE.Color(0xd9b26a); SNOWM.bag = false; SNOWM.hat = 'snowc'; SNOWM.speed = 0.85;
  [...INSP, ...KIDS, ...WORKERS, ...APPL, DED, SNOWM].forEach(n => { n.arrive = Infinity; n.special = true; });
  STAFF.forEach(n => n.offAlways = true);   // 1–2 этажи не моделируем: только ИНИТ на 3 этаже
  if (R_DEAN) R_DEAN.name = 'Дирекция ИНИТ';
  // характеры
  STUDENTS.forEach(s => { const t = s.traits; s.crowdR = rnd(); s.arch = t.punctual < 0.12 ? 'opz' : t.diligent > 0.8 && t.punctual > 0.45 ? 'otl' : t.social > 0.86 ? 'tus' : t.social < 0.14 ? 'tih' : t.gamer > 0.88 ? 'gam' : 'obs'; });
  GROUPS.forEach(g => { const ss = STUDENTS.filter(s => s.group === g); if (!ss.length) return; const b = ss.reduce((a, s) => (s.traits.diligent + s.traits.social > a.traits.diligent + a.traits.social ? s : a), ss[0]); setArch(b, 'sta'); g.starosta = b; });
  // пары
  const ms = shuffle(STUDENTS.filter(s => s.g === 'm' && s.group.course > 1)), fs = shuffle(STUDENTS.filter(s => s.g === 'f' && s.group.course > 1));
  for (let i = 0; i < 9 && i < ms.length && i < fs.length; i++) { const a = ms[i], b = fs.find(f => f.love == null && (f.group === a.group || chance(0.4))) || fs[i]; if (b.love != null) continue; a.love = b.id; b.love = a.id; a.friends.set(b.id, 1); b.friends.set(a.id, 1); COUPLES.push([a, b]); }
}
function setArch(n, a) {
  n.arch = a; const t = n.traits;
  if (a === 'otl') { t.diligent = 0.92; t.punctual = Math.max(t.punctual, 0.8); }
  if (a === 'tus') { t.social = 0.97; t.diligent = Math.min(t.diligent, 0.4); }
  if (a === 'tih') { t.social = 0.08; }
  if (a === 'opz') { t.punctual = 0.04; }
  if (a === 'gam') { t.gamer = 0.96; }
  if (a === 'sta') { t.diligent = Math.max(t.diligent, 0.8); t.social = Math.max(t.social, 0.7); t.punctual = Math.max(t.punctual, 0.9); }
  if (n.group && n.arrive0 != null) { n.arrive0 = PAIRS[n.group.first][0] - rr(5, 28) + (t.punctual < 0.2 ? rr(6, 18) : 0); }
}

// ---------- день: периоды и одежда ----------
let QUARREL = null;
function evDayPlan() {
  const P = PERIOD();
  NPCS.forEach(n => {
    if (n.arrive0 === undefined) { n.arrive0 = n.arrive; n.leave0 = n.leave; n.cTop0 = n.cTop; n.cPants0 = n.cPants; n.hat0 = n.hat || null; }
    n.arrive = n.arrive0; n.leave = n.leave0; n.offToday = false; n.hack = false; n.hackMentor = false; n.tour = null; n.evMood = null; n.tossT = null; n.grad = false; n.powerOut = false;
    n.cTop = n.cTop0; n.cPants = n.cPants0; n.hat = n.hat0; n.quarrel = false; n.vac = false;
  });
  const S = STUDENTS, Tc = TEACHERS;
  if (P === 'nooruz') {
    S.forEach(s => { s.offToday = chance(0.3); s.arrive = rr(600, 700); s.leave = rr(900, 1010); if (s.g === 'f' && chance(0.45)) s.cTop = new THREE.Color(pick([0xb3202a, 0xd8d0c0, 0x8c1a3a, 0xe0c9a0])); });
    Tc.forEach(t => { t.offToday = chance(0.45); t.arrive = rr(610, 700); t.leave = rr(840, 960); });
    if (DEAN) { DEAN.arrive = 600; DEAN.leave = 960; }
  } else if (P === 'grad') {
    const maxC = Math.max(...GROUPS.map(g => g.course));
    S.forEach(s => { if (s.group.course === maxC) { s.grad = true; s.arrive = rr(585, 640); s.leave = rr(880, 960); s.cTop = new THREE.Color(0x1c2a52); s.hat = 'mboard'; } else { s.offToday = chance(0.6); s.arrive = rr(620, 680); s.leave = rr(770, 870); } });
    Tc.forEach(t => { t.offToday = chance(0.4); t.arrive = rr(600, 650); t.leave = rr(790, 900); });
    if (DEAN) { DEAN.arrive = 590; DEAN.leave = 930; }
  } else if (P === 'vacation') {
    S.forEach(s => s.offToday = true);
    Tc.forEach(t => { t.offToday = chance(0.75); t.arrive = rr(540, 610); t.leave = rr(700, 800); t.vac = true; });
    WORKERS.forEach(w => { w.arrive = rr(530, 560); w.leave = rr(1000, 1030); });
    APPL.forEach(a => { a.arrive = rr(600, 940); a.leave = a.arrive + rr(25, 45); });
  } else if (P === 'newyear') {
    DED.arrive = 655; DED.leave = 960; SNOWM.arrive = 657; SNOWM.leave = 960;
    S.forEach(s => { if (chance(0.15)) s.hat = 'dm'; });
  }
  // ссора дня: одна пара
  if (COUPLES.length) { const c = COUPLES[Math.floor(dayHash(SUN.doy * 13 + simDow) * COUPLES.length)]; if (dayHash(SUN.doy + 5) < 0.5) { c[0].quarrel = c[1].quarrel = true; QUARREL = c; } else QUARREL = null; }
  applyDress(); propsFor(P);
}
function applyDress() { if (!PART.torsoM) return; NPCS.forEach((n, i) => recolor(n, i)); markColors(); }

function canSpawn(n, hol) {
  if (n.offToday || n.offAlways) return false;
  if (n.role === 'student' && n.crowdR > EV.crowd) return false;
  if (n.special) return n.arrive < 1e8;
  if (hol) return n.role === 'guard';
  if (PERIOD() === 'vacation') return n.role !== 'student' && n.role !== 'gym';
  return true;
}

// ---------- реквизит праздников во дворе ----------
const PROPS: any = {}; const PLAZA = { x: 5.5, y: -1.5 };
const STAGE: any = {}; let propsBuilt = false;
const Mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
function canvasT(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
function bannerTex(text, sub, bg, fg) { return canvasT(1024, 256, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 40; i++) g.fillRect(i * 28, 0, 3, h); g.fillStyle = fg; g.textAlign = 'center'; g.font = '600 92px "Golos Text", sans-serif'; g.fillText(text, w / 2, 130); g.font = '500 44px "Golos Text", sans-serif'; g.fillText(sub, w / 2, 205); }); }
function buildProps() {
  if (propsBuilt) return; propsBuilt = true;
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.85 });
  // сцена: к югу от площади, лицом к площади
  const sp = freeDisk(PLAZA.x, PLAZA.y - 11, 3.6, 10);
  STAGE.x = sp.x; STAGE.y = sp.y; const dirx = PLAZA.x - sp.x, diry = PLAZA.y - sp.y, L = Math.hypot(dirx, diry) || 1; STAGE.dx = dirx / L; STAGE.dy = diry / L; STAGE.a = Math.atan2(STAGE.dy, STAGE.dx);
  const stage = new THREE.Group(); stage.position.set(sp.x, OUTZ, -sp.y); stage.rotation.y = STAGE.a - Math.PI / 2;
  const deck = Mesh(new THREE.BoxGeometry(6.2, 0.6, 3.2), wood); deck.position.set(0, 0.3, 0); stage.add(deck);
  const back = Mesh(new THREE.BoxGeometry(6.4, 3.0, 0.12), new THREE.MeshStandardMaterial({ color: 0x1d2a4a, roughness: 0.8 })); back.position.set(0, 2.1, 1.55); stage.add(back);
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: bannerTex('КГУ', 'им. И. Арабаева', '#1f5fa8', '#fff'), toneMapped: false })); ban.position.set(0, 2.55, 1.48); ban.rotation.y = Math.PI; stage.add(ban); STAGE.banner = ban;
  [-2.9, 2.9].forEach(x => { const p = Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.4 })); p.position.set(x, 1.8, 1.4); stage.add(p); const sp2 = Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })); sp2.position.set(x * 1.12, 0.4, 0.2); stage.add(sp2); });
  scene.add(stage); PROPS.stage = stage; stage.visible = false; STAGE.r = 3.4;
  STAGE.top = { x: sp.x - STAGE.dx * 0.4, y: sp.y - STAGE.dy * 0.4 };
  // юрта
  const yp = freeDisk(PLAZA.x - 12, PLAZA.y - 7, 3.2, 12); PROPS.yurtP = yp;
  const yurt = new THREE.Group(); yurt.position.set(yp.x, OUTZ, -yp.y);
  const felt = canvasT(1024, 128, (g, w, h) => { g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3202a'; g.fillRect(0, 54, w, 22); g.fillStyle = '#1d3b6e'; for (let i = 0; i < 32; i++) { g.beginPath(); const x = i * 32 + 16; g.moveTo(x, 50); g.lineTo(x + 10, 40); g.lineTo(x + 20, 50); g.lineTo(x + 10, 60); g.fill(); } g.fillStyle = '#d9b26a'; g.fillRect(0, 20, w, 5); g.fillRect(0, 100, w, 5); });
  felt.wrapS = THREE.RepeatWrapping; felt.repeat.set(2, 1);
  const wall = Mesh(new THREE.CylinderGeometry(2.7, 2.7, 1.7, 32, 1, true), new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95, side: THREE.DoubleSide })); wall.position.y = 0.85; yurt.add(wall);
  const roof = Mesh(new THREE.ConeGeometry(2.95, 1.5, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.95, side: THREE.DoubleSide })); roof.position.y = 2.42; yurt.add(roof);
  const tund = Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 20), wood); tund.rotation.x = Math.PI / 2; tund.position.y = 3.0; yurt.add(tund);
  const door = Mesh(new THREE.BoxGeometry(0.9, 1.35, 0.08), new THREE.MeshStandardMaterial({ color: 0xb3202a, roughness: 0.7 })); const da = Math.atan2(-(PLAZA.y - yp.y), PLAZA.x - yp.x); door.position.set(Math.cos(da) * 2.72, 0.68, Math.sin(da) * 2.72); door.rotation.y = -da + Math.PI / 2; yurt.add(door);
  scene.add(yurt); PROPS.yurt = yurt; yurt.visible = false;
  // казан с сумолоком
  const kp = freeDisk(yp.x + 5, yp.y - 2.5, 1.4, 8); PROPS.kazanP = kp;
  const kz = new THREE.Group(); kz.position.set(kp.x, OUTZ, -kp.y);
  const bowl = Mesh(new THREE.SphereGeometry(0.62, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide })); bowl.position.y = 0.95; kz.add(bowl);
  const soup = new THREE.Mesh(new THREE.CircleGeometry(0.58, 18), new THREE.MeshStandardMaterial({ color: 0x5a3216, roughness: 0.4 })); soup.rotation.x = -Math.PI / 2; soup.position.y = 0.9; kz.add(soup);
  const stand = Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.45, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.8, side: THREE.DoubleSide })); stand.position.y = 0.22; kz.add(stand);
  const fire = new THREE.PointLight(0xff8a3a, 0, 6); fire.position.y = 0.35; kz.add(fire); PROPS.fire = fire;
  const stN = 60, stP = new Float32Array(stN * 3); for (let i = 0; i < stN; i++) stP.set([rr(-0.3, 0.3), 1 + rr(0, 2), rr(-0.3, 0.3)], i * 3);
  const stG = new THREE.BufferGeometry(); stG.setAttribute('position', new THREE.BufferAttribute(stP, 3));
  const steam = new THREE.Points(stG, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.35, depthWrite: false })); kz.add(steam); PROPS.steam = steam;
  scene.add(kz); PROPS.kazan = kz; kz.visible = false;
  // ёлка
  const tp = { x: PLAZA.x, y: PLAZA.y }; PROPS.treeP = tp;
  const tree = new THREE.Group(); tree.position.set(tp.x, OUTZ, -tp.y);
  const fir = new THREE.MeshStandardMaterial({ color: 0x1f5a35, roughness: 0.9 });
  [[2.6, 2.4, 1.8], [2.1, 2.2, 3.3], [1.55, 2.0, 4.7], [1.0, 1.7, 5.9]].forEach(([r, h, y]) => { const c = Mesh(new THREE.ConeGeometry(r, h, 18), fir); c.position.y = y; tree.add(c); });
  const trunk = Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.0), wood); trunk.position.y = 0.5; tree.add(trunk);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffc21a, emissiveIntensity: 1.2 })); star.position.y = 7.0; tree.add(star);
  const LN = 160, lp = new Float32Array(LN * 3), lc = new Float32Array(LN * 3); const pal = [0xff3b3b, 0xffd24a, 0x3bc1ff, 0x7dff6a, 0xff7ad9].map(c => new THREE.Color(c));
  for (let i = 0; i < LN; i++) { const h = rr(0.9, 6.4), r = (2.65 - (h - 0.9) / 5.5 * 2.2) * rr(0.86, 1.0), a = i * 2.4; lp.set([Math.cos(a) * r, h, Math.sin(a) * r], i * 3); const c = pal[i % pal.length]; lc.set([c.r, c.g, c.b], i * 3); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 1, toneMapped: false, depthWrite: false })); tree.add(lights); PROPS.treeLights = lights;
  const gm = [0xc0262c, 0x2b6cb0, 0xd9a531, 0x2e7d4f].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  for (let i = 0; i < 9; i++) { const b = Mesh(new THREE.BoxGeometry(rr(0.35, 0.6), rr(0.3, 0.5), rr(0.35, 0.6)), pick(gm)); const a = i / 9 * Math.PI * 2; b.position.set(Math.cos(a) * 2.9, 0.2, Math.sin(a) * 2.9); b.rotation.y = a; tree.add(b); }
  const tl = new THREE.PointLight(0xffd9a0, 0, 14); tl.position.y = 3; tree.add(tl); PROPS.treeLamp = tl;
  scene.add(tree); PROPS.tree = tree; tree.visible = false;
  // шары-арка для выпускного
  const arch = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.35 }), 44);
  const ac = [0x1f5fa8, 0xffffff, 0xd9a531].map(c => new THREE.Color(c)); const m4 = new THREE.Matrix4();
  for (let i = 0; i < 44; i++) { const a = i / 43 * Math.PI; m4.makeTranslation(Math.cos(a) * 3.6, Math.sin(a) * 3.4, 0); arch.setMatrixAt(i, m4); arch.setColorAt(i, ac[i % 3]); }
  arch.position.set(sp.x + STAGE.dx * 3.4, OUTZ, -(sp.y + STAGE.dy * 3.4)); arch.rotation.y = STAGE.a; scene.add(arch); PROPS.arch = arch; arch.visible = false;
  // кучи листьев для субботника
  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 10, 6), new THREE.MeshStandardMaterial({ color: 0xc8782a, roughness: 1 }), 26); leaves.castShadow = true; leaves.count = 0; scene.add(leaves); PROPS.leaves = leaves; PROPS.leafPts = [];
}
function propsFor(P) {
  buildProps();
  const on = (k, v) => { if (PROPS[k]) PROPS[k].visible = v; };
  on('stage', P === 'nooruz' || P === 'grad' || P === 'newyear'); on('yurt', P === 'nooruz'); on('kazan', P === 'nooruz'); on('tree', P === 'newyear'); on('arch', P === 'grad');
  if (P === 'nooruz' || P === 'grad' || P === 'newyear') blockOn('stage', STAGE.x, STAGE.y, 3.3); else blockOff('stage');
  if (P === 'nooruz') { blockOn('yurt', PROPS.yurtP.x, PROPS.yurtP.y, 2.95); blockOn('kazan', PROPS.kazanP.x, PROPS.kazanP.y, 0.8); } else { blockOff('yurt'); blockOff('kazan'); }
  if (P === 'newyear') blockOn('tree', PROPS.treeP.x, PROPS.treeP.y, 3.1); else blockOff('tree');
  const bt = { nooruz: ['Нооруз майрамы', 'Кут-береке, ынтымак! 🌸', '#2e7d4f', '#fff'], grad: ['Выпускной 2027', 'ИНИТ · КГУ им. И. Арабаева 🎓', '#1c2a52', '#ffd24a'], newyear: ['С Новым годом!', 'ИНИТ поздравляет 🎄', '#8c1a2a', '#fff'] }[P];
  if (bt && STAGE.banner) { STAGE.banner.material.map = bannerTex(...(bt as [any, any, any, any])); STAGE.banner.material.needsUpdate = true; }
}
let propT = 0;
function propsFrame(dt) {
  propT += dt; const P = PERIOD(); const el = sunPos(simT).el, night = Math.max(0, Math.min(1, (3 - el) / 9));
  if (PROPS.steam && PROPS.kazan.visible) { const a = PROPS.steam.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) { a[i + 1] += dt * 0.6; a[i] += Math.sin(propT + i) * dt * 0.05; if (a[i + 1] > 3.2) { a[i + 1] = 1; a[i] = rr(-0.3, 0.3); a[i + 2] = rr(-0.3, 0.3); } } PROPS.steam.geometry.attributes.position.needsUpdate = true; PROPS.fire.intensity = 1.2 + Math.sin(propT * 13) * 0.3 + Math.sin(propT * 7.7) * 0.2; }
  if (PROPS.tree && PROPS.tree.visible) { PROPS.treeLights.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(propT * 2.2)); PROPS.treeLights.material.size = 0.18 + night * 0.12; PROPS.treeLamp.intensity = night * 1.4; }
  if (PROPS.leaves && PROPS.leaves.count) { const E = EV.cur; const k = E && E.type === 'clean' ? Math.min(1, (simT - E.t0) / (E.end - E.t0) * 1.4 + 0.15) : 0; const m4 = new THREE.Matrix4(); PROPS.leafPts.forEach((p, i) => { m4.makeScale(k * p.s, k * p.s * 0.45, k * p.s).setPosition(p.x, OUTZ + 0.05, -p.y); PROPS.leaves.setMatrixAt(i, m4); }); PROPS.leaves.instanceMatrix.needsUpdate = true; if (!E || E.type !== 'clean') PROPS.leaves.count = 0; }
}

// ---------- события ----------
const EV_START: any = {}, EV_STOP: any = {}, EV_DEC: any = {};
function startEvent(type, opt: any = {}) {
  if (!EV_DEF[type]) return;
  if (EV.cur) stopEvent(true);
  const D = EV_DEF[type]; const t0 = simT - (opt.elapsed || 0);
  const E = EV.cur = { type, t0, end: Math.min(t0 + D.dur, type === 'hack' ? 1380 : 1430), data: {} };
  if (!opt.quiet) { news(`${D.icon} ${D.name}${opt.by ? '' : ''}`, true); toast(`${D.icon} ${D.name}`); }
  (EV_START[type] || (() => { }))(E);
  updAdmin();
  if (type === 'alarm') sndSiren();
}
function stopEvent(silent?) {
  const E = EV.cur; if (!E) return; EV.cur = null;
  (EV_STOP[E.type] || (() => { }))(E, silent);
  updAdmin();
}
// --- тревога
EV_START.alarm = E => {
  const ring = []; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, R = 9 + (i % 2) * 3.5; const s = spotNear(3, PLAZA.x + Math.cos(a) * R, PLAZA.y + Math.sin(a) * R, 6); if (s) ring.push(s); }
  E.data.ring = ring;
  NPCS.forEach(n => { if (n.spawned && !n.special) { interrupt(n); EV_DEC.alarm(n, simT, E); } });
};
function alarmSpot(n, E) {
  const R = E.data.ring; if (!R.length) return yardSpot();
  const gi = n.group ? GROUPS.indexOf(n.group) : (n.role === 'teacher' ? (n.id % R.length) : R.length - 1);
  const c = R[gi % R.length]; return spotNear(3, c.x + rr(-1.6, 1.6), c.y + rr(-1.6, 1.6), 4) || c;
}
EV_DEC.alarm = (n, t, E) => {
  if (n.special) return false;
  if (n.f === 3 && n.evSpotK === E) { hold(n, { until: E.end, ev: E, subs: ['idle', 'arms', 'phone', 'talk', 'idle'], act: n.role === 'teacher' ? 'проверяет группу на построении' : 'стоит на построении во дворе', topic: n.role === 'teacher' ? 'alarmT' : 'alarm', talk: 0.012, face: PLAZA }); return true; }
  const s = alarmSpot(n, E); n.evSpotK = E;
  goTo(n, s, n.f === 3 ? 'идёт к месту сбора' : 'эвакуация: выходит во двор', null, 1.3); n.evMood = '😨'; n.evMoodT = E.end; return true;
};
EV_STOP.alarm = (E, silent) => { if (!silent) { news('✅ Отбой тревоги, все возвращаются на пары'); toast('✅ Отбой тревоги'); } NPCS.forEach(n => { if (n.evMood === '😨') n.evMood = null; n.evSpotK = null; }); };
// --- свет
EV_START.power = E => {
  NPCS.forEach(n => { if (!n.spawned) return; const T = n.tasks[0];
    if (n.role === 'student' && T && T.t === 'sit' && n.seat && n.seat.pc >= 0 && chance(0.35)) { interrupt(n); n.powerOut = false; }
    if (n.role === 'it') { interrupt(n); }
    if (n.role === 'teacher' && T && T.t === 'teach' && T.room.kind === 'pc') say(n, 'powerT', 4);
  });
};
EV_DEC.power = (n, t, E) => {
  if (n.role === 'it') { if (!E.data.itGo) { E.data.itGo = true; const e = ENTR[0]; const s = spotNear(0, e.in[0] - 2.5, e.in[1], 6) || { f: 0, x: e.in[0], y: e.in[1] }; goTo(n, s, 'бежит к электрощиту', null, 1.4); say(n, 'Где фонарик?! Иду к щитку'); return true; } hold(n, { until: E.end, ev: E, sub: 'explain', act: 'чинит электрощит на 1 этаже' }); return true; }
  if (n.role === 'student' && !n.powerOut && n.f === 2) { const sh = n.group.shift, p = pairAt(t, sh), L = lessonFor(n, p); if (L && roomById(L.room).kind === 'pc') { n.powerOut = true; const r = roomById(L.room); const sp = corridorSpotNear(2, r.c[0], r.c[1], 8); if (sp) { const c = makeConv(2, sp.x, sp.y, 'study', rr(4, 9)); joinConv(n, c, 'вышел в коридор, пока нет света'); return true; } } }
  return false;
};
EV_STOP.power = (E, silent) => { PCS.forEach(p => { if (p.user) { p.tile = 1; p.bootT = simT + rr(0.3, 1.2); } }); if (!silent) { news('💡 Свет дали! Компьютеры загружаются'); toast('💡 Свет дали'); } const it = IT; if (it && it.spawned) { interrupt(it); say(it, 'Свет дали ✅', 4); } };
// --- Wi-Fi
EV_START.wifi = E => { if (IT && IT.spawned) interrupt(IT); };
EV_DEC.wifi = (n, t, E) => {
  if (n.role !== 'it') return false;
  const ss = seatsIn(R_IT.id).filter(s => s.office); const seat = ss.find(s => s.pc >= 0) || ss[0];
  if (!E.data.itSat && seat) { E.data.itSat = true; say(n, 'Роутер перезагружу, минуту!'); takeSeat(n, seat, 'бежит к серверу в 314', { until: Math.min(E.end - 4, t + 8), kind: 'it', pace: 1.4 }); return true; }
  if (!E.data.itTour) { E.data.itTour = true; const r = pick(PC_ROOMS); const sp = spotNear(2, r.c[0], r.c[1], 5); if (sp) { goTo(n, sp, 'проверяет сеть в классах', null, 1.2); hold(n, { until: E.end, ev: E, sub: 'explain', act: 'настраивает точку доступа', topic: 'it', talk: 0.02 }); return true; } }
  return false;
};
EV_STOP.wifi = (E, silent) => { PCS.forEach(p => { if (p.tile === 8) p.tile = 2; }); if (!silent) news(`📶 ${IT ? IT.name : 'Айтишник'} из 314 поднял Wi‑Fi`); if (IT && IT.spawned) say(IT, 'Сеть поднял ✅', 4); };
// --- комиссия
const TOURS = [];
function makeTour(lead, members, wps) { const T = { lead, members, wps, k: 0, stayUntil: null }; [lead, ...members].forEach((m, i) => { m.tour = T; m.tourI = i; m.tk = -1; }); TOURS.push(T); return T; }
function memberSpot(w, i) { w.spots = w.spots || []; if (!w.spots[i]) { const a = i * 2.39996, r = 0.9 + (i % 4) * 0.45; w.spots[i] = spotNear(w.f, w.x + Math.cos(a) * r, w.y + Math.sin(a) * r, 4) || { f: w.f, x: w.x, y: w.y }; } return w.spots[i]; }
function tourDecide(n) {
  const T = n.tour; if (!T) return false;
  if (T.k >= T.wps.length) { n.tour = null; if (n.special) leave(n, 'уходит'); return n.special; }
  const w = T.wps[T.k];
  if (n === T.lead) {
    if (n.tk !== T.k) { n.tk = T.k; goTo(n, { f: w.f, x: w.x, y: w.y }, w.act || 'ведёт группу', null, 0.85); return true; }
    if (T.stayUntil == null) { T.stayUntil = simT + w.stay; if (w.say) say(n, w.say, 4); if (w.news) news(w.news); }
    if (simT >= T.stayUntil) { T.k++; T.stayUntil = null; return tourDecide(n); }
    hold(n, { until: Math.min(T.stayUntil, simT + 0.6), sub: w.sub || 'explain', act: w.stayAct || w.act, topic: w.topic, talk: 0.05, face: w.face }); return true;
  }
  if (n.tk !== T.k) { n.tk = T.k; goTo(n, memberSpot(w, n.tourI), w.act2 || 'идёт за группой', null, 1.08); return true; }
  hold(n, { until: simT + 0.5, subs: w.subs2 || ['idle', 'idle', 'phone', 'arms'], act: w.stayAct2 || 'слушает', topic: w.topic2, talk: 0.02, face: T.lead }); return true;
}
EV_START.inspect = E => {
  const lead = INSP[0]; const t = simT;
  const busy = []; for (let p = 0; p < PAIRS.length; p++) if (t >= PAIRS[p][0] - 10 && t < PAIRS[p][1]) Object.values(SCHED[p]).forEach((s: any) => { if (!busy.includes(s.room)) busy.push(s.room); });
  const rooms = shuffle(busy.map(id => roomById(id)).filter(r => r && r.f === 2)).slice(0, 4);
  if (rooms.length < 3) shuffle([...PC_ROOMS, ...CLASS_ROOMS]).forEach(r => { if (rooms.length < 4 && !rooms.includes(r)) rooms.push(r); });
  const g = GATES[0];
  const wps: any[] = [{ f: 3, x: PLAZA.x + 3, y: PLAZA.y + 1, stay: 1, act: 'комиссия входит во двор', stayAct: 'осматривает двор', say: 'Так, посмотрим корпус', topic: 'inspect' }];
  rooms.forEach(r => { const s = spotNear(r.f, r.c[0], r.c[1], 6); if (s) wps.push({ ...s, stay: 3, act: `идёт в ${r.num || 'аудиторию'}`, stayAct: `проверяет занятие в ${r.num || 'аудитории'}`, topic: 'inspect', stayAct2: 'проверяет занятие', news: `🕴 Комиссия проверяет аудиторию ${r.num || ''}` }); });
  if (R_DEAN) { const s = spotNear(2, R_DEAN.c[0], R_DEAN.c[1], 6); if (s) wps.push({ ...s, stay: 5, act: 'идёт в дирекцию', stayAct: 'обсуждает итоги проверки с директором', sub: 'talk', topic: 'inspect' }); }
  const members = INSP.slice(1);
  if (DEAN && DEAN.spawned) { interrupt(DEAN); members.push(DEAN); say(DEAN, 'Добро пожаловать в ИНИТ!', 4); }
  E.data.tour = makeTour(lead, members, wps);
  INSP.forEach(n => { n.doneToday = false; n.arrive = simT; n.leave = 1400; });
};
EV_DEC.inspect = (n, t, E) => false;
EV_STOP.inspect = (E, silent) => { const T = E.data.tour; if (T) { T.k = T.wps.length; [T.lead, ...T.members].forEach(m => { if (m.special) { m.arrive = Infinity; if (m.spawned && m.tour) { m.tour = null; interrupt(m); leave(m, 'уезжает'); } } else m.tour = null; }); } if (!silent) news('🕴 Комиссия уехала. Замечаний немного 👍'); };
// --- субботник
EV_START.clean = E => {
  const pts = []; for (let i = 0; i < 26; i++) { const s = yardSpot(); pts.push({ x: s.x, y: s.y, s: rr(0.6, 1.3) }); } PROPS.leafPts = pts; if (PROPS.leaves) PROPS.leaves.count = pts.length;
  E.data.pts = pts;
  NPCS.forEach(n => { if (n.spawned && !n.special && (n.role === 'student' || n.role === 'teacher')) { interrupt(n); } });
};
EV_DEC.clean = (n, t, E) => {
  if (n.role !== 'student' && n.role !== 'teacher') return false;
  if (n.f === 3 && n.cleanK === E) { if (n.role === 'teacher') hold(n, { until: Math.min(E.end, t + rr(4, 9)), ev: E, sub: 'arms', act: 'руководит субботником', topic: 'cleanT', talk: 0.01 }); else hold(n, { until: Math.min(E.end, t + rr(5, 12)), ev: E, sub: 'sweep', act: 'субботник: сгребает листья', topic: 'clean', talk: 0.008 }); n.cleanK = null; return true; }
  const p = pick(E.data.pts); const s = spotNear(3, p.x + rr(-1.5, 1.5), p.y + rr(-1.5, 1.5), 5) || yardSpot(); n.cleanK = E; goTo(n, s, n.f === 3 ? 'берёт грабли' : 'идёт на субботник', null, 1.0); return true;
};
EV_STOP.clean = (E, silent) => { if (!silent) news('🍂 Субботник окончен, двор чистый ✨'); };
// --- хакатон
const TEAMS = ['NeuroNomads', 'Ala-Too Devs', 'Бишкек Bytes', 'Тулпар AI', 'CodeKurut', 'Манас Labs', 'Sary-Chelek', 'Boorsok.js'];
EV_START.hack = E => {
  const cand = STUDENTS.slice().sort((a, b) => (b.traits.diligent + b.traits.curious + b.traits.gamer * 0.6) - (a.traits.diligent + a.traits.curious + a.traits.gamer * 0.6)).slice(0, 56);
  E.data.teams = TEAMS.map((name, i) => ({ name, room: PC_ROOMS[i % PC_ROOMS.length], m: [] }));
  cand.forEach((s, i) => { s.hack = true; s.team = E.data.teams[i % TEAMS.length]; s.team.m.push(s); s.leave = Math.max(s.leave0, E.end + rr(0, 8)); if (!s.spawned && s.doneToday) { s.doneToday = false; s.arrive = simT + rr(4, 30); } });
  shuffle(TEACHERS.slice()).slice(0, 3).forEach(t => { t.hackMentor = true; t.leave = E.end; });
  E.data.pizza = E.t0 + 75;
};
function busyRooms(t) { const b = new Set(); for (let p = 0; p < PAIRS.length; p++) if (t >= PAIRS[p][0] - 5 && t < PAIRS[p][1]) Object.values(SCHED[p]).forEach((s: any) => b.add(s.room)); return b; }
EV_DEC.hack = (n, t, E) => {
  if (n.hackMentor) {
    const ks = Object.keys(n.lessons || {}).map(Number); if (ks.some(k => t >= PAIRS[k][0] - 3 && t < PAIRS[k][1])) return false;
    if (t >= E.end) return false;
    const r = pick(E.data.teams).room; const s = spotNear(2, r.c[0] + rr(-1.5, 1.5), r.c[1] + rr(-1.5, 1.5), 4); if (!s) return false;
    goTo(n, s, 'ментор хакатона идёт к командам'); hold(n, { until: t + rr(3, 7), sub: 'explain', act: 'ментор хакатона: помогает команде', topic: 'hackT', talk: 0.03 }); return true;
  }
  if (!n.hack || n.role !== 'student') return false;
  const sh = n.group.shift; const p = pairAt(t, sh); if (lessonFor(n, p)) return false;
  const np = nextPair(t, sh); if (np >= 0 && lessonFor(n, np) && PAIRS[np][0] - t < 8) return false;
  if (t > E.data.pizza && !n.ate && chance(0.6)) { n.ate = true; return joinQueue(n, 'хакатон: идёт за пиццей'); }
  if (chance(0.15)) { const r = n.team.room; const sp = corridorSpotNear(2, r.c[0], r.c[1], 7); if (sp) { const c = CONVS.find(c => c.f === 2 && c.members.some(m => m.team === n.team)) || makeConv(2, sp.x, sp.y, 'hack', rr(3, 7)); if (joinConv(n, c, 'хакатон: обсуждает идею с командой')) return true; } }
  const busy = busyRooms(t);
  const rooms = [n.team.room, ...PC_ROOMS].filter(r => !busy.has(r.id));
  for (const r of rooms) { const seat = freeSeat(r.id, s => !s.office && s.pc >= 0); if (seat) { takeSeat(n, seat, `хакатон: команда «${n.team.name}» кодит`, { until: t + rr(20, 45), kind: 'hack' }); return true; } }
  if (R_COWORK) { goTo(n, randomCellIn(2, R_COWORK.id), 'хакатон: кодит на ноутбуке в коворкинге'); wait(n, rr(10, 20), 'phone', 'хакатон: кодит на ноутбуке'); return true; }
  return false;
};
EV_STOP.hack = (E, silent) => {
  const win = pick(E.data.teams);
  if (!silent) { news(`🏆 Хакатон окончен! Победила команда «${win.name}»`, true); toast(`🏆 Победила команда «${win.name}»`); }
  STUDENTS.forEach(s => { if (s.hack) { s.leave = Math.min(s.leave, simT + rr(5, 30)); if (s.team === win && s.spawned) { s.evMood = '🏆'; s.evMoodT = simT + 30; say(s, 'Мы победили!!! 🏆', 4); } s.hack = false; s.ate = false; } });
  TEACHERS.forEach(t => t.hackMentor = false);
};
// --- день открытых дверей
EV_START.openday = E => {
  let guide = TEACHERS.find(t => t.spawned && !Object.keys(t.lessons || {}).some(k => simT >= PAIRS[k][0] - 5 && simT < PAIRS[k][1] + 60));
  if (!guide) guide = DEAN && DEAN.spawned ? DEAN : TEACHERS.find(t => t.spawned) || DEAN;
  E.data.guide = guide;
  if (guide.spawned) interrupt(guide); else { guide.doneToday = false; guide.arrive = simT; }
  guide.leave = Math.max(guide.leave || 0, E.end + 10);
  const wps = []; const add = (s, o) => { if (s) wps.push({ ...s, ...o }); };
  const g0 = GATES[0];
  add(spotNear(3, g0.x - 3, g0.y, 6), { stay: 1.5, act: 'встречает школьников у ворот', say: 'Добро пожаловать в КГУ! Идём за мной', topic: 'guide', topic2: 'kids' });
  add(spotNear(3, PLAZA.x + 2, PLAZA.y + 2, 6), { stay: 3, act: 'ведёт экскурсию по двору', stayAct: 'рассказывает о КГУ', topic: 'guide', topic2: 'kids', stayAct2: 'слушает экскурсию' });
  const pc = pick(PC_ROOMS); add(spotNear(2, pc.c[0], pc.c[1], 6), { stay: 4, act: `ведёт школьников в ${pc.num}`, stayAct: 'показывает компьютерный класс', topic: 'guide', topic2: 'kids', stayAct2: 'смотрит компьютерный класс' });
  if (R_IT) add(spotNear(2, R_IT.c[0], R_IT.c[1], 6), { stay: 2.5, act: 'ведёт в IT-отдел 314', stayAct: 'знакомит с айтишником', topic: 'guide', topic2: 'kids', stayAct2: 'смотрит на серверы' });
  if (R_COWORK) add(spotNear(2, R_COWORK.c[0], R_COWORK.c[1], 6), { stay: 4, act: 'ведёт в буфет', stayAct: 'угощает школьников самсой', sub: 'talk', topic: 'guide', topic2: 'kids', stayAct2: 'пробует самсу в буфете' });
  if (R_DEAN) add(spotNear(2, R_DEAN.c[0], R_DEAN.c[1], 6), { stay: 3, act: 'ведёт в дирекцию', stayAct: 'рассказывает о поступлении', topic: 'guide', topic2: 'kids', stayAct2: 'спрашивает про ОРТ' });
  add(spotNear(3, PLAZA.x - 2, PLAZA.y - 2, 6), { stay: 3, act: 'выводит группу во двор', stayAct: 'фото на память с школьниками', sub: 'arms', topic: 'guide', topic2: 'kids', stayAct2: 'фотографируется на память', subs2: ['cheer', 'idle', 'phone'] });
  KIDS.forEach(k => { k.doneToday = false; k.arrive = simT; k.leave = 1400; });
  E.data.tour = makeTour(guide, KIDS.slice(), wps);
  if (IT && IT.spawned) setTimeout(() => { }, 0);
};
EV_DEC.openday = (n, t, E) => false;
EV_STOP.openday = (E, silent) => { const T = E.data.tour; if (T) { T.k = T.wps.length; KIDS.forEach(k => { k.arrive = Infinity; if (k.spawned && k.tour) { k.tour = null; interrupt(k); leave(k, 'уходит с экскурсии'); } }); if (T.lead) T.lead.tour = null; } if (!silent) news('🎒 Экскурсия для школьников закончилась'); };

// ---------- праздничные дни ----------
const STAGE_SP = [];
function crowdSpot(i, rad0 = 3.4, rad1 = 8.5) { // перед сценой
  const a = STAGE.a + rr(-0.9, 0.9), r = rr(rad0, rad1); return spotNear(3, STAGE.x + Math.cos(a) * r, STAGE.y + Math.sin(a) * r, 4) || yardSpot();
}
function holidayDecide(n, t, P) {
  if (P === 'vacation') {
    if (n.role === 'teacher') { if (t >= n.leave) { leave(n); return true; } const seat = seatsIn(n.kaf.id).find(s => s.office && (!s.occ || s.occ === n)); if (seat) { takeSeat(n, seat, 'на кафедре: готовит программы на новый год', { until: t + rr(20, 50), kind: 'kaf' }); return true; } wait(n, 10, 'phone', 'на кафедре'); return true; }
    return false;
  }
  if (n.role !== 'student' && n.role !== 'teacher' && n.role !== 'dean') return false;
  if (n.leave != null && t >= n.leave) { leave(n, P === 'grad' && n.grad ? 'идёт праздновать с группой' : 'идёт домой с праздника'); return true; }
  if (P === 'grad') {
    if (t >= 655 && t < 720 && (n.grad || n.role === 'dean' || n.role === 'teacher')) {
      if (n.role === 'dean') { goTo(n, { f: 3, ...spotNear(3, STAGE.top.x, STAGE.top.y, 4) }, 'поднимается на сцену', null, 0.9); hold(n, { until: 720, sub: 'explain', act: 'вручает дипломы выпускникам', topic: 'Поздравляю выпускников! 🎓', face: PLAZA }); return true; }
      if (n.role === 'teacher') { const s = spotNear(3, STAGE.x + STAGE.dx * 3 + rr(-3, 3), STAGE.y + STAGE.dy * 3 + rr(-0.5, 0.5), 4); if (s) { goTo(n, s, 'идёт на линейку'); hold(n, { until: 720, subs: ['idle', 'arms'], act: 'на выпускной линейке', face: STAGE }); return true; } }
      const idx = STUDENTS.filter(s => s.grad).indexOf(n); const row = Math.floor(idx / 8), col = idx % 8 - 3.5; const px = -STAGE.dy, py = STAGE.dx;
      const s = spotNear(3, STAGE.x + STAGE.dx * (5 + row * 0.95) + px * col * 0.85, STAGE.y + STAGE.dy * (5 + row * 0.95) + py * col * 0.85, 3);
      if (s) { goTo(n, s, 'встаёт в строй выпускников'); hold(n, { until: 720, subs: ['idle', 'idle', 'arms'], act: 'на выпускной линейке', face: STAGE }); return true; }
    }
    if (t >= 720 && t < 724 && n.grad && n.f === 3) { hold(n, { until: 724, sub: 'cheer', act: 'подбрасывает шапку! 🎓' }); return true; }
    if (t < 655 || t > 724) { if (chance(0.5) && STAGE.x != null) { const s = crowdSpot(n.id, 3.5, 10); const c = CONVS.find(c => c.f === 3 && c.members.length < 6 && Math.hypot(c.x - s.x, c.y - s.y) < 6 && c.members.some(m => m.group === n.group)) || makeConv(3, s.x, s.y, 'yard', rr(8, 20)); if (joinConv(n, c, n.grad ? 'фотографируется с группой 🎓' : 'поздравляет выпускников')) return true; } }
    if (!n.grad && t >= 655 && t < 724) { const s = crowdSpot(n.id, 7, 12); goTo(n, s, 'идёт смотреть выпускной'); hold(n, { until: Math.min(724, t + 15), subs: ['idle', 'phone', 'arms'], act: 'смотрит выпускную линейку', face: STAGE }); return true; }
    return yardHang(n, rr(8, 20)) || (wait(n, 3, 'idle', 'празднует'), true);
  }
  if (P === 'nooruz') {
    const concert = t >= 660 && t < 800;
    if (n.performer && concert) { goTo(n, spotNear(3, STAGE.top.x, STAGE.top.y, 4), 'выходит на сцену'); hold(n, { until: Math.min(800, t + 25), sub: n.performer === 'komuz' ? 'play' : 'dance', act: n.performer === 'komuz' ? 'играет на комузе на сцене 🎶' : 'танцует на сцене', face: PLAZA }); return true; }
    const r = rnd();
    if (concert && r < 0.42) { const s = crowdSpot(n.id); goTo(n, s, 'идёт на концерт', null, 0.85); hold(n, { until: t + rr(8, 20), subs: chance(0.3) ? ['dance', 'dance', 'cheer'] : ['idle', 'phone', 'arms', 'cheer'], act: 'смотрит концерт у сцены', face: STAGE, topic: 'nooruz', talk: 0.01 }); return true; }
    if (r < 0.62 && PROPS.kazanP) { const k = PROPS.kazanP; const s = spotNear(3, k.x + rr(-2.5, 2.5), k.y + rr(-2.5, 2.5), 4); if (s) { goTo(n, s, 'идёт к казану', null, 0.85); hold(n, { until: t + rr(5, 12), subs: ['talk', 'idle', 'phone'], act: chance(0.5) ? 'пробует сумолок 🥣' : 'ест боорсок у казана', face: k, topic: 'nooruz', talk: 0.02 }); return true; } }
    if (r < 0.75 && PROPS.yurtP) { const y = PROPS.yurtP; const a = rr(0, 6.28); const s = spotNear(3, y.x + Math.cos(a) * 3.6, y.y + Math.sin(a) * 3.6, 3); if (s) { goTo(n, s, 'идёт к юрте', null, 0.85); hold(n, { until: t + rr(3, 8), subs: ['phone', 'phone', 'idle'], act: 'фотографируется у юрты 📸', face: y }); return true; } }
    return yardHang(n, rr(8, 18)) || (wait(n, 3, 'idle', 'празднует Нооруз'), true);
  }
  return false;
}
function specialDecide(n, t, P) {
  if (n.tour) return tourDecide(n);
  if (n.role === 'inspector' || n.role === 'kid') { leave(n, 'уходит'); n.arrive = Infinity; return true; }
  if (t >= (n.leave || 1080)) { leave(n); return true; }
  if (n.role === 'ded' || n.role === 'snow') {
    const c = PROPS.treeP || PLAZA; const a = rr(0, 6.28); const s = spotNear(3, c.x + Math.cos(a) * rr(3.6, 6), c.y + Math.sin(a) * rr(3.6, 6), 4);
    if (s) { goTo(n, s, n.role === 'ded' ? 'Дед Мороз гуляет у ёлки' : 'Снегурочка водит хоровод', null, 0.8); hold(n, { until: t + rr(3, 7), subs: n.role === 'ded' ? ['explain', 'arms', 'cheer'] : ['dance', 'explain'], act: n.role === 'ded' ? 'поздравляет студентов 🎅' : 'водит хоровод у ёлки', topic: n.role, talk: 0.05 }); return true; }
  }
  if (n.role === 'worker') { const sp = corridorSpotNear(2, rr(-20, 22), rr(-24, 22), 30); if (sp) { goTo(n, sp, 'идёт с ведром краски'); hold(n, { until: t + rr(12, 25), sub: 'board', act: 'красит стены в коридоре', topic: 'worker', talk: 0.01 }); return true; } }
  if (n.role === 'applicant' && R_DEAN) { if (!n.done) { n.done = true; goTo(n, randomCellIn(2, R_DEAN.id), 'ищет приёмную комиссию'); hold(n, { until: t + rr(10, 20), subs: ['talk', 'idle'], act: 'подаёт документы в приёмную комиссию', topic: 'applicant', talk: 0.02 }); return true; } leave(n, 'уходит, документы сданы'); return true; }
  wait(n, 3, 'idle', 'стоит'); return true;
}
function evDecide(n) {
  const t = simT, P = PERIOD(), E = EV.cur;
  if (n.tour) return tourDecide(n);
  if (n.special) return specialDecide(n, t, P);
  if (E && EV_DEC[E.type] && EV_DEC[E.type](n, t, E)) return true;
  if (noClasses()) return holidayDecide(n, t, P);
  if (n.hackMentor && E && E.type === 'hack') return false;
  return false;
}

// ---------- очередь в буфете ----------
const QUEUE: any = { pts: [], list: [], counter: null };
function buildQueue() {
  if (!R_COWORK) return;
  const c = cellsOf(2, R_COWORK.id); let best = null;
  for (let k = 0; k < c.length; k += 2) {
    const x0 = wx(c[k]), y0 = wy(c[k + 1]);
    for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const pts = []; for (let s = 0; s < 12; s++) { const x = x0 + dx * s * 0.55, y = y0 + dy * s * 0.55; let ok = roomAt(2, x, y) === R_COWORK.id; for (const [ox, oy] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) if (!pass(2, cx(x + ox), cy(y + oy))) ok = false; if (!ok) break; pts.push({ f: 2, x, y }); }
      const wallBehind = !pass(2, cx(x0 - dx * 0.6), cy(y0 - dy * 0.6));
      const score = pts.length + (wallBehind ? 3 : 0);
      if (!best || score > best.score) best = { score, pts, dx, dy, x0, y0 };
    }
  }
  if (!best || best.pts.length < 4) return;
  QUEUE.pts = best.pts; QUEUE.dir = [best.dx, best.dy];
  const cX = best.x0 - best.dx * 0.75, cY = best.y0 - best.dy * 0.75; QUEUE.counter = { x: cX, y: cY };
  const g = new THREE.Group(); g.position.set(cX, FZ[2], -cY); g.rotation.y = Math.atan2(best.dx, best.dy) + Math.PI;
  const top = Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.6), new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 0.6 })); top.position.y = 0.5; g.add(top);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.32, 0.45), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.05 })); glass.position.y = 1.16; g.add(glass);
  const food = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc98a3c, roughness: 0.6 }), 14); const m4 = new THREE.Matrix4(); for (let i = 0; i < 14; i++) { m4.makeScale(1.3, 0.7, 1).setPosition(-0.7 + i * 0.105, 1.06, rr(-0.1, 0.1)); food.setMatrixAt(i, m4); } g.add(food);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: bannerTex('САМСА · ЛАГМАН · ЧАЙ', 'буфет ИНИТ', '#7a1f1f', '#ffe6a8'), toneMapped: false, side: THREE.DoubleSide })); sign.position.set(0, 1.95, 0); g.add(sign);
  storeyG[1] ? people.add(g) : scene.add(g); QUEUE.mesh = g;
}
function joinQueue(n, act) {
  if (!QUEUE.pts.length) return false;
  QUEUE.list.push(n); const tail = QUEUE.pts[Math.min(QUEUE.list.length - 1, QUEUE.pts.length - 1)];
  goTo(n, { f: 2, x: tail.x + rr(-0.05, 0.05), y: tail.y + rr(-0.05, 0.05) }, act || 'идёт в буфет');
  n.tasks.push({ t: 'queue', act: act });
  return true;
}
function qLeave(n) { const i = QUEUE.list.indexOf(n); if (i >= 0) QUEUE.list.splice(i, 1); }
EXT_TASK.queue = (n, T, dt) => {
  let i = QUEUE.list.indexOf(n); if (i < 0) { QUEUE.list.push(n); i = QUEUE.list.length - 1; }
  const sh = n.group ? n.group.shift : null; const np = nextPair(simT, sh);
  if (n.role === 'student' && ((np >= 0 && lessonFor(n, np) && PAIRS[np][0] - simT < 2) || (pairAt(simT, sh) >= 0 && lessonFor(n, pairAt(simT, sh))))) { qLeave(n); n.tasks.shift(); return; }
  const tp = QUEUE.pts[Math.min(i, QUEUE.pts.length - 1)]; const dx = tp.x - n.x, dy = tp.y - n.y, d = Math.hypot(dx, dy);
  n.act = i === 0 ? 'покупает самсу и чай' : `стоит в очереди в буфет (${i + 1}-й)`; n.pose = 'stand';
  if (d > 0.06) { const st = Math.min(d, n.speed * 0.7 * dt); n.x += dx / d * st; n.y += dy / d * st; n.walk = Math.min(0.7, n.walk + dt * 4); n.phase += aph(dt) * n.speed * 3.4; n.a = lerpAng(n.a, Math.atan2(dy, dx), Math.min(1, dt * 8)); }
  else { n.walk = Math.max(0, n.walk - dt * 5); const C = QUEUE.counter; n.a = lerpAng(n.a, Math.atan2(C.y - n.y, C.x - n.x), Math.min(1, dt * 6)); n.sub = i === 0 ? 'talk' : (n.sub === 'phone' || chance(0.002) ? 'phone' : 'idle'); }
  if (i === 0 && d < 0.1) { if (T.serve == null) T.serve = simT + rr(0.5, 1.1); if (simT >= T.serve) { qLeave(n); n.tasks.shift(); n.needs.hunger = 0.05; const spot = randomCellIn(2, R_COWORK.id); goTo(n, spot, 'несёт поднос с едой'); wait(n, rr(6, 12), chance(0.5) ? 'talk' : 'phone', T.act && T.act.includes('пицц') ? 'ест пиццу 🍕' : pick(['ест самсу и пьёт чай', 'ест лагман 🍜', 'пьёт чай с боорсоками'])); } }
};

// ---------- части тела: шапки, борода, грабли ----------
function evBodies() {
  const N = NPCS.length; const P = (name, geo, mat) => { const m = mkPart(name, geo, N, { mat }); people.add(m); PARTS1.push(name); m.castShadow = true; NPCS.forEach((n, i) => m.setMatrixAt(i, ZERO)); return m; };
  const kal = new THREE.CylinderGeometry(0.07, 0.115, 0.19, 14, 1, false); kal.translate(0, 0.145, -0.008);
  const kalB = new THREE.CylinderGeometry(0.128, 0.128, 0.04, 14, 1, true); kalB.translate(0, 0.065, -0.008);
  const mb = BGU.mergeBufferGeometries([(() => { const b = new THREE.BoxGeometry(0.29, 0.016, 0.29); b.translate(0, 0.15, -0.005); return b; })(), (() => { const c = new THREE.CylinderGeometry(0.104, 0.11, 0.08, 14); c.translate(0, 0.1, -0.005); return c; })()]);
  const beard = new THREE.SphereGeometry(0.09, 12, 8); beard.scale(1.08, 1.35, 0.72); beard.translate(0, -0.085, 0.055);
  const dm = BGU.mergeBufferGeometries([(() => { const c = new THREE.ConeGeometry(0.106, 0.2, 14); c.translate(0, 0.17, -0.02); return c; })(), (() => { const s = new THREE.SphereGeometry(0.03, 8, 6); s.translate(0.02, 0.27, -0.06); return s; })()]);
  const dmT = new THREE.CylinderGeometry(0.12, 0.122, 0.045, 14, 1, true); dmT.translate(0, 0.07, -0.01);
  const rake = BGU.mergeBufferGeometries([(() => { const c = new THREE.CylinderGeometry(0.013, 0.013, 1.35, 6); c.translate(0, -0.55, 0); return c; })(), (() => { const b = new THREE.BoxGeometry(0.38, 0.035, 0.06); b.translate(0, -1.22, 0); return b; })()]);
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  P('kalpak', kal, mat(0xf2ede2)); P('kalB', kalB, mat(0x161616)); P('mboard', mb, mat(0x111520)); P('beard', beard, mat(0xf4f4f4)); P('dmHat', dm, mat(0xc0141c)); P('dmT', dmT, mat(0xf6f6f6)); P('rake', rake, mat(0x8a6a3c));
  ['kalpak', 'kalB', 'mboard', 'beard', 'dmHat', 'dmT', 'rake'].forEach(p => { NPCS.forEach((n, i) => PART[p].setColorAt(i, new THREE.Color(1, 1, 1))); PART[p].instanceColor.needsUpdate = true; PART[p].castShadow = p !== 'beard'; });
}
const _hm = new THREE.Matrix4(), _hm2 = new THREE.Matrix4(), _ht = new THREE.Matrix4();
function poseExtras(n, i, vis) {
  if (!PART.kalpak) return;
  const H = vis ? (PART.head.getMatrixAt(i, _hm), _hm) : null;
  const hat = vis ? n.hat : null;
  setP('kalpak', i, hat === 'kalpak' ? H : ZERO); setP('kalB', i, hat === 'kalpak' ? H : ZERO);
  setP('dmHat', i, hat === 'dm' ? H : ZERO); setP('dmT', i, hat === 'dm' ? H : ZERO);
  setP('beard', i, vis && n.beard ? H : ZERO);
  if (hat === 'mboard') {
    let el = n.tossT ? (performance.now() - n.tossT) / 1000 : 9;
    if (el < 2.6) { const h = 3.4 * (1 - ((el - 1.3) / 1.3) ** 2); _ht.makeTranslation(0, Math.max(0, h), 0); _hm2.copy(_ht).multiply(H).multiply(new THREE.Matrix4().makeRotationY(el * 9)); setP('mboard', i, _hm2); }
    else setP('mboard', i, H);
  } else setP('mboard', i, ZERO);
  if (vis && n.sub === 'sweep') { PART.hand.getMatrixAt(i * 2 + 1, _hm2); setP('rake', i, _hm2.multiply(new THREE.Matrix4().makeRotationX(-0.5))); } else setP('rake', i, ZERO);
}

// ---------- эмоции над головой ----------
const moodLayer = document.createElement('div'); moodLayer.id = 'moods'; host.appendChild(moodLayer);
const moodPool = []; for (let i = 0; i < 36; i++) { const d = document.createElement('span'); d.className = 'mood'; moodLayer.appendChild(d); moodPool.push(d); }
let showMoods = true;
function moodOf(n) {
  if (n.evMood && simT < (n.evMoodT || 1e9)) return n.evMood;
  const T = n.tasks[0], E = EV.cur, P = PERIOD();
  if (n.sub === 'sleep') return '😴';
  if (T && T.t === 'go' && /опаздыва/.test(T.act || '')) return '😰';
  if (n.love != null) { const p = NPCS[n.love]; if (p.spawned && p.f === n.f && Math.hypot(p.x - n.x, p.y - n.y) < 1.7) return n.quarrel ? '😤' : '❤️'; }
  if (T && T.t === 'fix') return '🔧';
  if (n.sub === 'hand') return '🙋';
  if (n.gameMode && n.sub === 'type') return '🎮';
  if (T && T.t === 'queue') return '🥟';
  if (E && E.type === 'power' && n.f < 3 && n.sub === 'phone') return '🔦';
  if (E && E.type === 'wifi' && n.seat && n.seat.pc >= 0) return '📵';
  if (E && E.type === 'hack' && n.hack && n.sub === 'type') return '💻';
  if (n.role === 'kid') return '🤩';
  if (n.role === 'ded') return '🎅';
  if (P === 'session' && T && T.t === 'sit' && T.kind === 'lesson' && n.role === 'student') return '😬';
  if (n.sub === 'dance' || n.sub === 'cheer') return P === 'grad' ? '🎓' : '🎉';
  if (n.sub === 'play') return '🎶';
  if (n.sub === 'sweep') return '🍂';
  if (n.near) return '😇';
  if (n.say && performance.now() < n.sayT && /😂|Ха-ха|Капец/.test(n.say)) return '😂';
  return null;
}
function moodFrame() {
  if (!showMoods || PREWARM) { moodPool.forEach(d => d.style.display = 'none'); return; }
  const cand = []; const cam = camera.position;
  for (const n of NPCS) { if (!npcVisible(n)) continue; const m = moodOf(n); if (!m) continue; const d2 = dist3(n); if (d2 > 55 * 55) continue; cand.push([d2, n, m]); }
  cand.sort((a, b) => a[0] - b[0]);
  moodPool.forEach((d, i) => { const c = cand[i]; if (!c) { d.style.display = 'none'; return; } const [d2, n, m] = c; const [sx, sy, sz] = project(n.x, n.y, n.z + floorYOff(n.f) + (n.pose === 'sit' ? 1.5 : 2.05) * n.k); if (sz > 1) { d.style.display = 'none'; return; } d.style.display = 'block'; if (d.textContent !== m) d.textContent = m; const sc = Math.max(0.55, Math.min(1.25, 14 / Math.sqrt(d2))); d.style.transform = `translate(${sx | 0}px,${sy | 0}px) translate(-50%,-100%) scale(${sc.toFixed(2)})`; });
}

// ---------- тики ----------
let evAcc = 0;
function evTick(dtMin) {
  const t = simT, prev = EV.prevT == null ? t - dtMin : EV.prevT; EV.prevT = t;
  const E = EV.cur;
  if (E && t >= E.end) stopEvent();
  // запланированные
  if (simDow !== 0) EV.sched.forEach(s => { const m = s.m; if (prev < m && t >= m && (!EV.cur || EV.cur.type !== s.type)) startEvent(s.type, { sched: true }); });
  // старосты и опоздания
  for (let p = 0; p < PAIRS.length; p++) {
    if (prev < PAIRS[p][0] + 1 && t >= PAIRS[p][0] + 1 && !noClasses() && simDow !== 0) GROUPS.forEach(g => { const s = g.starosta; if (s && s.spawned && s.tasks[0] && s.tasks[0].t === 'sit' && chance(0.6)) say(s, 'starosta', 3.5); });
    if (prev < PAIRS[p][0] + 12 && t >= PAIRS[p][0] + 12 && !noClasses() && simDow !== 0) { let worst = null, wc = 0; GROUPS.forEach(g => { const c = STUDENTS.filter(s => s.group === g && s.lateMark === p).length; if (c > wc) { wc = c; worst = g; } }); if (worst && wc >= 3) news(`⏰ Группа ${worst.name}: ${wc} ${wc % 10 >= 2 && wc % 10 <= 4 && (wc % 100 < 12 || wc % 100 > 14) ? 'человека опоздали' : 'человек опоздали'} на ${PAIR_NAMES[p].replace('-я пара', '-ю пару')}`); }
  }
  // выпускной: шапки вверх
  if (PERIOD() === 'grad' && prev < 720 && t >= 720) { STUDENTS.forEach(s => { if (s.grad && s.spawned && s.f === 3) s.tossT = performance.now() + rr(0, 400); }); news('🎓 Выпускники подбросили шапки в небо!', true); toast('🎓 Шапки в небо!'); }
  if (PERIOD() === 'nooruz' && prev < 660 && t >= 660) { const c = STUDENTS.filter(s => s.spawned && s.f === 3); if (c.length) { const k = pick(c); k.performer = 'komuz'; c.slice(0, 4).forEach(s => { if (s !== k && chance(0.7)) s.performer = 'dance'; }); } news('🎶 Начался концерт к Ноорузу у сцены во дворе', true); }
  if (PERIOD() === 'nooruz' && prev < 800 && t >= 800) NPCS.forEach(n => n.performer = null);
  if (PERIOD() === 'newyear' && prev < 660 && t >= 660 && simDow !== 0) news('🎅 Во двор пришли Дед Мороз и Снегурочка!', true);
  // пары: помирились вечером
  if (QUARREL && prev < 1000 && t >= 1000) { QUARREL.forEach(s => { s.quarrel = false; if (s.spawned) say(s, 'makeup', 3); }); }
  // комиссия рядом
  if ((evAcc += dtMin) > 0.3) { evAcc = 0; const ins = INSP.filter(m => m.spawned); NPCS.forEach(n => { n.near = false; if (n.role !== 'student' || !n.spawned) return; for (const m of ins) if (m.f === n.f && Math.abs(m.x - n.x) < 8 && Math.abs(m.y - n.y) < 8) { n.near = true; if (n.sub === 'phone' || n.sub === 'sleep' || n.gameMode) { n.sub = n.seat && n.seat.pc >= 0 ? 'type' : 'write'; n.gameMode = false; if (chance(0.08)) say(n, 'inspectNear', 2.5); } break; } }); }
}
// pcTick: свет и сеть
function pcExtra() {
  const E = EV.cur;
  if (E && E.type === 'power') { PCS.forEach(p => { if (!p.err) p.tile = 0; }); return; }
  if (E && E.type === 'wifi') PCS.forEach(p => { if (p.user && p.tile >= 2 && p.tile !== 5) p.tile = 8; });
  PCS.forEach(p => { if (p._err !== p.err) { if (p.err && p.user && !PREWARM) news(`💥 В ${roomById(p.room)?.num || 'классе'} завис компьютер у ${p.user.name}`); if (!p.err && p._err && !PREWARM) news(`🔧 ${IT ? IT.name : 'Айтишник'} из 314 починил компьютер в ${roomById(p.room)?.num || 'классе'}`); p._err = p.err; } });
}

// ---------- звуки ----------
const SND: any = { on: false, C: null, master: null, voices: [], noise: null, keyAcc: 0, birdAcc: 0, siren: null, musicAcc: 0 };
function sndInit() {
  if (SND.C) return; const C = SND.C = actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  SND.master = C.createGain(); SND.master.gain.value = 0.8; SND.master.connect(C.destination);
  const len = C.sampleRate * 2, b = C.createBuffer(1, len, C.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; SND.noise = b;
  for (let v = 0; v < 4; v++) { // гул голосов: шум через полосовой фильтр, промодулированный «слогами»
    const src = C.createBufferSource(); src.buffer = b; src.loop = true; src.playbackRate.value = 0.9 + v * 0.07;
    const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380 + v * 170; bp.Q.value = 2.2;
    const am = C.createGain(); am.gain.value = 0; const lfo = C.createOscillator(); lfo.frequency.value = 3.1 + v * 0.9; const lg = C.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain); lfo.start();
    const g = C.createGain(); g.gain.value = 0; src.connect(bp).connect(am).connect(g).connect(SND.master); src.start(); SND.voices.push({ g, am, base: 0.5 });
  }
  const road = C.createBufferSource(); road.buffer = b; road.loop = true; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; const rg = C.createGain(); rg.gain.value = 0; road.connect(lp).connect(rg).connect(SND.master); road.start(); SND.road = rg;
}
function sndClick(vol) { const C = SND.C, s = C.createBufferSource(); s.buffer = SND.noise; const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500 + Math.random() * 2000; const g = C.createGain(); const t = C.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); s.connect(hp).connect(g).connect(SND.master); s.start(t, Math.random() * 1.5, 0.04); }
function sndBird(vol) { const C = SND.C, t0 = C.currentTime; const n = 2 + Math.floor(Math.random() * 4), f0 = 2600 + Math.random() * 1600; for (let k = 0; k < n; k++) { const o = C.createOscillator(), g = C.createGain(); const t = t0 + k * (0.11 + Math.random() * 0.05); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), t + 0.05); o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.09); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g).connect(SND.master); o.start(t); o.stop(t + 0.11); } }
function sndPluck(freq, vol, t?) { const C = SND.C; t = t || C.currentTime; const o = C.createOscillator(), o2 = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter(); o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = freq; o2.frequency.value = freq * 1.003; lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.4); const g2 = C.createGain(); g2.gain.value = 0.25; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(SND.master); o.start(t); o2.start(t); o.stop(t + 0.75); o2.stop(t + 0.75); }
function sndSiren() {
  if (!SND.on || !SND.C) return; const C = SND.C, t = C.currentTime, D = 12;
  const o = C.createOscillator(), g = C.createGain(); o.type = 'sawtooth'; for (let k = 0; k < D; k++) { o.frequency.setValueAtTime(620, t + k); o.frequency.linearRampToValueAtTime(1180, t + k + 0.5); o.frequency.linearRampToValueAtTime(620, t + k + 1); }
  const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.2); g.gain.setValueAtTime(0.06, t + D - 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + D); o.connect(lp).connect(g).connect(SND.master); o.start(t); o.stop(t + D);
}
const PENTA = [293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
function sndFrame(dt) {
  if (!SND.on || !SND.C || PREWARM) return;
  const tg = controls.target, X = tg.x, Y = -tg.z, camD = camera.position.distanceTo(tg); const near = Math.max(0.08, Math.min(1, 26 / camD));
  let chat = 0, typing = 0, out = 0;
  const fpvF = FPV.on ? FPV.f : null;
  for (const n of NPCS) { if (!n.spawned || n.hidden) continue; if (fpvF != null && n.f !== fpvF) continue; const d = Math.hypot(n.x - (FPV.on ? FPV.x : X), n.y - (FPV.on ? FPV.y : Y)); if (d > 22) continue; const w = 1 - d / 22; const T = n.tasks[0]; if (n.sub === 'talk' || (T && (T.t === 'chat' || T.t === 'queue'))) chat += w; else if (!(T && T.t === 'sit' && T.kind === 'lesson')) chat += w * 0.25; if (n.sub === 'type') typing += w; if (n.f === 3) out += w; }
  const crowd = Math.min(1, chat / 14) * near;
  SND.voices.forEach((v, i) => { v.g.gain.setTargetAtTime(crowd * (0.11 + i * 0.015), SND.C.currentTime, 0.4); });
  const el = sunPos(simT).el; const roadNear = Math.max(0, 1 - Math.min(Math.abs(X - -36), Math.abs(Y - STR.TK)) / 45);
  SND.road.gain.setTargetAtTime((0.05 + roadNear * 0.08) * (simT > 360 && simT < 1380 ? 1 : 0.3) * Math.min(1, near * 1.5), SND.C.currentTime, 0.6);
  SND.keyAcc += dt * typing * 2.2 * near; while (SND.keyAcc > 1) { SND.keyAcc -= 1; sndClick(0.05 + Math.random() * 0.06); }
  const season = seasonOf(SUN.doy); const outdoor = !FPV.on ? camera.position.y > 4 || curFloor === 'all' : FPV.f === 3;
  if (el > 2 && season !== 'winter' && outdoor && !WX.bad) { SND.birdAcc += dt; if (SND.birdAcc > 2.5 + Math.random() * 5) { SND.birdAcc = 0; sndBird(0.025 + Math.random() * 0.03); } }
  // музыка на празднике
  const P = PERIOD(); const concert = (P === 'nooruz' && simT >= 660 && simT < 800) || (P === 'newyear' && simT >= 660 && simT < 960) || (P === 'grad' && simT >= 724 && simT < 900);
  if (concert && STAGE.x != null) { const ds = Math.hypot(STAGE.x - (FPV.on ? FPV.x : X), STAGE.y - (FPV.on ? FPV.y : Y)); const vol = Math.max(0, 1 - ds / 60) * 0.09 * near; SND.musicAcc += dt; const step = P === 'newyear' ? 0.32 : 0.22; if (vol > 0.004 && SND.musicAcc > step) { SND.musicAcc = 0; const f = P === 'newyear' ? [392, 392, 440, 392, 523.3, 493.9][Math.floor(propT / step) % 6] : pick(PENTA); if (chance(0.85)) sndPluck(f * (chance(0.15) ? 0.5 : 1), vol); } }
}

// ---------- прогулка от первого лица ----------
const FPV = { on: false, f: 3, x: 0, y: 0, yaw: 0, pitch: -0.05, eye: 1.62, drag: null, save: null, move: { f: 0, s: 0 }, trans: null, cool: 0, bob: 0 };
window.fpvOn = false;
function fpvStart() {
  if (FPV.on) return fpvStop();
  let f = curFloor === 'all' ? 3 : +curFloor; let x = controls.target.x, y = -controls.target.z;
  let q = nearestPass(f, x, y, 60); if (!q || (f === 3 && cellV(3, q[0], q[1]) !== -2)) { f = 3; const e = ENTR[0]; x = e.out[0]; y = e.out[1] - 3; q = nearestPass(3, x, y, 30); }
  if (!q) return;
  FPV.save = { p: camera.position.clone(), t: controls.target.clone(), floor: curFloor, ex: explode };
  if (explode) { explode = false; document.getElementById('cExplode').checked = false; }
  setFloor('all'); tween = null; document.getElementById('cRoof').checked = true; applyVis();
  FPV.f = f; FPV.x = wx(q[0]); FPV.y = wy(q[1]);
  const dir = controls.target.clone().sub(camera.position); FPV.yaw = Math.atan2(-dir.z, dir.x); FPV.pitch = -0.05;
  FPV.on = true; window.fpvOn = true; controls.enabled = false; followN = null; camera.fov = 62; camera.updateProjectionMatrix();
  document.body.classList.add('fpv'); document.getElementById('fpvBtn')?.classList.add('on'); document.body.classList.remove('menu-open', 'exp-open');
}
function fpvStop() {
  FPV.on = false; window.fpvOn = false; controls.enabled = true; camera.fov = 40; camera.updateProjectionMatrix();
  if (FPV.save) { camera.position.copy(FPV.save.p); controls.target.copy(FPV.save.t); setFloor(FPV.save.floor); }
  document.body.classList.remove('fpv'); document.getElementById('fpvBtn')?.classList.remove('on');
}
function fpvFloorBtns() {
  const out = []; if (FPV.f === 3) { for (const e of ENTR) if (Math.hypot(e.out[0] - FPV.x, e.out[1] - FPV.y) < 2.2) out.push(['in', 'Войти в корпус', e]); return out; }
  if (FPV.f === 0) for (const e of ENTR) if (Math.hypot(e.in[0] - FPV.x, e.in[1] - FPV.y) < 2.2) out.push(['out', 'Выйти во двор', e]);
  for (const s of STAIRS) { if (s.f === FPV.f && Math.hypot(s.lo[0] - FPV.x, s.lo[1] - FPV.y) < 2.4) out.push(['up', `⬆ На ${FPV.f + 2} этаж`, s]); if (s.f === FPV.f - 1 && Math.hypot(s.hi[0] - FPV.x, s.hi[1] - FPV.y) < 2.4) out.push(['down', `⬇ На ${FPV.f} этаж`, s]); }
  return out;
}
function fpvGo(kind, o) {
  if (FPV.trans) return; const z0 = FPV.f === 3 ? OUTZ : FZ[FPV.f];
  let pts;
  if (kind === 'in') pts = [[o.out[0], o.out[1], OUTZ, 3], [o.in[0], o.in[1], 0, 0]];
  else if (kind === 'out') pts = [[o.in[0], o.in[1], 0, 0], [o.out[0], o.out[1], OUTZ, 3]];
  else if (kind === 'up') pts = [[o.lo[0], o.lo[1], FZ[o.f], o.f], [o.land[0], o.land[1], FZ[o.f] + 1.5, o.f], [o.hi[0], o.hi[1], FZ[o.f] + 3, o.f + 1]];
  else pts = [[o.hi[0], o.hi[1], FZ[o.f] + 3, o.f + 1], [o.land[0], o.land[1], FZ[o.f] + 1.5, o.f], [o.lo[0], o.lo[1], FZ[o.f], o.f]];
  FPV.trans = { pts: [[FPV.x, FPV.y, z0, FPV.f], ...pts], k: 0, u: 0 };
}
let fpvHudKey = '';
function fpvFrame(dt) {
  if (!FPV.on) return;
  const K: any = keys; let fw = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0) + FPV.move.f, st = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0) + FPV.move.s;
  const turn = (K.ArrowRight || K.KeyE ? 1 : 0) - (K.ArrowLeft || K.KeyQ ? 1 : 0); FPV.yaw -= turn * dt * 1.6;
  let z;
  if (FPV.trans) {
    const T = FPV.trans; const a = T.pts[T.k], b = T.pts[T.k + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] - a[2]) * 1.5) || 0.1; T.u += dt * 1.5 / L;
    if (T.u >= 1) { T.k++; T.u = 0; if (T.k >= T.pts.length - 1) { const e = T.pts[T.pts.length - 1]; FPV.x = e[0]; FPV.y = e[1]; FPV.f = e[3]; FPV.trans = null; } }
    if (FPV.trans) { const u = T.u, A = T.pts[T.k], B = T.pts[T.k + 1]; FPV.x = A[0] + (B[0] - A[0]) * u; FPV.y = A[1] + (B[1] - A[1]) * u; z = A[2] + (B[2] - A[2]) * u; FPV.yaw = lerpAng(FPV.yaw, Math.atan2(B[1] - A[1], B[0] - A[0]), Math.min(1, dt * 4)); FPV.bob += dt * 8; }
  }
  if (!FPV.trans) {
    const sp = (K.ShiftLeft || K.ShiftRight ? 3.2 : 1.5) * dt; const c = Math.cos(FPV.yaw), s = Math.sin(FPV.yaw);
    const mx = (c * fw + s * st) * sp, my = (s * fw - c * st) * sp;
    const ok = (x, y) => { const v = cellV(FPV.f, cx(x), cy(y)); if (v === -1) return false; for (const [ox, oy] of [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]]) if (cellV(FPV.f, cx(x + ox), cy(y + oy)) === -1) return false; return true; };
    if (mx || my) { if (ok(FPV.x + mx, FPV.y + my)) { FPV.x += mx; FPV.y += my; } else if (ok(FPV.x + mx, FPV.y)) FPV.x += mx; else if (ok(FPV.x, FPV.y + my)) FPV.y += my; FPV.bob += dt * (K.ShiftLeft ? 12 : 8); }
    z = FPV.f === 3 ? OUTZ : FZ[FPV.f];
  }
  const eye = z + FPV.eye + Math.sin(FPV.bob) * 0.025;
  camera.position.set(FPV.x, eye, -FPV.y);
  const cp = Math.cos(FPV.pitch); const look = new THREE.Vector3(FPV.x + Math.cos(FPV.yaw) * cp, eye + Math.sin(FPV.pitch), -(FPV.y + Math.sin(FPV.yaw) * cp));
  camera.lookAt(look); controls.target.copy(look);
  const hud = document.getElementById('fpvAct'); const btns = FPV.trans ? [] : fpvFloorBtns(); const key = btns.map(b => b[0] + b[1]).join('|') + FPV.f;
  if (hud && key !== fpvHudKey) { fpvHudKey = key; hud.innerHTML = btns.map((b, i) => `<button data-i="${i}">${b[1]}</button>`).join(''); hud.querySelectorAll('button').forEach(el => el.onclick = () => { const b = fpvFloorBtns()[+el.dataset.i]; if (b) fpvGo(b[0], b[2]); }); }
  const where = document.getElementById('fpvWhere'); if (where) { const r = FPV.f < 3 ? ROOMS[roomAt(FPV.f, FPV.x, FPV.y)] : null; where.textContent = FPV.f === 3 ? 'Двор корпуса' : `${FPV.f + 1} этаж${r && r.kind !== 'corridor' ? ' · ' + (r.num ? r.num + ' ' : '') + r.name.toLowerCase() : ' · коридор'}`; }
}
function fpvUI() {
  const hud = document.createElement('div'); hud.id = 'fpvHud';
  hud.innerHTML = `<div class="fpvTop"><b id="fpvWhere"></b><button id="fpvExit">✕ Выйти из прогулки</button></div>
  <div id="fpvAct"></div>
  <div class="fpvPad"><button data-m="f">▲</button><div><button data-m="l">◀</button><button data-m="b">▼</button><button data-m="r">▶</button></div></div>
  <div class="fpvHint">W A S D — идти · мышь — смотреть · Shift — быстрее · у входа и лестниц появятся кнопки</div>`;
  host.appendChild(hud);
  document.getElementById('fpvExit').onclick = fpvStop;
  hud.querySelectorAll('.fpvPad button').forEach(b => { const m = b.dataset.m; const set = v => { if (m === 'f') FPV.move.f = v; if (m === 'b') FPV.move.f = -v; if (m === 'l') FPV.move.s = -v; if (m === 'r') FPV.move.s = v; };
    b.addEventListener('pointerdown', e => { e.preventDefault(); set(1); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => set(0))); });
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', e => { if (FPV.on) FPV.drag = [e.clientX, e.clientY, FPV.yaw, FPV.pitch]; });
  addEventListener('pointermove', e => { if (!FPV.on || !FPV.drag) return; const [x0, y0, yw, pt] = FPV.drag; FPV.yaw = yw + (e.clientX - x0) * 0.0042; FPV.pitch = Math.max(-1.1, Math.min(1.0, pt - (e.clientY - y0) * 0.0035)); });
  addEventListener('pointerup', () => FPV.drag = null);
}

// ---------- админка (режим директора) и общее хранилище ----------
let DB = null, DOC = null, IS_ADMIN = false, dbBusy = false, dbDirty = false, dbOK = null, lastState = {};
function stateOut() { return { period: EV.period, weather: EV.weather, crowd: EV.crowd, announce: EV.announce, sched: EV.sched, names: EV.names, ev: EV.lastEv || null }; }
async function saveState() {
  if (!DOC) return; if (dbBusy) { dbDirty = true; return; }
  dbBusy = true; try { await DOC.set(stateOut()); dbOK = true; } catch (e) { dbOK = false; console.warn('db', e && e.code); } dbBusy = false; setSync();
  if (dbDirty) { dbDirty = false; saveState(); }
}
function setSync() { const el = document.getElementById('admSync'); if (!el) return; el.textContent = !DOC ? '· только у вас' : dbOK === false ? '· нет связи' : '· видят все'; el.title = !DOC ? 'Хранилище недоступно: изменения видны только в этом окне' : 'Изменения сохраняются и видны всем, кто открыл ссылку'; }
function applyState(d) {
  if (!d) return; const pe = PERIOD();
  if (d.period && d.period !== EV.period) { EV.period = d.period; }
  if (d.weather && d.weather !== EV.weather) { EV.weather = d.weather; applyWeather(); }
  if (typeof d.crowd === 'number' && d.crowd !== EV.crowd) { EV.crowd = d.crowd; applyCrowd(); }
  EV.announce = d.announce && d.announce.text ? d.announce : null; renderNews();
  if (Array.isArray(d.sched)) EV.sched = d.sched.filter(s => EV_DEF[s.type] && typeof s.m === 'number');
  if (d.names && typeof d.names === 'object') { EV.names = d.names; applyNames(); }
  if (PERIOD() !== pe) periodChanged();
  if (d.ev && d.ev.key && d.ev.key !== EV.lastKey) {
    EV.lastKey = d.ev.key; EV.lastEv = d.ev;
    if (d.ev.type === 'stop') { if (EV.cur) stopEvent(); }
    else if (liveMode && EV_DEF[d.ev.type]) { const el = (Date.now() - d.ev.at) / 60000; if (el >= 0 && el < EV_DEF[d.ev.type].dur && (!EV.cur || EV.cur.type !== d.ev.type)) startEvent(d.ev.type, { elapsed: Math.min(el, 2) }); }
  }
  syncAdminInputs();
}
function applyNames() { Object.entries(EV.names).forEach(([id, v]) => { const n = NPCS[+id]; if (!n || !v) return; if ((v as any).name) n.name = String((v as any).name).slice(0, 30); if ((v as any).surname != null) n.surname = String((v as any).surname).slice(0, 40); if ((v as any).arch && ARCH[(v as any).arch] && n.role === 'student') setArch(n, (v as any).arch); }); }
function applyWeather() { const doy = SUN.doy; if (EV.weather === 'auto') pickWeather(doy, simDow); else { WX.kind = EV.weather; WX.bad = WX.kind === 'rain' || WX.kind === 'snow'; buildPrecip(); } skyT = -99; }
function applyCrowd() { STUDENTS.forEach(s => { if (s.spawned && s.crowdR > EV.crowd && !s.leaving) { s.leaving = true; interrupt(s); leave(s, 'ушёл по делам'); } if (s.crowdR <= EV.crowd) s.leaving = false; }); }
function periodChanged() { const t = simT; if (liveMode) { PREWARM = true; prewarm(t); PREWARM = false; } else { resetDay(); simT = t; } updAdmin(); renderNews(); }
async function evConnect() {
  if (KGU && KGU.stateUrl) { kguPoll(); setInterval(kguPoll, 4000); if (KGU.staff) kguLink(); return; }
  const local = location.protocol === 'file:' && location.search.includes('admin');
  try {
    const cl = window.claude;
    if (cl && cl.use) {
      const [db, user] = await Promise.all([cl.use('db').catch(() => null), cl.use('user').catch(() => null)]);
      if (user) { try { IS_ADMIN = !!(await user.canEdit()); } catch (e) { } }
      if (db) {
        DB = db; DOC = db.doc('kgu/state'); let first = true; const to = setTimeout(() => { if (first) { dbOK = false; setSync(); } }, 10000);
        DOC.onSnapshot(s => { if (!s.fromCache) { clearTimeout(to); dbOK = true; } first = false; const d = s.exists ? s.data() : null; if (d) applyState(d); setSync(); }, e => { clearTimeout(to); dbOK = false; setSync(); });
      }
    }
  } catch (e) { }
  if (local) IS_ADMIN = true;
  if (IS_ADMIN) adminUI();
}
// --- режим сервера института (Django): состояние читаем с /api/state/ ---
let kguStamp = '';
async function kguPoll() { try { const r = await fetch(KGU.stateUrl, { cache: 'no-store', credentials: 'same-origin' }); if (!r.ok) return; const d = await r.json(); if (d.roster_version && KGU.rosterVersion && d.roster_version !== KGU.rosterVersion && !kguStamp) { kguStamp = 'x'; const b = document.getElementById('liveBan'); if (typeof toast === 'function') toast('Список студентов обновился — перезагрузите страницу'); } applyState(d); dbOK = true; } catch (e) { dbOK = false; } }
function kguLink() { const box = document.createElement('div'); box.className = 'grp'; box.id = 'adminBox'; box.innerHTML = `<div class="lbl">👑 Режим директора</div><div class="ns">Вы вошли как ${kClean(KGU.user) || 'сотрудник'}. События, объявления и списки студентов — в панели управления.</div><div class="seg" style="margin-top:8px"><a class="btnA" href="/panel/">⚙ Панель управления</a></div>`; const sb = document.getElementById('simBox'); sb.after(box); const st = document.createElement('style'); st.textContent = '.btnA{display:inline-block;padding:7px 12px;border-radius:8px;background:var(--accent);color:var(--accent-fg);text-decoration:none;font-size:13px;font-weight:500}'; document.head.appendChild(st); }
function adminUI() {
  if (document.getElementById('adminBox')) return;
  const box = document.createElement('div'); box.className = 'grp'; box.id = 'adminBox';
  const evBtns = Object.entries(EV_DEF).map(([k, d]) => `<button data-ev="${k}" title="${d.name}">${d.icon} ${d.name.replace('Пожарная ', '').replace('Проверка комиссии', 'Комиссия').replace('День открытых дверей', 'Открытые двери').replace('Отключение света', 'Нет света').replace('Хакатон ИНИТ', 'Хакатон')}</button>`).join('');
  box.innerHTML = `<div class="lbl">👑 Режим директора <span id="admSync"></span></div>
  <label class="arow">День <select id="admPeriod">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
  <div class="seg" id="admEv">${evBtns}<button data-ev="stop" id="admStop">⏹ Стоп</button></div>
  <label class="arow">Погода <select id="admWx"><option value="auto">Авто, по сезону</option><option value="clear">☀ Ясно</option><option value="cloudy">☁ Облачно</option><option value="rain">🌧 Дождь</option><option value="snow">❄ Снег</option></select></label>
  <label class="arow">Студентов <input type="range" id="admCrowd" min="10" max="100" step="10" value="100"><b id="admCrowdV">100%</b></label>
  <div class="arow"><input id="admAnn" maxlength="140" placeholder="Объявление на весь корпус…"><button id="admAnnGo" title="Показать всем">📢</button><button id="admAnnX" title="Убрать">✕</button></div>
  <details id="admSchD"><summary>⏰ Запланировать событие</summary><div class="arow"><select id="admSchT">${Object.entries(EV_DEF).map(([k, d]) => `<option value="${k}">${d.icon} ${d.name}</option>`).join('')}</select><input type="time" id="admSchAt" value="15:00"><button id="admSchAdd">+</button></div><div id="admSchList"></div></details>
  <div class="note" style="margin-top:0">Панель видите только вы. Остальные по ссылке видят праздники, события и объявления, но ничего не меняют.</div>`;
  const ctrl = document.getElementById('ctrl'); const sb = document.getElementById('simBox'); ctrl.insertBefore(box, sb.nextSibling);
  box.querySelectorAll('#admEv button').forEach(b => b.onclick = () => {
    const k = b.dataset.ev; const key = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    EV.lastKey = key; EV.lastEv = { type: k, at: Date.now(), key };
    if (k === 'stop') stopEvent(); else if (EV.cur && EV.cur.type === k) { stopEvent(); EV.lastEv = { type: 'stop', at: Date.now(), key }; } else startEvent(k, { by: 'admin' });
    if (!liveMode && k !== 'stop') toast(`${EV_DEF[k].icon} Событие запущено у вас. Зрители увидят его, когда вы в режиме «● Сейчас»`);
    saveState();
  });
  document.getElementById('admPeriod').onchange = e => { const pe = PERIOD(); EV.period = e.target.value; if (PERIOD() !== pe) periodChanged(); saveState(); };
  document.getElementById('admWx').onchange = e => { EV.weather = e.target.value; applyWeather(); saveState(); };
  const cr = document.getElementById('admCrowd'); cr.oninput = () => { document.getElementById('admCrowdV').textContent = cr.value + '%'; }; cr.onchange = () => { EV.crowd = +cr.value / 100; applyCrowd(); saveState(); };
  document.getElementById('admAnnGo').onclick = () => { const v = document.getElementById('admAnn').value.trim(); if (!v) return; EV.announce = { text: v.slice(0, 140), at: Date.now() }; renderNews(); toast('📢 ' + v); saveState(); };
  document.getElementById('admAnnX').onclick = () => { EV.announce = null; document.getElementById('admAnn').value = ''; renderNews(); saveState(); };
  document.getElementById('admSchAdd').onclick = () => { const [h, m] = (document.getElementById('admSchAt').value || '15:00').split(':').map(Number); EV.sched.push({ type: document.getElementById('admSchT').value, m: h * 60 + m }); EV.sched.sort((a, b) => a.m - b.m); renderSched(); saveState(); };
  setSync(); syncAdminInputs(); updAdmin();
}
function renderSched() { const el = document.getElementById('admSchList'); if (!el) return; el.innerHTML = EV.sched.length ? EV.sched.map((s, i) => `<div class="sch">${hhmm(s.m)} · ${EV_DEF[s.type].icon} ${EV_DEF[s.type].name} <span class="ns">каждый учебный день</span><button data-i="${i}" aria-label="Удалить">✕</button></div>`).join('') : '<div class="ns">Пока ничего не запланировано</div>'; el.querySelectorAll('button').forEach(b => b.onclick = () => { EV.sched.splice(+b.dataset.i, 1); renderSched(); saveState(); }); }
function syncAdminInputs() {
  const p = document.getElementById('admPeriod'); if (!p) return; p.value = EV.period; document.getElementById('admWx').value = EV.weather;
  const c = document.getElementById('admCrowd'); c.value = Math.round(EV.crowd * 100); document.getElementById('admCrowdV').textContent = c.value + '%';
  const a = document.getElementById('admAnn'); if (document.activeElement !== a) a.value = EV.announce ? EV.announce.text : ''; renderSched();
}
function updAdmin() { document.querySelectorAll('#admEv button').forEach(b => b.classList.toggle('on', !!EV.cur && b.dataset.ev === EV.cur.type)); const st = document.getElementById('admStop'); if (st) st.disabled = !EV.cur; }
// редактор человечка (только директор)
let editN = null;
function editorFrame() {
  const box = document.getElementById('npcEdit'); if (!box) return;
  const n = IS_ADMIN && selN && (selN.role === 'student' || selN.role === 'teacher') ? selN : null;
  if (n === editN) return; editN = n;
  if (!n) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  box.innerHTML = `<div class="lbl">✏️ Изменить человечка</div><div class="arow"><input id="edName" maxlength="30" placeholder="Имя"><input id="edSur" maxlength="40" placeholder="Фамилия"></div>
  ${n.role === 'student' ? `<label class="arow">Характер <select id="edArch">${Object.entries(ARCH).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>` : ''}
  <div class="seg"><button id="edSave">Сохранить</button></div><div class="ns">Так можно посадить в модель свою группу с настоящими именами.</div>`;
  document.getElementById('edName').value = n.name; document.getElementById('edSur').value = n.surname; const ar = document.getElementById('edArch'); if (ar) ar.value = n.arch || 'obs';
  document.getElementById('edSave').onclick = () => { const v: any = { name: document.getElementById('edName').value.trim() || n.name, surname: document.getElementById('edSur').value.trim() }; if (ar) v.arch = ar.value; EV.names[n.id] = v; applyNames(); toast(`✏️ Сохранено: ${v.name} ${v.surname}`); cardTick = 9; saveState(); };
}

// ---------- обвязка: подключаемся к симуляции ----------
const _decide0 = decide; decide = n => { if (evDecide(n)) return; _decide0(n); };
const _lessonFor0 = lessonFor; lessonFor = (n, p) => noClasses() ? null : _lessonFor0(n, p);
const _runTask0 = runTask; runTask = (n, dt) => { const T = n.tasks[0]; if (T && EXT_TASK[T.t]) { n.hidden = false; EXT_TASK[T.t](n, T, dt); return; } _runTask0(n, dt); };
const _seat0 = seatedBehaviour; seatedBehaviour = (n, T, dt) => {
  const before = n.subNext; _seat0(n, T, dt);
  if (n.subNext === before) return;
  const E = EV.cur, P = PERIOD(), pc = n.seat && n.seat.pc >= 0, r = rnd();
  if (T.kind === 'hack') { n.sub = r < 0.72 ? 'type' : r < 0.9 ? 'talk' : 'phone'; if (n.sub === 'talk' && chance(0.4)) say(n, 'hack', 2.6); if (n.sub === 'type') n.st.code++; return; }
  if (n.role !== 'student') return;
  if (E && E.type === 'power' && n.f < 3) { n.sub = r < 0.55 ? 'phone' : r < 0.85 ? 'talk' : 'sleep'; return; }
  if (E && E.type === 'wifi' && pc) { n.sub = r < 0.22 ? 'hand' : r < 0.55 ? 'talk' : r < 0.85 ? 'phone' : 'type'; if (n.sub === 'hand') say(n, 'wifi', 2.6); return; }
  if (P === 'session' && T.kind === 'lesson') { n.sub = r < 0.72 ? (pc ? 'type' : 'write') : r < 0.85 ? 'listen' : r < 0.93 ? 'phone' : 'hand'; if (n.sub === 'phone' && chance(0.3)) { const tch = NPCS.find(m => m.role === 'teacher' && m.tasks[0] && m.tasks[0].t === 'teach' && m.tasks[0].room.id === roomAt(n.f, n.x, n.y)); if (tch) say(tch, 'Это шпаргалка? Убери телефон!', 3); } if (n.sub === 'hand') say(n, 'Можно ответить?', 2.4); }
};
const _pcTick0 = pcTick; pcTick = () => { _pcTick0(); pcExtra(); };
const _reset0 = resetDay; resetDay = () => { _reset0(); if (EV.cur) stopEvent(true); TOURS.length = 0; QUEUE.list.length = 0; NPCS.forEach(n => { n.tour = null; n.performer = null; n.near = false; n.done = false; n.ate = false; n.leaving = false; }); if (NPCS.length && STUDENTS.length) evDayPlan(); EV.prevT = null; };
const _simTick0 = simTick; simTick = dt => { _simTick0(dt); evTick(dt); };
const _prewarm0 = prewarm; prewarm = target => { PREWARM = true; try { _prewarm0(target); } finally { PREWARM = false; } renderNews(); };
const _jump0 = jumpTo; jumpTo = fn => { PREWARM = true; try { _jump0(fn); } finally { PREWARM = false; } renderNews(); };
const _pose0 = poseNPC; poseNPC = (n, i, vis) => { _pose0(n, i, vis); poseExtras(n, i, vis); };
const _card0 = cardHTML; cardHTML = n => { let h = _card0(n); if (n.arch && n.role === 'student') h = h.replace('<div class="na">', `<div class="ns">🎭 ${ARCH[n.arch]}${n.love != null ? ` · ${n.quarrel ? '💔 поссорился' : '❤️ встречается'} с ${NPCS[n.love].name}` : ''}${n.hack ? ` · 💻 хакатон, «${n.team.name}»` : ''}</div><div class="na">`); return h; };
const _yardSpot0 = yardSpot; yardSpot = (x, y, r) => { const P = PERIOD(); const hot = P === 'newyear' && PROPS.treeP ? { ...PROPS.treeP, r: 9 } : (P === 'nooruz' || P === 'grad') && STAGE.x != null ? { x: STAGE.x + STAGE.dx * 6, y: STAGE.y + STAGE.dy * 6, r: 10 } : null; if (hot && chance(0.6)) return _yardSpot0(hot.x, hot.y, hot.r); return _yardSpot0(x, y, r); };
const _yardHang0 = yardHang; yardHang = (n, dur) => {
  if (n.love != null && !n.quarrel) { const p = NPCS[n.love]; if (p.spawned && p.f === 3 && p.conv && p.conv.f === 3 && p.conv.members.length < 6 && joinConv(n, p.conv, 'гуляет вдвоём во дворе ❤️')) return true; }
  return _yardHang0(n, dur);
};
const _updateUI0 = updateUI; updateUI = () => {
  _updateUI0(); const el = document.getElementById('evStat'); if (!el) return;
  const P = PERIOD(), E = EV.cur; const bits = [];
  if (P !== 'normal') bits.push(`<b>${{ session: '📝 Сессия', nooruz: '🌸 Нооруз', newyear: '🎄 Новогодняя неделя', grad: '🎓 Выпускной', vacation: '🏖 Каникулы' }[P]}</b>`);
  if (E) bits.push(`<b class="evOn">${EV_DEF[E.type].icon} ${EV_DEF[E.type].name}</b> до ${hhmm(E.end)}`);
  const html = bits.join(' · '); if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; el.style.display = html ? 'block' : 'none'; }
  document.body.classList.toggle('alarm', !!E && E.type === 'alarm' && simT - E.t0 < 4);
  editorFrame();
};
const _simFrame0 = simFrame; simFrame = () => { const now = performance.now(); const dt = Math.min(0.1, (now - ((simFrame as any)._t || now)) / 1000); (simFrame as any)._t = now; _simFrame0(); propsFrame(dt); moodFrame(); sndFrame(dt); fpvFrame(dt); if (QUEUE.mesh) QUEUE.mesh.position.y = FZ[2] + floorYOff(2); if (QUEUE.mesh) QUEUE.mesh.visible = floorVis(2); };

function evUI() {
  const box = document.getElementById('simBox');
  const row = document.createElement('div'); row.className = 'seg';
  row.innerHTML = `<button id="sSound">🔇 Звуки</button><button id="fpvBtn">🚶 Пройтись самому</button>`;
  box.appendChild(row);
  const bell = document.getElementById('sBell'); if (bell) bell.style.display = 'none';
  document.getElementById('sSound').onclick = e => { SND.on = !SND.on; bellSound = SND.on; if (SND.on) { sndInit(); SND.C.resume && SND.C.resume(); SND.master.gain.value = 0.8; } else if (SND.master) SND.master.gain.value = 0; e.target.textContent = SND.on ? '🔊 Звуки' : '🔇 Звуки'; e.target.classList.toggle('on', SND.on); };
  document.getElementById('fpvBtn').onclick = fpvStart;
  const tg = document.createElement('label'); tg.className = 'tog'; tg.innerHTML = '<input type="checkbox" id="cMoods" checked> Эмоции над головами'; box.appendChild(tg);
  document.getElementById('cMoods').onchange = e => showMoods = e.target.checked;
  const st = document.createElement('div'); st.id = 'evStat'; st.className = 'sstat'; document.getElementById('sStat').after(st);
  newsEl = document.createElement('div'); newsEl.id = 'ticker'; newsEl.innerHTML = '<em>Новости корпуса</em><div class="tkw"><div class="tk"></div></div>'; host.appendChild(newsEl); newsEl.style.display = 'none';
  const ed = document.createElement('div'); ed.id = 'npcEdit'; document.getElementById('npcCard').after(ed);
  const fx = document.createElement('div'); fx.id = 'alarmFx'; host.appendChild(fx);
  fpvUI();
}
function evInit__base() {
  buildQueue(); buildProps(); evUI();
  if (R_COWORK && QUEUE.pts.length) {
    // буфет: студенты идут через очередь
  }
  evDayPlan();
  evConnect();
}
