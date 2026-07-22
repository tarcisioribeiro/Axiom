from django.urls import path

from . import views
from .views import MemberPhotoStreamView

urlpatterns = [
    path(
        "members/",
        views.MemberCreateListView.as_view(),
        name="member-create-list",
    ),
    path(
        "members/me/",
        views.get_current_user_member,
        name="current-user-member",
    ),
    path(
        "members/me/photo/",
        views.manage_profile_photo,
        name="member-profile-photo",
    ),
    path(
        "members/<int:pk>/photo/",
        MemberPhotoStreamView.as_view(),
        name="member-photo-stream",
    ),
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
    path(
        "members/<int:pk>/financial-report/",
        views.MemberFinancialReportView.as_view(),
        name="member-financial-report",
    ),
]
