from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

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
