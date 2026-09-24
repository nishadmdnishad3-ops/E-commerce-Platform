from django.urls import path

from .views import (
    CancelOrderAPIView,
    CreateOrderAPIView,
    MyOrdersAPIView,
)


urlpatterns = [
    path(
        'create/',
        CreateOrderAPIView.as_view(),
        name='create-order'
    ),

    path(
        '<int:order_id>/cancel/',
        CancelOrderAPIView.as_view(),
        name='cancel-order'
    ),

    path(
        'my-orders/',
        MyOrdersAPIView.as_view(),
        name='my-orders'
    ),
]