// Сборка 3D-модели в один HTML-файл: TypeScript (уже скомпилированный tsc в build/) + шаблон + данные.
// Результат: ../campus/viewer/index.html (Django) и build/korpus-artifact.html (артефакт claude.ai).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

// Порядок важен: все файлы — один общий <script>, модули оборачивают функции предыдущих.
export const ORDER = ['hooks', 'core', 'sim', 'people', 'world', 'events', 'design', 'brain', 'doors', 'campus', 'main'];

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
