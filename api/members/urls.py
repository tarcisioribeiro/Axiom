from django.urls import path

from . import views

urlpatterns = [
    path("members/", views.MemberCreateListView.as_view(), name="member-create-list"),
    path("members/me/", views.get_current_user_member, name="current-user-member"),
    path(
        "members/<int:pk>/",
        views.MemberRetrieveUpdateDestroyView.as_view(),
        name="member-detail-view",
    ),
    path(
        "members/<int:pk>/permissions/",
        views.get_member_permissions,
        name="member-permissions-get",
    ),
    path(
        "members/<int:pk>/permissions/update/",
        views.update_member_permissions,
        name="member-permissions-update",
    ),
    path(
        "permissions/available/",
        views.get_available_permissions,
        name="available-permissions",
    ),
]
