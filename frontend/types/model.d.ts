// Основные типы модели корпуса. Поля, которые ещё не описаны, доступны через индекс [key: string]: any —
// так код можно типизировать постепенно, не ломая работающую симуляцию.

/** Точка на плане этажа: x — на восток, y — на север (метры). */
type XY = [number, number];

/** Помещение из IFC-модели (sim.json → rooms). */
interface Room {
  id: number;
  /** Этаж: 0, 1, 2 (3 этаж — ИНИТ) или 3 — двор. */
  f: number;
  /** Число ячеек сетки, занятых помещением. */
  n: number;
  /** Центр помещения. */
  c: XY;
  /** Габарит: [x0, y0, x1, y1]. */
  bb: [number, number, number, number];
  kind: string;
  num: string;
  name: string;
  cnt?: Record<string, number>;
  [key: string]: any;
}

interface Seat { id: number; f: number; room: number; p: XY; z: number; a: number; pc: number; office: boolean; [key: string]: any; }
interface Board { room: number; f: number; p: XY; t: XY; a: number; }
interface PC { id: number; f: number; room: number; c: [number, number, number]; bb: number[]; imac: boolean; [key: string]: any; }
interface Stair { f: number; lo: XY; hi: XY; land: XY; bb: [number, number, number, number]; }

/** Данные, извлечённые из IFC-модели при сборке (тег <script id="simdata">). */
interface SimData {
  /** Шаг сетки проходимости, м. */
  R: number;
  X0: number; Y0: number; NX: number; NY: number;
  floors: { f: number; z: number }[];
  rooms: Room[];
  seats: Seat[];
  boards: Board[];
  pcs: PC[];
  stairs: Stair[];
  entrances: { in: XY; out: XY }[];
  hide: string[];
  /** Сжатая (gzip + base64) сетка проходимости: −1 стена, −2 дверь, ≥0 номер помещения. */
  grid: string;
}

type Role = 'student' | 'teacher' | 'dean' | 'staff' | 'guard' | 'cleaner' | string;

/** Один человек в симуляции: студент, преподаватель, сотрудник. */
interface NPC {
  id: number;
  role: Role;
  /** Пол: 'm' | 'f'. */
  g: 'm' | 'f';
  name: string;
  surname: string;
  /** Появился в корпусе (иначе «дома»). */
  spawned: boolean;
  hidden?: boolean;
  /** Этаж и координаты на плане, z — высота. a — угол поворота. */
  f: number; x: number; y: number; z: number; a: number;
  /** Рост, м, и телосложение. */
  h: number; build: number;
  /** Очередь задач (идти, сидеть, говорить…). */
  tasks: any[];
  path: any;
  pi: number;
  speed: number;
  pose: string;
  /** Что сейчас делает — подпись в карточке. */
  act: string;
  say: string | null;
  needs: { energy: number; hunger: number; social: number; bladder: number };
  traits: { social: number; diligent: number; punctual: number; gamer: number; curious: number };
  friends: Map<number, number>;
  /** Учебная группа студента (объект группы с name, расписанием и т.д.). */
  group?: any;
  [key: string]: any;
}

/** Створка двери, вращается вокруг петли. */
interface DoorLeaf { pivot: THREE.Group; sgn: number; }

/** Дверь на 3 этаже: открывается, когда рядом кто-то есть. */
interface Door {
  f: number; x: number; y: number;
  leaves: DoorLeaf[];
  /** Текущее открытие 0..1 и цель. */
  open: number; want: number;
  /** Ширина проёма, м. */
  w: number;
  /** До какого времени (performance.now) держать открытой. */
  hold?: number;
}
