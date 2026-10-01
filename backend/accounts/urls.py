from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AppleLoginAPIView,
    CustomTokenObtainPairView,
    GoogleLoginAPIView,
    MyProfileAPIView,
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
        CustomTokenObtainPairView.as_view(),
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
    path('profile/', MyProfileAPIView.as_view(), name='my-profile'),
    path(
        'token/refresh/',
        TokenRefreshView.as_view(),
        name='token-refresh'
    ),
]