import logging
import re

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

try:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
except ImportError:  # pragma: no cover
    google_requests = None
    id_token = None

import jwt

from .models import SocialAccount
from .serializers import RegisterSerializer

logger = logging.getLogger(__name__)
User = get_user_model()


class RegisterAPIView(generics.CreateAPIView):
    serializer_class = RegisterSerializer


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
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'username': user.username,
        'email': user.email,
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