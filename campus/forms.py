from django import forms

from .models import MAX_GROUP_SIZE, MAX_GROUPS, Group, SiteState, Student, Teacher


class StudentForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ["last_name", "first_name", "gender", "group", "character", "active", "note"]

    def clean(self):
        data = super().clean()
        group, active = data.get("group"), data.get("active")
        if group and active:
            qs = group.students.filter(active=True)
            if self.instance.pk:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.count() >= MAX_GROUP_SIZE:
                raise forms.ValidationError(
                    f"В группе {group.name} уже {MAX_GROUP_SIZE} студентов — больше в аудиторию модели не помещается."
                )
        return data


class GroupForm(forms.ModelForm):
    class Meta:
        model = Group
        fields = ["name", "course", "shift", "order"]

    def clean(self):
        data = super().clean()
        if not self.instance.pk and Group.objects.count() >= MAX_GROUPS:
            raise forms.ValidationError(f"В модели помещается не больше {MAX_GROUPS} групп.")
        return data


class TeacherForm(forms.ModelForm):
    class Meta:
        model = Teacher
        fields = ["last_name", "first_name", "patronymic", "gender", "title", "active", "order"]


class StaffForm(forms.ModelForm):
    class Meta:
        model = SiteState
        fields = ["director_last", "director_first", "director_patr", "director_gender", "it_first", "it_last"]


class ImportForm(forms.Form):
    group = forms.ModelChoiceField(Group.objects.all(), label="Группа")
    text = forms.CharField(
        label="Список студентов",
        widget=forms.Textarea(attrs={"rows": 10, "placeholder": "Асанов Азамат м\nЖумабекова Айгерим ж"}),
        help_text="По одному на строку: Фамилия Имя и пол (м или ж). Пол можно не писать — угадаем по фамилии.",
    )
