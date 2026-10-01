from django.urls import path

from accounts.views import (
    AdminCustomerDetailAPIView,
    AdminCustomerListAPIView,
    AdminEmployeeDetailAPIView,
    AdminEmployeeListCreateAPIView,
)
from orders.views import (
    AdminDashboardAPIView,
    AdminOrderDetailAPIView,
    AdminOrderListAPIView,
    AdminOrderStatusUpdateAPIView,
)
from products.views import (
    AdminBrandListAPIView,
    AdminCategoryDetailAPIView,
    AdminCategoryListCreateAPIView,
    AdminProductDetailAPIView,
    AdminProductListCreateAPIView,
)

urlpatterns = [
    path('dashboard/', AdminDashboardAPIView.as_view(), name='admin-dashboard'),
    path('orders/', AdminOrderListAPIView.as_view(), name='admin-orders'),
    path('orders/<int:order_id>/', AdminOrderDetailAPIView.as_view(), name='admin-order-detail'),
    path('orders/<int:order_id>/status/', AdminOrderStatusUpdateAPIView.as_view(), name='admin-order-status'),
    path('products/', AdminProductListCreateAPIView.as_view(), name='admin-product-list-create'),
    path('products/<int:product_id>/', AdminProductDetailAPIView.as_view(), name='admin-product-detail'),
    path('categories/', AdminCategoryListCreateAPIView.as_view(), name='admin-category-list-create'),
    path('categories/<int:category_id>/', AdminCategoryDetailAPIView.as_view(), name='admin-category-detail'),
    path('brands/', AdminBrandListAPIView.as_view(), name='admin-brand-list'),
    path('customers/', AdminCustomerListAPIView.as_view(), name='admin-customers'),
    path('customers/<int:customer_id>/', AdminCustomerDetailAPIView.as_view(), name='admin-customer-detail'),
    path('employees/', AdminEmployeeListCreateAPIView.as_view(), name='admin-employee-list-create'),
    path('employees/<int:employee_id>/', AdminEmployeeDetailAPIView.as_view(), name='admin-employee-detail'),
]
