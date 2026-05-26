/* eslint-disable max-lines */
import { zodResolver } from '@hookform/resolvers/zod';
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
  Wand2,
  Upload,
} from 'lucide-react';
import { useState, useEffect } from 'react';
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
import { membersService } from '@/services/members-service';
import { passwordsService } from '@/services/passwords-service';
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

export default function Passwords() {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPassword, setSelectedPassword] = useState<Password | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Map<number, string>>(
    new Map()
  );
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [sharingPassword, setSharingPassword] = useState<Password | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
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
    },
  });

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Ocultar senha
      const newMap = new Map(revealedPasswords);
      newMap.delete(id);
      setRevealedPasswords(newMap);
      return;
    }

    try {
      setRevealingId(id);
      const revealData = await passwordsService.reveal(id);
      const newMap = new Map(revealedPasswords);
      newMap.set(id, revealData.password);
      setRevealedPasswords(newMap);
      toast({
        title: t('pages.passwords.revealed'),
        description: t('pages.passwords.revealedDesc'),
      });
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
    if (password) {
      await copyToClipboard(password);
      toast({
        title: t('common.messages.copied'),
        description: t('pages.passwords.copiedDesc'),
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

        <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
          <SearchInput
            placeholder={t('pages.passwords.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterBar>

        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          {filteredPasswords.map((password) => {
            const catConfig =
              CATEGORY_CONFIG[password.category] ?? CATEGORY_CONFIG.other;
            return (
              <Card
                key={password.id}
                className={cn(
                  'overflow-hidden border-l-2 transition-shadow hover:shadow-lg',
                  catConfig.border
                )}
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
                        <a
                          href={password.site}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:underline"
                        >
                          {password.site}
                        </a>
                      </div>
                    )}

                    {revealedPasswords.has(password.id) && (
                      <div className="flex items-center gap-sm rounded bg-muted p-sm">
                        <code className="flex-1 text-sm">
                          {revealedPasswords.get(password.id)}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyPassword(password.id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    <div className="flex gap-sm pt-sm">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReveal(password.id)}
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
                        onClick={() => setSharingPassword(password)}
                        title={t('pages.sharePassword.title')}
                        aria-label={t('pages.sharePassword.title')}
                      >
                        <Share2 className="h-3 w-3" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(password)}
                        title={t('common.actions.edit')}
                        aria-label={t('common.actions.edit')}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(password.id)}
                        title={t('common.actions.delete')}
                        aria-label={t('common.actions.delete')}
                      >
                        <Trash2
                          className="h-3 w-3 text-destructive"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>

                    <div className="text-xs">
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
