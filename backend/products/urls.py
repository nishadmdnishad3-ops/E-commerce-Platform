from django.urls import path
from .views import (
    ProductListAPIView,
    ProductDetailAPIView,
    CategoryListAPIView,
    LatestProductListAPIView,
)

urlpatterns = [
    path('', ProductListAPIView.as_view(), name='product-list'),
    path('latest/', LatestProductListAPIView.as_view(), name='latest-products'),

    path(
        'categories/',
        CategoryListAPIView.as_view(),
        name='category-list'
    ),

    path(
        '<slug:slug>/',
        ProductDetailAPIView.as_view(),
        name='product-detail'
    ),
]