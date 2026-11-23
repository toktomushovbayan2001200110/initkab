import json
import re
import secrets
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.views import redirect_to_login
from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from .forms import GroupForm, ImportForm, StaffForm, StudentForm, TeacherForm
from .models import (
    EVENTS,
    MAX_GROUP_SIZE,
    MAX_GROUPS,
    PERIODS,
    WEATHER,
    ActionLog,
    Group,
    ScheduledEvent,
    SiteState,
    Student,
    Teacher,
    bump_roster,
)

staff_required = user_passes_test(lambda u: u.is_active and u.is_staff, login_url="login")
VIEWER_FILE = Path(__file__).resolve().parent / "viewer" / "index.html"


def log(request, text):
    ActionLog.objects.create(user=request.user if request.user.is_authenticated else None, text=text[:250])


# ---------------------------------------------------------------- 3D-модель
@lru_cache(maxsize=1)
def _viewer_html():
    return VIEWER_FILE.read_text(encoding="utf-8")


def roster_payload():
    groups = []
    for g in Group.objects.prefetch_related("students")[:MAX_GROUPS]:
        studs = [s for s in g.students.all() if s.active][:MAX_GROUP_SIZE]
        if not studs:
            continue
        groups.append({
            "name": g.name,
            "course": g.course,
            "shift": g.shift,
            "students": [{"id": s.id, "first": s.first_name, "last": s.last_name, "g": s.gender, "arch": s.character} for s in studs],
        })
    teachers = [
        {"last": t.last_name, "first": t.first_name, "patr": t.patronymic, "g": t.gender, "title": t.title}
        for t in Teacher.objects.filter(active=True)[:14]
    ]
    return groups, teachers


@never_cache
def viewer(request):
    """Страница с 3D-моделью. Люди и события подставляются из базы."""
    if settings.VIEWER_REQUIRES_LOGIN and not request.user.is_authenticated:
        return redirect_to_login(request.get_full_path())
    st = SiteState.get()
    groups, teachers = roster_payload()
    data = {
        "groups": groups,
        "teachers": teachers,
        "stateUrl": "/api/state/",
        "panelUrl": "/panel/",
        "staff": bool(request.user.is_authenticated and request.user.is_staff),
        "user": request.user.get_full_name() or request.user.get_username() if request.user.is_authenticated else "",
        "rosterVersion": st.roster_version,
    }
    if st.director_last or st.director_first:
        data["director"] = {"last": st.director_last, "first": st.director_first, "patr": st.director_patr, "g": st.director_gender}
    if st.it_first or st.it_last:
        data["it"] = {"first": st.it_first, "last": st.it_last}
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = _viewer_html().replace("<head>", "<head>\n<script>window.KGU=" + payload + ";</script>", 1)
    return HttpResponse(html)


def state_payload(st=None):
    st = st or SiteState.get()
    ms = lambda dt: int(dt.timestamp() * 1000) if dt else 0  # noqa: E731
    return {
        "period": st.period,
        "weather": st.weather,
        "crowd": max(10, min(100, st.crowd)) / 100,
        "announce": {"text": st.announce_text, "at": ms(st.announce_at)} if st.announce_text else None,
        "sched": [{"type": s.type, "m": s.time.hour * 60 + s.time.minute} for s in ScheduledEvent.objects.all()],
        "ev": {"type": st.ev_type, "at": ms(st.ev_at), "key": st.ev_key} if st.ev_key else None,
        "roster_version": st.roster_version,
    }


@never_cache
@require_GET
def api_state(request):
    if settings.VIEWER_REQUIRES_LOGIN and not request.user.is_authenticated:
        return JsonResponse({"error": "login required"}, status=403)
    return JsonResponse(state_payload())


# ---------------------------------------------------------------- панель
@staff_required
def panel(request):
    st = SiteState.get()
    ctx = {
        "st": st,
        "periods": PERIODS,
        "weather": WEATHER,
        "events": [(k, v[0], v[1], v[2]) for k, v in EVENTS.items()],
        "current": st.current_event(),
        "sched": ScheduledEvent.objects.all(),
        "logs": ActionLog.objects.select_related("user")[:12],
        "n_students": Student.objects.filter(active=True).count(),
        "n_groups": Group.objects.count(),
        "n_teachers": Teacher.objects.filter(active=True).count(),
        "tab": "panel",
    }
    return render(request, "campus/panel.html", ctx)


@staff_required
@require_POST
def panel_action(request):
    st = SiteState.get()
    act = request.POST.get("action", "")
    if act == "settings":
        period, weather = request.POST.get("period"), request.POST.get("weather")
        if period in dict(PERIODS):
            st.period = period
        if weather in dict(WEATHER):
            st.weather = weather
        try:
            st.crowd = max(10, min(100, int(request.POST.get("crowd", st.crowd))))
        except ValueError:
            pass
        st.save()
        log(request, f"Настройки дня: {st.get_period_display()}, погода: {st.get_weather_display()}, студентов {st.crowd}%")
        messages.success(request, "Настройки сохранены. Модель обновится за несколько секунд.")
    elif act == "event":
        ev = request.POST.get("type", "")
        if ev in EVENTS:
            st.ev_type, st.ev_at, st.ev_key = ev, timezone.now(), secrets.token_hex(8)
            st.save()
            log(request, f"Запустил событие: {EVENTS[ev][0]}")
            messages.success(request, f"Событие «{EVENTS[ev][0]}» запущено у всех, кто смотрит модель.")
    elif act == "stop":
        st.ev_type, st.ev_at, st.ev_key = "stop", timezone.now(), secrets.token_hex(8)
        st.save()
        log(request, "Остановил текущее событие")
        messages.success(request, "Событие остановлено.")
    elif act == "announce":
        text = request.POST.get("text", "").strip()[:160]
        st.announce_text, st.announce_at = text, timezone.now() if text else None
        st.save()
        log(request, f"Объявление: {text}" if text else "Убрал объявление")
        messages.success(request, "Объявление в бегущей строке обновлено." if text else "Объявление убрано.")
    elif act == "sched_add":
        ev, t = request.POST.get("type", ""), request.POST.get("time", "")
        m = re.fullmatch(r"(\d{1,2}):(\d{2})", t)
        if ev in EVENTS and m and int(m[1]) < 24 and int(m[2]) < 60:
            ScheduledEvent.objects.create(type=ev, time=f"{int(m[1]):02d}:{m[2]}")
            log(request, f"Расписание: {EVENTS[ev][0]} в {t}")
            messages.success(request, "Событие добавлено в расписание.")
        else:
            messages.error(request, "Укажите событие и время, например 15:00.")
    elif act == "sched_del":
        ScheduledEvent.objects.filter(pk=request.POST.get("id")).delete()
        messages.success(request, "Событие убрано из расписания.")
    return redirect("panel")


# ---------------------------------------------------------------- студенты
@staff_required
def students(request):
    q, gid = request.GET.get("q", "").strip(), request.GET.get("group", "")
    qs = Student.objects.select_related("group")
    if q:
        qs = qs.filter(Q(last_name__icontains=q) | Q(first_name__icontains=q))
    if gid.isdigit():
        qs = qs.filter(group_id=int(gid))
    groups = Group.objects.annotate(n=Count("students", filter=Q(students__active=True)))
    return render(request, "campus/students.html", {"students": qs, "groups": groups, "q": q, "gid": gid, "tab": "students", "max_size": MAX_GROUP_SIZE})


def _edit(request, form_cls, instance, title, back, what, initial=None):
    form = form_cls(request.POST or None, instance=instance, initial=initial)
    if request.method == "POST" and form.is_valid():
        obj = form.save()
        bump_roster()
        log(request, f"{'Изменил' if instance else 'Добавил'} {what}: {obj}")
        messages.success(request, f"Сохранено: {obj}. Чтобы увидеть в модели, обновите её страницу.")
        if "add_more" in request.POST:
            return redirect(request.path + (f"?group={obj.group_id}" if hasattr(obj, "group_id") else ""))
        return redirect(back)
    return render(request, "campus/form.html", {"form": form, "title": title, "back": back, "tab": back, "is_new": instance is None})


@staff_required
def student_add(request):
    if not Group.objects.exists():
        messages.error(request, "Сначала создайте хотя бы одну группу.")
        return redirect("groups")
    gid = request.GET.get("group", "")
    return _edit(request, StudentForm, None, "Новый студент", "students", "студента", initial={"group": int(gid)} if gid.isdigit() else None)


@staff_required
def student_edit(request, pk):
    return _edit(request, StudentForm, get_object_or_404(Student, pk=pk), "Студент", "students", "студента")


@staff_required
@require_POST
def student_delete(request, pk):
    s = get_object_or_404(Student, pk=pk)
    log(request, f"Удалил студента: {s} ({s.group})")
    s.delete()
    bump_roster()
    messages.success(request, "Студент удалён.")
    return redirect("students")


def guess_gender(last, first):
    last, first = last.lower(), first.lower()
    if last.endswith(("ова", "ева", "ина", "ая", "кызы")):
        return "f"
    if last.endswith(("ов", "ев", "ин", "уулу", "ий")):
        return "m"
    return "f" if first.endswith(("а", "я", "й")) and not first.endswith(("ай", "ей")) else "m"


@staff_required
def students_import(request):
    form = ImportForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        group = form.cleaned_data["group"]
        room = MAX_GROUP_SIZE - group.students.filter(active=True).count()
        added, skipped = 0, 0
        for line in form.cleaned_data["text"].splitlines():
            parts = re.split(r"[\s,;]+", line.strip())
            parts = [p for p in parts if p]
            if len(parts) < 2:
                continue
            if added >= room:
                skipped += 1
                continue
            if len(parts) > 2 and parts[1].lower() in ("уулу", "кызы"):
                parts = [parts[0] + " " + parts[1]] + parts[2:]
            last, first = parts[0][:40], parts[1][:40]
            g = parts[-1].lower() if len(parts) > 2 else ""
            gender = "m" if g in ("м", "m", "муж") else "f" if g in ("ж", "f", "жен") else guess_gender(last, first)
            Student.objects.create(last_name=last, first_name=first, gender=gender, group=group)
            added += 1
        if added:
            bump_roster()
            log(request, f"Загрузил список: {added} студентов в {group}")
        messages.success(request, f"Добавлено студентов: {added}." + (f" Не поместилось: {skipped} (в группе максимум {MAX_GROUP_SIZE})." if skipped else ""))
        return redirect("students")
    return render(request, "campus/form.html", {"form": form, "title": "Загрузить список группы", "back": "students", "tab": "students", "is_new": False, "plain": True})


# ---------------------------------------------------------------- группы и преподаватели
@staff_required
def groups(request):
    qs = Group.objects.annotate(n=Count("students", filter=Q(students__active=True)))
    return render(request, "campus/groups.html", {"groups": qs, "tab": "groups", "max_groups": MAX_GROUPS, "max_size": MAX_GROUP_SIZE})


@staff_required
def group_add(request):
    return _edit(request, GroupForm, None, "Новая группа", "groups", "группу")


@staff_required
def group_edit(request, pk):
    return _edit(request, GroupForm, get_object_or_404(Group, pk=pk), "Группа", "groups", "группу")


@staff_required
@require_POST
def group_delete(request, pk):
    g = get_object_or_404(Group, pk=pk)
    log(request, f"Удалил группу: {g} (студентов: {g.students.count()})")
    g.delete()
    bump_roster()
    messages.success(request, "Группа удалена вместе со студентами.")
    return redirect("groups")


@staff_required
def teachers(request):
    st = SiteState.get()
    form = StaffForm(request.POST or None, instance=st)
    if request.method == "POST" and form.is_valid():
        form.save()
        bump_roster()
        log(request, "Изменил директора или системного администратора")
        messages.success(request, "Сохранено.")
        return redirect("teachers")
    return render(request, "campus/teachers.html", {"teachers": Teacher.objects.all(), "form": form, "tab": "teachers"})


@staff_required
def teacher_add(request):
    return _edit(request, TeacherForm, None, "Новый преподаватель", "teachers", "преподавателя")


@staff_required
def teacher_edit(request, pk):
    return _edit(request, TeacherForm, get_object_or_404(Teacher, pk=pk), "Преподаватель", "teachers", "преподавателя")


@staff_required
@require_POST
def teacher_delete(request, pk):
    t = get_object_or_404(Teacher, pk=pk)
    log(request, f"Удалил преподавателя: {t}")
    t.delete()
    bump_roster()
    messages.success(request, "Преподаватель удалён.")
    return redirect("teachers")
