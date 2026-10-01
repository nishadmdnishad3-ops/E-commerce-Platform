from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserRoleProfile
from .roles import ensure_user_role_profile, get_user_role

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        token['role'] = get_user_role(user)
        return token

    def validate(self, attrs):
        username = attrs.get(self.username_field, '')
        if '@' in username:
            user = User.objects.filter(email__iexact=username).first()
            if user:
                attrs[self.username_field] = user.get_username()

        data = super().validate(attrs)
        ensure_user_role_profile(self.user)
        role = get_user_role(self.user)
        data['username'] = self.user.username
        data['email'] = self.user.email
        data['is_staff'] = self.user.is_staff
        data['is_superuser'] = self.user.is_superuser
        data['role'] = role
        data['user'] = {
            'id': self.user.pk,
            'username': self.user.username,
            'email': self.user.email,
            'role': role,
        }
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'password',
            'password2',
        ]

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({
                'password': 'Passwords do not match.'
            })

        if User.objects.filter(
            username=data['username']
        ).exists():
            raise serializers.ValidationError({
                'username': 'Username already exists.'
            })

        if User.objects.filter(
            email=data['email']
        ).exists():
            raise serializers.ValidationError({
                'email': 'Email already exists.'
            })

        return data

    def create(self, validated_data):
        validated_data.pop('password2')

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )
        UserRoleProfile.objects.create(user=user, role=UserRoleProfile.ROLE_CUSTOMER)

        return user