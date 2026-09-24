from django.urls import path

from .views import (
    WishlistAddAPIView,
    WishlistAPIView,
    WishlistRemoveAPIView,
    WishlistToggleAPIView,
)

urlpatterns = [
    path('', WishlistAPIView.as_view(), name='wishlist'),
    path('add/', WishlistAddAPIView.as_view(), name='wishlist-add'),
    path('remove/<int:product_id>/', WishlistRemoveAPIView.as_view(), name='wishlist-remove'),
    path('toggle/', WishlistToggleAPIView.as_view(), name='wishlist-toggle'),
]
