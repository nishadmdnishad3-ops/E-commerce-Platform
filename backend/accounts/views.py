import logging
import re

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q, Sum
from django.core.exceptions import ValidationError
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from orders.models import Order
from .serializers import CustomTokenObtainPairSerializer, RegisterSerializer

try:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
except ImportError:  # pragma: no cover
    google_requests = None
    id_token = None

import jwt

from .models import SocialAccount, UserRoleProfile
from .permissions import IsAdmin
from .roles import ensure_user_role_profile, get_user_role

logger = logging.getLogger(__name__)
User = get_user_model()


class RegisterAPIView(generics.CreateAPIView):
    serializer_class = RegisterSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


def _generate_unique_username(base_name, provider):
    cleaned_name = re.sub(
        r'[^A-Za-z0-9._-]+',
        '',
        (base_name or f'{provider}_user').lower(),
    )
    cleaned_name = cleaned_name.strip('.') or f'{provider}_user'
    cleaned_name = cleaned_name[:30]

    if not User.objects.filter(username=cleaned_name).exists():
        return cleaned_name

    counter = 1
    while True:
        candidate = f'{cleaned_name}_{counter}'
        if not User.objects.filter(username=candidate).exists():
            return candidate
        counter += 1


def _build_token_response(user):
    profile = ensure_user_role_profile(user)
    role = UserRoleProfile.ROLE_ADMIN if user.is_superuser else profile.role
    refresh = RefreshToken.for_user(user)
    refresh['role'] = role
    refresh['username'] = user.username
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'username': user.username,
        'email': user.email,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'role': role,
        'user': {
            'id': user.pk,
            'username': user.username,
            'email': user.email,
            'role': role,
        },
    }


def _link_existing_social_account(provider, provider_user_id, email, name):
    social_account = SocialAccount.objects.filter(
        provider=provider,
        provider_user_id=provider_user_id,
    ).select_related('user').first()

    if social_account:
        user = social_account.user
        if email and not user.email:
            user.email = email
            user.save(update_fields=['email'])
        return user

    if email:
        user = User.objects.filter(email__iexact=email).first()
        if user:
            SocialAccount.objects.get_or_create(
                provider=provider,
                provider_user_id=provider_user_id,
                defaults={'user': user, 'email': email},
            )
            if not user.email:
                user.email = email
                user.save(update_fields=['email'])
            return user

    username = _generate_unique_username(name or email or f'{provider}_user', provider)
    user = User.objects.create_user(
        username=username,
        email=email or '',
        password='SocialLogin@2025',
    )
    SocialAccount.objects.create(
        user=user,
        provider=provider,
        provider_user_id=provider_user_id,
        email=email or '',
    )
    return user


class AdminCustomerListAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        users = User.objects.filter(
            is_active=True,
            role_profile__role=UserRoleProfile.ROLE_CUSTOMER,
        ).order_by('-date_joined')
        search = (request.query_params.get('search') or '').strip()
        if search:
            users = users.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        result = []
        for user in users:
            total_spent = Order.objects.filter(user=user).aggregate(total=Sum('total'))['total'] or 0
            result.append({
                'id': user.id,
                'name': user.get_full_name() or user.username,
                'email': user.email,
                'username': user.username,
                'date_joined': user.date_joined.isoformat(),
                'order_count': Order.objects.filter(user=user).count(),
                'total_spent': str(total_spent),
            })

        return Response(result)


class AdminCustomerDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, customer_id):
        user = User.objects.filter(
            id=customer_id,
            role_profile__role=UserRoleProfile.ROLE_CUSTOMER,
        ).first()
        if not user:
            return Response({'error': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        customer_orders = Order.objects.filter(user=user).order_by('-created_at')
        return Response({
            'id': user.id,
            'name': user.get_full_name() or user.username,
            'email': user.email,
            'username': user.username,
            'date_joined': user.date_joined.isoformat(),
            'order_count': customer_orders.count(),
            'total_spent': str(customer_orders.aggregate(total=Sum('total'))['total'] or 0),
            'recent_orders': [
                {
                    'id': order.id,
                    'order_number': order.order_number,
                    'date': order.created_at.isoformat(),
                    'total': str(order.total),
                    'status': order.status,
                }
                for order in customer_orders[:10]
            ],
        })


class AdminEmployeeListCreateAPIView(APIView):
    permission_classes = [IsAdmin]

    @staticmethod
    def serialize_employee(user):
        return {
            'id': user.id,
            'name': user.get_full_name() or user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'username': user.username,
            'email': user.email,
            'is_active': user.is_active,
            'date_joined': user.date_joined.isoformat(),
        }

    def get(self, request):
        employees = User.objects.filter(
            role_profile__role=UserRoleProfile.ROLE_EMPLOYEE,
        ).order_by('-date_joined')
        return Response([self.serialize_employee(user) for user in employees])

    def post(self, request):
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        username = (request.data.get('username') or '').strip()
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password') or ''

        if not all([first_name, last_name, username, email, password]):
            return Response({'error': 'All employee fields are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username__iexact=username).exists():
            return Response({'error': 'Username is already in use.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': 'Email is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(password)
        except ValidationError as error:
            return Response({'error': list(error.messages)}, status=status.HTTP_400_BAD_REQUEST)

        employee = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_staff=False,
        )
        UserRoleProfile.objects.create(user=employee, role=UserRoleProfile.ROLE_EMPLOYEE)
        return Response(self.serialize_employee(employee), status=status.HTTP_201_CREATED)


class AdminEmployeeDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, employee_id):
        employee = User.objects.filter(
            id=employee_id,
            role_profile__role=UserRoleProfile.ROLE_EMPLOYEE,
        ).first()
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)
        if 'is_active' not in request.data:
            return Response({'error': 'is_active is required.'}, status=status.HTTP_400_BAD_REQUEST)

        employee.is_active = request.data.get('is_active') in [True, 'true', 'True', '1']
        employee.save(update_fields=['is_active'])
        return Response(AdminEmployeeListCreateAPIView.serialize_employee(employee))


class MyProfileAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def serialize_user(user):
        return {
            'id': user.pk,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'role': get_user_role(user),
        }

    def get(self, request):
        return Response(self.serialize_user(request.user))

    def patch(self, request):
        user = request.user
        email = (request.data.get('email', user.email) or '').strip().lower()
        if email and User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            return Response({'email': 'This email address is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

        user.first_name = (request.data.get('first_name', user.first_name) or '').strip()
        user.last_name = (request.data.get('last_name', user.last_name) or '').strip()
        user.email = email
        user.save(update_fields=['first_name', 'last_name', 'email'])
        return Response(self.serialize_user(user))


class GoogleLoginAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        credential = request.data.get('credential')
        if not credential:
            logger.warning('Google social login attempted without credential.')
            return Response({
                'detail': 'Google login failed. Please try again.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if id_token is None or google_requests is None:
            logger.error('Google auth library is not installed or configured.')
            return Response({
                'detail': 'Google login failed. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            payload = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception:
            logger.exception('Google token verification failed.')
            return Response({
                'detail': 'Google login failed. Please try again.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not payload.get('sub'):
            logger.warning('Google token missing subject.')
            return Response({
                'detail': 'Google login failed. Please try again.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        email = payload.get('email', '')
        if payload.get('email_verified') is False:
            logger.warning('Google login blocked because email is not verified: %s', email)
            return Response({
                'detail': 'Google login failed. Please try again.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        user = _link_existing_social_account(
            provider='google',
            provider_user_id=payload['sub'],
            email=email,
            name=payload.get('name') or (email.split('@')[0] if email else ''),
        )
        return Response(_build_token_response(user))


class AppleLoginAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        identity_token = request.data.get('identityToken') or request.data.get('id_token')
        if not identity_token:
            logger.warning('Apple social login attempted without identity token.')
            return Response({
                'detail': 'Apple login failed. Please try again.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not settings.APPLE_CLIENT_ID:
            logger.error('APPLE_CLIENT_ID is not configured.')
            return Response({
                'detail': 'Apple login failed. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            jwks_client = jwt.PyJWKClient('https://appleid.apple.com/auth/keys')
            signing_key = jwks_client.get_signing_key_from_jwt(identity_token)
            payload = jwt.decode(
                identity_token,
                signing_key.key,
                algorithms=['RS256'],
                audience=settings.APPLE_CLIENT_ID,
                options={'verify_aud': True},
            )
        except Exception:
            logger.exception('Apple token verification failed.')
            return Response({
                'detail': 'Apple login failed. Please try again.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        provider_user_id = payload.get('sub')
        if not provider_user_id:
            logger.warning('Apple token missing subject.')
            return Response({
                'detail': 'Apple login failed. Please try again.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        apple_email = payload.get('email', '')
        display_name = ''
        user_info = request.data.get('user') or {}
        if isinstance(user_info, dict):
            name_info = user_info.get('name') or {}
            if isinstance(name_info, dict):
                display_name = ' '.join(filter(None, [
                    name_info.get('firstName'),
                    name_info.get('lastName'),
                ]))

        user = _link_existing_social_account(
            provider='apple',
            provider_user_id=provider_user_id,
            email=apple_email,
            name=display_name or (apple_email.split('@')[0] if apple_email else ''),
        )
        return Response(_build_token_response(user))