// Точки расширения. Модули (events, brain, doors…) оборачивают эти функции:
//   const prev = simFrame; simFrame = () => { prev(); ... };
// Базовые реализации называются NAME__base и объявлены в своих файлах.
// Этот файл идёт первым в сборке: объявления функций всплывают (hoisting), поэтому присваивания безопасны.
var cardHTML = cardHTML__base;
var convTick = convTick__base;
var decide = decide__base;
var decideStudent = decideStudent__base;
var evInit = evInit__base;
var jumpTo = jumpTo__base;
var lessonFor = lessonFor__base;
var pcTick = pcTick__base;
var poseNPC = poseNPC__base;
var prewarm = prewarm__base;
var resetDay = resetDay__base;
var runTask = runTask__base;
var seatedBehaviour = seatedBehaviour__base;
var simFrame = simFrame__base;
var simTick = simTick__base;
var startGo = startGo__base;
var teachBehaviour = teachBehaviour__base;
var updateUI = updateUI__base;
var yardHang = yardHang__base;
var yardSpot = yardSpot__base;
