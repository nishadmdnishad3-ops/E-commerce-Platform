from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from orders.models import Order, OrderItem
from .models import Brand, Category, Product, ProductReview

User = get_user_model()


class ProductReviewModelTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(
            name='Phones',
            slug='phones',
            description='Phones',
        )
        self.brand = Brand.objects.create(
            name='Tech',
            slug='tech',
            description='Brand',
        )
        self.product = Product.objects.create(
            category=self.category,
            brand=self.brand,
            name='Test Product',
            slug='test-product',
            sku='SKU-001',
            description='A test product',
            price='100.00',
            discount_percentage=0,
            stock=10,
        )
        self.user = User.objects.create_user(
            username='reviewer',
            email='reviewer@example.com',
            password='secretpass123',
        )

    def test_rating_must_be_between_1_and_5(self):
        review = ProductReview(
            user=self.user,
            product=self.product,
            rating=6,
            review='This is too high',
        )

        with self.assertRaises(ValidationError):
            review.full_clean()

    def test_duplicate_review_for_same_user_product_is_blocked(self):
        ProductReview.objects.create(
            user=self.user,
            product=self.product,
            rating=5,
            review='First review',
        )

        with self.assertRaises(IntegrityError):
            ProductReview.objects.create(
                user=self.user,
                product=self.product,
                rating=4,
                review='Second review',
            )


class ProductReviewPermissionTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(
            name='Phones',
            slug='phones',
            description='Phones',
        )
        self.brand = Brand.objects.create(
            name='Tech',
            slug='tech',
            description='Brand',
        )
        self.product = Product.objects.create(
            category=self.category,
            brand=self.brand,
            name='Reviewable Product',
            slug='reviewable-product',
            sku='SKU-REVIEW-001',
            description='Product requiring delivery before review',
            price='100.00',
            discount_percentage=0,
            stock=10,
        )
        self.user = User.objects.create_user(
            username='buyer',
            email='buyer@example.com',
            password='secretpass123',
        )

    def test_user_without_purchase_cannot_submit_review(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse('product-review-list-create', args=[self.product.id]),
            {'rating': 5, 'review': 'Good product'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data['error'],
            'You can review this product only after purchasing it.'
        )

    def test_user_with_pending_order_cannot_submit_review(self):
        order = Order.objects.create(
            user=self.user,
            first_name='Buyer',
            last_name='User',
            email='buyer@example.com',
            mobile='123456',
            address='Street',
            upazila='Uttara',
            district='Dhaka',
            subtotal='100.00',
            total='100.00',
            status='Pending',
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            price='100.00',
            quantity=1,
            subtotal='100.00',
        )

        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse('product-review-list-create', args=[self.product.id]),
            {'rating': 5, 'review': 'Good product'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data['error'],
            'You can review this product after your order is delivered.'
        )

    def test_delivered_order_allows_review(self):
        order = Order.objects.create(
            user=self.user,
            first_name='Buyer',
            last_name='User',
            email='buyer@example.com',
            mobile='123456',
            address='Street',
            upazila='Uttara',
            district='Dhaka',
            subtotal='100.00',
            total='100.00',
            status='Delivered',
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            price='100.00',
            quantity=1,
            subtotal='100.00',
        )

        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse('product-review-list-create', args=[self.product.id]),
            {'rating': 5, 'review': 'Excellent product!'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ProductReview.objects.count(), 1)


class CategoryListAPIViewTests(APITestCase):
	def test_returns_active_categories_and_active_product_counts(self):
		brand = Brand.objects.create(name='Test Brand', slug='test-brand')
		category = Category.objects.create(
			name='Smart Home',
			slug='smart-home'
		)
		inactive_category = Category.objects.create(
			name='Hidden Category',
			slug='hidden-category',
			is_active=False
		)
		empty_category = Category.objects.create(
			name='Empty Category',
			slug='empty-category'
		)

		Product.objects.create(
			category=category,
			brand=brand,
			name='Active Product',
			slug='active-product',
			sku='ACTIVE-1',
			description='Active test product',
			price=10,
			is_active=True
		)
		Product.objects.create(
			category=category,
			brand=brand,
			name='Inactive Product',
			slug='inactive-product',
			sku='INACTIVE-1',
			description='Inactive test product',
			price=10,
			is_active=False
		)
		Product.objects.create(
			category=inactive_category,
			brand=brand,
			name='Hidden Product',
			slug='hidden-product',
			sku='HIDDEN-1',
			description='Product in inactive category',
			price=10,
			is_active=True
		)

		response = self.client.get(reverse('category-list'))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 2)
		self.assertEqual(response.data[0]['id'], category.id)
		self.assertEqual(response.data[0]['name'], 'Smart Home')
		self.assertEqual(response.data[0]['slug'], 'smart-home')
		self.assertTrue(response.data[0]['is_active'])
		self.assertIsNone(response.data[0]['image'])
		self.assertEqual(response.data[0]['product_count'], 1)
		self.assertEqual(response.data[1]['id'], empty_category.id)
		self.assertEqual(response.data[1]['product_count'], 0)
