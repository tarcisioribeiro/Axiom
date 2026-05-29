import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface VariableHelper {
  hint: string;
  default_value?: string;
  example?: string;
  accepted_values?: string;
  warning?: string;
}

const VARIABLE_HELPERS: Record<string, VariableHelper> = {
  LLM_PROVIDER: {
    hint: 'Define qual provedor o sistema de agentes usa. Trocar entre provedores requer reinicialização do container.',
    default_value: 'ollama',
    accepted_values: 'ollama | anthropic',
  },
  OLLAMA_BASE_URL: {
    hint: 'Endereço HTTP do servidor Ollama. Dentro do Docker Compose, o service name "ollama" resolve automaticamente. Para Ollama instalado no host (fora do Docker), use http://host.docker.internal:11434.',
    default_value: 'http://ollama:11434',
    example: 'http://host.docker.internal:11434',
  },
  OLLAMA_MODEL: {
    hint: 'Tag do modelo Ollama para geração de texto (chat). O modelo precisa estar previamente baixado. Recomendado para desenvolvimento: mistral:7b-instruct (funciona bem com 16 GB RAM).',
    example: 'mistral:7b-instruct',
    accepted_values:
      'mistral:7b-instruct | llama3:8b | gemma2:9b-instruct | llama3:70b',
  },
  OLLAMA_EMBED_MODEL: {
    hint: 'Modelo Ollama para gerar embeddings vetoriais (RAG). Deve estar alinhado com os vetores já armazenados no pgvector — trocar o modelo sem re-indexar gera resultados de busca ruins.',
    example: 'nomic-embed-text',
    accepted_values: 'nomic-embed-text | mxbai-embed-large | all-minilm',
  },
  LLM_TIMEOUT_CHAT: {
    hint: 'Segundos máximos de espera por uma resposta de chat. Em hardware sem GPU ou com modelos grandes, aumente para 300 ou mais para evitar timeouts.',
    default_value: '120',
    example: '300',
  },
  LLM_TIMEOUT_EMBED: {
    hint: 'Segundos máximos de espera por um embedding. Embeddings são geralmente mais rápidos que chat; raramente precisa ser aumentado.',
    default_value: '30',
  },
  ANTHROPIC_API_KEY: {
    hint: 'Chave secreta da API Anthropic. Obrigatória quando LLM_PROVIDER=anthropic. Obtida em console.anthropic.com → API Keys. Armazenada criptografada no banco.',
    example: 'sk-ant-api03-...',
    warning:
      'Nunca commite esta chave em código. Ela só é exibida uma vez no Console Anthropic ao ser criada.',
  },
  ANTHROPIC_MODEL: {
    hint: 'ID do modelo Claude a utilizar. Os IDs são versionados; consulte docs.anthropic.com/en/docs/about-claude/models para o ID mais recente recomendado.',
    example: 'claude-sonnet-4-6',
    accepted_values: 'claude-sonnet-4-6 | claude-haiku-4-5-20251001 | claude-opus-4-7',
  },
  EMAIL_BACKEND: {
    hint: 'Classe Python do backend de email do Django. Em produção use o backend SMTP. Em desenvolvimento, o backend "console" imprime emails no stdout do container em vez de enviá-los.',
    default_value: 'django.core.mail.backends.smtp.EmailBackend',
    accepted_values:
      'smtp.EmailBackend (produção) | console.EmailBackend (desenvolvimento)',
  },
  EMAIL_HOST: {
    hint: 'Hostname do servidor SMTP. Exemplos por provedor: Gmail → smtp.gmail.com, Outlook → smtp.office365.com, SES → email-smtp.<região>.amazonaws.com, SendGrid → smtp.sendgrid.net.',
    default_value: 'localhost',
    example: 'smtp.gmail.com',
  },
  EMAIL_PORT: {
    hint: 'Porta SMTP. Use 587 com STARTTLS (EMAIL_USE_TLS=True), 465 com SSL implícito (EMAIL_USE_SSL=True), ou 25 sem criptografia (não recomendado em produção).',
    default_value: '587',
    accepted_values: '587 (STARTTLS) | 465 (SSL) | 25 (sem criptografia)',
  },
  EMAIL_USE_TLS: {
    hint: 'Ativa STARTTLS. Use com porta 587. Nunca defina EMAIL_USE_TLS=True e EMAIL_USE_SSL=True ao mesmo tempo — isso causará erro de conexão.',
    default_value: 'True',
    accepted_values: 'True | False',
    warning: 'Não ative simultaneamente com EMAIL_USE_SSL=True.',
  },
  EMAIL_HOST_USER: {
    hint: 'Usuário de autenticação SMTP — geralmente o endereço de email completo. Para SendGrid, o valor é sempre a palavra literal "apikey".',
    example: 'seu@gmail.com',
  },
  EMAIL_HOST_PASSWORD: {
    hint: 'Senha SMTP. Armazenada criptografada. Para Gmail com verificação em 2 etapas, use uma App Password (myaccount.google.com/apppasswords) — não a senha da conta Google. Para SendGrid, use a chave de API (começa com SG.).',
    warning:
      'Para Gmail, crie uma App Password específica. A senha da conta Google não funciona quando a verificação em 2 etapas está ativa.',
  },
  DEFAULT_FROM_EMAIL: {
    hint: 'Endereço exibido no campo "De" dos emails enviados. O endereço deve estar autorizado pelo provedor SMTP para evitar que os emails sejam marcados como spam.',
    default_value: 'Axiom <noreply@axiom.app>',
    example: 'Axiom <noreply@seudominio.com>',
  },
  SITE_URL: {
    hint: 'URL pública do frontend, usada para gerar links clicáveis dentro dos emails (ex: link de redefinição de senha). Deve incluir o protocolo (https://).',
    example: 'https://axiom.seudominio.com',
  },
  BACKUP_CRON: {
    hint: 'Expressão cron para o agendamento do backup automático do banco. Requer reinicialização do serviço de backup para entrar em vigor após a mudança.',
    example: '0 2 * * * (diariamente às 02h)',
    accepted_values: '0 2 * * * | 0 3 * * 0 (domingos) | 0 1 1 * * (dia 1 de cada mês)',
  },
  KEEP_DAILY: {
    hint: 'Quantidade de backups diários a manter. Backups mais antigos são excluídos automaticamente pelo serviço de retenção.',
    example: '7',
  },
  KEEP_WEEKLY: {
    hint: 'Quantidade de backups semanais a manter (um por semana ISO). Complementa a retenção diária para recuperação de dados mais antigos.',
    example: '4',
  },
  KEEP_MONTHLY: {
    hint: 'Quantidade de backups mensais a manter. Recomendado manter ao menos 3 meses para compliance e recuperação de desastres.',
    example: '3',
  },
  BACKUP_ENCRYPTION_KEY: {
    hint: 'Senha AES-256 para criptografar os arquivos de backup. Independente da ENCRYPTION_KEY do aplicativo — são chaves distintas com finalidades distintas.',
    warning:
      'Alterar esta chave invalida a descriptografia de todos os backups anteriores. Guarde o valor atual antes de trocar.',
  },
  DEBUG: {
    hint: 'Ativa o modo debug do Django. Em modo debug, tracebacks completos são exibidos nas respostas de erro e otimizações de produção são desativadas.',
    default_value: 'False',
    accepted_values: 'True | False',
    warning:
      'Nunca use True em produção — expõe informações sensíveis do servidor nas respostas de erro.',
  },
  LOG_FORMAT: {
    hint: 'Formato dos logs do servidor. "json" é estruturado e integrável com ferramentas como Grafana/Loki. "verbose" é legível no terminal e recomendado para desenvolvimento.',
    default_value: 'json',
    accepted_values: 'json (produção) | verbose (desenvolvimento)',
  },
  BUDGET_ENFORCEMENT_MODE: {
    hint: 'Comportamento ao ultrapassar um orçamento configurado. "soft" permite a operação e retorna um alerta (HTTP 201). "hard" bloqueia a operação com erro (HTTP 400).',
    default_value: 'soft',
    accepted_values: 'soft (alerta) | hard (bloqueia)',
  },
  ALLOWED_HOSTS: {
    hint: 'Domínios aceitos pelo Django, separados por vírgula. Requisições com Host header não listado são rejeitadas com HTTP 400. Em desenvolvimento: localhost,127.0.0.1.',
    example: 'axiom.com,www.axiom.com',
  },
  CORS_ALLOWED_ORIGINS: {
    hint: 'Origens permitidas para requisições CORS, separadas por vírgula. Deve incluir a URL do frontend. Em desenvolvimento: http://localhost:39101.',
    example: 'https://axiom.com,http://localhost:39101',
  },
  GUNICORN_WORKERS: {
    hint: 'Número de processos worker do Gunicorn. Regra geral: 2 × número_de_núcleos_CPU + 1. Mais workers aumentam throughput mas também o uso de memória RAM.',
    default_value: '2',
    example: '5 (para servidor com 2 núcleos)',
  },
  SECRET_KEY: {
    hint: 'Chave secreta do Django usada para assinar sessões, tokens CSRF e cookies. Deve ser longa, aleatória e única por ambiente.',
    warning:
      'Alterar esta chave invalida imediatamente todas as sessões ativas — todos os usuários serão deslogados. Gere uma nova com: docker compose exec api python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"',
  },
  ENCRYPTION_KEY: {
    hint: 'Chave Fernet (44 chars base64) para criptografia de campos sensíveis no banco: Account._account_number, CreditCard._card_number/_security_code, Member._document, entre outros.',
    warning:
      'Nunca troque esta chave diretamente. Use o management command "rotate_encryption_key" com --old-key e --new-key. Alterar sem a rotação torna todos os dados criptografados ilegíveis e irrecuperáveis. Consulte a documentação para o procedimento completo.',
  },
  MINIO_ENDPOINT: {
    hint: 'Endereço interno do MinIO (host:porta). Dentro do Docker Compose, o service name "minio" resolve automaticamente. Para acesso externo (fora do Docker), use localhost:39105.',
    default_value: 'minio:9000',
    example: 'localhost:39105 (acesso externo)',
  },
  MINIO_BUCKET_NAME: {
    hint: 'Nome do bucket principal para armazenamento de mídia. O bucket é criado automaticamente na primeira inicialização se não existir. Use apenas letras minúsculas, números e hífens.',
    example: 'axiom-media',
  },
  MINIO_ROOT_USER: {
    hint: 'Usuário root do MinIO, equivalente à variável MINIO_ROOT_USER definida no docker-compose. Deve coincidir com o valor configurado no serviço MinIO.',
    example: 'minioadmin',
  },
  MINIO_ROOT_PASSWORD: {
    hint: 'Senha root do MinIO. Armazenada criptografada no banco. Deve coincidir com a senha configurada no serviço MinIO. O Console MinIO está disponível em http://localhost:39106.',
    warning:
      'Esta senha deve ser idêntica à configurada no serviço MinIO. Uma divergência causa falha de autenticação e torna o armazenamento de arquivos inacessível.',
  },
};

export function VariableHelperPopover({ configKey }: { configKey: string }) {
  const { t } = useTranslation();
  const helper = VARIABLE_HELPERS[configKey];
  if (!helper) return null;

  const hint = t(`pages.adminConfig.variables.${configKey}.hint`, {
    defaultValue: helper.hint,
  });
  const warning = helper.warning
    ? t(`pages.adminConfig.variables.${configKey}.warning`, {
        defaultValue: helper.warning,
      })
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex-shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          aria-label={t('pages.adminConfig.helpAriaLabel')}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-80 space-y-sm text-sm">
        <p className="leading-snug text-foreground">{hint}</p>

        {helper.accepted_values && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('pages.adminConfig.popover.acceptedValues')}
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.accepted_values}
            </p>
          </div>
        )}

        {helper.default_value && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('pages.adminConfig.popover.default')}
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.default_value}
            </p>
          </div>
        )}

        {helper.example && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('pages.adminConfig.popover.example')}
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.example}
            </p>
          </div>
        )}

        {warning && (
          <div className="flex gap-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-sm py-sm">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
            <p className="text-xs leading-snug text-amber-700 dark:text-amber-400">
              {warning}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
