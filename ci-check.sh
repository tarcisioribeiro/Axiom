#!/usr/bin/env bash
# ==============================================================================
# ci-check.sh — Axiom: Simulação interativa do pipeline GitLab CI/CD
# ==============================================================================
#
# Uso interativo (único modo — sem flags de escopo):
#
#   ./ci-check.sh
#
# O script pergunta o que você quer fazer:
#   1) Rodar os checks de MR (lint stage — o que sua MR precisa passar)
#   2) Ver os jobs que rodam em develop (informativo, não executa nada)
#   3) Ver os jobs que rodam em main (informativo, não executa nada)
#   4) Rodar MR + ver develop e main
#   0) Sair
#
# Ao escolher "Rodar os checks de MR", um segundo menu deixa escolher o
# escopo: tudo, só backend, ou só frontend.
#
# Por que só MR é executável: .gitlab-ci.yml só cria pipeline para eventos de
# MR ou push em develop/main (ver workflow: rules). Os jobs de develop/main
# (build, scan, deploy, smoke, backup, cleanup) exigem cluster/registry reais
# e credenciais de produção/staging — não são simuláveis localmente, por isso
# as opções 2/3/4 apenas explicam o que cada job faz e por que não roda aqui.
#
# Checks de MR cobertos (mesmos jobs, mesma ordem, de .gitlab-ci.yml):
#
#   lint:backend       black · isort · flake8
#   lint:migrations    makemigrations --check --dry-run
#   lint:bandit        bandit -r apps/api/ -x apps/api/tests,apps/api/*/migrations -ll
#   lint:pip-audit     pip-audit -r apps/api/requirements.txt --desc --vulnerability-service osv --ignore-vuln PYSEC-2025-183
#   lint:frontend      eslint · prettier
#   lint:npm-audit     npm audit --audit-level=high
#   lint:k8s           kubeconform (opcional local — precisa do binário instalado)
#   lint:commits       commitlint (opcional local — aproximação: roda contra o
#                      merge-base com origin/develop, já que o range exato de
#                      uma MR só existe dentro de uma pipeline de MR real)
#   lint:secrets       gitleaks (opcional local — obrigatório no GitLab CI)
#
# Mobile não tem jobs no GitLab CI (removidos — ver CLAUDE.md) — rode os
# comandos Flutter diretamente para lint/test/build local.
#
# Pré-requisitos:
#   - Docker + docker compose com o serviço 'api' rodando (só para lint:migrations)
#   - Node.js 20+ com apps/frontend/node_modules instalado no host
#     (o container 'frontend' é nginx-only; npm roda direto no host)
#
# Flags:
#   --help, -h    Exibe esta ajuda (única flag que existe — tudo o mais é
#                 escolhido interativamente)
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
: >"$LOG_FILE"

for arg in "$@"; do
	case "$arg" in
	--help | -h)
		# Exibe o bloco de comentário no topo (linhas começando com '#', a
		# partir da linha 2, até a primeira linha em branco).
		sed -n '2,${/^#/!q; p}' "$0" | sed 's/^# \?//'
		exit 0
		;;
	*)
		echo "Opção desconhecida: '$arg'. A única flag suportada é --help. Rode sem argumentos para o menu interativo."
		exit 1
		;;
	esac
done

# ── Venv Python (backend lint local) ────────────────────────────────────────────
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
BACKEND_ONLY=false
FRONTEND_ONLY=false
RUN_MR=false
SHOW_DEVELOP=false
SHOW_MAIN=false
SCOPE_BACK=false

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

# Card informativo para os jobs de develop/main que não são executados localmente.
print_job_card() {
	local name="$1" stage="$2" desc="$3" trigger="$4" reason="${5:-}"
	log "  ${CYAN}${BOLD}▸ $name${NC}  ${DIM}(stage: $stage)${NC}"
	log "      $desc"
	log "      ${DIM}Dispara quando:${NC} $trigger"
	if [ -n "$reason" ]; then
		log "      ${YELLOW}Por que não roda localmente:${NC} $reason"
	fi
	log ""
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
	if ! docker compose -f "$SCRIPT_DIR/infra/docker/docker-compose.yml" --project-directory "$SCRIPT_DIR" ps api 2>/dev/null | grep -q "Up"; then
		log "${YELLOW}  Serviço 'api' não está rodando. Subindo containers...${NC}"
		docker compose -f "$SCRIPT_DIR/infra/docker/docker-compose.yml" --project-directory "$SCRIPT_DIR" up -d >>"$LOG_FILE" 2>&1
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

	if [ ! -d "$SCRIPT_DIR/apps/frontend/node_modules" ]; then
		log "${YELLOW}  node_modules ausente — rodando npm ci...${NC}"
		if ! (cd "$SCRIPT_DIR/apps/frontend" && npm ci) >>"$LOG_FILE" 2>&1; then
			log "${RED}  ✗  Falha ao instalar dependências do frontend.${NC}"
			return 1
		fi
		log "${GREEN}  ✓  Dependências instaladas${NC}"
	fi

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
		log "${YELLOW}  Instalando dependências (apps/api/requirements-dev.txt + pip-audit)...${NC}"
		if ! "$VENV_BIN/pip" install --quiet --upgrade pip >>"$LOG_FILE" 2>&1; then
			log "${RED}  ✗  Falha ao atualizar pip no venv.${NC}"
			return 1
		fi
		if ! "$VENV_BIN/pip" install --quiet -r "$SCRIPT_DIR/apps/api/requirements-dev.txt" pip-audit >>"$LOG_FILE" 2>&1; then
			log "${RED}  ✗  Falha ao instalar dependências no venv.${NC}"
			return 1
		fi
		log "${GREEN}  ✓  Dependências instaladas${NC}"
	fi

	log "${GREEN}  ✓  venv OK — $VENV_DIR${NC}"
	return 0
}

# ── Menu interativo ─────────────────────────────────────────────────────────────
show_banner() {
	log ""
	log "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
	log "${BOLD}║       Axiom — Simulação Interativa do Pipeline GitLab CI/CD        ║${NC}"
	log "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
	log "  Log completo: ${BOLD}$LOG_FILE${NC}"
}

main_menu() {
	local choice
	RUN_MR=false
	SHOW_DEVELOP=false
	SHOW_MAIN=false
	while true; do
		log ""
		log "${BOLD}O que você quer fazer?${NC}"
		log "  ${CYAN}1)${NC} Rodar os checks de MR ${DIM}(lint stage — o que sua MR precisa passar)${NC}"
		log "  ${CYAN}2)${NC} Ver os jobs que rodam em ${BOLD}develop${NC} ${DIM}(informativo, não executa)${NC}"
		log "  ${CYAN}3)${NC} Ver os jobs que rodam em ${BOLD}main${NC} ${DIM}(informativo, não executa)${NC}"
		log "  ${CYAN}4)${NC} Rodar MR + ver develop e main"
		log "  ${CYAN}0)${NC} Sair"
		log ""
		read -rp "Escolha [0-4]: " choice
		case "$choice" in
		0)
			log ""
			log "Até mais!"
			exit 0
			;;
		1)
			RUN_MR=true
			return
			;;
		2)
			SHOW_DEVELOP=true
			return
			;;
		3)
			SHOW_MAIN=true
			return
			;;
		4)
			RUN_MR=true
			SHOW_DEVELOP=true
			SHOW_MAIN=true
			return
			;;
		*)
			log "${RED}  Opção inválida.${NC}"
			;;
		esac
	done
}

scope_menu() {
	local choice
	SCOPE_BACK=false
	while true; do
		log ""
		log "${BOLD}Quais checks de MR rodar?${NC}"
		log "  ${CYAN}1)${NC} Tudo ${DIM}(backend + frontend + k8s)${NC}"
		log "  ${CYAN}2)${NC} Só backend"
		log "  ${CYAN}3)${NC} Só frontend"
		log "  ${CYAN}0)${NC} Voltar ao menu principal"
		log ""
		read -rp "Escolha [0-3]: " choice
		case "$choice" in
		0)
			SCOPE_BACK=true
			return
			;;
		1)
			BACKEND_ONLY=false
			FRONTEND_ONLY=false
			return
			;;
		2)
			BACKEND_ONLY=true
			FRONTEND_ONLY=false
			return
			;;
		3)
			BACKEND_ONLY=false
			FRONTEND_ONLY=true
			return
			;;
		*)
			log "${RED}  Opção inválida.${NC}"
			;;
		esac
	done
}

# ── Informativo: jobs de develop/main (não executados localmente) ──────────────
show_develop_info() {
	section "JOBS QUE RODAM EM develop (informativo — não executado localmente)"
	log "${DIM}Branch pipeline em develop (push direto ou merge de MR). Sequência: build → scan → deploy:staging → backup/smoke → test:backup-restore → cleanup.${NC}"
	log ""

	print_job_card "build:api" "build" \
		"Builda a imagem Docker da API (ou re-tagueia a imagem já buildada em develop, se aplicável), gera SBOM (syft, CycloneDX+SPDX) e faz push para o GHCR." \
		"push em develop" \
		"Precisa de GHCR_TOKEN/GHCR_USERNAME e publica uma imagem real no registry — não reproduzível localmente sem efeitos colaterais."

	print_job_card "build:frontend" "build" \
		"Builda a imagem Docker do frontend (VITE_APP_ENV=staging), gera SBOM e faz push para o GHCR." \
		"push em develop" \
		"Mesmo motivo do build:api — precisa de credenciais do GHCR."

	print_job_card "scan:api" "scan" \
		"Escaneia a imagem recém-publicada da API com Trivy (severidade HIGH/CRITICAL, ignora vulnerabilidades sem fix)." \
		"após build:api, em develop" \
		"Precisa da imagem já publicada no GHCR (needs: build:api) e de credenciais de leitura do registry."

	print_job_card "scan:frontend" "scan" \
		"Mesmo scan Trivy, para a imagem do frontend." \
		"após build:frontend, em develop" \
		"Mesmo motivo do scan:api."

	print_job_card "deploy:staging" "deploy-staging" \
		"Sincroniza secrets (DB, Redis, MinIO, Ollama, superuser) via kubectl e aplica o overlay de staging (kustomize) no cluster, substituindo a tag da imagem." \
		"após scan:api e scan:frontend, em develop" \
		"Precisa de KUBECONFIG_CONTENT (kubeconfig real do cluster) e de todas as variáveis STAGING_* configuradas no GitLab."

	print_job_card "backup:staging" "smoke-staging" \
		"Garante que o CronJob de backup existe, dispara um Job avulso e aguarda ele completar — garante que sempre haja um dump fresco para o test:backup-restore." \
		"após deploy:staging" \
		"Precisa de acesso ao cluster de staging e das credenciais do MinIO de backup (STAGING_MINIO_BACKUP_*)."

	print_job_card "smoke:staging" "smoke-staging" \
		"Faz requisições HTTP reais contra o STAGING_URL (health/ready/login/me) para validar que o deploy não quebrou nada." \
		"após deploy:staging" \
		"Precisa que staging esteja realmente no ar em STAGING_URL, com credenciais de superusuário válidas."

	print_job_card "deploy:rollback:staging" "smoke-staging" \
		"Rollback automático (kubectl rollout undo) disparado quando smoke:staging falha." \
		"on_failure de smoke:staging, em develop" \
		"Só existe como reação a uma falha real em staging — não há o que simular localmente."

	print_job_card "rollback:staging" "smoke-staging" \
		"Rollback manual (acionado por um operador na UI do GitLab), mesma lógica do automático." \
		"manual, em develop" \
		"Requer acesso ao cluster de staging."

	print_job_card "test:backup-restore" "test-backup-restore" \
		"Baixa o backup mais recente do MinIO, decripta, restaura em um Postgres temporário e roda 'manage.py check' contra o dump restaurado." \
		"após deploy:staging e backup:staging, em develop" \
		"Precisa de BACKUP_ENCRYPTION_KEY e das credenciais do MinIO de staging para baixar o dump real."

	print_job_card "cleanup:registry" "cleanup" \
		"Remove tags antigas do Container Registry e versões antigas do Package Registry (SBOMs), mantendo as 5 mais recentes." \
		"após build, em develop (também roda em main), ou manual" \
		"Precisa de GITLAB_TOKEN com escopo 'api' contra o registry real do projeto."

	print_job_card "cleanup:k8s:staging" "cleanup" \
		"Remove Jobs concluídos/falhados do namespace axiom-staging." \
		"após deploy:staging" \
		"Precisa de acesso ao cluster de staging."
}

show_main_info() {
	section "JOBS QUE RODAM EM main (informativo — não executado localmente)"
	log "${DIM}Branch pipeline em main (merge de develop→main). Sequência: build → scan → deploy:production (blue-green) → smoke → cleanup.${NC}"
	log ""

	print_job_card "build:api" "build" \
		"Em main tenta re-tagear a imagem já buildada em develop no mesmo commit de merge; se não achar, builda do zero. Gera SBOM e faz push das tags :main." \
		"push em main" \
		"Precisa de GHCR_TOKEN/GHCR_USERNAME — compartilhado com o job de develop, mas roda de novo aqui para gerar as tags :main."

	print_job_card "build:frontend" "build" \
		"Sempre rebuilda com VITE_APP_ENV=production (o valor é embutido no bundle JS, não dá pra reaproveitar a imagem de staging) e faz push das tags :main." \
		"push em main" \
		"Mesmo motivo — credenciais do GHCR."

	print_job_card "scan:api" "scan" \
		"Mesmo scan Trivy de develop, sobre a imagem de main." \
		"após build:api, em main" \
		"Precisa da imagem publicada no GHCR."

	print_job_card "scan:frontend" "scan" \
		"Mesmo scan Trivy, para o frontend de main." \
		"após build:frontend, em main" \
		"Mesmo motivo do scan:api."

	print_job_card "deploy:production" "deploy-production" \
		"Sincroniza secrets de produção, aplica o overlay de produção e faz o deploy blue-green da API (infra/k8s/scripts/blue-green-switch.sh) + rollout do frontend." \
		"após scan:api e scan:frontend, em main" \
		"Precisa de KUBECONFIG_CONTENT apontando para o cluster de produção e de todas as variáveis PRODUCTION_*."

	print_job_card "smoke:production" "smoke-production" \
		"Executa curl de dentro do pod ativo (health/ready/login/me) contra o slot blue/green que está recebendo tráfego." \
		"após deploy:production" \
		"Precisa que produção esteja realmente no ar e de credenciais de superusuário de produção."

	print_job_card "deploy:rollback:production" "smoke-production" \
		"Rollback automático: troca o Service de volta para o slot anterior e escala o slot atual a 0, mais rollback do frontend." \
		"on_failure de smoke:production, em main" \
		"Só existe como reação a uma falha real em produção."

	print_job_card "rollback:production" "smoke-production" \
		"Rollback manual, mesma lógica do automático." \
		"manual, em main" \
		"Requer acesso ao cluster de produção."

	print_job_card "cleanup:registry" "cleanup" \
		"Mesmo job de limpeza do registry (compartilhado com develop)." \
		"após build, em main (também roda em develop), ou manual" \
		"Precisa de GITLAB_TOKEN contra o registry real."

	print_job_card "cleanup:k8s:production" "cleanup" \
		"Remove Jobs concluídos/falhados do namespace axiom." \
		"após deploy:production" \
		"Precisa de acesso ao cluster de produção."
}

# ==============================================================================
# Menu
# ==============================================================================
show_banner

if [ -t 0 ]; then
	while true; do
		main_menu
		if $RUN_MR; then
			scope_menu
			if $SCOPE_BACK; then
				continue
			fi
		fi
		break
	done
else
	log ""
	log "${YELLOW}⚠  stdin não é um terminal — pulando o menu interativo e rodando os checks de MR (tudo) automaticamente.${NC}"
	RUN_MR=true
fi

log ""
log "${DIM}Iniciado em: $(date)${NC}"
if $RUN_MR; then
	SCOPE_LABEL="tudo (backend + frontend + k8s)"
	$BACKEND_ONLY && SCOPE_LABEL="só backend"
	$FRONTEND_ONLY && SCOPE_LABEL="só frontend"
	log "${DIM}Checks de MR: $SCOPE_LABEL${NC}"
fi

# ==============================================================================
# Checks de MR
# ==============================================================================
if $RUN_MR; then
	# ── Pré-requisitos ─────────────────────────────────────────────────────────
	$FRONTEND_ONLY || check_docker

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

	# ==========================================================================
	# STAGE: lint
	# ==========================================================================
	section "LINT"

	if ! $FRONTEND_ONLY; then
		run_step_safe "lint:backend" "black" \
			sh -c "cd '$SCRIPT_DIR/apps/api' && '$VENV_BIN/black' --check --diff ."

		run_step_safe "lint:backend" "isort" \
			sh -c "cd '$SCRIPT_DIR/apps/api' && '$VENV_BIN/isort' --check-only --diff ."

		run_step_safe "lint:backend" "flake8" \
			sh -c "cd '$SCRIPT_DIR/apps/api' && '$VENV_BIN/flake8' ."

		run_step_safe "lint:migrations" "makemigrations --check --dry-run" \
			docker compose -f "$SCRIPT_DIR/infra/docker/docker-compose.yml" --project-directory "$SCRIPT_DIR" exec -T \
			-e SECRET_KEY="ci-insecure-key-for-migrations-check-only" \
			-e DEBUG="False" \
			-e DJANGO_SETTINGS_MODULE="app.settings" \
			api python manage.py makemigrations --check --dry-run

		run_step_safe "lint:bandit" "bandit -r apps/api/ -x apps/api/tests,apps/api/*/migrations -ll" \
			sh -c "cd '$SCRIPT_DIR' && '$VENV_BIN/bandit' -r apps/api/ -x 'apps/api/tests,apps/api/*/migrations' -ll"

		# PYSEC-2025-183 (PyJWT): disputed by supplier — key length is application's responsibility
		run_step_safe "lint:pip-audit" "pip-audit -r apps/api/requirements.txt --desc --vulnerability-service osv" \
			sh -c "'$VENV_BIN/pip-audit' -r '$SCRIPT_DIR/apps/api/requirements.txt' --desc --vulnerability-service osv --ignore-vuln PYSEC-2025-183"
	fi

	if ! $BACKEND_ONLY; then
		run_step_safe "lint:frontend" "eslint" \
			sh -c "cd '$SCRIPT_DIR/apps/frontend' && npm run lint"

		run_step_safe "lint:frontend" "prettier" \
			sh -c "cd '$SCRIPT_DIR/apps/frontend' && npm run format:check"

		run_step_safe "lint:npm-audit" "npm audit --audit-level=high" \
			sh -c "cd '$SCRIPT_DIR/apps/frontend' && out=\$(npm audit --audit-level=high 2>&1); ec=\$?; printf '%s\n' \"\$out\"; if [ \$ec -ne 0 ] && printf '%s' \"\$out\" | grep -qE 'endpoint returned an error|request.*failed'; then printf 'AVISO: npm audit falhou por indisponibilidade do registry — verifique manualmente.\n'; exit 0; fi; exit \$ec"
	fi

	# ==========================================================================
	# STAGE: lint:k8s (opcional local — requer kubeconform)
	# ==========================================================================
	section "lint:k8s"

	if command -v kubeconform >/dev/null 2>&1; then
		run_step_safe "lint:k8s" "kubeconform" \
			sh -c "cd '$SCRIPT_DIR' && mkdir -p .kubeconform-cache && find infra/k8s/ -name '*.yaml' -not -path '*/scripts/*' -not -path '*/patches/*' -not -name 'kustomization.yaml' | sort | xargs kubeconform -strict -summary -kubernetes-version 1.29.0 -n 1 -cache .kubeconform-cache -schema-location default -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json'"
	else
		log "${YELLOW}  ⚠  kubeconform não encontrado — pulando validação local dos manifests k8s.${NC}"
		log "${YELLOW}     Esta verificação roda no GitLab CI (lint:k8s) quando infra/k8s/**/*.yaml muda numa MR.${NC}"
		log "${DIM}     Instale: https://github.com/yannh/kubeconform${NC}"
	fi

	# ==========================================================================
	# STAGE: lint:commits (opcional local — aproximação do range real da MR)
	# ==========================================================================
	section "lint:commits"

	log "${DIM}  No GitLab CI, lint:commits roda só em MRs com destino != main, usando o range${NC}"
	log "${DIM}  exato da MR (CI_MERGE_REQUEST_DIFF_BASE_SHA..CI_COMMIT_SHA). Localmente não há${NC}"
	log "${DIM}  uma MR real, então isto é uma aproximação: valida os commits desde o merge-base${NC}"
	log "${DIM}  com origin/develop.${NC}"

	if command -v npx >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/apps/frontend/commitlint.config.cjs" ]; then
		COMMITLINT_BASE="$(cd "$SCRIPT_DIR" && git merge-base HEAD origin/develop 2>/dev/null)"
		if [ -z "$COMMITLINT_BASE" ]; then
			(cd "$SCRIPT_DIR" && git fetch origin develop --quiet 2>/dev/null) || true
			COMMITLINT_BASE="$(cd "$SCRIPT_DIR" && git merge-base HEAD origin/develop 2>/dev/null)"
		fi

		if [ -n "$COMMITLINT_BASE" ]; then
			run_step_safe "lint:commits" "commitlint --from $(git -C "$SCRIPT_DIR" rev-parse --short "$COMMITLINT_BASE") --to HEAD" \
				sh -c "cd '$SCRIPT_DIR/apps/frontend' && npx commitlint --from '$COMMITLINT_BASE' --to HEAD"
		else
			log "${YELLOW}  ⚠  Não foi possível determinar o merge-base com origin/develop — pulando lint:commits local.${NC}"
		fi
	else
		log "${YELLOW}  ⚠  npx/commitlint não disponível (ou node_modules do frontend ausente) — pulando lint:commits local.${NC}"
	fi

	# ==========================================================================
	# STAGE: lint:secrets (opcional local — obrigatório no GitLab CI)
	# ==========================================================================
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
fi

# ==============================================================================
# Informativo: develop / main
# ==============================================================================
$SHOW_DEVELOP && show_develop_info
$SHOW_MAIN && show_main_info

# ==============================================================================
# RELATÓRIO FINAL
# ==============================================================================
if $RUN_MR; then
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
else
	EXIT_CODE=0
fi

log ""
log "  Finalizado em: $(date)"
log ""

exit $EXIT_CODE
