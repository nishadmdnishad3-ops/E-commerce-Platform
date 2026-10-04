from django.conf import settings
from django.db import models
from django.db.models import Q
from products.models import Product


class Coupon(models.Model):
    DISCOUNT_PERCENTAGE = 'percentage'
    DISCOUNT_FIXED = 'fixed'
    DISCOUNT_TYPE_CHOICES = [
        (DISCOUNT_PERCENTAGE, 'Percentage'),
        (DISCOUNT_FIXED, 'Fixed'),
    ]

    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(
        max_length=20,
        choices=DISCOUNT_TYPE_CHOICES,
        default=DISCOUNT_PERCENTAGE,
    )
    discount_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    minimum_order_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    maximum_discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    start_date = models.DateField()
    end_date = models.DateField()
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    per_user_limit = models.PositiveIntegerField(default=1, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.code


class CouponUsage(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='uses')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='coupon_uses',
    )
    order = models.ForeignKey(
        'Order',
        on_delete=models.CASCADE,
        related_name='coupon_uses',
        null=True,
        blank=True,
    )
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['coupon', 'user', 'order'],
                name='unique_coupon_user_order_usage',
            )
        ]
        ordering = ['-used_at']

    def __str__(self):
        return f'{self.coupon.code} used by {self.user.username}'


class GiftVoucher(models.Model):
    DISCOUNT_FIXED = 'fixed'
    DISCOUNT_PERCENTAGE = 'percentage'
    DISCOUNT_TYPE_CHOICES = [
        (DISCOUNT_FIXED, 'Fixed Amount'),
        (DISCOUNT_PERCENTAGE, 'Percentage'),
    ]

    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(
        max_length=20,
        choices=DISCOUNT_TYPE_CHOICES,
        default=DISCOUNT_FIXED,
    )
    discount_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    maximum_discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    initial_balance = models.DecimalField(max_digits=12, decimal_places=2)
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2)
    minimum_order_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(discount_type='fixed', discount_value__gte=0)
                    | Q(
                        discount_type='percentage',
                        discount_value__gt=0,
                        discount_value__lte=100,
                        initial_balance=0,
                        remaining_balance=0,
                    )
                ),
                name='valid_gift_voucher_discount_type_value',
            ),
            models.CheckConstraint(
                condition=Q(maximum_discount_amount__isnull=True)
                | Q(maximum_discount_amount__gte=0),
                name='nonnegative_gift_voucher_max_discount',
            ),
        ]

    def __str__(self):
        return self.code


class GiftVoucherUsage(models.Model):
    voucher = models.ForeignKey(GiftVoucher, on_delete=models.CASCADE, related_name='uses')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gift_voucher_uses',
    )
    order = models.ForeignKey(
        'Order',
        on_delete=models.CASCADE,
        related_name='gift_voucher_uses',
        null=True,
        blank=True,
    )
    amount_used = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['voucher', 'user', 'order'],
                name='unique_voucher_user_order_usage',
            )
        ]
        ordering = ['-used_at']

    def __str__(self):
        return f'{self.voucher.code} used by {self.user.username}'


class Order(models.Model):

    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Confirmed', 'Confirmed'),
        ('Processing', 'Processing'),
        ('Shipped', 'Shipped'),
        ('Delivered', 'Delivered'),
        ('Cancelled', 'Cancelled'),
    ]

    PAYMENT_CHOICES = [
        ('Cash on Delivery', 'Cash on Delivery'),
        ('Online Payment', 'Online Payment'),
        ('POS on Delivery', 'POS on Delivery'),
    ]

    DELIVERY_CHOICES = [
        ('Home Delivery', 'Home Delivery'),
        ('Store Pickup', 'Store Pickup'),
        ('Express Delivery', 'Express Delivery'),
    ]

    # Customer
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders'
    )

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    email = models.EmailField()
    mobile = models.CharField(max_length=30)

    # Shipping address
    address = models.TextField()
    upazila = models.CharField(max_length=100)
    district = models.CharField(max_length=100)

    # Additional comment
    comment = models.TextField(blank=True)

    # Order information
    payment_method = models.CharField(
        max_length=50,
        choices=PAYMENT_CHOICES,
        default='Cash on Delivery'
    )

    delivery_method = models.CharField(
        max_length=50,
        choices=DELIVERY_CHOICES,
        default='Home Delivery'
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    coupon_code = models.CharField(max_length=50, blank=True, null=True)
    coupon_discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gift_voucher_code = models.CharField(max_length=50, blank=True, null=True)
    gift_voucher_discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    discount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    delivery_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    total = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Pending'
    )

    order_number = models.CharField(
        max_length=30,
        unique=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def save(self, *args, **kwargs):

        if not self.order_number:
            import uuid

            self.order_number = (
                f"TM-{uuid.uuid4().hex[:8].upper()}"
            )

        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items'
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='order_items'
    )

    product_name = models.CharField(
        max_length=200
    )

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    quantity = models.PositiveIntegerField(
        default=1
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"