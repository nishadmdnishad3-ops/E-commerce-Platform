from django.contrib import admin
from django import forms

from .models import Category, Brand, Product, ProductImage


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


class DragDropImageWidget(forms.ClearableFileInput):
    class Media:
        css = {
            'all': ('products/admin_drag_drop.css',)
        }
        js = ('products/admin_drag_drop.js',)

    def __init__(self, attrs=None):
        default_attrs = {
            'class': 'drag-drop-input'
        }

        if attrs:
            default_attrs.update(attrs)

        super().__init__(attrs=default_attrs)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

    formfield_overrides = {
        ProductImage._meta.get_field('image').__class__: {
            'widget': DragDropImageWidget
        }
    }


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'category',
        'brand',
        'price',
        'discount_price',
        'stock',
        'is_active',
        'is_featured'
    )

    list_filter = (
        'is_active',
        'is_featured',
        'category',
        'brand'
    )

    search_fields = (
        'name',
        'slug',
        'description'
    )

    prepopulated_fields = {
        'slug': ('name',)
    }

    inlines = [ProductImageInline]