from rest_framework.permissions import BasePermission

from .models import UserRoleProfile
from .roles import get_user_role


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and get_user_role(request.user) == UserRoleProfile.ROLE_ADMIN
        )


class IsEmployee(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and get_user_role(request.user) == UserRoleProfile.ROLE_EMPLOYEE
        )


class IsAdminOrEmployee(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and get_user_role(request.user) in {
                UserRoleProfile.ROLE_ADMIN,
                UserRoleProfile.ROLE_EMPLOYEE,
            }
        )


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and get_user_role(request.user) == UserRoleProfile.ROLE_CUSTOMER
        )