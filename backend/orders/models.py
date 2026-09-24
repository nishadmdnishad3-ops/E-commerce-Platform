from django.db import models
from django.contrib.auth.models import User
from products.models import Product


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
        User,
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