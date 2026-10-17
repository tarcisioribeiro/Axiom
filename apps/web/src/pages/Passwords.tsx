/* eslint-disable max-lines */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AtSign,
  Check,
  Copy,
  FileText,
  Globe,
  Key,
  KeyRound,
  Lock,
  Plus,
  Save,
  Search,
  Share2,
  Shield,
  ShieldCheck,
  Star,
  Tag,
  Upload,
  Wand2,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import {
  PasswordDetailModal,
  type TOTPRevealData,
} from '@/components/security/PasswordDetailModal';
import { PasswordGenerator } from '@/components/security/PasswordGenerator';
import { PasswordImportDialog } from '@/components/security/PasswordImportDialog';
import { SharePasswordModal } from '@/components/security/SharePasswordModal';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultItemCard } from '@/components/security/VaultItemCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useCurrentScreen } from '@/hooks/use-screen-access';
import { useToast } from '@/hooks/use-toast';
import { notifyFormErrors } from '@/lib/form-errors';
import { cn, copyToClipboard } from '@/lib/utils';
import { passwordSchema } from '@/lib/validations';
import { hibpService } from '@/services/hibp-service';
import { membersService } from '@/services/members-service';
import { passwordsService } from '@/services/passwords-service';
import type { Password, PasswordFormData, Member } from '@/types';
import { PASSWORD_CATEGORIES } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const CATEGORY_CONFIG: Record<string, { badge: string; avatar: string }> = {
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

const EMPTY_PASSWORDS: Password[] = [];

function PasswordsContent() {
  const { can } = useCurrentScreen();
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
  const [revealedAt, setRevealedAt] = useState<Map<number, number>>(new Map());
  const [countdown, setCountdown] = useState<Map<number, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
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
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
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
        title: t('pages.passwords.noMemberMsg'),
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
      });
      if (detailPassword?.id === id) {
        setDetailPassword(null);
      }
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
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
        title: t('pages.passwords.revealError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setRevealingId(null);
    }
  };

  // Verifica vazamento (HIBP) sem exibir a senha; o resultado vai para o toast.
  const handleCheckLeak = async (password: Password) => {
    try {
      const value =
        revealedPasswords.get(password.id) ??
        (await passwordsService.reveal(password.id)).password;
      const result = await hibpService.checkPassword(value);
      toast({
        title: result.breached
          ? `${password.title}: ${t('pages.passwords.hibp.breached', { count: result.count })}`
          : `${password.title}: ${t('pages.passwords.hibp.safe')}`,
        variant: result.breached ? 'destructive' : undefined,
      });
    } catch {
      toast({ title: t('pages.passwords.hibp.errorDesc'), variant: 'destructive' });
    }
  };

  // Copia site, usuário e senha, um campo por linha com rótulo.
  const handleCopyPasswordDetails = async (password: Password) => {
    try {
      const value =
        revealedPasswords.get(password.id) ??
        (await passwordsService.copy(password.id)).password;
      await copyToClipboard(
        [
          `${t('common.fields.site')}: ${password.site || '—'}`,
          `${t('common.fields.username')}: ${password.username}`,
          `${t('auth.login.password')}: ${value}`,
        ].join('\n')
      );
      toast({ title: t('common.messages.copied') });
    } catch (error: unknown) {
      toast({
        title: t('pages.passwords.copyError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const onFormSubmit = async (data: PasswordFormData) => {
    // Password required on create
    if (!selectedPassword && !data.password) {
      const message = t('common.fieldRequired', { field: t('auth.login.password') });
      setError('password', { message });
      toast({ title: message, variant: 'destructive' });
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
        });
      } else {
        await passwordsService.create(data);
        toast({
          title: t('pages.passwords.created'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const filteredPasswords = passwords.filter((pwd) => {
    if (showFavoritesOnly && !pwd.is_favorite) return false;
    if (categoryFilter !== 'all' && pwd.category !== categoryFilter) return false;
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
    <>
      <PageContainer>
        <PageHeader title={t('pages.passwords.title')} icon={<Key />}>
          <div className="gap-sm flex items-center">
            {can('import') && (
              <Button
                variant="outline"
                onClick={() => setIsImportOpen(true)}
                className="gap-sm"
              >
                <Upload className="h-4 w-4" />
                {t('pages.passwordImport.title')}
              </Button>
            )}

            {can('add') && (
              <Button onClick={handleCreate} className="gap-sm">
                <Plus className="h-4 w-4" />
                {t('pages.passwords.newBtn')}
              </Button>
            )}
          </div>
        </PageHeader>

        <FilterBar
          hasActiveFilters={
            !!searchTerm || showFavoritesOnly || categoryFilter !== 'all'
          }
          onClear={() => {
            setSearchTerm('');
            setShowFavoritesOnly(false);
            setCategoryFilter('all');
          }}
          activeFilters={[
            ...(categoryFilter !== 'all'
              ? [
                  {
                    key: 'category',
                    label: `${t('common.fields.category')}: ${t(`pages.passwords.categories.${categoryFilter}`)}`,
                    onRemove: () => setCategoryFilter('all'),
                  },
                ]
              : []),
          ]}
        >
          <FilterField label={t('common.filterLabels.search')} icon={Search}>
            <SearchInput
              placeholder={t('pages.passwords.searchPlaceholder')}
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="w-52 sm:w-64"
            />
          </FilterField>
          <FilterField label={t('common.fields.category')} icon={Tag}>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-44"
                aria-label={t('pages.passwords.allCategories')}
                startIcon={<Tag className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.passwords.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.passwords.allCategories')}
                </SelectItem>
                {PASSWORD_CATEGORIES.map((cat) => {
                  const Icon =
                    PASSWORD_CATEGORY_ICONS[cat.value] ??
                    PASSWORD_CATEGORY_ICONS['other'];
                  return (
                    <SelectItem
                      key={cat.value}
                      value={cat.value}
                      icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                    >
                      {t(`pages.passwords.categories.${cat.value}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className="gap-xs"
          >
            <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-current')} />
            {t('pages.passwords.favoritesFilter')}
          </Button>
        </FilterBar>

        {filteredPasswords.length === 0 ? (
          <EmptyState
            icon={<Key className="text-muted-foreground h-12 w-12" />}
            title={
              searchTerm || categoryFilter !== 'all' || showFavoritesOnly
                ? t('pages.passwords.emptySearch')
                : t('pages.passwords.emptyState')
            }
          />
        ) : (
          <PaginatedSlide
            key={`${searchTerm}-${categoryFilter}-${showFavoritesOnly}`}
            items={filteredPasswords}
            pageSize={GRID_PAGE_SIZE}
            className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          >
            {(pageItems) =>
              pageItems.map((password) => {
                const catConfig =
                  CATEGORY_CONFIG[password.category] ?? CATEGORY_CONFIG.other;
                const strength = password.strength_score;
                return (
                  <VaultItemCard
                    key={password.id}
                    avatar={
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                          catConfig.avatar
                        )}
                      >
                        {password.title.charAt(0).toUpperCase()}
                      </div>
                    }
                    title={password.title}
                    subtitle={password.username}
                    badge={
                      <Badge
                        variant="outline"
                        className={cn('shrink-0 text-xs', catConfig.badge)}
                      >
                        {t(`pages.passwords.categories.${password.category}`, {
                          defaultValue: password.category_display,
                        })}
                      </Badge>
                    }
                    metric={
                      strength !== undefined && (
                        <span
                          className={cn(
                            'gap-xs flex items-center text-xs font-medium',
                            strength >= 4
                              ? 'text-success'
                              : strength >= 3
                                ? 'text-primary'
                                : strength >= 2
                                  ? 'text-warning'
                                  : 'text-destructive'
                          )}
                        >
                          <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                          {t(
                            `pages.passwords.passwordStrength.${
                              strength >= 4
                                ? 'strong'
                                : strength >= 3
                                  ? 'good'
                                  : strength >= 2
                                    ? 'fair'
                                    : strength >= 1
                                      ? 'weak'
                                      : 'veryWeak'
                            }`
                          )}
                        </span>
                      )
                    }
                    isFavorite={password.is_favorite}
                    onOpen={() => setDetailPassword(password)}
                    onFavorite={() => void handleToggleFavorite(password.id)}
                    onEdit={() => handleEdit(password)}
                    onDelete={() => void handleDelete(password.id)}
                    menuActions={[
                      {
                        icon: Copy,
                        label: t('common.actions.copyDetails'),
                        action: 'reveal',
                        onClick: () => void handleCopyPasswordDetails(password),
                        color: 'copy' as const,
                      },
                      {
                        icon: Share2,
                        label: t('pages.sharePassword.title'),
                        action: 'share',
                        onClick: () => setSharingPassword(password),
                        color: 'share' as const,
                      },
                      {
                        icon: ShieldAlert,
                        label: t('pages.passwords.hibp.check'),
                        action: 'check_breach',
                        onClick: () => void handleCheckLeak(password),
                        color: 'check-leak' as const,
                      },
                    ]}
                  />
                );
              })
            }
          </PaginatedSlide>
        )}

        <PasswordDetailModal
          password={detailPassword}
          catConfig={
            (detailPassword && CATEGORY_CONFIG[detailPassword.category]) ||
            CATEGORY_CONFIG.other
          }
          revealedPassword={
            detailPassword ? revealedPasswords.get(detailPassword.id) : undefined
          }
          revealedTotp={
            detailPassword ? revealedTotpData.get(detailPassword.id) : undefined
          }
          countdown={detailPassword ? countdown.get(detailPassword.id) : undefined}
          isRevealing={!!detailPassword && revealingId === detailPassword.id}
          onReveal={(id) => void handleReveal(id)}
          onClose={() => setDetailPassword(null)}
        />

        <SharePasswordModal
          password={sharingPassword}
          open={!!sharingPassword}
          onOpenChange={(open) => {
            if (!open) setSharingPassword(null);
          }}
        />

        <PasswordImportDialog
          open={isImportOpen}
          onOpenChange={(open) => {
            setIsImportOpen(open);
            if (!open) void refresh();
          }}
        />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle mode={selectedPassword ? 'edit' : 'create'}>
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
            <form
              noValidate
              onSubmit={rhfHandleSubmit(onFormSubmit, notifyFormErrors)}
              className="space-y-md"
            >
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center" htmlFor="title">
                  <FileText className="text-muted-foreground h-3.5 w-3.5" />
                  {t('common.fields.title')} *
                </Label>
                <Input
                  id="title"
                  {...register('title')}
                  aria-invalid={!!errors.title}
                  placeholder={t('pages.passwords.titlePlaceholder')}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center" htmlFor="site">
                  <Globe className="text-muted-foreground h-3.5 w-3.5" />
                  {t('common.fields.site')}
                </Label>
                <Input
                  id="site"
                  type="url"
                  {...register('site')}
                  aria-invalid={!!errors.site}
                  placeholder={t('pages.passwords.sitePlaceholder')}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center" htmlFor="username">
                  <AtSign className="text-muted-foreground h-3.5 w-3.5" />
                  {t('common.fields.username')} *
                </Label>
                <Input
                  id="username"
                  {...register('username')}
                  aria-invalid={!!errors.username}
                  placeholder={t('pages.passwords.usernamePlaceholder')}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center" htmlFor="password">
                  <Lock className="text-muted-foreground h-3.5 w-3.5" />
                  {t('auth.login.password')} {selectedPassword ? '' : '*'}
                </Label>
                <div className="gap-sm flex">
                  <Input
                    id="password"
                    type="password"
                    {...register('password')}
                    aria-invalid={!!errors.password}
                    placeholder={
                      selectedPassword
                        ? t('pages.passwords.keepCurrentPassword')
                        : '••••••••'
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      setGeneratedPassword('');
                      setIsGeneratorOpen(true);
                    }}
                    aria-label={t('pages.passwords.generatePassword')}
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center" htmlFor="category">
                  <Tag className="text-muted-foreground h-3.5 w-3.5" />
                  {t('common.fields.category')} *
                </Label>
                <Select
                  value={watchedCategory}
                  onValueChange={(value) => setValue('category', value)}
                >
                  <SelectTrigger aria-invalid={!!errors.category}>
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
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center" htmlFor="notes">
                  <FileText className="text-muted-foreground h-3.5 w-3.5" />
                  {t('common.fields.notes')}
                </Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  aria-invalid={!!errors.notes}
                  placeholder={t('pages.passwords.notesSitePlaceholder')}
                  rows={1}
                />
              </div>

              {/* TOTP (#195) */}
              <div className="bg-muted/20 p-md rounded-lg border">
                <div className="flex items-center justify-between">
                  <Label
                    className="gap-xs flex cursor-pointer items-center"
                    htmlFor="totp_enabled"
                  >
                    <ShieldCheck className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.passwords.totpEnable')}
                  </Label>
                  <Controller
                    control={control}
                    name="totp_enabled"
                    render={({ field }) => (
                      <Checkbox
                        id="totp_enabled"
                        checked={!!field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                </div>
                {watchedTotpEnabled && (
                  <div className="mt-sm space-y-xs">
                    <Label className="gap-xs flex items-center" htmlFor="totp_secret">
                      <KeyRound className="text-muted-foreground h-3.5 w-3.5" />
                      {t('pages.passwords.totpSecret')}
                    </Label>
                    <Input
                      id="totp_secret"
                      {...register('totp_secret')}
                      placeholder="JBSWY3DPEHPK3PXP"
                    />
                  </div>
                )}
              </div>

              <div className="dialog-footer gap-sm flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  <X className="h-4 w-4" />
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {!isSubmitting && <Save className="h-4 w-4" />}
                  {isSubmitting ? t('common.actions.saving') : t('common.actions.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Gerador abre por cima do formulário (§2.2: ação que revela campos abre modal) */}
        <Dialog open={isGeneratorOpen} onOpenChange={setIsGeneratorOpen}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle icon={Wand2}>
                {t('pages.passwords.generatePassword')}
              </DialogTitle>
              <DialogDescription>
                {t('pages.passwords.generatePassword')}
              </DialogDescription>
            </DialogHeader>
            <PasswordGenerator onPasswordGenerated={setGeneratedPassword} />
            <DialogFooter className="gap-sm">
              <Button variant="outline" onClick={() => setIsGeneratorOpen(false)}>
                <X className="h-4 w-4" />
                {t('common.actions.cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (!generatedPassword) {
                    toast({
                      title: t('pages.passwords.generatePassword'),
                      variant: 'destructive',
                    });
                    return;
                  }
                  setValue('password', generatedPassword);
                  setIsGeneratorOpen(false);
                }}
              >
                <Check className="h-4 w-4" />
                {t('common.actions.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </>
  );
}

// Os dados do cofre só são buscados depois do desbloqueio (o conteúdo monta dentro do guard).
export default function Passwords() {
  return (
    <VaultGuard>
      <PasswordsContent />
    </VaultGuard>
  );
}
