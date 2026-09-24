from django.contrib import admin, messages
from django.utils import timezone

from .models import Order, OrderItem


@admin.action(description="Approve selected orders")
def approve_selected_orders(modeladmin, request, queryset):
    pending_orders = queryset.filter(status='Pending')

    updated_count = pending_orders.update(
        status='Confirmed',
        updated_at=timezone.now()
    )

    if updated_count == 1:
        messages.success(
            request,
            "1 order was successfully approved."
        )
    elif updated_count > 1:
        messages.success(
            request,
            f"{updated_count} orders were successfully approved."
        )
    else:
        messages.warning(
            request,
            "No eligible orders were selected."
        )


@admin.action(description="Mark selected orders as Processing")
def mark_selected_as_processing(modeladmin, request, queryset):
    updated_count = queryset.filter(
        status='Confirmed'
    ).update(
        status='Processing',
        updated_at=timezone.now()
    )

    if updated_count:
        order_word = 'order' if updated_count == 1 else 'orders'
        verb = 'was' if updated_count == 1 else 'were'
        messages.success(
            request,
            f"{updated_count} {order_word} {verb} moved to Processing."
        )
    else:
        messages.warning(
            request,
            "No eligible orders were selected."
        )


@admin.action(description="Mark selected orders as Shipped")
def mark_selected_as_shipped(modeladmin, request, queryset):
    updated_count = queryset.filter(
        status='Processing'
    ).update(
        status='Shipped',
        updated_at=timezone.now()
    )

    if updated_count:
        order_word = 'order' if updated_count == 1 else 'orders'
        verb = 'was' if updated_count == 1 else 'were'
        messages.success(
            request,
            f"{updated_count} {order_word} {verb} marked as Shipped."
        )
    else:
        messages.warning(
            request,
            "No eligible orders were selected."
        )


@admin.action(description="Mark selected orders as Delivered")
def mark_selected_as_delivered(modeladmin, request, queryset):
    updated_count = queryset.filter(
        status='Shipped'
    ).update(
        status='Delivered',
        updated_at=timezone.now()
    )

    if updated_count:
        order_word = 'order' if updated_count == 1 else 'orders'
        verb = 'was' if updated_count == 1 else 'were'
        messages.success(
            request,
            f"{updated_count} {order_word} {verb} marked as Delivered."
        )
    else:
        messages.warning(
            request,
            "No eligible orders were selected."
        )


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = (
        'product_name',
        'price',
        'quantity',
        'subtotal',
    )


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):

    list_display = (
        'order_number',
        'user',
        'first_name',
        'mobile',
        'total',
        'payment_method',
        'delivery_method',
        'status',
        'created_at',
    )

    list_filter = (
        'status',
        'payment_method',
        'delivery_method',
        'created_at',
    )

    search_fields = (
        'order_number',
        'first_name',
        'last_name',
        'email',
        'mobile',
    )

    readonly_fields = (
        'order_number',
        'created_at',
        'updated_at',
    )

    inlines = [OrderItemInline]

    ordering = ('-created_at',)

    actions = [
        approve_selected_orders,
        mark_selected_as_processing,
        mark_selected_as_shipped,
        mark_selected_as_delivered,
    ]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):

    list_display = (
        'order',
        'product_name',
        'price',
        'quantity',
        'subtotal',
    )

    search_fields = (
        'product_name',
        'order__order_number',
    )