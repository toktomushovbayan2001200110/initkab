from django.contrib import admin

from .models import ActionLog, Group, ScheduledEvent, SiteState, Student, Teacher, bump_roster


class RosterAdmin(admin.ModelAdmin):
    """После любого изменения людей модель узнаёт, что список обновился."""

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        bump_roster()

    def delete_model(self, request, obj):
        super().delete_model(request, obj)
        bump_roster()

    def delete_queryset(self, request, queryset):
        super().delete_queryset(request, queryset)
        bump_roster()


class StudentInline(admin.TabularInline):
    model = Student
    extra = 1
    fields = ("last_name", "first_name", "gender", "character", "active")


@admin.register(Group)
class GroupAdmin(RosterAdmin):
    list_display = ("name", "course", "shift", "order")
    list_editable = ("course", "shift", "order")
    inlines = [StudentInline]

    def save_formset(self, request, form, formset, change):
        super().save_formset(request, form, formset, change)
        bump_roster()


@admin.register(Student)
class StudentAdmin(RosterAdmin):
    list_display = ("last_name", "first_name", "group", "gender", "character", "active")
    list_filter = ("group", "gender", "character", "active")
    search_fields = ("last_name", "first_name")
    list_editable = ("active",)


@admin.register(Teacher)
class TeacherAdmin(RosterAdmin):
    list_display = ("last_name", "first_name", "patronymic", "title", "active", "order")
    list_editable = ("active", "order")
    search_fields = ("last_name", "first_name")


@admin.register(ScheduledEvent)
class ScheduledEventAdmin(admin.ModelAdmin):
    list_display = ("time", "type")


@admin.register(SiteState)
class SiteStateAdmin(RosterAdmin):
    def has_add_permission(self, request):
        return not SiteState.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ActionLog)
class ActionLogAdmin(admin.ModelAdmin):
    list_display = ("created", "user", "text")
    list_filter = ("user",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
