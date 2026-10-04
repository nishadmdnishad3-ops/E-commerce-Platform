from rest_framework import serializers
from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            'id',
            'product',
            'product_name',
            'price',
            'quantity',
            'subtotal',
        ]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'user',
            'first_name',
            'last_name',
            'email',
            'mobile',
            'address',
            'upazila',
            'district',
            'comment',
            'payment_method',
            'delivery_method',
            'subtotal',
            'coupon_code',
            'coupon_discount',
            'gift_voucher_code',
            'gift_voucher_discount',
            'discount',
            'delivery_fee',
            'total',
            'status',
            'created_at',
            'updated_at',
            'items',
        ]