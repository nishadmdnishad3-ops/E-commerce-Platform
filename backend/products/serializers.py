from django.db.models import Avg
from rest_framework import serializers

from .models import Category, Product, ProductImage, ProductReview


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
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'category',
            'category_name',
            'brand',
            'brand_name',
            'name',
            'slug',
            'sku',
            'description',
            'price',
            'discount_percentage',
            'discount_price',
            'stock',
            'is_active',
            'is_featured',
            'created_at',
            'updated_at',
            'images',
            'average_rating',
            'review_count',
        ]

    def get_average_rating(self, obj):
        result = obj.reviews.aggregate(avg_rating=Avg('rating'))['avg_rating']
        if result is None:
            return None
        return round(float(result), 1)

    def get_review_count(self, obj):
        return obj.reviews.count()


class ProductReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    product = serializers.PrimaryKeyRelatedField(read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ProductReview
        fields = [
            'id',
            'product',
            'product_name',
            'user',
            'username',
            'rating',
            'review',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'product',
            'product_name',
            'user',
            'username',
            'created_at',
            'updated_at',
        ]

    def get_product_name(self, obj):
        return obj.product.name

    def get_username(self, obj):
        return obj.user.username

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value

    def validate_review(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Review cannot be empty.')
        return value.strip()

    def validate(self, data):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return data

        product = self.context.get('product')
        if product is None and self.instance is not None:
            product = self.instance.product

        if product is not None and not self.instance:
            if ProductReview.objects.filter(user=request.user, product=product).exists():
                raise serializers.ValidationError({
                    'detail': 'You have already reviewed this product.'
                })

        return data


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
