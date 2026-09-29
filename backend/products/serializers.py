from rest_framework import serializers
from .models import Product, ProductImage, Category


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(
        source='brand.name',
        read_only=True
    )

    category_name = serializers.CharField(
        source='category.name',
        read_only=True
    )

    images = ProductImageSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = Product
        fields = '__all__'

    from .models import Product, ProductImage, Category


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'image',
            'is_active',
            'product_count',
        ]
