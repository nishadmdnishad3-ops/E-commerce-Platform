from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def assign_existing_roles(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
    UserRoleProfile = apps.get_model('accounts', 'UserRoleProfile')
    profiles = []

    for user in User.objects.all().iterator():
        role = 'admin' if user.is_staff or user.is_superuser else 'customer'
        profiles.append(UserRoleProfile(user_id=user.pk, role=role))

    UserRoleProfile.objects.bulk_create(profiles, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserRoleProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('admin', 'Admin'), ('employee', 'Employee'), ('customer', 'Customer')], default='customer', max_length=20)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='role_profile', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.RunPython(assign_existing_roles, migrations.RunPython.noop),
    ]