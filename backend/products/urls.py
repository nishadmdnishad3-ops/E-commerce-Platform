from django.urls import path

from .views import (
    CategoryListAPIView,
    LatestProductListAPIView,
    ProductDetailAPIView,
    ProductListAPIView,
    ProductReviewDetailAPIView,
    ProductReviewEligibilityAPIView,
    ProductReviewListCreateAPIView,
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
        '<int:product_id>/reviews/eligibility/',
        ProductReviewEligibilityAPIView.as_view(),
        name='product-review-eligibility'
    ),
    path(
        '<int:product_id>/reviews/',
        ProductReviewListCreateAPIView.as_view(),
        name='product-review-list-create'
    ),
    path(
        'reviews/<int:review_id>/',
        ProductReviewDetailAPIView.as_view(),
        name='product-review-detail'
    ),
    path(
        '<slug:slug>/',
        ProductDetailAPIView.as_view(),
        name='product-detail'
    ),
]