from django.urls import path

from orders.views import (
    EmployeeDashboardAPIView,
    EmployeeOrderDetailAPIView,
    EmployeeOrderListAPIView,
    EmployeeOrderStatusUpdateAPIView,
)
from products.views import (
    EmployeeBrandListAPIView,
    EmployeeCategoryListAPIView,
    EmployeeProductDetailAPIView,
    EmployeeProductListCreateAPIView,
)

urlpatterns = [
    path('dashboard/', EmployeeDashboardAPIView.as_view(), name='employee-dashboard'),
    path('orders/', EmployeeOrderListAPIView.as_view(), name='employee-orders'),
    path('orders/<int:order_id>/', EmployeeOrderDetailAPIView.as_view(), name='employee-order-detail'),
    path('orders/<int:order_id>/status/', EmployeeOrderStatusUpdateAPIView.as_view(), name='employee-order-status'),
    path('products/', EmployeeProductListCreateAPIView.as_view(), name='employee-products'),
    path('products/<int:product_id>/', EmployeeProductDetailAPIView.as_view(), name='employee-product-detail'),
    path('categories/', EmployeeCategoryListAPIView.as_view(), name='employee-categories'),
    path('brands/', EmployeeBrandListAPIView.as_view(), name='employee-brands'),
]