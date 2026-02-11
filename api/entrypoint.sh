#!/bin/bash

set -e

# As variáveis de ambiente são fornecidas pelo docker-compose
# Não carregamos .env local para evitar conflitos

echo "Aguardando banco de dados em $DB_HOST:$DB_PORT..."

until nc -z -v -w30 "$DB_HOST" "$DB_PORT"; do
  echo "Aguardando banco de dados..."
  sleep 1
done

echo "Banco de dados está disponível!"

# Criar diretórios necessários para upload de arquivos
echo "Criando diretórios necessários..."
CURRENT_YEAR=$(date +%Y)
CURRENT_MONTH=$(date +%m)

# Create media directories with year/month structure for current date
mkdir -p /app/media/security/archives/${CURRENT_YEAR}/${CURRENT_MONTH} 2>/dev/null || true
mkdir -p /app/media/loans 2>/dev/null || true
mkdir -p /app/logs 2>/dev/null || true
mkdir -p /app/staticfiles 2>/dev/null || true

# Verify write permissions to media directory
if [ ! -w "/app/media/security/archives" ]; then
    echo "⚠️  AVISO: Diretório /app/media/security/archives sem permissão de escrita!"
    echo "   Execute no host: sudo chown -R \$(id -u):\$(id -g) ./api/media"
fi

# Auto-create MinIO bucket if configured
if [ -n "$MINIO_ENDPOINT" ]; then
  echo "Criando bucket MinIO '$MINIO_BUCKET_NAME' se nao existir..."
  python -c "
import boto3
from botocore.exceptions import ClientError
import os

endpoint = 'http://' + os.environ['MINIO_ENDPOINT']
access_key = os.environ.get('MINIO_ACCESS_KEY', '')
secret_key = os.environ.get('MINIO_SECRET_KEY', '')
bucket = os.environ.get('MINIO_BUCKET_NAME', 'mindledger')

s3 = boto3.client(
    's3',
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
)
try:
    s3.head_bucket(Bucket=bucket)
    print(f'Bucket {bucket} ja existe.')
except ClientError:
    s3.create_bucket(Bucket=bucket)
    print(f'Bucket {bucket} criado com sucesso.')
" || echo "Aviso: Nao foi possivel criar bucket MinIO (o servico pode nao estar pronto)."
fi

export PGPASSWORD="$DB_PASSWORD"

# Create database if not exists
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_database WHERE datname = '$DB_NAME'
   ) THEN
      CREATE DATABASE $DB_NAME
      WITH OWNER = $DB_USER
      ENCODING = 'UTF8'
      LC_COLLATE = 'C.UTF-8'
      LC_CTYPE = 'C.UTF-8'
      TABLESPACE = pg_default
      CONNECTION LIMIT = -1
      IS_TEMPLATE = false;
   END IF;
END
\$\$;
EOF

python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic --noinput
python createsuperuser.py

# Configurar grupo 'members' e suas permissões
echo "🔧 Configurando grupos e permissões do sistema..."
python setup_members.py

echo "🚀 Iniciando servidor Django..."
python manage.py runserver 0.0.0.0:${API_PORT:-39100}
