/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  AtSign,
  CalendarDays,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  History,
  Key,
  Lock,
  Shield,
  Tag,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ACTION_COLOR } from '@/lib/action-colors';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { securityDashboardService } from '@/services/security-dashboard-service';
import type { Password } from '@/types';

export interface TOTPRevealData {
  code: string;
  expiresAt: number;
}

function TOTPCode({ code, expiresAt }: TOTPRevealData) {
  const [secsLeft, setSecsLeft] = useState(() =>
    Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  );

  useEffect(() => {
    const id = setInterval(
      () => setSecsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))),
      500
    );
    return () => clearInterval(id);
  }, [expiresAt]);

  if (secsLeft === 0) {
    return <code className="text-muted-foreground text-sm">••• •••</code>;
  }

  return (
    <div className="gap-sm flex items-center">
      <code className="flex-1 text-lg font-bold tracking-[0.25em]">
        {code.slice(0, 3)} {code.slice(3)}
      </code>
      <span
        className={cn(
          'text-sm',
          secsLeft <= 5 ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {secsLeft}s
      </span>
    </div>
  );
}

interface Props {
  password: Password | null;
  catConfig: { badge: string; avatar: string };
  revealedPassword: string | undefined;
  revealedTotp: TOTPRevealData | null | undefined;
  countdown: number | undefined;
  isRevealing: boolean;
  onReveal: (id: number) => void;
  onClose: () => void;
}

/** Detalhe da senha (§2.3): somente leitura, Fechar à esquerda e ações à direita. */
export function PasswordDetailModal({
  password: selected,
  catConfig,
  revealedPassword,
  revealedTotp,
  countdown,
  isRevealing,
  onReveal,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'details' | 'history'>('details');

  // Mantém a última senha para o modal sair inteiro na animação de fechamento;
  // ao trocar de senha, reinicia aba e verificação (derivado no render).
  const [password, setPassword] = useState(selected);
  if (selected && selected !== password) {
    if (selected.id !== password?.id) setTab('details');
    setPassword(selected);
  }

  // O histórico vem antes de abrir (§7): trocar de aba não muda o tamanho do modal
  // por causa de um "Carregando…".
  const historyQuery = useQuery({
    queryKey: ['password-history', selected?.id],
    queryFn: () => securityDashboardService.getPasswordHistory(selected!.id),
    enabled: !!selected,
  });

  if (!password) return null;

  const history = historyQuery.data ?? [];

  const fields = [
    {
      icon: AtSign,
      label: t('common.fields.username'),
      value: password.username,
    },
    {
      icon: CalendarDays,
      label: t('common.fields.updatedAt'),
      value: formatDate(password.updated_at, 'dd/MM/yyyy HH:mm'),
    },
  ];

  return (
    <Dialog
      open={!!selected && !historyQuery.isPending}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle icon={Key}>{password.title}</DialogTitle>
          <DialogDescription>{password.title}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'details' | 'history')}>
          <TabsList className="w-full">
            <TabsTrigger value="details" className="gap-xs flex-1">
              <FileText className="h-3.5 w-3.5" />
              {t('common.actions.details')}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-xs flex-1">
              <History className="h-3.5 w-3.5" />
              {t('pages.passwords.history')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-md mt-md">
            <div className="gap-md grid grid-cols-2">
              <div className="min-w-0">
                <p className="gap-xs text-muted-foreground flex items-center text-xs">
                  <Tag className="h-3.5 w-3.5" />
                  {t('common.fields.category')}
                </p>
                <Badge
                  variant="outline"
                  className={cn('mt-xs text-xs', catConfig.badge)}
                >
                  {t(`pages.passwords.categories.${password.category}`, {
                    defaultValue: password.category_display,
                  })}
                </Badge>
              </div>
              {fields.map(({ icon: Icon, label, value }) => (
                <div key={label} className="min-w-0">
                  <p className="gap-xs text-muted-foreground flex items-center text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </p>
                  <p className="truncate font-semibold" title={value}>
                    {value}
                  </p>
                </div>
              ))}
              <div className="min-w-0">
                <p className="gap-xs text-muted-foreground flex items-center text-xs">
                  <Globe className="h-3.5 w-3.5" />
                  {t('common.fields.site')}
                </p>
                {password.site ? (
                  <a
                    href={password.site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-xs text-primary flex min-w-0 items-center font-semibold hover:underline"
                  >
                    <span className="truncate">{password.site}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <p className="font-semibold">—</p>
                )}
              </div>
            </div>

            <div className="bg-muted/30 p-md rounded-lg border">
              <p className="gap-xs mb-xs text-muted-foreground flex items-center text-xs">
                <Lock className="h-3.5 w-3.5" />
                {t('auth.login.password')}
                {countdown !== undefined && (
                  <span className="ml-auto">
                    {t('pages.passwords.autoHideIn', { seconds: countdown })}
                  </span>
                )}
              </p>
              <div className="gap-sm flex items-center">
                <code className="min-w-0 flex-1 truncate text-sm">
                  {revealedPassword ?? '••••••••'}
                </code>
              </div>
            </div>

            {password.totp_enabled && (
              <div className="bg-muted/30 p-md rounded-lg border">
                <p className="gap-xs mb-xs text-muted-foreground flex items-center text-xs">
                  <Shield className="h-3.5 w-3.5" />
                  TOTP (2FA)
                </p>
                {revealedTotp ? (
                  <TOTPCode
                    code={revealedTotp.code}
                    expiresAt={revealedTotp.expiresAt}
                  />
                ) : (
                  <code className="text-muted-foreground text-sm">••• •••</code>
                )}
              </div>
            )}

            {password.notes && (
              <div className="min-w-0">
                <p className="gap-xs text-muted-foreground flex items-center text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  {t('common.fields.notes')}
                </p>
                <p className="text-sm">{password.notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-md">
            {history.length === 0 ? (
              <EmptyState title={t('pages.passwords.noHistory')} icon={<History />} />
            ) : (
              <PaginatedSlide
                items={history}
                pageSize={LIST_PAGE_SIZE}
                pinNav={false}
                className="space-y-sm"
              >
                {(pageItems) =>
                  pageItems.map((entry) => (
                    <div
                      key={entry.id}
                      className="px-md py-sm gap-sm flex items-center rounded-lg border"
                    >
                      <Lock className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="flex-1 text-sm">••••••••</span>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(entry.created_at, 'dd/MM/yyyy HH:mm')}
                        {entry.changed_by_username
                          ? ` · ${entry.changed_by_username}`
                          : ''}
                      </span>
                    </div>
                  ))
                }
              </PaginatedSlide>
            )}
          </TabsContent>
        </Tabs>

        <DialogCloseFooter>
          <Button
            variant="outline"
            onClick={() => onReveal(password.id)}
            loading={isRevealing}
          >
            {!isRevealing &&
              (revealedPassword ? (
                <EyeOff className={ACTION_COLOR.reveal} />
              ) : (
                <Eye className={ACTION_COLOR.reveal} />
              ))}
            {revealedPassword ? t('common.actions.hide') : t('common.actions.reveal')}
          </Button>
        </DialogCloseFooter>
      </DialogContent>
    </Dialog>
  );
}
