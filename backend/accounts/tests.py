from decimal import Decimal
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework.test import APIClient

from products.models import Brand, Category, Product, ProductImage
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

    def google_login(self, payload, role='admin'):
        with override_settings(GOOGLE_CLIENT_ID='test-client.apps.googleusercontent.com'):
            with patch('accounts.views.id_token.verify_oauth2_token', return_value=payload) as verify_token:
                response = self.client.post('/api/accounts/google-login/', {
                    'credential': 'verified-id-token',
                    'role': role,
                }, format='json')
        verify_token.assert_called_once()
        self.assertEqual(verify_token.call_args.args[2], 'test-client.apps.googleusercontent.com')
        return response

    def test_google_login_creates_customer_without_a_usable_password(self):
        response = self.google_login({
            'sub': 'google-new-customer',
            'email': 'google-customer@example.com',
            'email_verified': True,
            'name': 'Google Customer',
            'given_name': 'Google',
            'family_name': 'Customer',
        })

        self.assertEqual(response.status_code, 200)
        user = User.objects.get(email='google-customer@example.com')
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.role_profile.role, UserRoleProfile.ROLE_CUSTOMER)
        self.assertEqual(response.data['user']['first_name'], 'Google')
        self.assertEqual(response.data['user']['role'], 'customer')
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_google_login_reuses_accounts_and_preserves_roles(self):
        for user, subject in [
            (self.customer, 'google-existing-customer'),
            (self.admin, 'google-existing-admin'),
            (self.employee, 'google-existing-employee'),
        ]:
            with self.subTest(role=user.role_profile.role):
                response = self.google_login({
                    'sub': subject,
                    'email': user.email,
                    'email_verified': True,
                    'name': user.username,
                })

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['user']['id'], user.pk)
                self.assertEqual(response.data['user']['role'], user.role_profile.role)

        repeat_response = self.google_login({
            'sub': 'google-existing-customer',
            'email': self.customer.email,
            'email_verified': True,
            'name': self.customer.username,
        })
        self.assertEqual(repeat_response.data['user']['id'], self.customer.pk)
        self.assertEqual(self.customer.social_accounts.filter(provider='google').count(), 1)

    def test_google_login_rejects_unverified_email(self):
        response = self.google_login({
            'sub': 'google-unverified',
            'email': 'unverified@example.com',
            'email_verified': False,
        })

        self.assertEqual(response.status_code, 401)
        self.assertIn('verified Google email', response.data['detail'])

    def test_google_login_rejects_invalid_credential(self):
        with override_settings(GOOGLE_CLIENT_ID='test-client.apps.googleusercontent.com'):
            with patch('accounts.views.id_token.verify_oauth2_token', side_effect=ValueError):
                response = self.client.post('/api/accounts/google-login/', {
                    'credential': 'invalid-token',
                }, format='json')

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['detail'], 'Google credential is invalid or expired.')

    def test_google_login_reports_missing_server_client_id(self):
        with override_settings(GOOGLE_CLIENT_ID=''):
            response = self.client.post('/api/accounts/google-login/', {
                'credential': 'verified-id-token',
            }, format='json')

        self.assertEqual(response.status_code, 503)
        self.assertIn('GOOGLE_CLIENT_ID', response.data['detail'])

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

    def test_login_jwt_allows_admin_to_create_product(self):
        login_response = self.client.post('/api/accounts/login/', {
            'username': self.admin.username,
            'password': 'StrongPass!234',
        }, format='json')
        self.assertEqual(login_response.status_code, 200)

        response = self.client.post(
            '/api/admin/products/',
            {
                'name': 'JWT-created product',
                'category': self.category.id,
                'brand': self.brand.id,
                'sku': 'JWT-ADMIN-1',
                'price': '25.00',
                'discount_percentage': '10',
                'stock': '4',
                'description': 'Created through a login-issued JWT',
                'is_active': 'true',
                'is_featured': 'false',
            },
            format='multipart',
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['discount_price'], '22.50')
        self.assertTrue(Product.objects.filter(sku='JWT-ADMIN-1').exists())

    def test_admin_can_update_discounted_product_without_replacing_image(self):
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            product = Product.objects.create(
                category=self.category,
                brand=self.brand,
                name='Product to update',
                slug='product-to-update',
                sku='UPDATE-ADMIN-1',
                description='Product with an existing image',
                price=Decimal('100.00'),
                discount_percentage=5,
            )
            existing_image = ProductImage.objects.create(
                product=product,
                image=SimpleUploadedFile('existing.jpg', b'existing-image', content_type='image/jpeg'),
                is_primary=True,
            )
            login_response = self.client.post('/api/accounts/login/', {
                'username': self.admin.username,
                'password': 'StrongPass!234',
            }, format='json')
            self.assertEqual(login_response.status_code, 200)
            auth_header = {'HTTP_AUTHORIZATION': f"Bearer {login_response.data['access']}"}

            response = self.client.patch(
                f'/api/admin/products/{product.id}/',
                {'price': '200.00'},
                format='multipart',
                **auth_header,
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['discount_price'], '190.00')
            self.assertEqual(list(product.images.values_list('id', flat=True)), [existing_image.id])

            replacement = SimpleUploadedFile('replacement.jpg', b'replacement-image', content_type='image/jpeg')
            response = self.client.patch(
                f'/api/admin/products/{product.id}/',
                {'images': replacement, 'primary_image_index': '0'},
                format='multipart',
                **auth_header,
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(product.images.count(), 2)
            self.assertFalse(product.images.get(id=existing_image.id).is_primary)
            self.assertTrue(product.images.exclude(id=existing_image.id).get().is_primary)

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
            'username': 'customer-renamed',
            'first_name': 'New',
            'last_name': 'Name',
            'email': self.customer.email,
            'role': 'admin',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.username, 'customer-renamed')
        self.assertEqual(self.customer.first_name, 'New')
        self.assertEqual(self.customer.last_name, 'Name')
        self.assertEqual(self.customer.email, 'customer-role@example.com')
        self.assertEqual(self.customer.role_profile.role, UserRoleProfile.ROLE_CUSTOMER)

    def test_profile_rejects_existing_username(self):
        self.authenticate(self.customer)
        response = self.client.patch('/api/accounts/profile/', {
            'username': self.employee.username,
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['username'], 'Username already exists.')
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.username, 'customer-role-test')

    def test_profile_rejects_empty_username(self):
        self.authenticate(self.customer)
        response = self.client.patch('/api/accounts/profile/', {
            'username': '   ',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['username'], 'Username cannot be empty.')

    def test_profile_rejects_email_change(self):
        self.authenticate(self.customer)
        response = self.client.patch('/api/accounts/profile/', {
            'email': 'attacker@example.com',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['email'], 'Email cannot be changed.')
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.email, 'customer-role@example.com')

    def test_google_identity_remains_linked_after_username_change(self):
        SocialAccount.objects.create(
            user=self.customer,
            provider=SocialAccount.PROVIDER_GOOGLE,
            provider_user_id='stable-google-subject',
            email=self.customer.email,
        )
        self.authenticate(self.customer)
        response = self.client.patch('/api/accounts/profile/', {
            'username': 'customer-after-google-rename',
        }, format='json')
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=None)
        google_response = self.google_login({
            'sub': 'stable-google-subject',
            'email': self.customer.email,
            'email_verified': True,
            'name': 'Customer',
        })

        self.assertEqual(google_response.status_code, 200)
        self.assertEqual(google_response.data['user']['id'], self.customer.pk)
        self.assertEqual(google_response.data['user']['username'], 'customer-after-google-rename')
        self.assertEqual(google_response.data['user']['email'], 'customer-role@example.com')
        self.assertEqual(google_response.data['user']['role'], UserRoleProfile.ROLE_CUSTOMER)

        login_client = APIClient()
        login_response = login_client.post('/api/accounts/login/', {
            'username': 'customer-after-google-rename',
            'password': 'StrongPass!234',
        }, format='json')
        self.assertEqual(login_response.status_code, 200)

    def test_change_password_uses_authenticated_users_password_hash(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/accounts/change-password/', {
            'current_password': 'StrongPass!234',
            'new_password': 'NewSecurePass!7462',
            'confirm_new_password': 'NewSecurePass!7462',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('NewSecurePass!7462'))
        self.assertFalse(self.admin.check_password('StrongPass!234'))

        login_response = self.client.post('/api/accounts/login/', {
            'username': self.admin.username,
            'password': 'NewSecurePass!7462',
        }, format='json')
        self.assertEqual(login_response.status_code, 200)

    def test_change_password_rejects_incorrect_current_password(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/accounts/change-password/', {
            'current_password': 'incorrect-current',
            'new_password': 'NewSecurePass!7462',
            'confirm_new_password': 'NewSecurePass!7462',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['current_password'], 'Current password is incorrect.')
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('StrongPass!234'))

    def test_change_password_rejects_mismatched_confirmation(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/accounts/change-password/', {
            'current_password': 'StrongPass!234',
            'new_password': 'NewSecurePass!7462',
            'confirm_new_password': 'DifferentSecurePass!8462',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['confirm_new_password'], 'New passwords do not match.')
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('StrongPass!234'))

    def test_change_password_requires_authentication(self):
        response = self.client.post('/api/accounts/change-password/', {
            'current_password': 'StrongPass!234',
            'new_password': 'NewSecurePass!7462',
            'confirm_new_password': 'NewSecurePass!7462',
        }, format='json')

        self.assertEqual(response.status_code, 401)
