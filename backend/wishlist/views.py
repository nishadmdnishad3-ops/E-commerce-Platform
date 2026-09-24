from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from products.models import Product
from .models import WishlistItem
from .serializers import WishlistItemSerializer


class WishlistAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = WishlistItem.objects.filter(
            user=request.user,
            product__is_active=True
        ).select_related(
            'product',
            'product__brand',
            'product__category'
        ).prefetch_related('product__images')

        return Response(WishlistItemSerializer(
            items,
            many=True,
            context={'request': request}
        ).data)


class WishlistAddAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_id = request.data.get('product_id')

        if not product_id:
            return Response(
                {'error': 'product_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            product = Product.objects.get(
                id=product_id,
                is_active=True
            )
        except (Product.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'Product not found or inactive.'},
                status=status.HTTP_404_NOT_FOUND
            )

        item, created = WishlistItem.objects.get_or_create(
            user=request.user,
            product=product
        )

        return Response(
            WishlistItemSerializer(
                item,
                context={'request': request}
            ).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class WishlistRemoveAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, product_id):
        deleted, _ = WishlistItem.objects.filter(
            user=request.user,
            product_id=product_id
        ).delete()

        if not deleted:
            return Response(
                {'error': 'Product is not in your wishlist.'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistToggleAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_id = request.data.get('product_id')

        if not product_id:
            return Response(
                {'error': 'product_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            product = Product.objects.get(
                id=product_id,
                is_active=True
            )
        except (Product.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'Product not found or inactive.'},
                status=status.HTTP_404_NOT_FOUND
            )

        item = WishlistItem.objects.filter(
            user=request.user,
            product=product
        ).first()

        if item:
            item.delete()
            return Response({'is_in_wishlist': False})

        item = WishlistItem.objects.create(
            user=request.user,
            product=product
        )
        return Response(
            {
                'is_in_wishlist': True,
                'item': WishlistItemSerializer(
                    item,
                    context={'request': request}
                ).data
            },
            status=status.HTTP_201_CREATED
        )
