from django.shortcuts import render

# Create your views here.
from rest_framework import generics
from django.db.models import Count, Q
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer


class ProductListAPIView(generics.ListAPIView):
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer


class ProductDetailAPIView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer
    lookup_field = 'slug'

class CategoryListAPIView(generics.ListAPIView):
    queryset = (
        Category.objects
        .filter(is_active=True)
        .annotate(
            product_count=Count(
                'products',
                filter=Q(products__is_active=True)
            )
        )
        .order_by('id')
    )
    serializer_class = CategorySerializer

class LatestProductListAPIView(generics.ListAPIView):
    queryset = (
        Product.objects
        .filter(is_active=True)
        .order_by('-created_at')[:6]
    )
    serializer_class = ProductSerializer