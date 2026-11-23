import random

from django.core.management.base import BaseCommand

from campus.models import Group, SiteState, Student, Teacher

GROUPS = ["ПИ-1-25", "ПИ-2-24", "ИВТ-1-25", "ИВТ-2-24", "ПМИ-1-25", "ИСТ-2-24", "ИБ-1-25", "ИБ-2-24", "ИВТ-3-23", "ПИ-3-23", "КИ-1-25", "ПИ-4-22"]
M_NAMES = ["Азамат", "Бакыт", "Нурлан", "Эрлан", "Тимур", "Данияр", "Айбек", "Улан", "Бекжан", "Мирлан", "Адилет", "Нурсултан", "Эмир", "Илим", "Кубат", "Самат"]
F_NAMES = ["Айгерим", "Айпери", "Бегимай", "Нурай", "Жибек", "Мээрим", "Айжан", "Асель", "Диана", "Алина", "Акылай", "Чолпон", "Гулина", "Бактыгуль", "Аяна", "Сезим"]
SURNAMES = ["Асанов", "Жумабеков", "Мамытов", "Абдыкадыров", "Осмонов", "Сыдыков", "Касымов", "Токтогулов", "Эсенов", "Бакиров", "Орозбеков", "Садыков", "Кадыров", "Исаков", "Турдубаев", "Алымкулов"]
PATR_M = ["Асанович", "Бакирович", "Кубатович", "Мамытович", "Сагынович"]
PATR_F = ["Асановна", "Бакировна", "Кубатовна", "Мамытовна", "Сагыновна"]
TITLES = ["ст. преподаватель", "доцент", "преподаватель", "профессор", "к.т.н., доцент"]


class Command(BaseCommand):
    help = "Заполняет базу примерными группами, студентами и преподавателями (только если база пустая)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Добавить данные, даже если группы уже есть")

    def handle(self, *args, **opts):
        if Group.objects.exists() and not opts["force"]:
            self.stdout.write("Группы уже есть — ничего не меняю. Запустите с --force, чтобы добавить ещё.")
            return
        rnd = random.Random(2026)
        for i, name in enumerate(GROUPS):
            year = int(name.split("-")[2])
            g, _ = Group.objects.get_or_create(name=name, defaults={"course": 1 if year == 25 else 26 - year, "shift": 1 if i % 2 == 0 else 2, "order": i})
            for _ in range(rnd.randint(9, 14)):
                female = rnd.random() < 0.5
                last = rnd.choice(SURNAMES) + ("а" if female else "")
                Student.objects.create(group=g, gender="f" if female else "m", first_name=rnd.choice(F_NAMES if female else M_NAMES), last_name=last)
        if not Teacher.objects.exists():
            for i in range(14):
                female = rnd.random() < 0.55
                Teacher.objects.create(
                    gender="f" if female else "m", first_name=rnd.choice(F_NAMES if female else M_NAMES), last_name=rnd.choice(SURNAMES) + ("а" if female else ""),
                    patronymic=rnd.choice(PATR_F if female else PATR_M), title=rnd.choice(TITLES), order=i,
                )
        st = SiteState.get()
        st.roster_version += 1
        st.save()
        self.stdout.write(self.style.SUCCESS(f"Готово: групп {Group.objects.count()}, студентов {Student.objects.count()}, преподавателей {Teacher.objects.count()}."))
