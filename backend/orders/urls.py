from django.urls import path

from .views import (
    CancelOrderAPIView,
    CreateOrderAPIView,
    MyOrdersAPIView,
    ValidateCouponAPIView,
    ValidateGiftVoucherAPIView,
)


urlpatterns = [
    path(
        'coupons/validate/',
        ValidateCouponAPIView.as_view(),
        name='validate-coupon'
    ),
    path(
        'vouchers/validate/',
        ValidateGiftVoucherAPIView.as_view(),
        name='validate-gift-voucher'
    ),
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