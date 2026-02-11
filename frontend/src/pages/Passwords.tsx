import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Copy, ExternalLink, Key, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/common/SearchInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { passwordsService } from '@/services/passwords-service';
import { membersService } from '@/services/members-service';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getErrorMessage } from '@/utils/error-utils';
import { formatDate } from '@/lib/formatters';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import type { Password, PasswordFormData, Member } from '@/types';
import { PASSWORD_CATEGORIES } from '@/types';
import { PageContainer } from '@/components/common/PageContainer';
import { PasswordGenerator } from '@/components/security/PasswordGenerator';

export default function Passwords() {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPassword, setSelectedPassword] = useState<Password | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Map<number, string>>(new Map());
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

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
    loadData();
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
        title: 'Erro ao carregar dados',
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
        title: 'Ação não permitida',
        description: 'Não foi possível identificar o membro do usuário atual.',
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
      title: 'Excluir senha',
      description: 'Tem certeza que deseja excluir esta senha? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await passwordsService.delete(id);
      toast({
        title: 'Senha excluída',
        description: 'A senha foi excluída com sucesso.',
      });
      loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
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
        title: 'Senha revelada',
        description: 'A senha foi descriptografada com sucesso.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao revelar senha',
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
        title: 'Copiado!',
        description: 'Senha copiada para a área de transferência.',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!formData.title || !formData.username || (!selectedPassword && !formData.password)) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      if (selectedPassword) {
        const updateData = { ...formData };
        if (!updateData.password) {
          delete (updateData as any).password; // Não enviar senha vazia
        }
        await passwordsService.update(selectedPassword.id, updateData);
        toast({
          title: 'Senha atualizada',
          description: 'A senha foi atualizada com sucesso.',
        });
      } else {
        await passwordsService.create(formData);
        toast({
          title: 'Senha criada',
          description: 'A senha foi criada com sucesso.',
        });
      }
      setIsDialogOpen(false);
      loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
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
      (pwd.site && pwd.site.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Senhas"
        icon={<Key />}
        action={{
          label: 'Nova Senha',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <SearchInput
          placeholder="Buscar senhas..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPasswords.map((password) => (
          <Card key={password.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
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
                      className="hover:underline truncate"
                    >
                      {password.site}
                    </a>
                  </div>
                )}

                {revealedPasswords.has(password.id) && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
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
                        Ocultar
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1 h-3 w-3" />
                        Revelar
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
                  Atualizado em {formatDate(password.updated_at, 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPasswords.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-card">
          <p>Nenhuma senha encontrada.</p>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedPassword ? 'Editar Senha' : 'Nova Senha'}
            </DialogTitle>
            <DialogDescription>
              {selectedPassword
                ? 'Atualize as informações da senha.'
                : 'Adicione uma nova senha ao gerenciador.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Gmail, Netflix, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Input
                id="site"
                type="url"
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                placeholder="https://exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Usuário/Email *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="usuario@email.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">
                  Senha {selectedPassword ? '' : '*'}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGenerator(!showGenerator)}
                  className="h-auto py-1 px-2 text-xs"
                >
                  <Wand2 className="mr-1 h-3 w-3" />
                  {showGenerator ? 'Ocultar Gerador' : 'Gerar Senha'}
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={selectedPassword ? 'Deixe vazio para manter a atual' : ''}
              />
              {showGenerator && (
                <div className="border rounded-lg p-3 bg-muted/30">
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
              <Label htmlFor="category">Categoria *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
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
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionais..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
