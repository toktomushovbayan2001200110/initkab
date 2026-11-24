// Сборка 3D-модели в один HTML-файл: TypeScript (уже скомпилированный tsc в build/) + шаблон + данные.
// Результат: ../campus/viewer/index.html (Django) и build/korpus-artifact.html (артефакт claude.ai).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

// Порядок важен: все файлы — один общий <script>, модули оборачивают функции предыдущих.
export const ORDER = ['hooks', 'core', 'sim', 'people', 'osm', 'world', 'events', 'design', 'brain', 'doors', 'campus', 'azamat', 'main'];

const app = ORDER.map((m) => `// ---- ${m}.ts ----\n` + read(`build/${m}.js`)).join('\n');
if (app.includes('</script')) throw new Error('В коде встретилось </script — сломает HTML');

let html = read('template.html');
const put = (key, value) => {
  if (!html.includes(key)) throw new Error(`В шаблоне нет ${key}`);
  html = html.split(key).join(value);
};
put('/*__APP__*/', app);
put('__SIM__', read('data/sim.json').replace(/<\//g, '<\\/'));
put('__DATA__', read('data/data.b64').trim());

writeFileSync(join(root, '../campus/viewer/index.html'), html);

// Вариант для артефакта: без doctype/head/body-обёртки, её добавляет claude.ai.
const art = html
  .replace('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n', '')
  .replace('<title>Живой корпус КГУ</title>', '<title>Живой корпус КГУ</title>\n<meta name="claude:viewport-fit-sides" content="cover">')
  .replace('</head>\n<body>\n', '')
  .replace('</body>\n</html>\n', '');
writeFileSync(join(root, 'build/korpus-artifact.html'), art);
console.log(`index.html: ${(html.length / 1e6).toFixed(2)} МБ, модулей: ${ORDER.length}`);

// Персонажи (GLB из Blender) лежат отдельными файлами: в Django — static/campus/npc, у артефакта — build/npc
for (const out of ['../campus/static/campus/npc', 'build/npc']) {
  mkdirSync(join(root, out), { recursive: true });
  for (const f of readdirSync(join(root, 'data/npc'))) if (f.endsWith('.glb')) copyFileSync(join(root, 'data/npc', f), join(root, out, f));
  // артефакт не раздаёт .glb — рядом кладём ту же модель как скрипт с base64
  if (out === 'build/npc') for (const f of readdirSync(join(root, 'data/npc'))) if (f.endsWith('.glb')) { const id = f.slice(0, -4); writeFileSync(join(root, out, id + '.js'), `(window.NPC_GLB=window.NPC_GLB||{})[${JSON.stringify(id)}]=${JSON.stringify(readFileSync(join(root, 'data/npc', f)).toString('base64'))};`); }
}
