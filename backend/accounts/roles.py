from .models import UserRoleProfile


def get_user_role(user):
    if not user or not user.is_authenticated:
        return UserRoleProfile.ROLE_CUSTOMER

    if user.is_superuser:
        return UserRoleProfile.ROLE_ADMIN

    try:
        return user.role_profile.role
    except UserRoleProfile.DoesNotExist:
        if user.is_staff:
            return UserRoleProfile.ROLE_ADMIN
        return UserRoleProfile.ROLE_CUSTOMER


def ensure_user_role_profile(user):
    default_role = (
        UserRoleProfile.ROLE_ADMIN
        if user.is_staff or user.is_superuser
        else UserRoleProfile.ROLE_CUSTOMER
    )
    profile, _ = UserRoleProfile.objects.get_or_create(
        user=user,
        defaults={'role': default_role},
    )
    return profile