#!/usr/bin/env python
import os

import django

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
django.setup()

from django.contrib.auth.models import Group, Permission  # noqa: E402
from django.contrib.contenttypes.models import ContentType  # noqa: E402

print("🔧 Configurando grupo members e permissões...")

# Criar grupo
group, created = Group.objects.get_or_create(name="members")
print(f'Grupo members: {"criado" if created else "já existia"} - ID: {group.id}')

# Limpar permissões existentes
group.permissions.clear()

# Apps alvo - todas as aplicações customizadas do projeto
apps = [
    "app",
    "authentication",
    "accounts",
    "credit_cards",
    "expenses",
    "revenues",
    "members",
    "loans",
    "transfers",
    "dashboard",
    "security",
    "library",
    "personal_planning",
    "payables",
    "vaults",
    "notifications",
    "ai_assistant",
]

# Buscar e adicionar permissões
permissions_added = 0
permission_prefixes = ["view_", "add_", "change_", "delete_"]

for app_label in apps:
    try:
        content_types = ContentType.objects.filter(app_label=app_label)
        for ct in content_types:
            # Buscar todas as permissões (view, add, change, delete)
            for prefix in permission_prefixes:
                perms = Permission.objects.filter(
                    content_type=ct, codename__startswith=prefix
                )

                for perm in perms:
                    group.permissions.add(perm)
                    permissions_added += 1
                    print(f"✅ {app_label}.{perm.codename}")
    except Exception as e:
        print(f"❌ Erro em {app_label}: {e}")

print(f"\n📊 Total: {permissions_added} permissões adicionadas")
print(f"Grupo members tem {group.permissions.count()} permissões")

# Adicionar todos os usuários ao grupo members
from django.contrib.auth import get_user_model  # noqa: E402

User = get_user_model()
users_added = 0

for user in User.objects.all():
    if not user.groups.filter(id=group.id).exists():
        user.groups.add(group)
        users_added += 1
        print(f'✅ Usuário "{user.username}" adicionado ao grupo members')

if users_added == 0:
    print("✅ Todos os usuários já estão no grupo members")
else:
    print(f"\n📊 {users_added} usuário(s) adicionado(s) ao grupo members")
