import os

DEFAULT_CONFIGS: list[dict] = [
    # ─── LLM / Agentes
    # ────────────────────────────────────────────────────────
    {
        "key": "LLM_PROVIDER",
        "category": "llm",
        "label": "Provedor LLM",
        "description": (
            "Provedor de linguagem: 'ollama' (local), "
            "'groq' (nuvem, rápido e gratuito) ou 'anthropic' (nuvem, Claude)."
        ),
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "OLLAMA_BASE_URL",
        "category": "llm",
        "label": "URL do Ollama",
        "description": "Endereço do serviço Ollama (Kubernetes: "
        + ("http://ollama-service:11434 | Docker: http://ollama:11434)."),
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "OLLAMA_MODEL",
        "category": "llm",
        "label": "Modelo Ollama (Chat)",
        "description": (
            "Modelo para geração de texto" " (ex: mistral:7b-instruct)."
        ),
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "OLLAMA_EMBED_MODEL",
        "category": "llm",
        "label": "Modelo Ollama (Embedding)",
        "description": "Modelo para embeddings (ex: nomic-embed-text).",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "LLM_TIMEOUT_CHAT",
        "category": "llm",
        "label": "Timeout Chat (segundos)",
        "description": "Tempo máximo de espera por resposta do LLM.",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "LLM_TIMEOUT_EMBED",
        "category": "llm",
        "label": "Timeout Embedding (segundos)",
        "description": "Tempo máximo de espera por embedding.",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "GROQ_API_KEY",
        "category": "llm",
        "label": "Chave API Groq",
        "description": (
            "Chave de API para uso com Groq "
            "(obrigatório se LLM_PROVIDER=groq). Obtenha em console.groq.com."
        ),
        "is_secret": True,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "GROQ_MODEL",
        "category": "llm",
        "label": "Modelo Groq",
        "description": (
            "Modelo Groq a utilizar. Opções: llama-3.1-8b-instant (rápido), "
            "llama-3.3-70b-versatile (melhor qualidade), gemma2-9b-it."
        ),
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "ANTHROPIC_API_KEY",
        "category": "llm",
        "label": "Chave API Anthropic",
        "description": (
            "Chave de API para uso com Claude "
            "(obrigatório se LLM_PROVIDER=anthropic)."
        ),
        "is_secret": True,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "ANTHROPIC_MODEL",
        "category": "llm",
        "label": "Modelo Anthropic",
        "description": "Modelo Claude a utilizar (ex: claude-sonnet-4-6).",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    # ─── Email
    # ────────────────────────────────────────────────────────────────
    {
        "key": "EMAIL_BACKEND",
        "category": "email",
        "label": "Backend de Email",
        "description": (
            "Backend Django: "
            "django.core.mail.backends.smtp.EmailBackend (produção) ou "
            "django.core.mail.backends.console.EmailBackend (dev)."
        ),
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "EMAIL_HOST",
        "category": "email",
        "label": "Servidor SMTP",
        "description": "Host do servidor de email (ex: smtp.gmail.com).",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "EMAIL_PORT",
        "category": "email",
        "label": "Porta SMTP",
        "description": "Porta do servidor (587 para TLS, 465 para SSL).",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "EMAIL_USE_TLS",
        "category": "email",
        "label": "Usar TLS",
        "description": "Ativar TLS para conexão SMTP (True/False).",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "EMAIL_HOST_USER",
        "category": "email",
        "label": "Usuário SMTP",
        "description": "Nome de usuário para autenticação SMTP.",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "EMAIL_HOST_PASSWORD",
        "category": "email",
        "label": "Senha SMTP",
        "description": "Senha para autenticação SMTP.",
        "is_secret": True,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "DEFAULT_FROM_EMAIL",
        "category": "email",
        "label": "Email Remetente",
        "description": (
            "Endereço padrão do remetente " "(ex: Axiom <noreply@axiom.app>)."
        ),
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "SITE_URL",
        "category": "email",
        "label": "URL do Site",
        "description": "URL pública do frontend, usada em links de email.",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    # ─── Backup
    # ───────────────────────────────────────────────────────────────
    {
        "key": "BACKUP_CRON",
        "category": "backup",
        "label": "Agendamento (Cron)",
        "description": (
            "Expressão cron para o backup automático "
            "(ex: '0 2 * * *' = 02h diário)."
            " Requer reinicialização do serviço."
        ),
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "KEEP_DAILY",
        "category": "backup",
        "label": "Backups Diários Mantidos",
        "description": "Quantidade de backups diários a manter.",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "KEEP_WEEKLY",
        "category": "backup",
        "label": "Backups Semanais Mantidos",
        "description": (
            "Quantidade de backups semanais a manter" " (um por semana ISO)."
        ),
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "KEEP_MONTHLY",
        "category": "backup",
        "label": "Backups Mensais Mantidos",
        "description": "Quantidade de backups mensais a manter.",
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "BACKUP_ENCRYPTION_KEY",
        "category": "backup",
        "label": "Chave de Criptografia de Backup",
        "description": (
            "Senha AES-256 para criptografar os arquivos de backup. "
            "Alterar invalida a descriptografia de backups anteriores."
        ),
        "is_secret": True,
        "requires_restart": False,
        "is_editable": True,
    },
    # ─── Aplicação
    # ────────────────────────────────────────────────────────────
    {
        "key": "DEBUG",
        "category": "app",
        "label": "Modo Debug",
        "description": "Ativar modo de debug Django (nunca usar em produção).",
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "LOG_FORMAT",
        "category": "app",
        "label": "Formato de Log",
        "description": "'json' (produção) ou 'verbose' (desenvolvimento).",
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "BUDGET_ENFORCEMENT_MODE",
        "category": "app",
        "label": "Modo de Orçamento",
        "description": (
            "'soft' (alerta 201 ao ultrapassar) ou "
            "'hard' (bloqueio 400 ao ultrapassar)."
        ),
        "is_secret": False,
        "requires_restart": False,
        "is_editable": True,
    },
    {
        "key": "ALLOWED_HOSTS",
        "category": "app",
        "label": "Hosts Permitidos",
        "description": "Domínios permitidos separados por vírgula.",
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "CORS_ALLOWED_ORIGINS",
        "category": "app",
        "label": "Origens CORS",
        "description": "Origens permitidas para CORS, separadas por vírgula.",
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "GUNICORN_WORKERS",
        "category": "app",
        "label": "Workers Gunicorn",
        "description": "Número de processos worker do servidor de aplicação.",
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    # ─── Segurança
    # ────────────────────────────────────────────────────────────
    {
        "key": "SECRET_KEY",
        "category": "security",
        "label": "Django Secret Key",
        "description": (
            "Chave secreta Django para assinatura de sessões e tokens. "
            "ATENÇÃO: alterar invalida todas as sessões ativas imediatamente."
        ),
        "is_secret": True,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "ENCRYPTION_KEY",
        "category": "security",
        "label": "Chave de Criptografia (Fernet)",
        "description": (
            "Chave Fernet para criptografia de campos sensíveis no banco. "
            "ATENÇÃO: alterar sem executar rotate_encryption_key primeiro "
            "torna todos os dados criptografados ilegíveis."
        ),
        "is_secret": True,
        "requires_restart": True,
        "is_editable": True,
    },
    # ─── Armazenamento
    # ────────────────────────────────────────────────────────
    {
        "key": "MINIO_ENDPOINT",
        "category": "storage",
        "label": "Endpoint MinIO",
        "description": "Endereço interno do MinIO (ex: minio:9000).",
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "MINIO_BUCKET_NAME",
        "category": "storage",
        "label": "Bucket Principal",
        "description": "Nome do bucket para armazenamento de mídia.",
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "MINIO_ROOT_USER",
        "category": "storage",
        "label": "Usuário MinIO",
        "description": "Usuário de acesso ao MinIO.",
        "is_secret": False,
        "requires_restart": True,
        "is_editable": True,
    },
    {
        "key": "MINIO_ROOT_PASSWORD",
        "category": "storage",
        "label": "Senha MinIO",
        "description": "Senha de acesso ao MinIO.",
        "is_secret": True,
        "requires_restart": True,
        "is_editable": True,
    },
]


def populate_default_configs() -> None:
    """
    Cria entradas SystemConfig ausentes no banco, semeando valores do ambiente
    atual.
    Nunca sobrescreve entradas já existentes.
    """
    from admin_panel.models import SystemConfig

    for cfg in DEFAULT_CONFIGS:
        mgr = SystemConfig.objects  # type: ignore[attr-defined]
        if mgr.filter(key=cfg["key"]).exists():
            continue
        env_value = os.getenv(cfg["key"])
        obj = SystemConfig(
            key=cfg["key"],
            category=cfg["category"],
            label=cfg["label"],
            description=cfg["description"],
            is_secret=cfg["is_secret"],
            requires_restart=cfg["requires_restart"],
            is_editable=cfg["is_editable"],
        )
        obj.set_value(env_value)
        obj.save()
