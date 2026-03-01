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
  Wand2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { PasswordGenerator } from '@/components/security/PasswordGenerator';
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
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { membersService } from '@/services/members-service';
import { passwordsService } from '@/services/passwords-service';
import type { Password, PasswordFormData, Member } from '@/types';
import { PASSWORD_CATEGORIES } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

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
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  // Form state
  const [formData, setFormData] = useState<PasswordFormData>({
    title: '',
    site: '',
    username: '',
    password: '',
    category: 'other',
    notes: '',
    owner: 0,
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [passwordsData, memberData] = await Promise.all([
        passwordsService.getAll(),
        membersService.getCurrentUserMember(),
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
    setFormData({
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
    setFormData({
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
      await navigator.clipboard.writeText(password);
      toast({
        title: t('common.messages.copied'),
        description: t('pages.passwords.copiedDesc'),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (
      !formData.title ||
      !formData.username ||
      (!selectedPassword && !formData.password)
    ) {
      toast({
        title: t('pages.passwords.requiredFields'),
        description: t('pages.passwords.requiredFieldsDesc'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      if (selectedPassword) {
        const updateData: Partial<PasswordFormData> = { ...formData };
        if (!updateData.password) {
          delete updateData.password; // Não enviar senha vazia
        }
        await passwordsService.update(selectedPassword.id, updateData);
        toast({
          title: t('pages.passwords.updated'),
          description: t('pages.passwords.updatedDesc'),
        });
      } else {
        await passwordsService.create(formData);
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
        <PageHeader
          title={t('pages.passwords.title')}
          icon={<Key />}
          action={{
            label: t('pages.passwords.newBtn'),
            icon: <Plus className="h-4 w-4" />,
            onClick: handleCreate,
          }}
        />

        <div className="flex gap-4">
          <SearchInput
            placeholder={t('pages.passwords.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="max-w-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPasswords.map((password) => (
            <Card key={password.id} className="transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{password.title}</CardTitle>
                    <CardDescription>{password.username}</CardDescription>
                  </div>
                  <Badge variant="secondary">{password.category_display}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {password.site && (
                    <div className="flex items-center gap-2 text-sm">
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
                    <div className="flex items-center gap-2 rounded bg-muted p-2">
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

                  <div className="flex gap-2 pt-2">
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
                          <EyeOff className="mr-1 h-3 w-3" />
                          {t('common.actions.hide')}
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1 h-3 w-3" />
                          {t('common.actions.reveal')}
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(password)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(password.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="text-xs">
                    {t('common.fields.updatedAt')}{' '}
                    {formatDate(password.updated_at, 'dd/MM/yyyy HH:mm')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('common.fields.title')} *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('pages.passwords.titlePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="site">{t('common.fields.site')}</Label>
                <Input
                  id="site"
                  type="url"
                  value={formData.site}
                  onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                  placeholder={t('pages.passwords.sitePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">{t('common.fields.username')} *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder={t('pages.passwords.usernamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
                    {t('auth.login.password')} {selectedPassword ? '' : '*'}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGenerator(!showGenerator)}
                    className="h-auto px-2 py-1 text-xs"
                  >
                    <Wand2 className="mr-1 h-3 w-3" />
                    {showGenerator
                      ? t('pages.passwords.hideGenerator')
                      : t('pages.passwords.generatePassword')}
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={
                    selectedPassword ? t('pages.passwords.keepCurrentPassword') : ''
                  }
                />
                {showGenerator && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <PasswordGenerator
                      compact
                      onPasswordGenerated={(password) => {
                        setFormData({ ...formData, password });
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t('common.fields.category')} *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PASSWORD_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('common.fields.notes')}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('pages.passwords.notesSitePlaceholder')}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
