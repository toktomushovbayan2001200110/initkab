from django.conf import settings
from django.db import models
from django.utils import timezone

GENDERS = [("m", "Мужской"), ("f", "Женский")]

# Характеры студентов — те же, что понимает 3D-модель
CHARACTERS = [
    ("", "Случайный"),
    ("otl", "Отличник"),
    ("tus", "Тусовщик"),
    ("tih", "Тихоня"),
    ("opz", "Вечный опоздун"),
    ("gam", "Геймер"),
    ("sta", "Староста"),
    ("obs", "Обычный студент"),
]

PERIODS = [
    ("auto", "Авто, по календарю"),
    ("normal", "Обычный учебный день"),
    ("session", "Сессия, экзамены"),
    ("nooruz", "Нооруз"),
    ("newyear", "Новый год"),
    ("grad", "Выпускной"),
    ("vacation", "Каникулы"),
]

WEATHER = [
    ("auto", "Авто, по сезону"),
    ("clear", "Ясно"),
    ("cloudy", "Облачно"),
    ("rain", "Дождь"),
    ("snow", "Снег"),
]

# тип события → (название, значок, длительность в минутах)
EVENTS = {
    "alarm": ("Пожарная тревога", "🚨", 22),
    "power": ("Отключение света", "💡", 25),
    "wifi": ("Упал Wi‑Fi", "📶", 15),
    "inspect": ("Проверка комиссии", "🕴", 45),
    "clean": ("Субботник", "🍂", 60),
    "hack": ("Хакатон ИНИТ", "💻", 300),
    "openday": ("День открытых дверей", "🎒", 90),
}
EVENT_CHOICES = [(k, v[0]) for k, v in EVENTS.items()]

# В модели помещается не больше стольких групп и студентов в группе
MAX_GROUPS = 16
MAX_GROUP_SIZE = 18


class Group(models.Model):
    name = models.CharField("Название", max_length=30, unique=True, help_text="Например: ПИ-1-25")
    course = models.PositiveSmallIntegerField("Курс", default=1)
    shift = models.PositiveSmallIntegerField("Смена", choices=[(1, "1 смена (с 8:00)"), (2, "2 смена (с 12:00)")], default=1)
    order = models.PositiveSmallIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "группа"
        verbose_name_plural = "группы"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Student(models.Model):
    last_name = models.CharField("Фамилия", max_length=40)
    first_name = models.CharField("Имя", max_length=40)
    gender = models.CharField("Пол", max_length=1, choices=GENDERS, default="m")
    group = models.ForeignKey(Group, verbose_name="Группа", on_delete=models.CASCADE, related_name="students")
    character = models.CharField("Характер", max_length=3, choices=CHARACTERS, blank=True, default="")
    active = models.BooleanField("Учится", default=True, help_text="Снимите галочку, чтобы студент не появлялся в модели")
    note = models.CharField("Заметка", max_length=200, blank=True)
    created = models.DateTimeField("Добавлен", auto_now_add=True)

    class Meta:
        verbose_name = "студент"
        verbose_name_plural = "студенты"
        ordering = ["group__order", "group__name", "last_name", "first_name"]

    def __str__(self):
        return f"{self.last_name} {self.first_name}"


class Teacher(models.Model):
    last_name = models.CharField("Фамилия", max_length=40)
    first_name = models.CharField("Имя", max_length=40)
    patronymic = models.CharField("Отчество", max_length=40, blank=True)
    gender = models.CharField("Пол", max_length=1, choices=GENDERS, default="m")
    title = models.CharField("Должность", max_length=60, blank=True, default="преподаватель")
    active = models.BooleanField("Работает", default=True)
    order = models.PositiveSmallIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "преподаватель"
        verbose_name_plural = "преподаватели"
        ordering = ["order", "last_name"]

    def __str__(self):
        return f"{self.last_name} {self.first_name} {self.patronymic}".strip()


class SiteState(models.Model):
    """Единственная запись: что сейчас происходит в корпусе."""

    period = models.CharField("День", max_length=10, choices=PERIODS, default="auto")
    weather = models.CharField("Погода", max_length=10, choices=WEATHER, default="auto")
    crowd = models.PositiveSmallIntegerField("Сколько студентов пришло, %", default=100)
    announce_text = models.CharField("Объявление", max_length=160, blank=True)
    announce_at = models.DateTimeField(null=True, blank=True)
    ev_type = models.CharField(max_length=10, blank=True)
    ev_at = models.DateTimeField(null=True, blank=True)
    ev_key = models.CharField(max_length=40, blank=True)
    director_last = models.CharField("Директор: фамилия", max_length=40, blank=True)
    director_first = models.CharField("Директор: имя", max_length=40, blank=True)
    director_patr = models.CharField("Директор: отчество", max_length=40, blank=True)
    director_gender = models.CharField("Директор: пол", max_length=1, choices=GENDERS, default="m")
    it_first = models.CharField("Системный администратор: имя", max_length=40, blank=True)
    it_last = models.CharField("Системный администратор: фамилия", max_length=40, blank=True)
    roster_version = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "состояние корпуса"
        verbose_name_plural = "состояние корпуса"

    def __str__(self):
        return "Состояние корпуса"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def current_event(self):
        """Событие, которое идёт прямо сейчас, или None."""
        if not self.ev_type or self.ev_type not in EVENTS or not self.ev_at:
            return None
        left = EVENTS[self.ev_type][2] - (timezone.now() - self.ev_at).total_seconds() / 60
        if left <= 0:
            return None
        return {"type": self.ev_type, "name": EVENTS[self.ev_type][0], "icon": EVENTS[self.ev_type][1], "left": int(left) + 1}


class ScheduledEvent(models.Model):
    type = models.CharField("Событие", max_length=10, choices=EVENT_CHOICES)
    time = models.TimeField("Время (Бишкек)")

    class Meta:
        verbose_name = "событие по расписанию"
        verbose_name_plural = "события по расписанию"
        ordering = ["time"]

    def __str__(self):
        return f"{self.time:%H:%M} {self.get_type_display()}"


class ActionLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name="Кто", null=True, on_delete=models.SET_NULL)
    text = models.CharField("Что сделал", max_length=250)
    created = models.DateTimeField("Когда", auto_now_add=True)

    class Meta:
        verbose_name = "запись журнала"
        verbose_name_plural = "журнал действий"
        ordering = ["-created"]

    def __str__(self):
        return self.text


def bump_roster():
    """Отметить, что список людей изменился: открытые модели попросят обновить страницу."""
    st = SiteState.get()
    st.roster_version += 1
    st.save(update_fields=["roster_version"])
