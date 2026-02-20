from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from app.permissions import GlobalDefaultPermission


class BaseListCreateView(generics.ListCreateAPIView):
    """Base list + create view with standard project permissions."""
    permission_classes = (IsAuthenticated, GlobalDefaultPermission,)


class BaseRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """Base retrieve + update + destroy view with standard project permissions."""
    permission_classes = (IsAuthenticated, GlobalDefaultPermission,)
