/* eslint-disable max-lines */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Copy,
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
import { useForm } from 'react-hook-form';
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

interface DetailPanelProps {
  password: Password;
  revealedPassword: string | undefined;
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
      <div className="flex items-start justify-between gap-sm border-b p-lg">
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
            <p className="truncate text-sm text-muted-foreground">
              {password.username}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-xs">
          {password.totp_enabled && (
            <Shield className="h-4 w-4 text-success" aria-label="TOTP habilitado" />
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

      {/* Tabs */}
      <div className="flex border-b">
        <button
          type="button"
          className={cn(
            'flex flex-1 items-center justify-center gap-xs px-md py-sm text-sm font-medium transition-colors',
            activeTab === 'details'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('details')}
        >
          <FileText className="h-3.5 w-3.5" />
          {t('common.actions.details', { defaultValue: 'Detalhes' })}
        </button>
        <button
          type="button"
          className={cn(
            'flex flex-1 items-center justify-center gap-xs px-md py-sm text-sm font-medium transition-colors',
            activeTab === 'history'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('history')}
        >
          <History className="h-3.5 w-3.5" />
          {t('pages.passwords.history', { defaultValue: 'Histórico' })}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-lg">
        {activeTab === 'history' ? (
          <div className="space-y-sm">
            {isHistoryLoading ? (
              <div className="flex justify-center py-lg">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !historyEntries || historyEntries.length === 0 ? (
              <div className="flex flex-col items-center gap-sm py-lg text-center">
                <History className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {t('pages.passwords.noHistory', {
                    defaultValue: 'Nenhuma alteração de senha registrada.',
                  })}
                </p>
              </div>
            ) : (
              historyEntries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/20 px-md py-sm"
                >
                  <div className="flex items-center gap-sm">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">••••••••</p>
                      <p className="text-xs text-muted-foreground">
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
        ) : (
          <div className="space-y-md">
            <div className="flex items-center gap-sm">
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
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
              <div className="flex items-center gap-sm">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {t('common.fields.site')}
                </span>
                <a
                  href={password.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex min-w-0 items-center gap-xs truncate text-sm hover:underline"
                >
                  <span className="truncate">{password.site}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}

            <div className="flex items-center gap-sm">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t('common.fields.username')}
              </span>
              <span className="ml-auto truncate text-sm">{password.username}</span>
            </div>

            <div className="rounded-lg border bg-muted/30 p-md">
              <p className="mb-sm text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('auth.login.password')}
              </p>
              {revealedPassword ? (
                <div className="flex items-center gap-sm">
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
                <p className="font-mono text-sm text-muted-foreground">••••••••</p>
              )}
            </div>

            {password.totp_enabled && (
              <div className="flex items-center gap-sm rounded-lg border border-success/30 bg-success/5 px-md py-sm">
                <Shield className="h-4 w-4 shrink-0 text-success" />
                <span className="text-sm text-success">
                  {t('pages.passwords.totpEnabled', {
                    defaultValue: 'TOTP (2FA) habilitado',
                  })}
                </span>
              </div>
            )}

            {password.notes && (
              <div className="space-y-xs">
                <div className="flex items-center gap-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t('common.fields.notes')}
                  </span>
                </div>
                <p className="rounded-lg bg-muted/30 p-sm text-sm">{password.notes}</p>
              </div>
            )}

            <div className="flex items-center gap-sm border-t pt-md text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t('common.fields.createdAt')}{' '}
                {formatDate(password.created_at, 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-sm border-t p-lg">
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

export default function Passwords() {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPassword, setSelectedPassword] = useState<Password | undefined>();
  const [detailPassword, setDetailPassword] = useState<Password | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Map<number, string>>(
    new Map()
  );
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [_copyingId, setCopyingId] = useState<number | null>(null);
  const [_copiedId, setCopiedId] = useState<number | null>(null);
  const [revealedAt, setRevealedAt] = useState<Map<number, number>>(new Map());
  const [_countdown, setCountdown] = useState<Map<number, number>>(new Map());
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
    watch,
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

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide revealed passwords after 30 seconds with countdown
  useEffect(() => {
    if (revealedAt.size === 0) {
      if (autoHideInterval.current) {
        clearInterval(autoHideInterval.current);
        autoHideInterval.current = null;
      }
      setCountdown(new Map());
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
      }

      setCountdown(newCountdown);
    }, 1000);

    return () => {
      if (autoHideInterval.current) clearInterval(autoHideInterval.current);
    };
  }, [revealedAt]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [passwordsData, memberData] = await Promise.all([
        passwordsService.getAll(),
        membersService.getCurrentUserMember().catch(() => null),
      ]);
      setPasswords(passwordsData);
      setCurrentUserMember(memberData);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      void loadData();
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
      return;
    }

    try {
      setRevealingId(id);
      const revealData = await passwordsService.reveal(id);
      setRevealedPasswords((prev) => new Map(prev).set(id, revealData.password));
      setRevealedAt((prev) => new Map(prev).set(id, Date.now()));
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
    const password = revealedPasswords.get(id);
    if (!password) return;
    await copyToClipboard(password);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  };

  const _handleCopyWithoutReveal = async (id: number) => {
    try {
      setCopyingId(id);
      const revealData = await passwordsService.reveal(id);
      await copyToClipboard(revealData.password);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
      toast({
        title: t('pages.passwords.copied'),
        description: t('pages.passwords.copiedClipboard'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.passwords.revealError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setCopyingId(null);
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
      void loadData();
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

  const filteredPasswords = passwords.filter(
    (pwd) =>
      pwd.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pwd.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pwd.site?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title={t('pages.passwords.title')} icon={<Key />}>
          <div className="flex items-center gap-sm">
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

        <div className={cn('flex gap-lg', detailPassword ? 'lg:flex-row' : 'flex-col')}>
          <div className={cn('min-w-0', detailPassword ? 'lg:w-[40%]' : 'w-full')}>
            <div className="grid gap-md md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                      isSelected && 'ring-2 ring-primary/50'
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
                          <div className="flex items-center gap-sm text-sm">
                            <ExternalLink className="h-3 w-3" />
                            <span className="truncate text-muted-foreground">
                              {password.site}
                            </span>
                          </div>
                        )}

                        {!detailPassword && revealedPasswords.has(password.id) && (
                          <div className="flex items-center gap-sm rounded bg-muted p-sm">
                            <code className="flex-1 text-sm">
                              {revealedPasswords.get(password.id)}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCopyPassword(password.id);
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        {!detailPassword && (
                          <div className="flex gap-sm pt-sm">
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
                                className="h-3 w-3 text-destructive"
                                aria-hidden="true"
                              />
                            </Button>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
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
                icon={<Key className="h-12 w-12 text-muted-foreground" />}
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
                <div className="sticky top-4 rounded-lg border bg-card shadow-lg">
                  <DetailPanel
                    password={detailPassword}
                    revealedPassword={revealedPasswords.get(detailPassword.id)}
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
            if (!open) void loadData();
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
                  <p className="text-sm text-destructive">{errors.title.message}</p>
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
                  <p className="text-sm text-destructive">{errors.site.message}</p>
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
                  <p className="text-sm text-destructive">{errors.username.message}</p>
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
                    className="h-auto px-sm py-xs text-xs"
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
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
                {showGenerator && (
                  <div className="rounded-lg border bg-muted/30 p-3">
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
                  value={watch('category')}
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
                          <span className="flex items-center gap-sm">
                            {Icon && (
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            {t(`pages.passwords.categories.${cat.value}`)}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
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
                  <p className="text-sm text-destructive">{errors.notes.message}</p>
                )}
              </div>

              {/* TOTP (#195) */}
              <div className="rounded-lg border bg-muted/20 p-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <Shield className="h-4 w-4 text-muted-foreground" />
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
                    className="h-4 w-4 rounded border accent-primary"
                  />
                </div>
                {watch('totp_enabled') && (
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
                    <p className="text-xs text-muted-foreground">
                      {t('pages.passwords.totpSecretHint', {
                        defaultValue:
                          'Cole o segredo base32 do serviço para gerar códigos TOTP.',
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-sm">
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
