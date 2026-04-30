import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Pencil,
  RefreshCw,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { adminService } from '@/services/admin-service';
import type { ConfigCategory, SystemConfig } from '@/types';

const CATEGORY_LABELS: Record<ConfigCategory, string> = {
  llm: 'LLM / Agentes',
  email: 'Email',
  backup: 'Backup',
  app: 'Aplicação',
  security: 'Segurança',
  storage: 'Armazenamento (MinIO)',
};

const CATEGORY_ORDER: ConfigCategory[] = [
  'llm',
  'email',
  'backup',
  'app',
  'security',
  'storage',
];

interface VariableHelper {
  hint: string;
  default_value?: string;
  example?: string;
  accepted_values?: string;
  warning?: string;
}

const VARIABLE_HELPERS: Record<string, VariableHelper> = {
  // LLM / Agentes
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

  // Email
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
    default_value: 'MindLedger <noreply@mindledger.app>',
    example: 'MindLedger <noreply@seudominio.com>',
  },
  SITE_URL: {
    hint: 'URL pública do frontend, usada para gerar links clicáveis dentro dos emails (ex: link de redefinição de senha). Deve incluir o protocolo (https://).',
    example: 'https://mindledger.seudominio.com',
  },

  // Backup
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

  // Aplicação
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
    example: 'mindledger.com,www.mindledger.com',
  },
  CORS_ALLOWED_ORIGINS: {
    hint: 'Origens permitidas para requisições CORS, separadas por vírgula. Deve incluir a URL do frontend. Em desenvolvimento: http://localhost:39101.',
    example: 'https://mindledger.com,http://localhost:39101',
  },
  GUNICORN_WORKERS: {
    hint: 'Número de processos worker do Gunicorn. Regra geral: 2 × número_de_núcleos_CPU + 1. Mais workers aumentam throughput mas também o uso de memória RAM.',
    default_value: '2',
    example: '5 (para servidor com 2 núcleos)',
  },

  // Segurança
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

  // Armazenamento (MinIO)
  MINIO_ENDPOINT: {
    hint: 'Endereço interno do MinIO (host:porta). Dentro do Docker Compose, o service name "minio" resolve automaticamente. Para acesso externo (fora do Docker), use localhost:39105.',
    default_value: 'minio:9000',
    example: 'localhost:39105 (acesso externo)',
  },
  MINIO_BUCKET_NAME: {
    hint: 'Nome do bucket principal para armazenamento de mídia. O bucket é criado automaticamente na primeira inicialização se não existir. Use apenas letras minúsculas, números e hífens.',
    example: 'mindledger-media',
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

function VariableHelperPopover({ configKey }: { configKey: string }) {
  const helper = VARIABLE_HELPERS[configKey];
  if (!helper) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex-shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          aria-label="Ver ajuda"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-80 space-y-2.5 text-sm">
        <p className="leading-snug text-foreground">{helper.hint}</p>

        {helper.accepted_values && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Valores aceitos
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.accepted_values}
            </p>
          </div>
        )}

        {helper.default_value && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Padrão
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.default_value}
            </p>
          </div>
        )}

        {helper.example && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Exemplo
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.example}
            </p>
          </div>
        )}

        {helper.warning && (
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
            <p className="text-xs leading-snug text-amber-700 dark:text-amber-400">
              {helper.warning}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ConfigRow({ config }: { config: SystemConfig }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (val: string) => adminService.updateConfig(config.key, val),
    onSuccess: () => {
      toast({
        title: 'Configuração salva',
        description: `${config.label} atualizado com sucesso.`,
      });
      setEditing(false);
      setValue('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = () => {
    setValue(config.is_secret ? '' : (config.masked_value ?? ''));
    setEditing(true);
  };

  const handleSave = () => {
    if (value === '') {
      toast({
        title: 'Valor vazio',
        description: 'Informe um valor para salvar.',
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate(value);
  };

  const displayValue = () => {
    if (!config.is_configured)
      return <span className="italic text-muted-foreground">Não configurado</span>;
    if (config.is_secret)
      return <span className="text-muted-foreground">••••••••</span>;
    return <span className="font-mono text-sm">{config.masked_value}</span>;
  };

  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{config.label}</span>
            <VariableHelperPopover configKey={config.key} />
            {config.is_secret && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" /> Secreto
              </span>
            )}
            {config.requires_restart && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                <AlertTriangle className="h-3 w-3" /> Requer reinicialização
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{config.key}</p>
          {config.description && (
            <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
          )}

          {/* Editing mode */}
          {editing ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type={config.is_secret && !showValue ? 'password' : 'text'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={
                    config.is_secret
                      ? 'Digite o novo valor (não será exibido)'
                      : 'Novo valor'
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 pr-10 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                />
                {config.is_secret && (
                  <button
                    type="button"
                    onClick={() => setShowValue((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showValue ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={mutation.isPending}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Salvar
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              {displayValue()}
              {config.updated_by_username && (
                <span className="text-xs text-muted-foreground">
                  · atualizado por {config.updated_by_username}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Edit button */}
        {!editing && config.is_editable && (
          <button
            onClick={handleEdit}
            className="mt-0.5 flex-shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Restart warning shown during editing */}
      {editing && config.requires_restart && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-blue-500" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Esta configuração requer reinicialização do container para ter efeito.
          </p>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  configs,
}: {
  category: ConfigCategory;
  configs: SystemConfig[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent/50"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">
            {CATEGORY_LABELS[category]}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {configs.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border">
          {configs.map((cfg) => (
            <ConfigRow key={cfg.key} config={cfg} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminConfig() {
  const { data: configs, isLoading } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminService.getConfigs(),
    staleTime: 60_000,
  });

  const grouped = CATEGORY_ORDER.reduce<Record<ConfigCategory, SystemConfig[]>>(
    (acc, cat) => {
      acc[cat] = (configs ?? []).filter((c) => c.category === cat);
      return acc;
    },
    { llm: [], email: [], backup: [], app: [], security: [], storage: [] }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configurações do Sistema</h1>
        <p className="text-sm text-muted-foreground">
          Valores armazenados no banco de dados. Secrets nunca são exibidos.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Configurações marcadas com{' '}
          <span className="font-semibold">"Requer reinicialização"</span> só terão
          efeito após reiniciar o container da API.
        </p>
      </div>

      {CATEGORY_ORDER.map((cat) =>
        grouped[cat].length > 0 ? (
          <CategorySection key={cat} category={cat} configs={grouped[cat]} />
        ) : null
      )}
    </div>
  );
}
