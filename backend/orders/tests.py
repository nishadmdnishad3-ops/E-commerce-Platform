from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import UserRoleProfile
from .models import Order

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
