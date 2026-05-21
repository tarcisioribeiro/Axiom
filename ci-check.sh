#!/usr/bin/env bash
# ==============================================================================
# ci-check.sh — Axiom: Simulação do pipeline GitLab CI/CD
# ==============================================================================
#
# Etapas cobertas (mesma ordem do .gitlab-ci.yml):
#
#   lint:backend       black · isort · flake8
#   lint:migrations    makemigrations --check --dry-run
#   lint:bandit        bandit -r api/ -x api/tests,api/migrations -ll
#   lint:pip-audit     pip-audit -r api/requirements.txt --desc --ignore-vuln PYSEC-2025-183
#   lint:frontend      eslint · prettier
#   lint:npm-audit     npm audit --audit-level=high
#   lint:secrets       gitleaks (opcional local — obrigatório no GitLab CI)
#   typecheck:backend  mypy
#   typecheck:frontend tsc
#   test:backend       pytest --cov --cov-report=term-missing --cov-report=xml:coverage.xml
#   test:frontend      vitest --run --coverage
#   test:load          k6 (opcional local — requer k6 instalado e BASE_URL configurada)
#
# Etapas não cobertas (requerem registry ou infraestrutura de deploy):
#   build              docker build + push para o registry GitLab
#   scan               trivy sobre imagens do registry (requer build)
#   deploy-staging     kubectl (requer kubeconfig de staging)
#   deploy-production  kubectl + blue-green-switch.sh (requer kubeconfig de produção)
#
# Pré-requisitos:
#   - Docker + docker compose com o serviço 'api' rodando
#   - Node.js 20+ com frontend/node_modules instalado no host
#     (o container 'frontend' é nginx-only; npm roda direto no host)
#
# Uso:
#   ./ci-check.sh [opções]
#
# Opções:
#   --backend-only    Executa apenas checks do backend
#   --frontend-only   Executa apenas checks do frontend
#   --help            Exibe esta ajuda
#
# Saída:
#   Terminal   → progresso colorido em tempo real
#   Arquivo    → ci-check-YYYYMMDD_HHMMSS.log (log completo, incluindo saída
#                de cada ferramenta)
# ==============================================================================

# Não usar set -e: erros são tratados manualmente para coletar todos os falhos.
# set -u garante que variáveis não definidas causem erro.
set -uo pipefail

# ── Diretório do script ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$SCRIPT_DIR/ci-check-$TIMESTAMP.log"

# ── Flags ──────────────────────────────────────────────────────────────────────
BACKEND_ONLY=false
FRONTEND_ONLY=false

for arg in "$@"; do
	case "$arg" in
	--backend-only) BACKEND_ONLY=true ;;
	--frontend-only) FRONTEND_ONLY=true ;;
	--help | -h)
		# Exibe o bloco de comentário no topo
		sed -n '2,/^# =\+$/{ /^# =\+$/q; p }' "$0" | sed 's/^# \?//'
		exit 0
		;;
	*)
		echo "Opção desconhecida: '$arg'. Use --help."
		exit 1
		;;
	esac
done

# ── Venv Python (backend lint/typecheck local) ─────────────────────────────────
VENV_DIR="$SCRIPT_DIR/.venv"
VENV_BIN="$VENV_DIR/bin"

# ── Cores (degrada graciosamente se terminal não suportar) ─────────────────────
if [ -t 1 ] && command -v tput >/dev/null 2>&1 && tput colors >/dev/null 2>&1 && [ "$(tput colors)" -ge 8 ]; then
	RED="$(tput setaf 1)"
	GREEN="$(tput setaf 2)"
	YELLOW="$(tput setaf 3)"
	BLUE="$(tput setaf 4)"
	CYAN="$(tput setaf 6)"
	BOLD="$(tput bold)"
	DIM="$(tput dim 2>/dev/null || echo '')"
	NC="$(tput sgr0)"
else
	RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' DIM='' NC=''
fi

# ── Estado global ──────────────────────────────────────────────────────────────
FAILURES=()
TOTAL=0
PASSED=0

# ── Funções de log ─────────────────────────────────────────────────────────────
# Escreve no terminal E no arquivo de log (sem processar escapes de cor no arquivo)
log() {
	local msg="$1"
	# Terminal: interpreta \n e códigos de cor
	echo -e "$msg"
	# Arquivo: remove sequências ANSI antes de gravar
	echo -e "$msg" | sed 's/\x1b\[[0-9;]*m//g' >>"$LOG_FILE"
}

section() {
	log ""
	log "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
	log "${BLUE}${BOLD}  STAGE: $1${NC}"
	log "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Executa um passo, exibe saída em tempo real (terminal + log) e registra result.
# Uso: run_step "stage" "nome do passo" cmd [args...]
run_step() {
	local stage="$1"
	local name="$2"
	shift 2

	log ""
	log "${CYAN}▶ $stage › $name${NC}"
	echo "  CMD: $*" >>"$LOG_FILE"
	echo "  ────────────────────────────────────────────────────────────" >>"$LOG_FILE"

	TOTAL=$((TOTAL + 1))

	# Executa o comando:
	#   - stdout + stderr vão para o terminal E para o log simultaneamente (tee)
	#   - PIPESTATUS[0] captura o exit code do comando (não do tee)
	local exit_code=0
	set +o pipefail # Desativa pipefail pontualmente para usar PIPESTATUS manualmente
	"$@" 2>&1 | tee -a "$LOG_FILE"
	exit_code="${PIPESTATUS[0]}"
	set -o pipefail

	echo "" >>"$LOG_FILE"

	if [ "$exit_code" -eq 0 ]; then
		log "${GREEN}  ✓  PASSOU${NC}"
		PASSED=$((PASSED + 1))
		return 0
	else
		log "${RED}  ✗  FALHOU  (exit code: $exit_code)${NC}"
		FAILURES+=("$stage › $name")
		return 1
	fi
}

# Versão que nunca interrompe o script (continue mesmo se falhar)
run_step_safe() {
	run_step "$@" || true
}

# ── Pré-requisitos ─────────────────────────────────────────────────────────────
check_docker() {
	log "${YELLOW}Verificando Docker...${NC}"

	if ! docker info >/dev/null 2>&1; then
		log "${RED}  ✗  Docker não está rodando. Inicie o Docker e tente novamente.${NC}"
		exit 1
	fi

	# Verifica se o serviço 'api' está Up
	if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps api 2>/dev/null | grep -q "Up"; then
		log "${YELLOW}  Serviço 'api' não está rodando. Subindo containers...${NC}"
		docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d >>"$LOG_FILE" 2>&1
		log "  Aguardando inicialização (20s)..."
		sleep 20
	fi

	log "${GREEN}  ✓  Docker OK — serviço 'api' disponível${NC}"
}

check_node() {
	log "${YELLOW}Verificando Node.js no host...${NC}"

	if ! command -v node >/dev/null 2>&1; then
		log "${RED}  ✗  Node.js não encontrado. Instale Node.js 20+ para rodar os checks do frontend.${NC}"
		return 1
	fi

	local ver
	ver="$(node --version)"
	log "${GREEN}  ✓  Node.js $ver encontrado${NC}"

	if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
		log "${YELLOW}  node_modules ausente — rodando npm ci...${NC}"
		if ! (cd "$SCRIPT_DIR/frontend" && npm ci) >>"$LOG_FILE" 2>&1; then
			log "${RED}  ✗  Falha ao instalar dependências do frontend.${NC}"
			return 1
		fi
		log "${GREEN}  ✓  Dependências instaladas${NC}"
	fi

	return 0
}

_install_docker_devdeps() {
	log "${YELLOW}  mypy/pytest ausentes — instalando dependências de dev no container (--user)...${NC}"
	docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T api \
		pip install --quiet --user \
		mypy pytest pytest-cov pytest-django freezegun \
		django-stubs djangorestframework-stubs >>"$LOG_FILE" 2>&1
	# pip exits non-zero when a dependency is already satisfied at a conflicting version;
	# ignore the exit code and verify importability directly instead.
	if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T api python -m mypy --version >/dev/null 2>&1 || \
		! docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T api python -m pytest --version >/dev/null 2>&1; then
		log "${RED}  ✗  Ferramentas de dev não encontradas após instalação — verifique o container.${NC}"
		return 1
	fi
}

check_docker_devdeps() {
	log "${YELLOW}Verificando ferramentas de dev no container api...${NC}"

	if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T api python -m mypy --version >/dev/null 2>&1 || \
		! docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T api python -m pytest --version >/dev/null 2>&1; then
		_install_docker_devdeps || return 1
	fi

	log "${GREEN}  ✓  Ferramentas de dev disponíveis no container${NC}"
	return 0
}

check_python_venv() {
	log "${YELLOW}Verificando venv Python...${NC}"

	local python_bin
	if command -v python3 >/dev/null 2>&1; then
		python_bin="python3"
	else
		log "${RED}  ✗  Python 3 não encontrado. Instale Python 3 para rodar os checks do backend.${NC}"
		return 1
	fi

	if [ ! -d "$VENV_DIR" ]; then
		log "${YELLOW}  venv ausente — criando em .venv ...${NC}"
		if ! "$python_bin" -m venv "$VENV_DIR" >>"$LOG_FILE" 2>&1; then
			log "${RED}  ✗  Falha ao criar venv.${NC}"
			return 1
		fi
	fi

	if [ ! -f "$VENV_BIN/black" ] || [ ! -f "$VENV_BIN/bandit" ]; then
		log "${YELLOW}  Instalando dependências (api/requirements-dev.txt + pip-audit)...${NC}"
		if ! "$VENV_BIN/pip" install --quiet --upgrade pip >>"$LOG_FILE" 2>&1; then
			log "${RED}  ✗  Falha ao atualizar pip no venv.${NC}"
			return 1
		fi
		if ! "$VENV_BIN/pip" install --quiet -r "$SCRIPT_DIR/api/requirements-dev.txt" pip-audit >>"$LOG_FILE" 2>&1; then
			log "${RED}  ✗  Falha ao instalar dependências no venv.${NC}"
			return 1
		fi
		log "${GREEN}  ✓  Dependências instaladas${NC}"
	fi

	log "${GREEN}  ✓  venv OK — $VENV_DIR${NC}"
	return 0
}

# ── Cabeçalho / inicialização do log ──────────────────────────────────────────
{
	echo "=================================================================="
	echo "  Axiom — CI/CD Check Local"
	echo "  Iniciado em  : $(date)"
	echo "  BACKEND_ONLY : $BACKEND_ONLY"
	echo "  FRONTEND_ONLY: $FRONTEND_ONLY"
	echo "=================================================================="
	echo ""
} >"$LOG_FILE"

log ""
log "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
log "${BOLD}║       Axiom — Simulação do Pipeline GitLab CI/CD           ║${NC}"
log "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
log "  Log completo: ${BOLD}$LOG_FILE${NC}"
log ""

# ── Pré-requisitos ─────────────────────────────────────────────────────────────
$FRONTEND_ONLY || check_docker
$FRONTEND_ONLY || check_docker_devdeps

PYTHON_VENV_OK=true
if ! $FRONTEND_ONLY; then
	if ! check_python_venv; then
		log "${YELLOW}  venv Python indisponível — checks locais do backend podem falhar.${NC}"
		PYTHON_VENV_OK=false
	fi
fi

NODE_OK=true
if ! $BACKEND_ONLY; then
	if ! check_node; then
		log "${YELLOW}  Node.js indisponível — pulando todos os checks do frontend.${NC}"
		NODE_OK=false
		BACKEND_ONLY=true
	fi
fi

# ==============================================================================
# STAGE: lint
# ==============================================================================
section "LINT"

if ! $FRONTEND_ONLY; then
	run_step_safe "lint:backend" "black" \
		sh -c "cd '$SCRIPT_DIR/api' && '$VENV_BIN/black' --check --diff ."

	run_step_safe "lint:backend" "isort" \
		sh -c "cd '$SCRIPT_DIR/api' && '$VENV_BIN/isort' --check-only --diff ."

	run_step_safe "lint:backend" "flake8" \
		sh -c "cd '$SCRIPT_DIR/api' && '$VENV_BIN/flake8' ."

	run_step_safe "lint:migrations" "makemigrations --check --dry-run" \
		docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T \
		-e SECRET_KEY="ci-insecure-key-for-migrations-check-only" \
		-e DEBUG="False" \
		-e DJANGO_SETTINGS_MODULE="app.settings" \
		api python manage.py makemigrations --check --dry-run

	run_step_safe "lint:bandit" "bandit -r api/ -x api/tests,api/migrations -ll" \
		sh -c "cd '$SCRIPT_DIR' && '$VENV_BIN/bandit' -r api/ -x api/tests,api/migrations -ll"

	# PYSEC-2025-183 (PyJWT): disputed by supplier — key length is application's responsibility
	run_step_safe "lint:pip-audit" "pip-audit -r api/requirements.txt --desc" \
		sh -c "'$VENV_BIN/pip-audit' -r '$SCRIPT_DIR/api/requirements.txt' --desc --ignore-vuln PYSEC-2025-183"
fi

if ! $BACKEND_ONLY; then
	run_step_safe "lint:frontend" "eslint" \
		sh -c "cd '$SCRIPT_DIR/frontend' && npm run lint"

	run_step_safe "lint:frontend" "prettier" \
		sh -c "cd '$SCRIPT_DIR/frontend' && npm run format:check"

	run_step_safe "lint:npm-audit" "npm audit --audit-level=high" \
		sh -c "cd '$SCRIPT_DIR/frontend' && out=\$(npm audit --audit-level=high 2>&1); ec=\$?; printf '%s\n' \"\$out\"; if [ \$ec -ne 0 ] && printf '%s' \"\$out\" | grep -qE 'endpoint returned an error|request.*failed'; then printf 'AVISO: npm audit falhou por indisponibilidade do registry — verifique manualmente.\n'; exit 0; fi; exit \$ec"
fi

# ==============================================================================
# STAGE: typecheck
# ==============================================================================
section "TYPECHECK"

if ! $FRONTEND_ONLY; then
	# mypy precisa de SECRET_KEY não-vazio para inicializar o django-stubs
	# pragma: allowlist secret
	_MYPY_SECRET_KEY="ci-insecure-key-for-mypy-only" # pragma: allowlist secret
	run_step_safe "typecheck:backend" "mypy" \
		docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T \
		-e SECRET_KEY="$_MYPY_SECRET_KEY" \
		-e DEBUG="False" \
		-e DJANGO_SETTINGS_MODULE="app.settings" \
		api bash -c \
		'python -m mypy --version >/dev/null 2>&1 || pip install --quiet --user mypy django-stubs djangorestframework-stubs; python -m mypy .'
fi

if ! $BACKEND_ONLY; then
	run_step_safe "typecheck:frontend" "tsc" \
		sh -c "cd '$SCRIPT_DIR/frontend' && npm run typecheck"
fi

# ==============================================================================
# STAGE: test
# ==============================================================================
section "TEST"

if ! $FRONTEND_ONLY; then
	# ENCRYPTION_KEY gerado por job (igual ao CI); seguro pois testes usam SQLite in-memory.
	run_step_safe "test:backend" "pytest" \
		docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T api \
		bash -c 'python -m pytest --version >/dev/null 2>&1 || pip install --quiet --user pytest pytest-cov pytest-django freezegun; export ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())") && python -m pytest --cov --cov-report=term-missing --cov-report=xml:coverage.xml'
fi

if ! $BACKEND_ONLY; then
	run_step_safe "test:frontend" "vitest" \
		sh -c "cd '$SCRIPT_DIR/frontend' && npm run test:coverage"
fi

# ==============================================================================
# STAGE: lint:secrets (opcional local — obrigatório no GitLab CI)
# ==============================================================================
section "lint:secrets"

if command -v gitleaks >/dev/null 2>&1; then
	# Mirrors the GitLab CI job: scans git history (not just the working tree).
	run_step_safe "lint:secrets" "gitleaks" \
		gitleaks detect --source "$SCRIPT_DIR" --redact
else
	log "${YELLOW}  ⚠  gitleaks não encontrado — pulando verificação local de secrets.${NC}"
	log "${YELLOW}     Esta verificação é OBRIGATÓRIA no GitLab CI (lint:secrets).${NC}"
	log "${DIM}     Instale: https://github.com/gitleaks/gitleaks${NC}"
fi

# ==============================================================================
# STAGE: test:load (opcional local — requer k6 + servidor acessível)
# ==============================================================================
section "test:load"

# No CI this job targets $STAGING_URL after a real staging deploy.
# Locally it runs against BASE_URL (default: http://localhost:39100) so you
# can validate the script and thresholds without a staging environment.
# Set TEST_USERNAME / TEST_PASSWORD to also exercise authenticated endpoints.
if command -v k6 >/dev/null 2>&1; then
	_K6_BASE_URL="${BASE_URL:-http://localhost:39100}"
	_K6_USERNAME="${TEST_USERNAME:-}"
	_K6_PASSWORD="${TEST_PASSWORD:-}"

	log "${CYAN}  BASE_URL     : $_K6_BASE_URL${NC}"
	if [ -n "$_K6_USERNAME" ]; then
		log "${CYAN}  TEST_USERNAME: $_K6_USERNAME${NC}"
	else
		log "${YELLOW}  TEST_USERNAME não definido — endpoints autenticados serão pulados.${NC}"
		log "${DIM}  Defina TEST_USERNAME e TEST_PASSWORD para testar endpoints autenticados.${NC}"
	fi

	run_step_safe "test:load" "k6" \
		k6 run \
		--env BASE_URL="$_K6_BASE_URL" \
		--env TEST_USERNAME="$_K6_USERNAME" \
		--env TEST_PASSWORD="$_K6_PASSWORD" \
		"$SCRIPT_DIR/k6/load-test.js"
else
	log "${YELLOW}  ⚠  k6 não encontrado — pulando load test local.${NC}"
	log "${YELLOW}     Esta verificação é executada no GitLab CI após o deploy de staging.${NC}"
	log "${DIM}     Instale: https://grafana.com/docs/k6/latest/set-up/install-k6/${NC}"
fi

# ==============================================================================
# RELATÓRIO FINAL
# ==============================================================================
FAILED_COUNT=$((TOTAL - PASSED))

log ""
log "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
log "${BOLD}║                       RELATÓRIO FINAL                           ║${NC}"
log "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
log ""
log "  Total de verificações : ${BOLD}$TOTAL${NC}"
log "  ${GREEN}Passaram${NC}               : ${GREEN}${BOLD}$PASSED${NC}"
log "  ${RED}Falharam${NC}               : ${RED}${BOLD}$FAILED_COUNT${NC}"
log ""

if [ "${#FAILURES[@]}" -eq 0 ]; then
	log "${GREEN}${BOLD}  ✓  TUDO OK — o pipeline deve passar no GitLab.${NC}"
	EXIT_CODE=0
else
	log "${RED}${BOLD}  ✗  FALHAS DETECTADAS:${NC}"
	for failure in "${FAILURES[@]}"; do
		log "    ${RED}•${NC} $failure"
	done
	log ""
	log "  Detalhes completos em: ${BOLD}$LOG_FILE${NC}"
	EXIT_CODE=1
fi

log ""
log "  Finalizado em: $(date)"
log ""

exit $EXIT_CODE
