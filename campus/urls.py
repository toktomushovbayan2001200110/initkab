from django.urls import path

from . import views

urlpatterns = [
    path("", views.viewer, name="viewer"),
    path("api/state/", views.api_state, name="api_state"),
    path("panel/", views.panel, name="panel"),
    path("panel/action/", views.panel_action, name="panel_action"),
    path("panel/students/", views.students, name="students"),
    path("panel/students/add/", views.student_add, name="student_add"),
    path("panel/students/import/", views.students_import, name="students_import"),
    path("panel/students/<int:pk>/", views.student_edit, name="student_edit"),
    path("panel/students/<int:pk>/delete/", views.student_delete, name="student_delete"),
    path("panel/groups/", views.groups, name="groups"),
    path("panel/groups/add/", views.group_add, name="group_add"),
    path("panel/groups/<int:pk>/", views.group_edit, name="group_edit"),
    path("panel/groups/<int:pk>/delete/", views.group_delete, name="group_delete"),
    path("panel/teachers/", views.teachers, name="teachers"),
    path("panel/teachers/add/", views.teacher_add, name="teacher_add"),
    path("panel/teachers/<int:pk>/", views.teacher_edit, name="teacher_edit"),
    path("panel/teachers/<int:pk>/delete/", views.teacher_delete, name="teacher_delete"),
]
