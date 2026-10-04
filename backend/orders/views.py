from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRoleProfile
from accounts.permissions import IsAdmin, IsAdminOrEmployee
from accounts.roles import get_user_role
from products.models import Product
from .models import (
    Coupon,
    CouponUsage,
    GiftVoucher,
    GiftVoucherUsage,
    Order,
    OrderItem,
)

User = get_user_model()

MONEY_QUANTIZER = Decimal('0.01')


def money(value):
    return Decimal(str(value)).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def normalize_code(value):
    if value is None:
        return ''
    return str(value).strip().upper()


def calculate_coupon_discount(subtotal, coupon, user=None):
    if coupon is None:
        return Decimal('0')

    today = timezone.now().date()
    if not coupon.is_active:
        raise ValueError('This coupon is currently inactive.')
    if not coupon.start_date <= today <= coupon.end_date:
        raise ValueError('This coupon has expired.')
    if coupon.minimum_order_amount and subtotal < coupon.minimum_order_amount:
        raise ValueError(f'Minimum order amount is ৳{coupon.minimum_order_amount:.2f}.')
    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        raise ValueError('This coupon has reached its usage limit.')
    if user and coupon.per_user_limit is not None:
        used_by_user = CouponUsage.objects.filter(coupon=coupon, user=user).count()
        if used_by_user >= coupon.per_user_limit:
            raise ValueError('You have already used this coupon.')

    if coupon.discount_type == Coupon.DISCOUNT_PERCENTAGE:
        raw_discount = subtotal * (coupon.discount_value / Decimal('100'))
        if coupon.maximum_discount_amount is not None:
            raw_discount = min(raw_discount, coupon.maximum_discount_amount)
        return money(min(raw_discount, subtotal))

    fixed_discount = money(coupon.discount_value)
    return money(min(fixed_discount, subtotal))


def calculate_gift_voucher_discount(subtotal, voucher, user=None):
    if voucher is None:
        return Decimal('0')

    today = timezone.now().date()
    if not voucher.is_active:
        raise ValueError('This gift voucher is currently inactive.')
    if not voucher.start_date <= today <= voucher.end_date:
        raise ValueError('This gift voucher has expired.')
    if voucher.minimum_order_amount and subtotal < voucher.minimum_order_amount:
        raise ValueError(f'Minimum order amount is ৳{voucher.minimum_order_amount:.2f}.')
    if voucher.discount_type == GiftVoucher.DISCOUNT_PERCENTAGE:
        discount = subtotal * (voucher.discount_value / Decimal('100'))
        if voucher.maximum_discount_amount is not None:
            discount = min(discount, voucher.maximum_discount_amount)
        return money(min(discount, subtotal))

    if voucher.remaining_balance <= 0:
        raise ValueError('This gift voucher has no balance remaining.')

    return money(min(voucher.remaining_balance, subtotal))


def validate_gift_voucher_values(discount_type, discount_value, maximum_discount_amount=None):
    if discount_type not in {
        GiftVoucher.DISCOUNT_FIXED,
        GiftVoucher.DISCOUNT_PERCENTAGE,
    }:
        raise ValueError('Select a valid gift voucher discount type.')

    try:
        value = Decimal(str(discount_value))
    except Exception as exc:
        raise ValueError('Enter a valid gift voucher discount value.') from exc
    if not value.is_finite():
        raise ValueError('Enter a valid gift voucher discount value.')

    if discount_type == GiftVoucher.DISCOUNT_FIXED and value < 0:
        raise ValueError('Fixed voucher discount must be zero or greater.')
    if discount_type == GiftVoucher.DISCOUNT_PERCENTAGE and not Decimal('0') < value <= Decimal('100'):
        raise ValueError('Percentage voucher discount must be greater than 0 and at most 100.')
    value = money(value)
    if discount_type == GiftVoucher.DISCOUNT_PERCENTAGE and value <= 0:
        raise ValueError('Percentage voucher discount must be greater than 0 and at most 100.')

    maximum = None
    if maximum_discount_amount not in (None, ''):
        try:
            maximum = Decimal(str(maximum_discount_amount))
        except Exception as exc:
            raise ValueError('Enter a valid maximum discount amount.') from exc
        if not maximum.is_finite() or maximum < 0:
            raise ValueError('Maximum discount amount must be zero or greater.')
        maximum = money(maximum)

    return value, maximum


def build_discount_summary(subtotal, coupon_code, voucher_code, user=None):
    coupon_discount = Decimal('0')
    voucher_discount = Decimal('0')
    coupon = None
    voucher = None

    normalized_coupon_code = normalize_code(coupon_code)
    normalized_voucher_code = normalize_code(voucher_code)

    if normalized_coupon_code:
        coupon = Coupon.objects.filter(code__iexact=normalized_coupon_code).first()
        if coupon is None:
            raise ValueError('Invalid coupon code.')
        coupon_discount = calculate_coupon_discount(subtotal, coupon, user=user)

    remaining_after_coupon = max(subtotal - coupon_discount, Decimal('0'))

    if normalized_voucher_code:
        voucher = GiftVoucher.objects.filter(code__iexact=normalized_voucher_code).first()
        if voucher is None:
            raise ValueError('Invalid gift voucher code.')
        requested_voucher_discount = calculate_gift_voucher_discount(subtotal, voucher, user=user)
        voucher_discount = min(requested_voucher_discount, remaining_after_coupon)

    return {
        'coupon': coupon,
        'voucher': voucher,
        'coupon_discount': money(coupon_discount),
        'voucher_discount': money(voucher_discount),
        'final_discounted_subtotal': money(max(subtotal - coupon_discount - voucher_discount, Decimal('0'))),
    }


class ValidateCouponAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        subtotal = request.data.get('subtotal', 0)
        try:
            subtotal_decimal = money(subtotal)
        except Exception:
            return Response({'error': 'Invalid subtotal.'}, status=status.HTTP_400_BAD_REQUEST)

        code = normalize_code(request.data.get('code'))
        if not code:
            return Response({'error': 'Please enter a coupon code.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            voucher_code = normalize_code(request.data.get('voucher_code'))
            if voucher_code:
                summary = build_discount_summary(
                    subtotal_decimal,
                    code,
                    voucher_code,
                    user=request.user,
                )
                coupon = summary['coupon']
                discount = summary['coupon_discount']
                voucher = summary['voucher']
                voucher_discount = summary['voucher_discount']
            else:
                coupon = Coupon.objects.get(code__iexact=code)
                discount = calculate_coupon_discount(subtotal_decimal, coupon, user=request.user)
                voucher = None
                voucher_discount = None

            response_data = {
                'message': 'Coupon applied successfully.',
                'code': coupon.code,
                'discount_type': coupon.discount_type,
                'discount_amount': str(discount),
                'minimum_order_amount': str(coupon.minimum_order_amount),
            }
            if voucher:
                response_data['voucher_discount_amount'] = str(voucher_discount)
            return Response(response_data, status=status.HTTP_200_OK)
        except Coupon.DoesNotExist:
            return Response({'error': 'Invalid coupon code.'}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class ValidateGiftVoucherAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        subtotal = request.data.get('subtotal', 0)
        try:
            subtotal_decimal = money(subtotal)
        except Exception:
            return Response({'error': 'Invalid subtotal.'}, status=status.HTTP_400_BAD_REQUEST)

        code = normalize_code(request.data.get('code'))
        if not code:
            return Response({'error': 'Please enter a gift voucher code.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            coupon_code = normalize_code(request.data.get('coupon_code'))
            summary = build_discount_summary(
                subtotal_decimal,
                coupon_code,
                code,
                user=request.user,
            )
            voucher = summary['voucher']
            discount = summary['voucher_discount']
            return Response({
                'message': 'Gift voucher applied successfully.',
                'code': voucher.code,
                'discount_type': voucher.discount_type,
                'discount_value': str(voucher.discount_value),
                'maximum_discount_amount': (
                    str(voucher.maximum_discount_amount)
                    if voucher.maximum_discount_amount is not None
                    else None
                ),
                'discount_amount': str(discount),
                'remaining_balance': (
                    str(voucher.remaining_balance)
                    if voucher.discount_type == GiftVoucher.DISCOUNT_FIXED
                    else None
                ),
                'minimum_order_amount': str(voucher.minimum_order_amount),
            }, status=status.HTTP_200_OK)
        except GiftVoucher.DoesNotExist:
            return Response({'error': 'Invalid gift voucher code.'}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


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
        # Coupon / Gift Voucher Validation
        # --------------------------------

        coupon_code = normalize_code(data.get('coupon_code') or data.get('coupon'))
        gift_voucher_code = normalize_code(data.get('gift_voucher_code') or data.get('gift_voucher') or data.get('voucher'))

        try:
            discount_summary = build_discount_summary(subtotal, coupon_code, gift_voucher_code, user=request.user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        coupon_discount = discount_summary['coupon_discount']
        gift_voucher_discount = discount_summary['voucher_discount']
        applied_coupon = discount_summary['coupon']
        applied_voucher = discount_summary['voucher']

        discounted_subtotal = max(subtotal - coupon_discount - gift_voucher_discount, Decimal('0'))
        total = discounted_subtotal + delivery_fee

        # --------------------------------
        # Create Order
        # --------------------------------

        order = Order.objects.create(
            user=request.user,
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
            coupon_code=applied_coupon.code if applied_coupon else None,
            coupon_discount=coupon_discount,
            gift_voucher_code=applied_voucher.code if applied_voucher else None,
            gift_voucher_discount=gift_voucher_discount,
            discount=coupon_discount + gift_voucher_discount,
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

            item['product'].stock -= item['quantity']
            item['product'].save(update_fields=['stock'])

        if applied_coupon:
            applied_coupon.used_count += 1
            applied_coupon.save(update_fields=['used_count', 'updated_at'])
            CouponUsage.objects.create(
                coupon=applied_coupon,
                user=request.user,
                order=order,
                discount_amount=coupon_discount,
            )

        if applied_voucher:
            if applied_voucher.discount_type == GiftVoucher.DISCOUNT_FIXED:
                applied_voucher.remaining_balance = max(
                    applied_voucher.remaining_balance - gift_voucher_discount,
                    Decimal('0'),
                )
                applied_voucher.save(update_fields=['remaining_balance', 'updated_at'])
            GiftVoucherUsage.objects.create(
                voucher=applied_voucher,
                user=request.user,
                order=order,
                amount_used=gift_voucher_discount,
            )

        # --------------------------------
        # Response
        # --------------------------------

        return Response(
            {
                'message': 'Order created successfully.',
                'order_number': order.order_number,
                'order_id': order.id,
                'subtotal': order.subtotal,
                'discount': order.discount,
                'delivery_fee': order.delivery_fee,
                'total': order.total,
                'status': order.status,
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


class AdminCouponListCreateAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        coupons = Coupon.objects.all().order_by('-created_at')
        result = []
        for coupon in coupons:
            result.append({
                'id': coupon.id,
                'code': coupon.code,
                'discount_type': coupon.discount_type,
                'discount_value': str(coupon.discount_value),
                'minimum_order_amount': str(coupon.minimum_order_amount),
                'maximum_discount_amount': str(coupon.maximum_discount_amount) if coupon.maximum_discount_amount is not None else None,
                'start_date': coupon.start_date.isoformat(),
                'end_date': coupon.end_date.isoformat(),
                'usage_limit': coupon.usage_limit,
                'used_count': coupon.used_count,
                'per_user_limit': coupon.per_user_limit,
                'is_active': coupon.is_active,
            })
        return Response(result)

    def post(self, request):
        code = normalize_code(request.data.get('code'))
        if not code:
            return Response({'error': 'Coupon code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        discount_type = (request.data.get('discount_type') or Coupon.DISCOUNT_PERCENTAGE).strip().lower()
        if discount_type not in {Coupon.DISCOUNT_PERCENTAGE, Coupon.DISCOUNT_FIXED}:
            return Response({'error': 'Invalid discount type.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            discount_value = Decimal(str(request.data.get('discount_value', 0)))
            minimum_order_amount = Decimal(str(request.data.get('minimum_order_amount', 0)))
            maximum_discount_amount = request.data.get('maximum_discount_amount')
            if maximum_discount_amount not in (None, '', 'None'):
                maximum_discount_amount = Decimal(str(maximum_discount_amount))
            usage_limit = request.data.get('usage_limit') or None
            per_user_limit = request.data.get('per_user_limit') or None
            start_date = request.data.get('start_date')
            end_date = request.data.get('end_date')
            if not start_date or not end_date:
                return Response({'error': 'Start and end dates are required.'}, status=status.HTTP_400_BAD_REQUEST)

            coupon = Coupon.objects.create(
                code=code,
                discount_type=discount_type,
                discount_value=discount_value,
                minimum_order_amount=minimum_order_amount,
                maximum_discount_amount=maximum_discount_amount,
                start_date=start_date,
                end_date=end_date,
                usage_limit=int(usage_limit) if usage_limit not in (None, '', 'None') else None,
                per_user_limit=int(per_user_limit) if per_user_limit not in (None, '', 'None') else None,
                is_active=request.data.get('is_active', True) in [True, 'true', 'True', '1'],
            )
            return Response({
                'id': coupon.id,
                'code': coupon.code,
                'discount_type': coupon.discount_type,
                'discount_value': str(coupon.discount_value),
                'minimum_order_amount': str(coupon.minimum_order_amount),
            }, status=status.HTTP_201_CREATED)
        except Exception:
            return Response({'error': 'Invalid coupon data.'}, status=status.HTTP_400_BAD_REQUEST)


class AdminCouponDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, coupon_id):
        try:
            coupon = Coupon.objects.get(id=coupon_id)
        except Coupon.DoesNotExist:
            return Response({'error': 'Coupon not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'id': coupon.id,
            'code': coupon.code,
            'discount_type': coupon.discount_type,
            'discount_value': str(coupon.discount_value),
            'minimum_order_amount': str(coupon.minimum_order_amount),
            'maximum_discount_amount': str(coupon.maximum_discount_amount) if coupon.maximum_discount_amount is not None else None,
            'start_date': coupon.start_date.isoformat(),
            'end_date': coupon.end_date.isoformat(),
            'usage_limit': coupon.usage_limit,
            'used_count': coupon.used_count,
            'per_user_limit': coupon.per_user_limit,
            'is_active': coupon.is_active,
        })

    def patch(self, request, coupon_id):
        try:
            coupon = Coupon.objects.get(id=coupon_id)
        except Coupon.DoesNotExist:
            return Response({'error': 'Coupon not found.'}, status=status.HTTP_404_NOT_FOUND)

        for field in ['code', 'discount_type', 'discount_value', 'minimum_order_amount', 'maximum_discount_amount', 'start_date', 'end_date', 'usage_limit', 'per_user_limit', 'is_active']:
            if field in request.data:
                value = request.data.get(field)
                if field == 'code':
                    value = normalize_code(value)
                if field == 'is_active':
                    value = value in [True, 'true', 'True', '1']
                setattr(coupon, field, value)

        coupon.save()
        return Response({'message': 'Coupon updated successfully.'})

    def delete(self, request, coupon_id):
        try:
            coupon = Coupon.objects.get(id=coupon_id)
        except Coupon.DoesNotExist:
            return Response({'error': 'Coupon not found.'}, status=status.HTTP_404_NOT_FOUND)
        coupon.delete()
        return Response({'message': 'Coupon deleted successfully.'}, status=status.HTTP_200_OK)


class AdminGiftVoucherListCreateAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        vouchers = GiftVoucher.objects.annotate(usage_count=Count('uses')).order_by('-created_at')
        result = []
        for voucher in vouchers:
            result.append({
                'id': voucher.id,
                'code': voucher.code,
                'discount_type': voucher.discount_type,
                'discount_value': str(voucher.discount_value),
                'maximum_discount_amount': (
                    str(voucher.maximum_discount_amount)
                    if voucher.maximum_discount_amount is not None
                    else None
                ),
                'initial_balance': str(voucher.initial_balance),
                'remaining_balance': str(voucher.remaining_balance),
                'minimum_order_amount': str(voucher.minimum_order_amount),
                'start_date': voucher.start_date.isoformat(),
                'end_date': voucher.end_date.isoformat(),
                'is_active': voucher.is_active,
                'usage_count': voucher.usage_count,
            })
        return Response(result)

    def post(self, request):
        code = normalize_code(request.data.get('code'))
        if not code:
            return Response({'error': 'Gift voucher code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            discount_type = (request.data.get('discount_type') or GiftVoucher.DISCOUNT_FIXED).strip().lower()
            discount_input = request.data.get('discount_value')
            if discount_input in (None, '') and discount_type == GiftVoucher.DISCOUNT_FIXED:
                discount_input = request.data.get('initial_balance')
            if discount_input in (None, ''):
                return Response({'error': 'Discount value is required.'}, status=status.HTTP_400_BAD_REQUEST)

            discount_value, maximum_discount_amount = validate_gift_voucher_values(
                discount_type,
                discount_input,
                request.data.get('maximum_discount_amount'),
            )
            if discount_type == GiftVoucher.DISCOUNT_FIXED:
                maximum_discount_amount = None
            minimum_order_amount = money(request.data.get('minimum_order_amount', 0))
            if not minimum_order_amount.is_finite() or minimum_order_amount < 0:
                return Response({'error': 'Minimum order amount must be zero or greater.'}, status=status.HTTP_400_BAD_REQUEST)

            balance = discount_value if discount_type == GiftVoucher.DISCOUNT_FIXED else Decimal('0')
            voucher = GiftVoucher.objects.create(
                code=code,
                discount_type=discount_type,
                discount_value=discount_value,
                maximum_discount_amount=maximum_discount_amount,
                initial_balance=balance,
                remaining_balance=balance,
                minimum_order_amount=minimum_order_amount,
                start_date=request.data.get('start_date'),
                end_date=request.data.get('end_date'),
                is_active=request.data.get('is_active', True) in [True, 'true', 'True', '1'],
            )
            return Response({
                'id': voucher.id,
                'code': voucher.code,
                'discount_type': voucher.discount_type,
                'discount_value': str(voucher.discount_value),
                'maximum_discount_amount': (
                    str(voucher.maximum_discount_amount)
                    if voucher.maximum_discount_amount is not None
                    else None
                ),
                'remaining_balance': str(voucher.remaining_balance),
            }, status=status.HTTP_201_CREATED)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Invalid gift voucher data.'}, status=status.HTTP_400_BAD_REQUEST)


class AdminGiftVoucherDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, gift_voucher_id):
        try:
            voucher = GiftVoucher.objects.get(id=gift_voucher_id)
        except GiftVoucher.DoesNotExist:
            return Response({'error': 'Gift voucher not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'id': voucher.id,
            'code': voucher.code,
            'discount_type': voucher.discount_type,
            'discount_value': str(voucher.discount_value),
            'maximum_discount_amount': (
                str(voucher.maximum_discount_amount)
                if voucher.maximum_discount_amount is not None
                else None
            ),
            'initial_balance': str(voucher.initial_balance),
            'remaining_balance': str(voucher.remaining_balance),
            'minimum_order_amount': str(voucher.minimum_order_amount),
            'start_date': voucher.start_date.isoformat(),
            'end_date': voucher.end_date.isoformat(),
            'is_active': voucher.is_active,
            'usage_count': voucher.uses.count(),
        })

    def patch(self, request, gift_voucher_id):
        try:
            voucher = GiftVoucher.objects.get(id=gift_voucher_id)
        except GiftVoucher.DoesNotExist:
            return Response({'error': 'Gift voucher not found.'}, status=status.HTTP_404_NOT_FOUND)

        has_uses = voucher.uses.exists()
        discount_type = (request.data.get('discount_type') or voucher.discount_type).strip().lower()
        discount_input = request.data.get('discount_value', voucher.discount_value)
        if 'discount_value' not in request.data and 'initial_balance' in request.data:
            if discount_type == GiftVoucher.DISCOUNT_FIXED:
                discount_input = request.data['initial_balance']
            else:
                return Response({'error': 'Percentage vouchers use discount_value, not initial_balance.'}, status=status.HTTP_400_BAD_REQUEST)

        maximum_input = request.data.get('maximum_discount_amount', voucher.maximum_discount_amount)
        try:
            discount_value, maximum_discount_amount = validate_gift_voucher_values(
                discount_type,
                discount_input,
                maximum_input,
            )
            if discount_type == GiftVoucher.DISCOUNT_FIXED:
                maximum_discount_amount = None

            minimum_order_amount = money(
                request.data.get('minimum_order_amount', voucher.minimum_order_amount)
            )
            if not minimum_order_amount.is_finite() or minimum_order_amount < 0:
                return Response({'error': 'Minimum order amount must be zero or greater.'}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Invalid gift voucher data.'}, status=status.HTTP_400_BAD_REQUEST)

        pricing_changed = (
            discount_type != voucher.discount_type
            or discount_value != voucher.discount_value
            or maximum_discount_amount != voucher.maximum_discount_amount
        )
        if has_uses and pricing_changed:
            return Response(
                {'error': 'Discount settings cannot be changed after a voucher has been used.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        voucher.discount_type = discount_type
        voucher.discount_value = discount_value
        voucher.maximum_discount_amount = maximum_discount_amount
        voucher.minimum_order_amount = minimum_order_amount

        if not has_uses:
            balance = discount_value if discount_type == GiftVoucher.DISCOUNT_FIXED else Decimal('0')
            voucher.initial_balance = balance
            voucher.remaining_balance = balance

        if 'code' in request.data:
            voucher.code = normalize_code(request.data.get('code'))
        for field in ['start_date', 'end_date']:
            if field in request.data:
                setattr(voucher, field, request.data[field])
        if 'is_active' in request.data:
            voucher.is_active = request.data.get('is_active') in [True, 'true', 'True', '1']

        try:
            voucher.save()
        except Exception:
            return Response({'error': 'Invalid gift voucher data.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': 'Gift voucher updated successfully.'})

    def delete(self, request, gift_voucher_id):
        try:
            voucher = GiftVoucher.objects.get(id=gift_voucher_id)
        except GiftVoucher.DoesNotExist:
            return Response({'error': 'Gift voucher not found.'}, status=status.HTTP_404_NOT_FOUND)
        if voucher.uses.exists():
            return Response(
                {'error': 'A gift voucher with redemption history cannot be deleted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        voucher.delete()
        return Response({'message': 'Gift voucher deleted successfully.'}, status=status.HTTP_200_OK)


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