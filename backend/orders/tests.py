from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import UserRoleProfile
from products.models import Brand, Category, Product
from .models import Coupon, GiftVoucher, GiftVoucherUsage, Order
from .views import build_discount_summary, calculate_gift_voucher_discount

User = get_user_model()


class CancelOrderAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='secret123'
        )
        self.order = Order.objects.create(
            user=self.user,
            first_name='Test',
            last_name='User',
            email='test@example.com',
            mobile='123456789',
            address='Test Address',
            upazila='Dhaka',
            district='Dhaka',
            subtotal='100.00',
            total='100.00',
            status='Pending',
        )

    def test_cancel_order_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            reverse('cancel-order', args=[self.order.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'Cancelled')
        self.assertEqual(response.data['status'], 'Cancelled')

    def test_cancel_order_forbidden_for_other_user(self):
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='secret123'
        )
        self.client.force_authenticate(user=other_user)
        response = self.client.patch(
            reverse('cancel-order', args=[self.order.id])
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'Pending')


class OrderStatusUpdateAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='adminuser',
            email='admin@example.com',
            password='secret123',
        )
        UserRoleProfile.objects.create(user=self.admin, role=UserRoleProfile.ROLE_ADMIN)
        self.customer = User.objects.create_user(
            username='customeruser',
            email='customer@example.com',
            password='secret123',
        )
        self.order = Order.objects.create(
            user=self.customer,
            first_name='Test',
            last_name='User',
            email='customer@example.com',
            mobile='123456789',
            address='Test Address',
            upazila='Dhaka',
            district='Dhaka',
            subtotal='100.00',
            total='100.00',
            status='Pending',
        )

    def update_status(self, new_status):
        return self.client.patch(
            reverse('admin-order-status', args=[self.order.id]),
            {'status': new_status},
            format='json',
        )

    def test_admin_can_advance_order_through_full_workflow(self):
        self.client.force_authenticate(user=self.admin)

        for new_status in ['Confirmed', 'Processing', 'Shipped', 'Delivered']:
            response = self.update_status(new_status)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data['status'], new_status)
            self.order.refresh_from_db()
            self.assertEqual(self.order.status, new_status)

        self.client.force_authenticate(user=self.customer)
        customer_orders = self.client.get(reverse('my-orders'))
        self.assertEqual(customer_orders.status_code, status.HTTP_200_OK)
        self.assertEqual(customer_orders.data[0]['status'], 'Delivered')

    def test_invalid_backward_transition_is_rejected(self):
        self.client.force_authenticate(user=self.admin)
        self.order.status = 'Shipped'
        self.order.save(update_fields=['status'])

        response = self.update_status('Pending')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'Shipped')

    def test_customer_cannot_update_order_status(self):
        self.client.force_authenticate(user=self.customer)

        response = self.update_status('Confirmed')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'Pending')

    def test_employee_can_only_use_employee_status_transitions(self):
        employee = User.objects.create_user(
            username='employeeuser',
            email='employee@example.com',
            password='secret123',
        )
        UserRoleProfile.objects.create(user=employee, role=UserRoleProfile.ROLE_EMPLOYEE)
        self.client.force_authenticate(user=employee)

        response = self.client.patch(
            reverse('employee-order-status', args=[self.order.id]),
            {'status': 'Confirmed'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.patch(
            reverse('employee-order-status', args=[self.order.id]),
            {'status': 'Shipped'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'Confirmed')


class AdminGiftVoucherAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='voucheradmin',
            email='voucheradmin@example.com',
            password='secret123',
        )
        UserRoleProfile.objects.create(user=self.admin, role=UserRoleProfile.ROLE_ADMIN)
        self.employee = User.objects.create_user(
            username='voucheremployee',
            email='voucheremployee@example.com',
            password='secret123',
        )
        UserRoleProfile.objects.create(user=self.employee, role=UserRoleProfile.ROLE_EMPLOYEE)
        self.customer = User.objects.create_user(
            username='vouchercustomer',
            email='vouchercustomer@example.com',
            password='secret123',
        )
        UserRoleProfile.objects.create(user=self.customer, role=UserRoleProfile.ROLE_CUSTOMER)
        self.voucher = GiftVoucher.objects.create(
            code='TM-GIFT500',
            initial_balance='500.00',
            remaining_balance='500.00',
            minimum_order_amount='100.00',
            start_date=date.today(),
            end_date=date.today(),
            is_active=True,
        )
        self.voucher.refresh_from_db()
        self.category = Category.objects.create(name='Test Category', slug='voucher-test-category')
        self.brand = Brand.objects.create(name='Test Brand', slug='voucher-test-brand')
        self.product = Product.objects.create(
            category=self.category,
            brand=self.brand,
            name='Test Product',
            slug='voucher-test-product',
            sku='VOUCHER-TEST-1',
            description='Test product for order creation',
            price='10000.00',
            stock=5,
        )
        self.list_url = '/api/admin/gift-vouchers/'
        self.detail_url = f'{self.list_url}{self.voucher.id}/'

    def make_percentage_voucher(self, code='GIFT10', value='10.00', maximum=None, minimum='0.00'):
        voucher = GiftVoucher.objects.create(
            code=code,
            discount_type=GiftVoucher.DISCOUNT_PERCENTAGE,
            discount_value=value,
            maximum_discount_amount=maximum,
            initial_balance='0.00',
            remaining_balance='0.00',
            minimum_order_amount=minimum,
            start_date=date.today(),
            end_date=date.today(),
            is_active=True,
        )
        voucher.refresh_from_db()
        return voucher

    def test_employee_cannot_access_voucher_management(self):
        self.client.force_authenticate(user=self.employee)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_toggle_voucher_status(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(self.detail_url, {'is_active': False}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.voucher.refresh_from_db()
        self.assertFalse(self.voucher.is_active)

    def test_admin_can_create_voucher_and_customer_can_validate_it(self):
        self.client.force_authenticate(user=self.admin)
        create_response = self.client.post(
            self.list_url,
            {
                'code': 'TM-GIFT500-NEW',
                'initial_balance': '500.00',
                'minimum_order_amount': '1000.00',
                'start_date': date.today().isoformat(),
                'end_date': date.today().isoformat(),
                'is_active': True,
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.customer)
        validate_response = self.client.post(
            '/api/orders/vouchers/validate/',
            {'code': 'TM-GIFT500-NEW', 'subtotal': '1200.00'},
            format='json',
        )

        self.assertEqual(validate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(validate_response.data['discount_amount'], '500.00')

    def test_admin_can_create_percentage_voucher_and_customer_can_validate_it(self):
        self.client.force_authenticate(user=self.admin)
        create_response = self.client.post(
            self.list_url,
            {
                'code': 'GIFT10-API',
                'discount_type': 'percentage',
                'discount_value': '10',
                'maximum_discount_amount': '1000',
                'minimum_order_amount': '5000',
                'start_date': date.today().isoformat(),
                'end_date': date.today().isoformat(),
                'is_active': True,
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.customer)
        validate_response = self.client.post(
            '/api/orders/vouchers/validate/',
            {'code': 'GIFT10-API', 'subtotal': '20000.00'},
            format='json',
        )

        self.assertEqual(validate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(validate_response.data['discount_type'], 'percentage')
        self.assertEqual(validate_response.data['discount_amount'], '1000.00')

    def test_admin_rejects_invalid_percentage_and_maximum_discount_values(self):
        self.client.force_authenticate(user=self.admin)
        for code, value in [('BADZERO', '0'), ('BADHIGH', '105'), ('BADNEG', '-5')]:
            response = self.client.post(
                self.list_url,
                {
                    'code': code,
                    'discount_type': 'percentage',
                    'discount_value': value,
                    'start_date': date.today().isoformat(),
                    'end_date': date.today().isoformat(),
                },
                format='json',
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        max_response = self.client.post(
            self.list_url,
            {
                'code': 'BADMAX',
                'discount_type': 'percentage',
                'discount_value': '10',
                'maximum_discount_amount': '-1',
                'start_date': date.today().isoformat(),
                'end_date': date.today().isoformat(),
            },
            format='json',
        )
        self.assertEqual(max_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_fixed_voucher_discount_is_capped_by_subtotal(self):
        self.assertEqual(
            calculate_gift_voucher_discount(Decimal('300.00'), self.voucher),
            Decimal('300.00'),
        )

    def test_percentage_voucher_discount_and_maximum_cap(self):
        voucher = self.make_percentage_voucher(maximum='1000.00')
        uncapped_voucher = self.make_percentage_voucher(code='GIFT10-UNCAPPED')

        self.assertEqual(
            calculate_gift_voucher_discount(Decimal('20000.00'), voucher),
            Decimal('1000.00'),
        )
        self.assertEqual(
            calculate_gift_voucher_discount(Decimal('20000.00'), uncapped_voucher),
            Decimal('2000.00'),
        )
        self.assertEqual(voucher.remaining_balance, Decimal('0.00'))

    def test_percentage_voucher_minimum_order_is_enforced(self):
        voucher = self.make_percentage_voucher(minimum='5000.00')

        with self.assertRaisesMessage(ValueError, 'Minimum order amount'):
            calculate_gift_voucher_discount(Decimal('4000.00'), voucher)

    def test_one_hundred_percent_voucher_and_fixed_over_value_never_go_negative(self):
        full_discount_voucher = self.make_percentage_voucher(code='GIFT100', value='100.00')

        self.assertEqual(
            calculate_gift_voucher_discount(Decimal('5000.00'), full_discount_voucher),
            Decimal('5000.00'),
        )
        self.assertEqual(
            max(Decimal('5000.00') - calculate_gift_voucher_discount(Decimal('5000.00'), full_discount_voucher), Decimal('0')),
            Decimal('0'),
        )

    def test_coupon_and_percentage_voucher_match_checkout_total_example(self):
        self.make_percentage_voucher()
        coupon = Coupon.objects.create(
            code='SAVE5',
            discount_type=Coupon.DISCOUNT_PERCENTAGE,
            discount_value='5.00',
            minimum_order_amount='0.00',
            start_date=date.today(),
            end_date=date.today(),
            is_active=True,
        )

        summary = build_discount_summary(
            Decimal('10000.00'),
            coupon.code,
            'GIFT10',
            user=self.customer,
        )

        self.assertEqual(summary['coupon_discount'], Decimal('500.00'))
        self.assertEqual(summary['voucher_discount'], Decimal('1000.00'))
        self.assertEqual(summary['final_discounted_subtotal'] + Decimal('70.00'), Decimal('8570.00'))

    def test_percentage_order_creation_records_discount_without_spending_balance(self):
        voucher = self.make_percentage_voucher(code='ORDER10')
        coupon = Coupon.objects.create(
            code='ORDER5',
            discount_type=Coupon.DISCOUNT_PERCENTAGE,
            discount_value='5.00',
            minimum_order_amount='0.00',
            start_date=date.today(),
            end_date=date.today(),
            is_active=True,
        )
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            '/api/orders/create/',
            {
                'first_name': 'Test',
                'last_name': 'Customer',
                'email': self.customer.email,
                'mobile': '123456789',
                'address': 'Test address',
                'upazila': 'Dhaka',
                'district': 'Dhaka',
                'payment_method': 'Cash on Delivery',
                'delivery_method': 'Home Delivery',
                'coupon_code': coupon.code,
                'gift_voucher_code': voucher.code,
                'items': [{'product_id': self.product.id, 'quantity': 1}],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        voucher.refresh_from_db()
        self.assertEqual(voucher.discount_value, Decimal('10.00'))
        self.assertEqual(voucher.remaining_balance, Decimal('0.00'))
        self.assertEqual(voucher.uses.count(), 1)
        self.assertEqual(response.data['total'], Decimal('8570.00'))
        order = Order.objects.get(id=response.data['order_id'])
        self.assertEqual(order.coupon_discount, Decimal('500.00'))
        self.assertEqual(order.gift_voucher_discount, Decimal('1000.00'))

    def test_editing_unused_voucher_updates_available_balance(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.detail_url,
            {'initial_balance': '600.00'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.voucher.refresh_from_db()
        self.assertEqual(self.voucher.initial_balance, 600)
        self.assertEqual(self.voucher.remaining_balance, 600)

    def test_admin_can_edit_unused_voucher_as_percentage(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.detail_url,
            {
                'discount_type': 'percentage',
                'discount_value': '10.00',
                'maximum_discount_amount': '1000.00',
                'minimum_order_amount': '5000.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.voucher.refresh_from_db()
        self.assertEqual(self.voucher.discount_type, GiftVoucher.DISCOUNT_PERCENTAGE)
        self.assertEqual(self.voucher.discount_value, Decimal('10.00'))
        self.assertEqual(self.voucher.maximum_discount_amount, Decimal('1000.00'))
        self.assertEqual(self.voucher.remaining_balance, Decimal('0.00'))

    def test_used_voucher_balance_cannot_be_changed_or_deleted(self):
        GiftVoucherUsage.objects.create(
            voucher=self.voucher,
            user=self.admin,
            amount_used='50.00',
        )
        self.client.force_authenticate(user=self.admin)

        balance_response = self.client.patch(
            self.detail_url,
            {'initial_balance': '600.00'},
            format='json',
        )
        delete_response = self.client.delete(self.detail_url)

        self.assertEqual(balance_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(delete_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(GiftVoucher.objects.filter(id=self.voucher.id).exists())

    def test_admin_can_delete_unused_voucher(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(GiftVoucher.objects.filter(id=self.voucher.id).exists())
