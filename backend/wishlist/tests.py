from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from products.models import Brand, Category, Product


class WishlistAPITests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='wishlist-user',
            password='test-password'
        )
        self.other_user = user_model.objects.create_user(
            username='other-user',
            password='test-password'
        )
        category = Category.objects.create(
            name='Test Category',
            slug='test-category'
        )
        brand = Brand.objects.create(
            name='Test Brand',
            slug='test-brand'
        )
        self.product = Product.objects.create(
            category=category,
            brand=brand,
            name='Test Product',
            slug='test-product',
            sku='TEST-001',
            description='Test product description',
            price='100.00'
        )
        self.inactive_product = Product.objects.create(
            category=category,
            brand=brand,
            name='Inactive Product',
            slug='inactive-product',
            sku='TEST-002',
            description='Inactive product description',
            price='100.00',
            is_active=False
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_wishlist_requires_authentication(self):
        response = self.client.get('/api/wishlist/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_add_is_idempotent_and_user_specific(self):
        self.authenticate(self.user)

        first_response = self.client.post(
            '/api/wishlist/add/',
            {'product_id': self.product.id},
            format='json'
        )
        duplicate_response = self.client.post(
            '/api/wishlist/add/',
            {'product_id': self.product.id},
            format='json'
        )

        self.assertEqual(
            first_response.status_code,
            status.HTTP_201_CREATED
        )
        self.assertEqual(
            duplicate_response.status_code,
            status.HTTP_200_OK
        )
        self.assertEqual(
            len(self.client.get('/api/wishlist/').data),
            1
        )

        self.authenticate(self.other_user)
        other_user_response = self.client.get('/api/wishlist/')

        self.assertEqual(other_user_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(other_user_response.data), 0)

    def test_inactive_product_cannot_be_added(self):
        self.authenticate(self.user)

        response = self.client.post(
            '/api/wishlist/add/',
            {'product_id': self.inactive_product.id},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_toggle_and_remove(self):
        self.authenticate(self.user)

        add_response = self.client.post(
            '/api/wishlist/toggle/',
            {'product_id': self.product.id},
            format='json'
        )
        remove_response = self.client.post(
            '/api/wishlist/toggle/',
            {'product_id': self.product.id},
            format='json'
        )

        self.assertEqual(add_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(add_response.data['is_in_wishlist'])
        self.assertEqual(remove_response.status_code, status.HTTP_200_OK)
        self.assertFalse(remove_response.data['is_in_wishlist'])
