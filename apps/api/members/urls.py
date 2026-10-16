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
]
