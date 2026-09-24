from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.models import Product
from .models import Order, OrderItem


class CreateOrderAPIView(APIView):

    @transaction.atomic
    def post(self, request):

        if not request.user.is_authenticated:
            return Response(
                {
                    'error': 'Please login to place an order.'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        data = request.data

        items = data.get('items', [])

        if not items:
            return Response(
                {'error': 'Cart is empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --------------------------------
        # Customer Information
        # --------------------------------

        first_name = data.get(
            'first_name',
            ''
        ).strip()

        last_name = data.get(
            'last_name',
            ''
        ).strip()

        email = data.get(
            'email',
            ''
        ).strip()

        mobile = data.get(
            'mobile',
            ''
        ).strip()

        address = data.get(
            'address',
            ''
        ).strip()

        upazila = data.get(
            'upazila',
            ''
        ).strip()

        district = data.get(
            'district',
            ''
        ).strip()

        if not all([
            first_name,
            last_name,
            email,
            mobile,
            address,
            upazila,
            district
        ]):
            return Response(
                {
                    'error':
                    'Please fill in all required fields.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # --------------------------------
        # Payment & Delivery
        # --------------------------------

        payment_method = data.get(
            'payment_method',
            'Cash on Delivery'
        )

        delivery_method = data.get(
            'delivery_method',
            'Home Delivery'
        )

        comment = data.get(
            'comment',
            ''
        ).strip()

        # --------------------------------
        # Delivery Fee
        # --------------------------------

        delivery_fees = {
            'Home Delivery': Decimal('70'),
            'Store Pickup': Decimal('0'),
            'Express Delivery': Decimal('120'),
        }

        delivery_fee = delivery_fees.get(
            delivery_method,
            Decimal('70')
        )

        # --------------------------------
        # Calculate Subtotal
        # --------------------------------

        subtotal = Decimal('0')

        order_items = []

        for item in items:

            product_id = item.get(
                'product_id'
            )

            quantity = int(
                item.get(
                    'quantity',
                    0
                )
            )

            if not product_id:
                return Response(
                    {
                        'error':
                        'Product ID is required.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if quantity < 1:
                return Response(
                    {
                        'error':
                        'Invalid product quantity.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get product and lock row
            try:
                product = (
                    Product.objects
                    .select_for_update()
                    .get(
                        id=product_id,
                        is_active=True
                    )
                )

            except Product.DoesNotExist:
                return Response(
                    {
                        'error':
                        f'Product {product_id} not found.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # --------------------------------
            # Check Stock
            # --------------------------------

            if quantity > product.stock:
                return Response(
                    {
                        'error': (
                            f'Only {product.stock} units '
                            f'of {product.name} are available.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # --------------------------------
            # Product Price
            # --------------------------------

            price = (
                product.discount_price
                if product.discount_price is not None
                else product.price
            )

            item_subtotal = price * quantity

            subtotal += item_subtotal

            order_items.append(
                {
                    'product': product,
                    'product_name': product.name,
                    'price': price,
                    'quantity': quantity,
                    'subtotal': item_subtotal,
                }
            )

        # --------------------------------
        # Coupon Discount
        # --------------------------------

        coupon = data.get(
            'coupon',
            ''
        ).strip().upper()

        discount = Decimal('0')

        if coupon == 'TECH5':
            discount = (
                subtotal *
                Decimal('0.05')
            )

        # --------------------------------
        # Final Total
        # --------------------------------

        total = (
            subtotal -
            discount +
            delivery_fee
        )

        # --------------------------------
        # Create Order
        # --------------------------------

        order = Order.objects.create(

            user=(
                request.user
                if request.user.is_authenticated
                else None
            ),

            first_name=first_name,
            last_name=last_name,
            email=email,
            mobile=mobile,

            address=address,
            upazila=upazila,
            district=district,

            comment=comment,

            payment_method=payment_method,
            delivery_method=delivery_method,

            subtotal=subtotal,
            discount=discount,
            delivery_fee=delivery_fee,
            total=total,

            status='Pending',
        )

        # --------------------------------
        # Create Order Items
        # & Reduce Stock
        # --------------------------------

        for item in order_items:

            OrderItem.objects.create(
                order=order,
                product=item['product'],
                product_name=item['product_name'],
                price=item['price'],
                quantity=item['quantity'],
                subtotal=item['subtotal'],
            )

            item['product'].stock -= (
                item['quantity']
            )

            item['product'].save(
                update_fields=['stock']
            )

        # --------------------------------
        # Response
        # --------------------------------

        return Response(
            {
                'message':
                    'Order created successfully.',

                'order_number':
                    order.order_number,

                'order_id':
                    order.id,

                'subtotal':
                    order.subtotal,

                'discount':
                    order.discount,

                'delivery_fee':
                    order.delivery_fee,

                'total':
                    order.total,

                'status':
                    order.status,
            },
            status=status.HTTP_201_CREATED
        )


# ==================================================
# MY ORDERS API
# ==================================================

class CancelOrderAPIView(APIView):

    def patch(self, request, order_id):

        if not request.user.is_authenticated:
            return Response(
                {
                    'error':
                    'Please login to cancel this order.'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            order = Order.objects.get(
                id=order_id
            )
        except Order.DoesNotExist:
            return Response(
                {
                    'error': 'Order not found.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        if order.user_id != request.user.id:
            return Response(
                {
                    'error': 'You do not have permission to cancel this order.'
                },
                status=status.HTTP_403_FORBIDDEN
            )

        if order.status in ['Cancelled', 'Delivered', 'Shipped']:
            return Response(
                {
                    'error':
                    'This order cannot be cancelled.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = 'Cancelled'
        order.save(update_fields=['status', 'updated_at'])

        return Response(
            {
                'message': 'Order cancelled successfully.',
                'status': order.status,
                'order_id': order.id,
            },
            status=status.HTTP_200_OK
        )


class MyOrdersAPIView(APIView):

    def get(self, request):

        # --------------------------------
        # Check Authentication
        # --------------------------------

        if not request.user.is_authenticated:
            return Response(
                {
                    'error':
                    'Please login to view your orders.'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        # --------------------------------
        # Get Current User Orders
        # --------------------------------

        orders = (
            Order.objects
            .filter(
                user=request.user
            )
            .prefetch_related('items')
            .order_by('-created_at')
        )

        result = []

        # --------------------------------
        # Prepare Order Data
        # --------------------------------

        for order in orders:

            order_data = {
                'id': order.id,

                'order_number':
                    order.order_number,

                'first_name':
                    order.first_name,

                'last_name':
                    order.last_name,

                'email':
                    order.email,

                'mobile':
                    order.mobile,

                'address':
                    order.address,

                'upazila':
                    order.upazila,

                'district':
                    order.district,

                'payment_method':
                    order.payment_method,

                'delivery_method':
                    order.delivery_method,

                'subtotal':
                    order.subtotal,

                'discount':
                    order.discount,

                'delivery_fee':
                    order.delivery_fee,

                'total':
                    order.total,

                'status':
                    order.status,

                'created_at':
                    order.created_at,

                'items': [],
            }

            # --------------------------------
            # Order Items
            # --------------------------------

            for item in order.items.all():

                order_data['items'].append(
                    {
                        'id': item.id,

                        'product':
                            item.product.id,

                        'product_name':
                            item.product_name,

                        'price':
                            item.price,

                        'quantity':
                            item.quantity,

                        'subtotal':
                            item.subtotal,
                    }
                )

            result.append(order_data)

        return Response(
            result,
            status=status.HTTP_200_OK
        )