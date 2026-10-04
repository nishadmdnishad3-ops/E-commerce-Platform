from decimal import Decimal, InvalidOperation

from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRoleProfile
from accounts.permissions import IsAdmin, IsAdminOrEmployee
from accounts.roles import get_user_role
from orders.models import Order
from .models import Brand, Category, Product, ProductImage, ProductReview
from .serializers import CategorySerializer, ProductReviewSerializer, ProductSerializer


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user


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


def _generate_unique_slug(model_class, value, pk=None):
    base_slug = slugify(value) or 'item'
    slug = base_slug
    counter = 1
    while model_class.objects.filter(slug=slug).exclude(pk=pk).exists():
        slug = f'{base_slug}-{counter}'
        counter += 1
    return slug


class AdminBrandListAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        brands = Brand.objects.filter(is_active=True).order_by('-created_at')
        return Response([
            {
                'id': brand.id,
                'name': brand.name,
                'slug': brand.slug,
            }
            for brand in brands
        ])


class AdminCategoryListCreateAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        categories = Category.objects.annotate(
            product_count=Count('products', filter=Q(products__is_active=True))
        ).order_by('-created_at')
        return Response(CategorySerializer(categories, many=True).data)

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'Category name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        slug = (request.data.get('slug') or '').strip() or _generate_unique_slug(Category, name)
        if Category.objects.filter(slug=slug).exists():
            slug = _generate_unique_slug(Category, f'{name}-{request.data.get("slug") or ""}')

        category = Category.objects.create(
            name=name,
            slug=slug,
            description=(request.data.get('description') or '').strip(),
            image=request.FILES.get('image'),
            is_active=request.data.get('is_active', True) in [True, 'true', 'True', '1'],
        )
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)


class AdminCategoryDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, category_id):
        category = get_object_or_404(Category, id=category_id)
        return Response(CategorySerializer(category).data)

    def patch(self, request, category_id):
        category = get_object_or_404(Category, id=category_id)
        name = (request.data.get('name') or category.name).strip()
        if not name:
            return Response({'error': 'Category name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        category.name = name
        slug_input = (request.data.get('slug') or '').strip()
        category.slug = slug_input or category.slug
        if not slug_input:
            category.slug = _generate_unique_slug(Category, name, category.id)
        elif Category.objects.filter(slug=slug_input).exclude(pk=category.id).exists():
            return Response({'error': 'Category slug already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        category.description = (request.data.get('description') or category.description).strip()
        if 'image' in request.FILES:
            category.image = request.FILES['image']
        if request.data.get('is_active') is not None:
            category.is_active = request.data.get('is_active') in [True, 'true', 'True', '1']
        category.save()
        return Response(CategorySerializer(category).data)

    def delete(self, request, category_id):
        category = get_object_or_404(Category, id=category_id)
        category.is_active = False
        category.save(update_fields=['is_active'])
        return Response({'message': 'Category deactivated successfully.'})


class AdminProductListCreateAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        products = Product.objects.select_related('category', 'brand').prefetch_related('images').order_by('-created_at')
        return Response(ProductSerializer(products, many=True).data)

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'Product name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        category_id = request.data.get('category')
        brand_id = request.data.get('brand')
        if not category_id or not brand_id:
            return Response({'error': 'Category and brand are required.'}, status=status.HTTP_400_BAD_REQUEST)

        category = get_object_or_404(Category, id=category_id)
        brand = get_object_or_404(Brand, id=brand_id)

        sku = (request.data.get('sku') or '').strip()
        if not sku:
            return Response({'error': 'SKU is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            price = Decimal(str(request.data.get('price')))
            if not price.is_finite():
                raise InvalidOperation
        except (InvalidOperation, TypeError, ValueError):
            return Response({'error': 'A valid price is required.'}, status=status.HTTP_400_BAD_REQUEST)

        slug = (request.data.get('slug') or '').strip() or _generate_unique_slug(Product, name)
        if Product.objects.filter(slug=slug).exists():
            slug = _generate_unique_slug(Product, f'{name}-{sku}')

        is_employee = get_user_role(request.user) == UserRoleProfile.ROLE_EMPLOYEE
        product = Product.objects.create(
            category=category,
            brand=brand,
            name=name,
            slug=slug,
            sku=sku,
            description=(request.data.get('description') or '').strip(),
            price=price,
            discount_percentage=int(request.data.get('discount_percentage') or 0),
            stock=int(request.data.get('stock') or 0),
            is_active=True if is_employee else request.data.get('is_active', True) in [True, 'true', 'True', '1'],
            is_featured=False if is_employee else request.data.get('is_featured', False) in [True, 'true', 'True', '1'],
        )

        files = request.FILES.getlist('images')
        if files:
            for index, image_file in enumerate(files):
                ProductImage.objects.create(
                    product=product,
                    image=image_file,
                    is_primary=index == int(request.data.get('primary_image_index', 0) or 0),
                )
            if not any(img.is_primary for img in product.images.all()):
                product.images.first().is_primary = True
                product.images.first().save(update_fields=['is_primary'])

        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class AdminProductDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, product_id):
        product = get_object_or_404(Product.objects.select_related('category', 'brand').prefetch_related('images'), id=product_id)
        return Response(ProductSerializer(product).data)

    def patch(self, request, product_id):
        product = get_object_or_404(Product.objects.select_related('category', 'brand').prefetch_related('images'), id=product_id)

        if 'name' in request.data and request.data.get('name'):
            product.name = request.data.get('name').strip()
        if 'description' in request.data:
            product.description = request.data.get('description').strip()
        if 'category' in request.data and request.data.get('category'):
            product.category = get_object_or_404(Category, id=request.data.get('category'))
        if 'brand' in request.data and request.data.get('brand'):
            product.brand = get_object_or_404(Brand, id=request.data.get('brand'))
        if 'sku' in request.data and request.data.get('sku'):
            product.sku = request.data.get('sku').strip()
        if 'price' in request.data and request.data.get('price') is not None:
            try:
                price = Decimal(str(request.data.get('price')))
                if not price.is_finite():
                    raise InvalidOperation
            except (InvalidOperation, TypeError, ValueError):
                return Response({'error': 'A valid price is required.'}, status=status.HTTP_400_BAD_REQUEST)
            product.price = price
        if 'discount_percentage' in request.data:
            product.discount_percentage = int(request.data.get('discount_percentage') or 0)
        if 'stock' in request.data and request.data.get('stock') is not None:
            product.stock = int(request.data.get('stock') or 0)
        if 'is_active' in request.data:
            product.is_active = request.data.get('is_active') in [True, 'true', 'True', '1']
        if 'is_featured' in request.data:
            product.is_featured = request.data.get('is_featured') in [True, 'true', 'True', '1']

        if 'slug' in request.data and request.data.get('slug'):
            slug_value = request.data.get('slug').strip()
            if Product.objects.filter(slug=slug_value).exclude(pk=product.id).exists():
                return Response({'error': 'Product slug already exists.'}, status=status.HTTP_400_BAD_REQUEST)
            product.slug = slug_value
        elif product.name:
            product.slug = _generate_unique_slug(Product, product.name, product.id)

        product.save()

        remove_ids = request.data.getlist('remove_image_ids')
        for image_id in remove_ids:
            image = product.images.filter(id=image_id).first()
            if image:
                if image.is_primary and product.images.exclude(id=image.id).exists():
                    next_image = product.images.exclude(id=image.id).first()
                    next_image.is_primary = True
                    next_image.save(update_fields=['is_primary'])
                image.delete()

        files = request.FILES.getlist('images')
        if files:
            primary_index = int(request.data.get('primary_image_index', 0) or 0)
            product.images.filter(is_primary=True).update(is_primary=False)
            for index, image_file in enumerate(files):
                ProductImage.objects.create(
                    product=product,
                    image=image_file,
                    is_primary=index == primary_index,
                )

        return Response(ProductSerializer(product).data)

    def delete(self, request, product_id):
        product = get_object_or_404(Product, id=product_id)
        product.is_active = False
        product.save(update_fields=['is_active', 'updated_at'])
        return Response({'message': 'Product deactivated successfully.'})


class EmployeeBrandListAPIView(AdminBrandListAPIView):
    permission_classes = [IsAdminOrEmployee]


class EmployeeCategoryListAPIView(APIView):
    permission_classes = [IsAdminOrEmployee]

    def get(self, request):
        categories = Category.objects.annotate(
            product_count=Count('products', filter=Q(products__is_active=True))
        ).order_by('-created_at')
        return Response(CategorySerializer(categories, many=True).data)


class EmployeeProductListCreateAPIView(AdminProductListCreateAPIView):
    permission_classes = [IsAdminOrEmployee]


class EmployeeProductDetailAPIView(AdminProductDetailAPIView):
    permission_classes = [IsAdminOrEmployee]

    def patch(self, request, product_id):
        if get_user_role(request.user) == UserRoleProfile.ROLE_EMPLOYEE and (
            'is_active' in request.data or 'is_featured' in request.data
        ):
            return Response(
                {'error': 'Employees cannot change product activation or featured status.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().patch(request, product_id)

    def delete(self, request, product_id):
        if get_user_role(request.user) != UserRoleProfile.ROLE_ADMIN:
            return Response({'error': 'Admin role required.'}, status=status.HTTP_403_FORBIDDEN)
        return super().delete(request, product_id)


class ProductReviewListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ProductReviewSerializer

    @staticmethod
    def get_review_eligibility(user, product):
        if not user or not user.is_authenticated:
            return {
                'can_review': False,
                'reason': 'not_authenticated',
            }

        if ProductReview.objects.filter(user=user, product=product).exists():
            return {
                'can_review': False,
                'reason': 'already_reviewed',
            }

        if Order.objects.filter(
            user=user,
            status='Delivered',
            items__product=product,
        ).exists():
            return {
                'can_review': True,
                'reason': 'delivered',
            }

        if Order.objects.filter(user=user, items__product=product).exists():
            return {
                'can_review': False,
                'reason': 'not_delivered',
            }

        return {
            'can_review': False,
            'reason': 'not_purchased',
        }

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        product = get_object_or_404(
            Product.objects.filter(is_active=True),
            id=self.kwargs['product_id']
        )
        return ProductReview.objects.filter(product=product).select_related('user', 'product')

    def get_summary(self, queryset):
        review_count = queryset.count()
        average_rating = queryset.aggregate(avg_rating=Avg('rating'))['avg_rating']
        rating_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

        for review in queryset:
            rating_counts[review.rating] = rating_counts.get(review.rating, 0) + 1

        return {
            'average_rating': round(float(average_rating), 1) if average_rating is not None else None,
            'review_count': review_count,
            'rating_counts': rating_counts,
        }

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        summary = self.get_summary(queryset)

        return Response({
            'average_rating': summary['average_rating'],
            'review_count': summary['review_count'],
            'rating_counts': summary['rating_counts'],
            'results': serializer.data,
        })

    def perform_create(self, serializer):
        product = get_object_or_404(
            Product.objects.filter(is_active=True),
            id=self.kwargs['product_id']
        )

        eligibility = self.get_review_eligibility(self.request.user, product)

        if not eligibility['can_review']:
            if eligibility['reason'] == 'already_reviewed':
                raise ValueError('You have already reviewed this product.')
            if eligibility['reason'] == 'not_purchased':
                raise PermissionError('You can review this product only after purchasing it.')
            if eligibility['reason'] == 'not_delivered':
                raise PermissionError('You can review this product after your order is delivered.')
            raise PermissionError('Authentication required.')

        serializer.save(user=self.request.user, product=product)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except ValueError as exc:
            return Response({
                'detail': str(exc)
            }, status=status.HTTP_400_BAD_REQUEST)
        except PermissionError as exc:
            return Response({
                'error': str(exc)
            }, status=status.HTTP_403_FORBIDDEN)


class ProductReviewEligibilityAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, product_id):
        product = get_object_or_404(
            Product.objects.filter(is_active=True),
            id=product_id,
        )

        eligibility = ProductReviewListCreateAPIView.get_review_eligibility(
            request.user,
            product,
        )

        return Response(eligibility)


class ProductReviewDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProductReview.objects.select_related('user', 'product')
    serializer_class = ProductReviewSerializer
    lookup_url_kwarg = 'review_id'
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_object(self):
        review = get_object_or_404(
            ProductReview.objects.select_related('user', 'product'),
            id=self.kwargs['review_id']
        )
        self.check_object_permissions(self.request, review)
        return review

    def update(self, request, *args, **kwargs):
        review = self.get_object()
        if ProductReview.objects.filter(
            user=request.user,
            product=review.product
        ).exclude(id=review.id).exists():
            return Response({
                'detail': 'You have already reviewed this product.'
            }, status=status.HTTP_400_BAD_REQUEST)

        eligibility = ProductReviewListCreateAPIView.get_review_eligibility(
            request.user,
            review.product,
        )

        if not eligibility['can_review']:
            if eligibility['reason'] == 'not_purchased':
                return Response({
                    'error': 'You can review this product only after purchasing it.'
                }, status=status.HTTP_403_FORBIDDEN)
            if eligibility['reason'] == 'not_delivered':
                return Response({
                    'error': 'You can review this product after your order is delivered.'
                }, status=status.HTTP_403_FORBIDDEN)

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        self.perform_destroy(review)
        return Response(status=status.HTTP_204_NO_CONTENT)