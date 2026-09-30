from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import SocialAccount

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
