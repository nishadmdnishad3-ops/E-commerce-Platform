from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Brand, Category, Product


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
