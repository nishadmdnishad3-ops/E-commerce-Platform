from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AppleLoginAPIView,
    GoogleLoginAPIView,
    RegisterAPIView,
)


urlpatterns = [
    path(
        'register/',
        RegisterAPIView.as_view(),
        name='register'
    ),
    path(
        'login/',
        TokenObtainPairView.as_view(),
        name='login'
    ),
    path(
        'google-login/',
        GoogleLoginAPIView.as_view(),
        name='google-login'
    ),
    path(
        'apple-login/',
        AppleLoginAPIView.as_view(),
        name='apple-login'
    ),
    path(
        'token/refresh/',
        TokenRefreshView.as_view(),
        name='token-refresh'
    ),
]