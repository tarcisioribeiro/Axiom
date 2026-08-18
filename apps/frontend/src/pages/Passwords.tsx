/* eslint-disable max-lines */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Key,
  Share2,
  Star,
  Wand2,
  Upload,
  X,
  Calendar,
  User,
  Globe,
  FileText,
  Tag,
  ShieldAlert,
  ShieldCheck,
  History,
  Shield,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { PasswordGenerator } from '@/components/security/PasswordGenerator';
import { PasswordImportContent } from '@/components/security/PasswordImportContent';
import { SharePasswordModal } from '@/components/security/SharePasswordModal';
import { VaultGuard } from '@/components/security/VaultGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PASSWORD_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { cn, copyToClipboard } from '@/lib/utils';
import { passwordSchema } from '@/lib/validations';
import { hibpService } from '@/services/hibp-service';
import { membersService } from '@/services/members-service';
import { passwordsService } from '@/services/passwords-service';
import { securityDashboardService } from '@/services/security-dashboard-service';
import type { Password, PasswordFormData, Member } from '@/types';
import { PASSWORD_CATEGORIES } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const CATEGORY_CONFIG: Record<
  string,
  { badge: string; border: string; avatar: string }
> = {
  social: {
    badge: 'bg-info/10 text-info border-info/25',
    border: 'border-l-info/60',
    avatar: 'bg-info/10 text-info ring-1 ring-info/25',
  },
  email: {
    badge: 'bg-primary/10 text-primary border-primary/25',
    border: 'border-l-primary/60',
    avatar: 'bg-primary/10 text-primary ring-1 ring-primary/25',
  },
  banking: {
    badge: 'bg-warning/10 text-warning border-warning/25',
    border: 'border-l-warning/60',
    avatar: 'bg-warning/10 text-warning ring-1 ring-warning/25',
  },
  work: {
    badge: 'bg-success/10 text-success border-success/25',
    border: 'border-l-success/60',
    avatar: 'bg-success/10 text-success ring-1 ring-success/25',
  },
  entertainment: {
    badge: 'bg-accent/10 text-accent border-accent/25',
    border: 'border-l-accent/60',
    avatar: 'bg-accent/10 text-accent ring-1 ring-accent/25',
  },
  shopping: {
    badge: 'bg-warning/10 text-warning border-warning/25',
    border: 'border-l-warning/60',
    avatar: 'bg-warning/10 text-warning ring-1 ring-warning/25',
  },
  streaming: {
    badge: 'bg-accent/10 text-accent border-accent/25',
    border: 'border-l-accent/60',
    avatar: 'bg-accent/10 text-accent ring-1 ring-accent/25',
  },
  gaming: {
    badge: 'bg-info/10 text-info border-info/25',
    border: 'border-l-info/60',
    avatar: 'bg-info/10 text-info ring-1 ring-info/25',
  },
  other: {
    badge: '',
    border: 'border-l-border',
    avatar: 'bg-muted text-muted-foreground ring-1 ring-border',
  },
};

const CATEGORY_CONFIG_DETAIL: Record<string, { badge: string; avatar: string }> = {
  social: {
    badge: 'bg-info/10 text-info border-info/25',
    avatar: 'bg-info/10 text-info ring-1 ring-info/25',
  },
  email: {
    badge: 'bg-primary/10 text-primary border-primary/25',
    avatar: 'bg-primary/10 text-primary ring-1 ring-primary/25',
  },
  banking: {
    badge: 'bg-warning/10 text-warning border-warning/25',
    avatar: 'bg-warning/10 text-warning ring-1 ring-warning/25',
  },
  work: {
    badge: 'bg-success/10 text-success border-success/25',
    avatar: 'bg-success/10 text-success ring-1 ring-success/25',
  },
  entertainment: {
    badge: 'bg-accent/10 text-accent border-accent/25',
    avatar: 'bg-accent/10 text-accent ring-1 ring-accent/25',
  },
  shopping: {
    badge: 'bg-warning/10 text-warning border-warning/25',
    avatar: 'bg-warning/10 text-warning ring-1 ring-warning/25',
  },
  streaming: {
    badge: 'bg-accent/10 text-accent border-accent/25',
    avatar: 'bg-accent/10 text-accent ring-1 ring-accent/25',
  },
  gaming: {
    badge: 'bg-info/10 text-info border-info/25',
    avatar: 'bg-info/10 text-info ring-1 ring-info/25',
  },
  other: {
    badge: '',
    avatar: 'bg-muted text-muted-foreground ring-1 ring-border',
  },
};

interface TOTPRevealData {
  code: string;
  expiresAt: number;
}

function TOTPBlock({ code, expiresAt }: TOTPRevealData) {
  const { toast } = useToast();
  const [secsLeft, setSecsLeft] = useState(() =>
    Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  );
  const [isExpired, setIsExpired] = useState(secsLeft === 0);

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecsLeft(remaining);
      if (remaining === 0) setIsExpired(true);
    }, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  const handleCopy = () => {
    void copyToClipboard(code).then(() => toast({ title: 'Código TOTP copiado!' }));
  };

  if (isExpired) {
    return (
      <p className="mt-xs text-warning text-xs">
        Código expirado — revele novamente para atualizar.
      </p>
    );
  }

  return (
    <div className="mt-sm gap-sm flex items-center justify-between">
      <code className="font-mono text-xl font-bold tracking-[0.25em]">
        {code.slice(0, 3)} {code.slice(3)}
      </code>
      <div className="gap-xs flex items-center">
        <span
          className={cn(
            'font-mono text-sm',
            secsLeft <= 5 ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {secsLeft}s
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          aria-label="Copiar código TOTP"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface DetailPanelProps {
  password: Password;
  revealedPassword: string | undefined;
  revealedTotpData?: TOTPRevealData | null;
  revealingId: number | null;
  onReveal: (id: number) => void;
  onCopy: (id: number) => void;
  onEdit: (password: Password) => void;
  onDelete: (id: number) => void;
  onShare: (password: Password) => void;
  onClose: () => void;
}

function DetailPanel({
  password,
  revealedPassword,
  revealedTotpData,
  revealingId,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
  onShare,
  onClose,
}: DetailPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const catConfig =
    CATEGORY_CONFIG_DETAIL[password.category] ?? CATEGORY_CONFIG_DETAIL.other;
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [hibpState, setHibpState] = useState<{
    status: 'idle' | 'checking' | 'safe' | 'breached';
    count: number;
  }>({ status: 'idle', count: 0 });

  const { data: historyEntries, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['password-history', password.id],
    queryFn: () => securityDashboardService.getPasswordHistory(password.id),
    enabled: activeTab === 'history',
  });

  const handleHibpCheck = async () => {
    if (!revealedPassword) return;
    setHibpState({ status: 'checking', count: 0 });
    try {
      const result = await hibpService.checkPassword(revealedPassword);
      setHibpState({
        status: result.breached ? 'breached' : 'safe',
        count: result.count,
      });
    } catch {
      toast({
        title: t('pages.passwords.hibp.errorTitle'),
        description: t('pages.passwords.hibp.errorDesc'),
        variant: 'destructive',
      });
      setHibpState({ status: 'idle', count: 0 });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="gap-sm p-lg flex items-start justify-between border-b">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-bold',
              catConfig.avatar
            )}
          >
            {password.title.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{password.title}</h2>
            <p className="text-muted-foreground truncate text-sm">
              {password.username}
            </p>
          </div>
        </div>
        <div className="gap-xs flex items-center">
          {password.totp_enabled && (
            <Shield className="text-success h-4 w-4" aria-label="TOTP habilitado" />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="shrink-0"
            aria-label={t('common.actions.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'details' | 'history')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="w-full">
          <TabsTrigger value="details" className="gap-xs flex-1">
            <FileText className="h-3.5 w-3.5" />
            {t('common.actions.details', { defaultValue: 'Detalhes' })}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-xs flex-1">
            <History className="h-3.5 w-3.5" />
            {t('pages.passwords.history', { defaultValue: 'Histórico' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="p-lg mt-0 flex-1 overflow-y-auto">
          <div className="space-y-sm">
            {isHistoryLoading ? (
              <div className="py-lg flex justify-center">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : !historyEntries || historyEntries.length === 0 ? (
              <div className="gap-sm py-lg flex flex-col items-center text-center">
                <History className="text-muted-foreground/40 h-10 w-10" />
                <p className="text-muted-foreground text-sm">
                  {t('pages.passwords.noHistory', {
                    defaultValue: 'Nenhuma alteração de senha registrada.',
                  })}
                </p>
              </div>
            ) : (
              historyEntries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="bg-muted/20 px-md py-sm flex items-center justify-between rounded-lg border"
                >
                  <div className="gap-sm flex items-center">
                    <div className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">••••••••</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(entry.created_at, 'dd/MM/yyyy HH:mm')}
                        {entry.changed_by_username
                          ? ` · ${entry.changed_by_username}`
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="details" className="p-lg mt-0 flex-1 overflow-y-auto">
          <div className="space-y-md">
            <div className="gap-sm flex items-center">
              <Tag className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="text-muted-foreground text-sm">
                {t('common.fields.category')}
              </span>
              <Badge
                variant="outline"
                className={cn('ml-auto shrink-0 text-xs', catConfig.badge)}
              >
                {t(`pages.passwords.categories.${password.category}`, {
                  defaultValue: password.category_display,
                })}
              </Badge>
            </div>

            {password.site && (
              <div className="gap-sm flex items-center">
                <Globe className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-muted-foreground text-sm">
                  {t('common.fields.site')}
                </span>
                <a
                  href={password.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-xs ml-auto flex min-w-0 items-center truncate text-sm hover:underline"
                >
                  <span className="truncate">{password.site}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}

            <div className="gap-sm flex items-center">
              <User className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="text-muted-foreground text-sm">
                {t('common.fields.username')}
              </span>
              <span className="ml-auto truncate text-sm">{password.username}</span>
            </div>

            <div className="bg-muted/30 p-md rounded-lg border">
              <p className="mb-sm text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t('auth.login.password')}
              </p>
              {revealedPassword ? (
                <div className="gap-sm flex items-center">
                  <code className="flex-1 font-mono text-sm">{revealedPassword}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCopy(password.id)}
                    aria-label={t('common.actions.copy')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground font-mono text-sm">••••••••</p>
              )}
            </div>

            {password.totp_enabled && (
              <div className="border-success/30 bg-success/5 p-md rounded-lg border">
                <div className="gap-sm flex items-center">
                  <Shield className="text-success h-4 w-4 shrink-0" />
                  <span className="text-success text-sm font-medium">TOTP (2FA)</span>
                </div>
                {revealedTotpData ? (
                  <TOTPBlock
                    code={revealedTotpData.code}
                    expiresAt={revealedTotpData.expiresAt}
                  />
                ) : (
                  <p className="mt-xs text-muted-foreground text-xs">
                    Revele a senha para ver o código TOTP atual.
                  </p>
                )}
              </div>
            )}

            {password.notes && (
              <div className="space-y-xs">
                <div className="gap-sm flex items-center">
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground text-sm">
                    {t('common.fields.notes')}
                  </span>
                </div>
                <p className="bg-muted/30 p-sm rounded-lg text-sm">{password.notes}</p>
              </div>
            )}

            <div className="gap-sm pt-md text-muted-foreground flex items-center border-t text-xs">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t('common.fields.createdAt')}{' '}
                {formatDate(password.created_at, 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="gap-sm p-lg flex flex-wrap border-t">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReveal(password.id)}
          disabled={revealingId === password.id}
          className="flex-1"
        >
          {revealingId === password.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : revealedPassword ? (
            <>
              <EyeOff className="mr-xs h-3 w-3" />
              {t('common.actions.hide')}
            </>
          ) : (
            <>
              <Eye className="mr-xs h-3 w-3" />
              {t('common.actions.reveal')}
            </>
          )}
        </Button>
        {revealedPassword && (
          <Button
            size="sm"
            variant={
              hibpState.status === 'breached'
                ? 'destructive'
                : hibpState.status === 'safe'
                  ? 'outline'
                  : 'outline'
            }
            onClick={handleHibpCheck}
            disabled={hibpState.status === 'checking'}
            className={cn(
              'flex-1',
              hibpState.status === 'safe' &&
                'border-[hsl(var(--success))] text-[hsl(var(--success))]'
            )}
          >
            {hibpState.status === 'checking' ? (
              <Loader2 className="mr-xs h-3 w-3 animate-spin" />
            ) : hibpState.status === 'safe' ? (
              <ShieldCheck className="mr-xs h-3 w-3" />
            ) : (
              <ShieldAlert className="mr-xs h-3 w-3" />
            )}
            {hibpState.status === 'safe'
              ? t('pages.passwords.hibp.safe')
              : hibpState.status === 'breached'
                ? t('pages.passwords.hibp.breached', { count: hibpState.count })
                : t('pages.passwords.hibp.check')}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onShare(password)}
          aria-label={t('pages.sharePassword.title')}
        >
          <Share2 className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEdit(password)}
          aria-label={t('common.actions.edit')}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDelete(password.id)}
          aria-label={t('common.actions.delete')}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

const EMPTY_PASSWORDS: Password[] = [];

export default function Passwords() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPassword, setSelectedPassword] = useState<Password | undefined>();
  const [detailPassword, setDetailPassword] = useState<Password | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Map<number, string>>(
    new Map()
  );
  const [revealedTotpData, setRevealedTotpData] = useState<
    Map<number, TOTPRevealData | null>
  >(new Map());
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [revealedAt, setRevealedAt] = useState<Map<number, number>>(new Map());
  const [countdown, setCountdown] = useState<Map<number, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [sharingPassword, setSharingPassword] = useState<Password | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const autoHideInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    setValue,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema) as Resolver<PasswordFormData>,
    defaultValues: {
      title: '',
      site: '',
      username: '',
      password: '',
      category: 'other',
      notes: '',
      owner: 0,
      totp_enabled: false,
      totp_secret: '',
    },
  });

  const watchedCategory = useWatch({ control, name: 'category' });
  const watchedTotpEnabled = useWatch({ control, name: 'totp_enabled' });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['passwords'],
    queryFn: async () => {
      try {
        const [passwordsData, memberData] = await Promise.all([
          passwordsService.getAll(),
          membersService.getCurrentUserMember().catch(() => null),
        ]);
        return { passwords: passwordsData, currentUserMember: memberData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return { passwords: EMPTY_PASSWORDS, currentUserMember: null as Member | null };
      }
    },
  });
  const passwords = pageData?.passwords ?? EMPTY_PASSWORDS;
  const currentUserMember = pageData?.currentUserMember ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['passwords'] });

  // Reinicia o countdown quando nada está revelado (derivado durante o
  // render — sem efeito — comparando com a última transição).
  const hasRevealed = revealedAt.size > 0;
  const [lastHasRevealed, setLastHasRevealed] = useState(hasRevealed);
  if (hasRevealed !== lastHasRevealed) {
    setLastHasRevealed(hasRevealed);
    if (!hasRevealed) setCountdown(new Map());
  }

  // Auto-hide revealed passwords after 30 seconds with countdown
  useEffect(() => {
    if (revealedAt.size === 0) {
      if (autoHideInterval.current) {
        clearInterval(autoHideInterval.current);
        autoHideInterval.current = null;
      }
      return;
    }

    autoHideInterval.current = setInterval(() => {
      const now = Date.now();
      const newCountdown = new Map<number, number>();
      const toRemove: number[] = [];

      for (const [id, ts] of revealedAt) {
        const elapsed = (now - ts) / 1000;
        const remaining = Math.max(0, 30 - elapsed);
        if (remaining <= 0) {
          toRemove.push(id);
        } else {
          newCountdown.set(id, Math.ceil(remaining));
        }
      }

      if (toRemove.length > 0) {
        setRevealedPasswords((prev) => {
          const next = new Map(prev);
          toRemove.forEach((id) => next.delete(id));
          return next;
        });
        setRevealedAt((prev) => {
          const next = new Map(prev);
          toRemove.forEach((id) => next.delete(id));
          return next;
        });
        setRevealedTotpData((prev) => {
          const next = new Map(prev);
          toRemove.forEach((id) => next.delete(id));
          return next;
        });
      }

      setCountdown(newCountdown);
    }, 1000);

    return () => {
      if (autoHideInterval.current) clearInterval(autoHideInterval.current);
    };
  }, [revealedAt]);

  const handleCreate = () => {
    if (!currentUserMember) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.passwords.noMemberMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedPassword(undefined);
    reset({
      title: '',
      site: '',
      username: '',
      password: '',
      category: 'other',
      notes: '',
      owner: currentUserMember.id,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (password: Password) => {
    setSelectedPassword(password);
    reset({
      title: password.title,
      site: password.site || '',
      username: password.username,
      password: '', // Não carregar senha por segurança
      category: password.category,
      notes: password.notes || '',
      owner: password.owner,
      totp_enabled: password.totp_enabled ?? false,
      totp_secret: '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.passwords.deleteTitle'),
      description: t('pages.passwords.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await passwordsService.delete(id);
      toast({
        title: t('pages.passwords.deleted'),
        description: t('pages.passwords.deletedDesc'),
      });
      if (detailPassword?.id === id) {
        setDetailPassword(null);
      }
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleReveal = async (id: number) => {
    if (revealedPasswords.has(id)) {
      const newMap = new Map(revealedPasswords);
      newMap.delete(id);
      setRevealedPasswords(newMap);
      setRevealedAt((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setRevealedTotpData((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    try {
      setRevealingId(id);
      const revealData = await passwordsService.reveal(id);
      setRevealedPasswords((prev) => new Map(prev).set(id, revealData.password));
      setRevealedAt((prev) => new Map(prev).set(id, Date.now()));
      if (revealData.totp_enabled && revealData.totp_code) {
        setRevealedTotpData((prev) =>
          new Map(prev).set(id, {
            code: revealData.totp_code!,
            expiresAt: Date.now() + (revealData.totp_seconds_remaining ?? 30) * 1000,
          })
        );
      }
    } catch (error: unknown) {
      toast({
        title: t('pages.passwords.revealError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopyPassword = async (id: number) => {
    const alreadyRevealed = revealedPasswords.get(id);
    try {
      const value = alreadyRevealed ?? (await passwordsService.copy(id)).password;
      await copyToClipboard(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch (error: unknown) {
      toast({
        title: t('pages.passwords.copyError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const onFormSubmit = async (data: PasswordFormData) => {
    // Password required on create
    if (!selectedPassword && !data.password) {
      setError('password', { message: t('pages.passwords.passwordRequired') });
      return;
    }

    try {
      setIsSubmitting(true);
      if (selectedPassword) {
        const updateData: Partial<PasswordFormData> = { ...data };
        if (!updateData.password) {
          delete updateData.password; // Não enviar senha vazia
        }
        await passwordsService.update(selectedPassword.id, updateData);
        toast({
          title: t('pages.passwords.updated'),
          description: t('pages.passwords.updatedDesc'),
        });
      } else {
        await passwordsService.create(data);
        toast({
          title: t('pages.passwords.created'),
          description: t('pages.passwords.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardClick = (password: Password) => {
    setDetailPassword((prev) => (prev?.id === password.id ? null : password));
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      const updated = await passwordsService.toggleFavorite(id);
      queryClient.setQueryData<typeof pageData>(['passwords'], (prev) =>
        prev
          ? {
              ...prev,
              passwords: prev.passwords.map((p) => (p.id === id ? updated : p)),
            }
          : prev
      );
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const filteredPasswords = passwords.filter((pwd) => {
    if (showFavoritesOnly && !pwd.is_favorite) return false;
    return (
      pwd.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pwd.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pwd.site?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title={t('pages.passwords.title')} icon={<Key />}>
          <div className="gap-sm flex items-center">
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="gap-sm"
            >
              <Upload className="h-4 w-4" />
              {t('pages.passwordImport.title')}
            </Button>
            <Button onClick={handleCreate} className="gap-sm">
              <Plus className="h-4 w-4" />
              {t('pages.passwords.newBtn')}
            </Button>
          </div>
        </PageHeader>

        <FilterBar
          hasActiveFilters={!!searchTerm || showFavoritesOnly}
          onClear={() => {
            setSearchTerm('');
            setShowFavoritesOnly(false);
          }}
        >
          <SearchInput
            placeholder={t('pages.passwords.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className="gap-xs"
            title={t('pages.passwords.favoritesFilter')}
          >
            <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-current')} />
            {t('pages.passwords.favoritesFilter')}
          </Button>
        </FilterBar>

        <div className={cn('gap-lg flex', detailPassword ? 'lg:flex-row' : 'flex-col')}>
          <div className={cn('min-w-0', detailPassword ? 'lg:w-[40%]' : 'w-full')}>
            <div className="gap-md grid md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {filteredPasswords.map((password) => {
                const catConfig =
                  CATEGORY_CONFIG[password.category] ?? CATEGORY_CONFIG.other;
                const isSelected = detailPassword?.id === password.id;
                return (
                  <Card
                    key={password.id}
                    className={cn(
                      'cursor-pointer overflow-hidden border-l-2 transition-shadow hover:shadow-lg',
                      catConfig.border,
                      isSelected && 'ring-primary/50 ring-2'
                    )}
                    onClick={() => handleCardClick(password)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                            catConfig.avatar
                          )}
                        >
                          {password.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base">
                            {password.title}
                          </CardTitle>
                          <CardDescription className="truncate text-xs">
                            {password.username}
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('shrink-0 text-xs', catConfig.badge)}
                        >
                          {t(`pages.passwords.categories.${password.category}`, {
                            defaultValue: password.category_display,
                          })}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {password.site && (
                          <div className="gap-sm flex items-center text-sm">
                            <ExternalLink className="h-3 w-3" />
                            <span className="text-muted-foreground truncate">
                              {password.site}
                            </span>
                          </div>
                        )}
                        {password.strength_score !== undefined && (
                          <div className="gap-xs flex items-center">
                            <Shield className="text-muted-foreground h-3 w-3" />
                            <span
                              className={cn(
                                'text-xs font-medium',
                                password.strength_score >= 4
                                  ? 'text-success'
                                  : password.strength_score >= 3
                                    ? 'text-primary'
                                    : password.strength_score >= 2
                                      ? 'text-warning'
                                      : 'text-destructive'
                              )}
                            >
                              {t(
                                `pages.passwords.passwordStrength.${
                                  password.strength_score >= 4
                                    ? 'strong'
                                    : password.strength_score >= 3
                                      ? 'good'
                                      : password.strength_score >= 2
                                        ? 'fair'
                                        : password.strength_score >= 1
                                          ? 'weak'
                                          : 'veryWeak'
                                }`
                              )}
                            </span>
                          </div>
                        )}

                        {!detailPassword && revealedPasswords.has(password.id) && (
                          <div className="gap-sm bg-muted p-sm flex items-center rounded">
                            <code className="flex-1 truncate text-sm">
                              {revealedPasswords.get(password.id)}
                            </code>
                            {countdown.get(password.id) !== undefined && (
                              <span className="text-muted-foreground shrink-0 text-xs">
                                {t('pages.passwords.autoHideIn', {
                                  seconds: countdown.get(password.id),
                                })}
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn(
                                'shrink-0',
                                copiedId === password.id && 'text-success'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCopyPassword(password.id);
                              }}
                              title={
                                copiedId === password.id
                                  ? t('pages.passwords.copied')
                                  : t('common.actions.copy')
                              }
                            >
                              {copiedId === password.id ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        )}

                        {!detailPassword && (
                          <div className="gap-sm pt-sm flex">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleReveal(password.id);
                              }}
                              disabled={revealingId === password.id}
                              className="flex-1"
                            >
                              {revealingId === password.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : revealedPasswords.has(password.id) ? (
                                <>
                                  <EyeOff className="mr-xs h-3 w-3" />
                                  {t('common.actions.hide')}
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-xs h-3 w-3" />
                                  {t('common.actions.reveal')}
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCopyPassword(password.id);
                              }}
                              title={
                                copiedId === password.id
                                  ? t('pages.passwords.copied')
                                  : t('pages.passwords.copyWithoutReveal')
                              }
                              aria-label={t('pages.passwords.copyWithoutReveal')}
                              className={cn(copiedId === password.id && 'text-success')}
                            >
                              {copiedId === password.id ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleToggleFavorite(password.id);
                              }}
                              title={t('common.actions.favorite')}
                              aria-label={t('common.actions.favorite')}
                              className={cn(password.is_favorite && 'text-warning')}
                            >
                              <Star
                                className={cn(
                                  'h-3 w-3',
                                  password.is_favorite && 'fill-current'
                                )}
                                aria-hidden="true"
                              />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSharingPassword(password);
                              }}
                              title={t('pages.sharePassword.title')}
                              aria-label={t('pages.sharePassword.title')}
                            >
                              <Share2 className="h-3 w-3" aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(password);
                              }}
                              title={t('common.actions.edit')}
                              aria-label={t('common.actions.edit')}
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(password.id);
                              }}
                              title={t('common.actions.delete')}
                              aria-label={t('common.actions.delete')}
                            >
                              <Trash2
                                className="text-destructive h-3 w-3"
                                aria-hidden="true"
                              />
                            </Button>
                          </div>
                        )}

                        <div className="text-muted-foreground text-xs">
                          {t('common.fields.updatedAt')}{' '}
                          {formatDate(password.updated_at, 'dd/MM/yyyy HH:mm')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredPasswords.length === 0 && (
              <EmptyState
                icon={<Key className="text-muted-foreground h-12 w-12" />}
                message={
                  searchTerm
                    ? t('pages.passwords.emptySearch')
                    : t('pages.passwords.emptyState')
                }
              />
            )}
          </div>

          <AnimatePresence>
            {detailPassword && (
              <motion.div
                key={detailPassword.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="hidden lg:block lg:w-[60%] lg:shrink-0"
              >
                <div className="bg-card sticky top-4 rounded-lg border shadow-lg">
                  <DetailPanel
                    password={detailPassword}
                    revealedPassword={revealedPasswords.get(detailPassword.id)}
                    revealedTotpData={revealedTotpData.get(detailPassword.id)}
                    revealingId={revealingId}
                    onReveal={(id) => void handleReveal(id)}
                    onCopy={(id) => void handleCopyPassword(id)}
                    onEdit={handleEdit}
                    onDelete={(id) => void handleDelete(id)}
                    onShare={setSharingPassword}
                    onClose={() => setDetailPassword(null)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {detailPassword && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setDetailPassword(null);
            }}
          >
            <DialogContent className="sm:max-w-[500px] lg:hidden">
              <DetailPanel
                password={detailPassword}
                revealedPassword={revealedPasswords.get(detailPassword.id)}
                revealedTotpData={revealedTotpData.get(detailPassword.id)}
                revealingId={revealingId}
                onReveal={(id) => void handleReveal(id)}
                onCopy={(id) => void handleCopyPassword(id)}
                onEdit={(pwd) => {
                  setDetailPassword(null);
                  handleEdit(pwd);
                }}
                onDelete={(id) => void handleDelete(id)}
                onShare={(pwd) => {
                  setDetailPassword(null);
                  setSharingPassword(pwd);
                }}
                onClose={() => setDetailPassword(null)}
              />
            </DialogContent>
          </Dialog>
        )}

        <SharePasswordModal
          password={sharingPassword}
          open={!!sharingPassword}
          onOpenChange={(open) => {
            if (!open) setSharingPassword(null);
          }}
        />

        {/* Import dialog */}
        <Dialog
          open={isImportOpen}
          onOpenChange={(open) => {
            setIsImportOpen(open);
            if (!open) void refresh();
          }}
        >
          <DialogContent className="custom-scrollbar max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('pages.passwordImport.title')}</DialogTitle>
              <DialogDescription>
                {t('pages.passwordImport.description')}
              </DialogDescription>
            </DialogHeader>
            <PasswordImportContent />
          </DialogContent>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {selectedPassword
                  ? t('pages.passwords.editTitle')
                  : t('pages.passwords.newTitle')}
              </DialogTitle>
              <DialogDescription>
                {selectedPassword
                  ? t('pages.passwords.editDesc')
                  : t('pages.passwords.newDesc')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={rhfHandleSubmit(onFormSubmit)} className="space-y-md">
              <div className="space-y-sm">
                <Label htmlFor="title">{t('common.fields.title')} *</Label>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder={t('pages.passwords.titlePlaceholder')}
                />
                {errors.title && (
                  <p className="text-destructive text-sm">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-sm">
                <Label htmlFor="site">{t('common.fields.site')}</Label>
                <Input
                  id="site"
                  type="url"
                  {...register('site')}
                  placeholder={t('pages.passwords.sitePlaceholder')}
                />
                {errors.site && (
                  <p className="text-destructive text-sm">{errors.site.message}</p>
                )}
              </div>

              <div className="space-y-sm">
                <Label htmlFor="username">{t('common.fields.username')} *</Label>
                <Input
                  id="username"
                  {...register('username')}
                  placeholder={t('pages.passwords.usernamePlaceholder')}
                />
                {errors.username && (
                  <p className="text-destructive text-sm">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-sm">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
                    {t('auth.login.password')} {selectedPassword ? '' : '*'}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGenerator(!showGenerator)}
                    className="px-sm py-xs h-auto text-xs"
                  >
                    <Wand2 className="mr-xs h-3 w-3" />
                    {showGenerator
                      ? t('pages.passwords.hideGenerator')
                      : t('pages.passwords.generatePassword')}
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder={
                    selectedPassword ? t('pages.passwords.keepCurrentPassword') : ''
                  }
                />
                {errors.password && (
                  <p className="text-destructive text-sm">{errors.password.message}</p>
                )}
                {showGenerator && (
                  <div className="bg-muted/30 rounded-lg border p-3">
                    <PasswordGenerator
                      compact
                      onPasswordGenerated={(pwd) => setValue('password', pwd)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-sm">
                <Label htmlFor="category">{t('common.fields.category')} *</Label>
                <Select
                  value={watchedCategory}
                  onValueChange={(value) => setValue('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PASSWORD_CATEGORIES.map((cat) => {
                      const Icon =
                        PASSWORD_CATEGORY_ICONS[cat.value] ??
                        PASSWORD_CATEGORY_ICONS['other'];
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="gap-sm flex items-center">
                            {Icon && (
                              <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                            )}
                            {t(`pages.passwords.categories.${cat.value}`)}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-destructive text-sm">{errors.category.message}</p>
                )}
              </div>

              <div className="space-y-sm">
                <Label htmlFor="notes">{t('common.fields.notes')}</Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  placeholder={t('pages.passwords.notesSitePlaceholder')}
                  rows={3}
                />
                {errors.notes && (
                  <p className="text-destructive text-sm">{errors.notes.message}</p>
                )}
              </div>

              {/* TOTP (#195) */}
              <div className="bg-muted/20 p-md rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="gap-sm flex items-center">
                    <Shield className="text-muted-foreground h-4 w-4" />
                    <Label className="cursor-pointer" htmlFor="totp_enabled">
                      {t('pages.passwords.totpEnable', {
                        defaultValue: 'Habilitar TOTP (2FA)',
                      })}
                    </Label>
                  </div>
                  <input
                    id="totp_enabled"
                    type="checkbox"
                    {...register('totp_enabled')}
                    className="accent-primary h-4 w-4 rounded border"
                  />
                </div>
                {watchedTotpEnabled && (
                  <div className="mt-sm space-y-xs">
                    <Label htmlFor="totp_secret">
                      {t('pages.passwords.totpSecret', {
                        defaultValue: 'Segredo TOTP',
                      })}
                    </Label>
                    <Input
                      id="totp_secret"
                      {...register('totp_secret')}
                      placeholder="JBSWY3DPEHPK3PXP"
                      className="font-mono"
                    />
                    <p className="text-muted-foreground text-xs">
                      {t('pages.passwords.totpSecretHint', {
                        defaultValue:
                          'Cole o segredo base32 do serviço para gerar códigos TOTP.',
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div className="gap-sm flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                      {t('common.actions.saving')}
                    </>
                  ) : (
                    t('common.actions.save')
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </VaultGuard>
  );
}
