from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, Sum
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRoleProfile
from accounts.permissions import IsAdmin, IsAdminOrEmployee
from accounts.roles import get_user_role
from products.models import Product
from .models import Order, OrderItem

User = get_user_model()


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


class AdminDashboardAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        total_products = Product.objects.count()
        total_orders = Order.objects.count()
        pending_orders = Order.objects.filter(status='Pending').count()
        processing_orders = Order.objects.filter(status='Processing').count()
        delivered_orders = Order.objects.filter(status='Delivered').count()
        total_customers = User.objects.filter(
            is_active=True,
            role_profile__role=UserRoleProfile.ROLE_CUSTOMER,
        ).count()
        total_sales = Order.objects.aggregate(total=Sum('total'))['total'] or Decimal('0')

        recent_orders = Order.objects.select_related('user').order_by('-created_at')[:8]
        recent_products = Product.objects.select_related('category', 'brand').order_by('-created_at')[:6]

        return Response({
            'stats': {
                'total_products': total_products,
                'total_orders': total_orders,
                'pending_orders': pending_orders,
                'processing_orders': processing_orders,
                'delivered_orders': delivered_orders,
                'total_customers': total_customers,
                'total_sales': str(total_sales),
            },
            'recent_orders': [
                {
                    'id': order.id,
                    'order_number': order.order_number,
                    'customer': order.user.username if order.user else order.email,
                    'date': order.created_at.isoformat(),
                    'total': str(order.total),
                    'status': order.status,
                }
                for order in recent_orders
            ],
            'recent_products': [
                {
                    'id': product.id,
                    'name': product.name,
                    'category': product.category.name,
                    'brand': product.brand.name,
                    'price': str(product.discount_price if product.discount_price is not None else product.price),
                    'stock': product.stock,
                    'date_added': product.created_at.isoformat(),
                    'image': product.images.first().image.url if product.images.exists() else '',
                }
                for product in recent_products
            ],
        })


def get_allowed_order_statuses(user, current_status):
    transitions = {
        'Pending': ['Confirmed', 'Cancelled'],
        'Confirmed': ['Processing', 'Cancelled'],
        'Processing': ['Shipped'],
        'Shipped': ['Delivered'],
        'Delivered': [],
        'Cancelled': [],
    }
    if get_user_role(user) == UserRoleProfile.ROLE_EMPLOYEE:
        transitions['Pending'] = ['Confirmed']
        transitions['Confirmed'] = ['Processing']
    return transitions.get(current_status, [])


class AdminOrderListAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        orders = Order.objects.select_related('user').prefetch_related('items').order_by('-created_at')

        search = (request.query_params.get('search') or '').strip()
        status_filter = request.query_params.get('status')
        payment_filter = request.query_params.get('payment_method')
        delivery_filter = request.query_params.get('delivery_method')
        sort = request.query_params.get('sort', 'newest')

        if search:
            search_lower = search.lower()
            orders = orders.filter(
                Q(order_number__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(mobile__icontains=search)
                | Q(user__username__icontains=search)
            )

        if status_filter and status_filter != 'All':
            orders = orders.filter(status=status_filter)

        if payment_filter and payment_filter != 'All':
            orders = orders.filter(payment_method=payment_filter)

        if delivery_filter and delivery_filter != 'All':
            orders = orders.filter(delivery_method=delivery_filter)

        if sort == 'oldest':
            orders = orders.order_by('created_at')
        elif sort == 'highest_total':
            orders = orders.order_by('-total')
        elif sort == 'lowest_total':
            orders = orders.order_by('total')

        result = []
        for order in orders:
            result.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer_name': f'{order.first_name} {order.last_name}'.strip() or (order.user.username if order.user else 'Guest'),
                'email': order.email,
                'mobile': order.mobile,
                'date': order.created_at.isoformat(),
                'items_count': order.items.count(),
                'payment_method': order.payment_method,
                'delivery_method': order.delivery_method,
                'total': str(order.total),
                'status': order.status,
                'available_statuses': get_allowed_order_statuses(request.user, order.status),
            })

        return Response({'results': result, 'count': len(result)})


class AdminOrderDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, order_id):
        try:
            order = Order.objects.select_related('user').prefetch_related('items__product').get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'id': order.id,
            'order_number': order.order_number,
            'customer': {
                'name': f'{order.first_name} {order.last_name}'.strip() or (order.user.username if order.user else 'Guest'),
                'email': order.email,
                'mobile': order.mobile,
            },
            'shipping': {
                'address': order.address,
                'upazila': order.upazila,
                'district': order.district,
            },
            'payment_method': order.payment_method,
            'delivery_method': order.delivery_method,
            'status': order.status,
            'subtotal': str(order.subtotal),
            'discount': str(order.discount),
            'delivery_fee': str(order.delivery_fee),
            'total': str(order.total),
            'comment': order.comment,
            'created_at': order.created_at.isoformat(),
            'items': [
                {
                    'id': item.id,
                    'product_id': item.product.id,
                    'product_name': item.product_name,
                    'image': item.product.images.first().image.url if item.product.images.exists() else '',
                    'quantity': item.quantity,
                    'price': str(item.price),
                    'subtotal': str(item.subtotal),
                }
                for item in order.items.all()
            ],
        })


class AdminOrderStatusUpdateAPIView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_status = (request.data.get('status') or '').strip()
        if not new_status:
            return Response({'error': 'Status is required.'}, status=status.HTTP_400_BAD_REQUEST)

        available_statuses = get_allowed_order_statuses(request.user, order.status)
        if new_status not in available_statuses:
            return Response({
                'error': f'Invalid status transition from {order.status} to {new_status}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        order.status = new_status
        order.save(update_fields=['status', 'updated_at'])

        return Response({
            'message': f'Order status updated to {new_status}.',
            'status': order.status,
            'available_statuses': get_allowed_order_statuses(request.user, order.status),
        })


class EmployeeDashboardAPIView(APIView):
    permission_classes = [IsAdminOrEmployee]

    def get(self, request):
        return Response({
            'stats': {
                'total_orders': Order.objects.count(),
                'pending_orders': Order.objects.filter(status='Pending').count(),
                'processing_orders': Order.objects.filter(status='Processing').count(),
                'shipped_orders': Order.objects.filter(status='Shipped').count(),
                'total_products': Product.objects.filter(is_active=True).count(),
            },
        })


class EmployeeOrderListAPIView(AdminOrderListAPIView):
    permission_classes = [IsAdminOrEmployee]


class EmployeeOrderDetailAPIView(AdminOrderDetailAPIView):
    permission_classes = [IsAdminOrEmployee]


class EmployeeOrderStatusUpdateAPIView(AdminOrderStatusUpdateAPIView):
    permission_classes = [IsAdminOrEmployee]