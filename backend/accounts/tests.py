from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from products.models import Brand, Category, Product
from orders.models import Order
from .models import SocialAccount, UserRoleProfile

User = get_user_model()


class SocialAccountModelTests(TestCase):
    def test_social_account_links_existing_user_by_email(self):
        user = User.objects.create_user(
            username='existinguser',
            email='user@example.com',
            password='secretpass123'
        )

        social_account = SocialAccount.objects.create(
            user=user,
            provider='google',
            provider_user_id='google-123',
            email='user@example.com',
        )

        self.assertEqual(social_account.user, user)
        self.assertEqual(social_account.provider, 'google')
        self.assertEqual(social_account.provider_user_id, 'google-123')
        self.assertEqual(user.email, 'user@example.com')


class RoleAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='customer-role-test',
            email='customer-role@example.com',
            password='StrongPass!234',
        )
        self.employee = User.objects.create_user(
            username='employee-role-test',
            email='employee-role@example.com',
            password='StrongPass!234',
        )
        self.admin = User.objects.create_superuser(
            username='admin-role-test',
            email='admin-role@example.com',
            password='StrongPass!234',
        )
        UserRoleProfile.objects.create(user=self.customer, role=UserRoleProfile.ROLE_CUSTOMER)
        UserRoleProfile.objects.create(user=self.employee, role=UserRoleProfile.ROLE_EMPLOYEE)
        UserRoleProfile.objects.create(user=self.admin, role=UserRoleProfile.ROLE_ADMIN)
        self.category = Category.objects.create(name='Role test category', slug='role-test-category')
        self.brand = Brand.objects.create(name='Role test brand', slug='role-test-brand')

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_login_returns_backend_role_for_each_account(self):
        for user, expected_role in [
            (self.admin, 'admin'),
            (self.employee, 'employee'),
            (self.customer, 'customer'),
        ]:
            response = self.client.post('/api/accounts/login/', {
                'username': user.username,
                'password': 'StrongPass!234',
            }, format='json')

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['user']['role'], expected_role)
            self.assertEqual(response.data['role'], expected_role)
            self.assertNotIn('password', response.data['user'])

    def test_login_accepts_email_as_username(self):
        response = self.client.post('/api/accounts/login/', {
            'username': self.customer.email,
            'password': 'StrongPass!234',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['role'], 'customer')

    def test_public_registration_cannot_choose_a_role(self):
        response = self.client.post('/api/accounts/register/', {
            'username': 'public-role-test',
            'email': 'public-role@example.com',
            'password': 'StrongPass!234',
            'password2': 'StrongPass!234',
            'role': 'admin',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='public-role-test')
        self.assertEqual(user.role_profile.role, UserRoleProfile.ROLE_CUSTOMER)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_customer_cannot_access_management_apis(self):
        self.authenticate(self.customer)

        for path in [
            '/api/admin/products/',
            '/api/admin/orders/',
            '/api/admin/customers/',
            '/api/admin/employees/',
            '/api/employee/dashboard/',
        ]:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 403)

        self.assertEqual(self.client.post('/api/admin/products/', {}, format='json').status_code, 403)

    def test_employee_is_limited_to_operational_apis(self):
        self.authenticate(self.employee)

        for path in [
            '/api/admin/orders/',
            '/api/admin/products/',
            '/api/admin/customers/',
            '/api/admin/employees/',
        ]:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 403)

        self.assertEqual(self.client.get('/api/employee/dashboard/').status_code, 200)
        self.assertEqual(self.client.get('/api/employee/orders/').status_code, 200)
        self.assertEqual(self.client.get('/api/employee/products/').status_code, 200)
        self.assertEqual(self.client.get('/api/employee/categories/').status_code, 200)

    def test_employee_can_create_products_but_cannot_manage_product_status(self):
        self.authenticate(self.employee)
        response = self.client.post('/api/employee/products/', {
            'name': 'Employee-created product',
            'category': self.category.id,
            'brand': self.brand.id,
            'sku': 'EMPLOYEE-ROLE-1',
            'price': '25.00',
            'stock': 4,
            'description': 'Created by an employee',
            'is_active': False,
            'is_featured': True,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        product = Product.objects.get(sku='EMPLOYEE-ROLE-1')
        self.assertTrue(product.is_active)
        self.assertFalse(product.is_featured)

        response = self.client.patch(
            f'/api/employee/products/{product.id}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_employee_can_advance_orders_but_not_cancel(self):
        order = Order.objects.create(
            user=self.customer,
            first_name='Test',
            last_name='Customer',
            email='customer-role@example.com',
            mobile='0123456789',
            address='Test address',
            upazila='Test upazila',
            district='Test district',
            subtotal='25.00',
            total='25.00',
        )
        self.authenticate(self.employee)

        response = self.client.patch(
            f'/api/employee/orders/{order.id}/status/',
            {'status': 'Confirmed'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.patch(
            f'/api/employee/orders/{order.id}/status/',
            {'status': 'Cancelled'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_can_access_admin_and_employee_apis(self):
        self.authenticate(self.admin)

        self.assertEqual(self.client.get('/api/admin/dashboard/').status_code, 200)
        self.assertEqual(self.client.get('/api/admin/customers/').status_code, 200)
        self.assertEqual(self.client.get('/api/admin/employees/').status_code, 200)
        self.assertEqual(self.client.get('/api/employee/orders/').status_code, 200)

    def test_admin_can_create_and_deactivate_employee(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/admin/employees/', {
            'first_name': 'Created',
            'last_name': 'Employee',
            'username': 'created-role-employee',
            'email': 'created-role-employee@example.com',
            'password': 'EmployeePass!482',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        employee = User.objects.get(username='created-role-employee')
        self.assertEqual(employee.role_profile.role, UserRoleProfile.ROLE_EMPLOYEE)
        self.assertFalse(employee.is_staff)

        response = self.client.patch(
            f'/api/admin/employees/{employee.id}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        employee.refresh_from_db()
        self.assertFalse(employee.is_active)

    def test_profile_endpoint_only_updates_request_user_fields(self):
        self.authenticate(self.customer)
        response = self.client.patch('/api/accounts/profile/', {
            'first_name': 'New',
            'role': 'admin',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.first_name, 'New')
        self.assertEqual(self.customer.role_profile.role, UserRoleProfile.ROLE_CUSTOMER)
