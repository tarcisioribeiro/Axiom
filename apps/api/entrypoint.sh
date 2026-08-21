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
mkdir -p /app/media/vault_snapshots 2>/dev/null || true
mkdir -p /app/logs 2>/dev/null || true
mkdir -p /app/staticfiles 2>/dev/null || true

# Verify write permissions to media directory
if [ ! -w "/app/media/security/archives" ]; then
    echo "⚠️  AVISO: Diretório /app/media/security/archives sem permissão de escrita!"
    echo "   Execute no host: sudo chown -R \$(id -u):\$(id -g) ./api/media"
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

echo "🔍 Verificando migrações pendentes (schema drift check)..."
python manage.py makemigrations --check --dry-run
python manage.py migrate --fake-initial

# Collectstatic - tenta com --clear primeiro para evitar problemas de permissão
# Se falhar, tenta sem --clear, e se ainda falhar, continua sem arquivos estáticos
echo "📦 Coletando arquivos estáticos..."
if ! python manage.py collectstatic --noinput --clear 2>/dev/null; then
    echo "⚠️  collectstatic --clear falhou, tentando sem --clear..."
    if ! python manage.py collectstatic --noinput 2>/dev/null; then
        echo "⚠️  collectstatic falhou - arquivos estáticos podem não estar disponíveis"
        echo "   Execute no host: sudo chown -R \$(id -u):\$(id -g) ./api/staticfiles"
    fi
fi

python createsuperuser.py

# Configurar grupo 'members' e suas permissões
echo "🔧 Configurando grupos e permissões do sistema..."
python setup_members.py

if [ "$#" -gt 0 ]; then
  echo "🚀 Iniciando: $*"
  exec "$@"
else
  # Garante que os agentes de IA (Financeiro, Pessoal, Biblioteca...) tenham
  # embeddings RAG disponíveis assim que a API sobe — sem isso, buscas
  # semânticas ficam vazias até alguém rodar os comandos manualmente.
  # Só roda aqui (branch do gunicorn/API), não no worker/queue, que não
  # consomem embeddings. Os comandos pulam registros já vetorizados por
  # padrão (só --force reprocessa), então repetir isso a cada subida do
  # container é barato — só embeda o que for novo. Nunca bloqueia o boot:
  # timeout + "|| echo" garantem que uma falha (ex: Ollama ainda subindo)
  # apenas adia a indexação para a próxima subida, sem derrubar a API.
  # Roda em background: são comandos lentos (podem levar minutos esperando o
  # Ollama aquecer) e não essenciais para a API responder. Rodá-los em primeiro
  # plano aqui atrasava o "exec gunicorn" abaixo além da janela do healthcheck
  # (start_period + interval*retries), derrubando o container como "unhealthy"
  # antes mesmo do Gunicorn abrir a porta — especialmente em subidas com banco
  # novo (migrations completas) somado ao tempo de embeddings.
  echo "🧠 Gerando embeddings pendentes para os agentes de IA (RAG) em background..."
  (
    timeout "${EMBEDDINGS_TIMEOUT:-240}" python manage.py vectorize_existing --domain all || \
      echo "⚠️  vectorize_existing falhou ou expirou — agentes seguem funcionando sem RAG até a próxima subida do container."
    timeout "${EMBEDDINGS_TIMEOUT:-240}" python manage.py index_library || \
      echo "⚠️  index_library falhou ou expirou — RAG da biblioteca fica pendente até a próxima subida do container."
  ) &

  echo "🚀 Iniciando servidor com Gunicorn..."
  # Com múltiplos workers, cada processo Gunicorn mantém seu próprio registro
  # Prometheus em memória — sem o modo multiprocess, cada scrape em /metrics
  # reflete só o worker que respondeu à requisição, não o total real.
  # gunicorn.conf.py usa este diretório para agregar métricas entre workers.
  export PROMETHEUS_MULTIPROC_DIR="${PROMETHEUS_MULTIPROC_DIR:-/tmp/prometheus-multiproc}"
  # worker-class gthread: views como BookCoverStreamView/MemberPhotoStreamView
  # fazem proxy síncrono de arquivos do MinIO (I/O-bound). Com workers "sync"
  # (padrão), cada requisição de capa/foto bloqueia um processo inteiro até o
  # MinIO responder; um burst de covers concorrentes (ex: lista de livros)
  # esgota os workers e derruba o readiness probe. Threads liberam o processo
  # para atender outras requisições enquanto aguarda I/O.
  exec gunicorn app.wsgi:application \
    --config /app/gunicorn.conf.py \
    --bind 0.0.0.0:${API_PORT:-39100} \
    --workers ${GUNICORN_WORKERS:-4} \
    --worker-class gthread \
    --threads ${GUNICORN_THREADS:-4} \
    --timeout ${GUNICORN_TIMEOUT:-120} \
    --access-logfile - \
    --error-logfile -
fi
