import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import MAX_GROUP_SIZE, ActionLog, Group, ScheduledEvent, SiteState, Student, Teacher
from .views import guess_gender


class Base(TestCase):
    def setUp(self):
        U = get_user_model()
        self.staff = U.objects.create_user("director", password="pw-Test-12345", is_staff=True)
        self.student_user = U.objects.create_user("student", password="pw-Test-12345")
        self.group = Group.objects.create(name="ПИ-1-25", course=1, shift=1)


class AccessTests(Base):
    def test_panel_requires_login(self):
        r = self.client.get(reverse("panel"))
        self.assertEqual(r.status_code, 302)
        self.assertIn("/login/", r["Location"])

    def test_non_staff_cannot_open_panel_or_change(self):
        self.client.login(username="student", password="pw-Test-12345")
        self.assertEqual(self.client.get(reverse("panel")).status_code, 302)
        self.client.post(reverse("panel_action"), {"action": "event", "type": "alarm"})
        self.assertEqual(SiteState.get().ev_type, "")
        self.client.post(reverse("student_add"), {"last_name": "X", "first_name": "Y", "gender": "m", "group": self.group.id, "active": "on"})
        self.assertEqual(Student.objects.count(), 0)

    def test_wrong_password(self):
        r = self.client.post(reverse("login"), {"username": "director", "password": "nope"})
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Неверный логин или пароль")

    def test_viewer_and_state_are_public(self):
        r = self.client.get(reverse("viewer"))
        self.assertEqual(r.status_code, 200)
        self.assertIn("window.KGU=", r.content.decode())
        self.assertEqual(self.client.get(reverse("api_state")).status_code, 200)

    def test_viewer_can_be_closed(self):
        with self.settings(VIEWER_REQUIRES_LOGIN=True):
            self.assertEqual(self.client.get(reverse("viewer")).status_code, 302)
            self.assertEqual(self.client.get(reverse("api_state")).status_code, 403)


class PanelTests(Base):
    def setUp(self):
        super().setUp()
        self.client.login(username="director", password="pw-Test-12345")

    def state(self):
        return json.loads(self.client.get(reverse("api_state")).content)

    def test_event_start_and_stop(self):
        self.client.post(reverse("panel_action"), {"action": "event", "type": "alarm"})
        s = self.state()
        self.assertEqual(s["ev"]["type"], "alarm")
        key = s["ev"]["key"]
        self.assertIsNotNone(SiteState.get().current_event())
        self.client.post(reverse("panel_action"), {"action": "stop"})
        s = self.state()
        self.assertEqual(s["ev"]["type"], "stop")
        self.assertNotEqual(s["ev"]["key"], key)
        self.assertIsNone(SiteState.get().current_event())
        self.assertEqual(ActionLog.objects.count(), 2)

    def test_unknown_event_ignored(self):
        self.client.post(reverse("panel_action"), {"action": "event", "type": "hack<script>"})
        self.assertIsNone(self.state()["ev"])

    def test_settings_and_announce(self):
        self.client.post(reverse("panel_action"), {"action": "settings", "period": "nooruz", "weather": "snow", "crowd": "250"})
        self.client.post(reverse("panel_action"), {"action": "announce", "text": "Собрание в 15:00"})
        s = self.state()
        self.assertEqual((s["period"], s["weather"], s["crowd"]), ("nooruz", "snow", 1.0))
        self.assertEqual(s["announce"]["text"], "Собрание в 15:00")
        self.client.post(reverse("panel_action"), {"action": "announce", "text": ""})
        self.assertIsNone(self.state()["announce"])

    def test_schedule(self):
        self.client.post(reverse("panel_action"), {"action": "sched_add", "type": "clean", "time": "15:30"})
        self.client.post(reverse("panel_action"), {"action": "sched_add", "type": "clean", "time": "99:99"})
        self.assertEqual(self.state()["sched"], [{"type": "clean", "m": 930}])
        self.client.post(reverse("panel_action"), {"action": "sched_del", "id": ScheduledEvent.objects.get().id})
        self.assertEqual(self.state()["sched"], [])

    def test_student_crud_reaches_viewer(self):
        v0 = SiteState.get().roster_version
        self.client.post(reverse("student_add"), {"last_name": "Асанова", "first_name": "Айгерим", "gender": "f", "group": self.group.id, "character": "otl", "active": "on"})
        s = Student.objects.get()
        self.assertGreater(SiteState.get().roster_version, v0)
        html = self.client.get(reverse("viewer")).content.decode()
        data = json.loads(html.split("window.KGU=", 1)[1].split(";</script>", 1)[0])
        self.assertEqual(data["groups"][0]["students"][0], {"id": s.id, "first": "Айгерим", "last": "Асанова", "g": "f", "arch": "otl"})
        self.assertTrue(data["staff"])
        self.client.post(reverse("student_delete", args=[s.id]))
        self.assertEqual(Student.objects.count(), 0)

    def test_group_size_limit(self):
        for i in range(MAX_GROUP_SIZE):
            Student.objects.create(last_name=f"Ф{i}", first_name="И", group=self.group)
        r = self.client.post(reverse("student_add"), {"last_name": "Лишний", "first_name": "И", "gender": "m", "group": self.group.id, "active": "on"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Student.objects.count(), MAX_GROUP_SIZE)

    def test_import_list(self):
        text = "Асанов Азамат м\nЖумабекова Айгерим\n\nмусор\nТокто уулу Бекжан"
        self.client.post(reverse("students_import"), {"group": self.group.id, "text": text})
        self.assertEqual(Student.objects.count(), 3)
        self.assertEqual(Student.objects.get(last_name="Жумабекова").gender, "f")
        self.assertEqual(Student.objects.get(first_name="Бекжан").last_name, "Токто уулу")

    def test_script_in_name_is_escaped_in_viewer(self):
        Student.objects.create(last_name="</script><script>alert(1)</script>", first_name="X", group=self.group)
        html = self.client.get(reverse("viewer")).content.decode()
        self.assertNotIn("</script><script>alert(1)", html)

    def test_teachers_and_director(self):
        self.client.post(reverse("teacher_add"), {"last_name": "Исакова", "first_name": "Чолпон", "patronymic": "Асановна", "gender": "f", "title": "доцент", "active": "on", "order": 0})
        self.client.post(reverse("teachers"), {"director_last": "Мамытов", "director_first": "Кубат", "director_patr": "", "director_gender": "m", "it_first": "", "it_last": ""})
        self.assertEqual(Teacher.objects.count(), 1)
        html = self.client.get(reverse("viewer")).content.decode()
        data = json.loads(html.split("window.KGU=", 1)[1].split(";</script>", 1)[0])
        self.assertEqual(data["director"]["last"], "Мамытов")
        self.assertEqual(data["teachers"][0]["last"], "Исакова")


class GenderGuessTests(TestCase):
    def test_guess(self):
        self.assertEqual(guess_gender("Асанова", "Айгерим"), "f")
        self.assertEqual(guess_gender("Асанов", "Азамат"), "m")
        self.assertEqual(guess_gender("Токтогул уулу", "Бекжан"), "m")
