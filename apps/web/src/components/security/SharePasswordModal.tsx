/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Check,
  Copy,
  Hash,
  Link2,
  Share2,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { StepNav } from '@/components/common/StepNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { slideVariants } from '@/lib/animations';
import { formatDate } from '@/lib/formatters';
import { cn, copyToClipboard } from '@/lib/utils';
import { credentialShareService } from '@/services/credential-share-service';
import { membersService } from '@/services/members-service';
import type { CredentialShareToken, Member, Password } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface SharePasswordModalProps {
  password: Password | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_TOKENS: CredentialShareToken[] = [];
const EMPTY_MEMBERS: Member[] = [];

const TTL_OPTIONS = [
  { value: '1', labelKey: 'expiresIn1h' as const },
  { value: '6', labelKey: 'expiresIn6h' as const },
  { value: '24', labelKey: 'expiresIn24h' as const },
  { value: '168', labelKey: 'expiresIn7d' as const },
];

const MAX_USES_OPTIONS = [1, 2, 3, 4, 5];

const STEPS = ['step1Title', 'step2Title', 'step3Title'] as const;

export function SharePasswordModal({
  password,
  open,
  onOpenChange,
}: SharePasswordModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [ttlHours, setTtlHours] = useState('24');
  const [maxUses, setMaxUses] = useState('1');

  const [isCreating, setIsCreating] = useState(false);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: tokens = EMPTY_TOKENS, isLoading: isLoadingTokens } = useQuery({
    queryKey: ['credential-share-tokens', password?.id],
    queryFn: async () => {
      if (!password) return EMPTY_TOKENS;
      try {
        return await credentialShareService.getTokens(password.id);
      } catch (error: unknown) {
        toast({
          title: t('pages.sharePassword.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return EMPTY_TOKENS;
      }
    },
    enabled: open && !!password,
  });
  const refreshTokens = () =>
    queryClient.invalidateQueries({
      queryKey: ['credential-share-tokens', password?.id],
    });

  const { data: members = EMPTY_MEMBERS, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['share-modal-members'],
    queryFn: async () => {
      try {
        return await membersService.getAll();
      } catch {
        toast({
          title: t('pages.sharePassword.loadMembersError'),
          variant: 'destructive',
        });
        return EMPTY_MEMBERS;
      }
    },
    enabled: open,
  });

  // Reinicia o formulário quando o dialog abre com uma nova senha (derivado
  // durante o render — sem efeito).
  const [lastResetKey, setLastResetKey] = useState({ open, password });
  if (lastResetKey.open !== open || lastResetKey.password !== password) {
    setLastResetKey({ open, password });
    if (open && password) {
      setStep(0);
      setDirection(1);
      setSelectedMember(null);
      setMemberSearch('');
      setNewShareUrl(null);
      setTtlHours('24');
      setMaxUses('1');
    }
  }

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const goNext = () => {
    if (step === 0 && !selectedMember) {
      toast({
        title: t('pages.sharePassword.selectMemberFirst'),
        variant: 'destructive',
      });
      return;
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, 2));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleCreate = async () => {
    if (!password) return;
    // Compartilhar fica sempre visível: sem membro, avisa e volta à 1ª etapa.
    if (!selectedMember) {
      toast({
        title: t('pages.sharePassword.selectMemberFirst'),
        variant: 'destructive',
      });
      setDirection(-1);
      setStep(0);
      return;
    }
    setIsCreating(true);
    try {
      const result = await credentialShareService.createToken(password.id, {
        ttl_hours: parseInt(ttlHours, 10),
        max_uses: parseInt(maxUses, 10),
      });
      if (result.token_key) {
        setNewShareUrl(
          `${window.location.origin}/share/${result.token}#key=${result.token_key}`
        );
      }
      void refreshTokens();
    } catch (error: unknown) {
      toast({
        title: t('pages.sharePassword.createError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (tokenId: number) => {
    try {
      await credentialShareService.revokeToken(tokenId);
      toast({
        title: t('pages.sharePassword.revoked'),
      });
      void refreshTokens();
    } catch (error: unknown) {
      toast({
        title: t('pages.sharePassword.revokeError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleCopyNewLink = async () => {
    if (!newShareUrl) return;
    await copyToClipboard(newShareUrl);
    toast({
      title: t('common.messages.copied'),
    });
  };

  const getTokenBadge = (token: CredentialShareToken) => {
    if (token.is_revoked)
      return (
        <Badge variant="destructive">{t('pages.sharePassword.statusRevoked')}</Badge>
      );
    if (token.is_expired)
      return (
        <Badge variant="secondary">{t('pages.sharePassword.statusExpired')}</Badge>
      );
    if (token.is_exhausted)
      return (
        <Badge variant="secondary">{t('pages.sharePassword.statusExhausted')}</Badge>
      );
    return <Badge variant="success">{t('pages.sharePassword.statusActive')}</Badge>;
  };

  const selectedTtlLabel =
    TTL_OPTIONS.find((o) => o.value === ttlHours)?.labelKey ?? 'expiresIn24h';

  const progressValue = ((step + 1) / STEPS.length) * 100;

  return (
    // Abre só com membros e links carregados (§7), sem "Carregando…" dentro do modal.
    <Dialog
      open={open && !isLoadingTokens && !isLoadingMembers}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle icon={Share2}>
            {t('pages.sharePassword.title')}
            {password && ` · ${password.title}`}
          </DialogTitle>
          <DialogDescription>{t('pages.sharePassword.description')}</DialogDescription>
        </DialogHeader>

        <div className="gap-lg grid md:grid-cols-2">
          <div className="space-y-md">
            <div className="space-y-xs">
              <div className="text-muted-foreground flex justify-between text-xs">
                {STEPS.map((key, i) => (
                  <span
                    key={key}
                    className={cn(
                      'transition-colors',
                      i === step ? 'text-foreground font-semibold' : ''
                    )}
                  >
                    {i + 1}. {t(`pages.sharePassword.${key}`)}
                  </span>
                ))}
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>

            <div className="overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {step === 0 && (
                    <div className="space-y-sm">
                      <SearchInput
                        value={memberSearch}
                        onValueChange={setMemberSearch}
                        placeholder={t('pages.sharePassword.searchMembers')}
                      />
                      <div className="rounded-lg border">
                        {filteredMembers.length === 0 ? (
                          <EmptyState title={t('pages.sharePassword.noMembers')} />
                        ) : (
                          <PaginatedSlide
                            key={memberSearch}
                            items={filteredMembers}
                            pageSize={LIST_PAGE_SIZE}
                            pinNav={false}
                          >
                            {(pageMembers) =>
                              pageMembers.map((member) => (
                                <button
                                  key={member.id}
                                  type="button"
                                  className={cn(
                                    'gap-sm px-md py-sm hover:bg-accent/50 flex w-full items-center text-left transition-colors',
                                    selectedMember?.id === member.id && 'bg-primary/10'
                                  )}
                                  onClick={() => setSelectedMember(member)}
                                >
                                  <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                                    <User className="text-muted-foreground h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                      {member.name}
                                    </p>
                                    {member.email && (
                                      <p className="text-muted-foreground truncate text-xs">
                                        {member.email}
                                      </p>
                                    )}
                                  </div>
                                  {selectedMember?.id === member.id && (
                                    <Check className="text-primary h-4 w-4 shrink-0" />
                                  )}
                                </button>
                              ))
                            }
                          </PaginatedSlide>
                        )}
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-md">
                      <div className="space-y-sm">
                        <Label className="gap-xs flex items-center">
                          <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                          {t('pages.sharePassword.expiryLabel')}
                        </Label>
                        <div className="gap-sm grid grid-cols-2 sm:grid-cols-4">
                          {TTL_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={cn(
                                'px-sm py-xs hover:bg-accent/50 rounded-lg border text-sm transition-colors',
                                ttlHours === opt.value &&
                                  'border-primary bg-primary/10 text-primary font-medium'
                              )}
                              onClick={() => setTtlHours(opt.value)}
                            >
                              {t(`pages.sharePassword.${opt.labelKey}`)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-sm">
                        <Label className="gap-xs flex items-center" htmlFor="max-uses">
                          <Hash className="text-muted-foreground h-3.5 w-3.5" />
                          {t('pages.sharePassword.maxUsesLabel')}
                        </Label>
                        <Select value={maxUses} onValueChange={setMaxUses}>
                          <SelectTrigger id="max-uses">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MAX_USES_OPTIONS.map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="bg-muted/30 p-md rounded-lg border">
                        <p className="mb-xs text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          {t('pages.sharePassword.previewLabel')}
                        </p>
                        <p className="text-sm font-medium">{password?.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {password?.username}
                        </p>
                        <p className="mt-xs text-muted-foreground text-sm">••••••••</p>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-md">
                      <div className="p-md rounded-lg border">
                        <p className="mb-sm text-sm font-medium">
                          {t('pages.sharePassword.confirmTitle')}
                        </p>
                        <dl className="space-y-sm text-sm">
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">
                              {t('pages.sharePassword.confirmPassword')}
                            </dt>
                            <dd className="font-medium">{password?.title}</dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">
                              {t('pages.sharePassword.confirmRecipient')}
                            </dt>
                            <dd className="font-medium">{selectedMember?.name}</dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">
                              {t('pages.sharePassword.confirmExpiry')}
                            </dt>
                            <dd className="font-medium">
                              {t(`pages.sharePassword.${selectedTtlLabel}`)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">
                              {t('pages.sharePassword.confirmMaxUses')}
                            </dt>
                            <dd className="font-medium">{maxUses}</dd>
                          </div>
                        </dl>
                      </div>

                      {newShareUrl && (
                        <div className="border-warning/40 bg-warning/10 p-sm rounded-md border text-sm">
                          <p className="mb-sm text-warning font-medium">
                            {t('pages.sharePassword.copyNowWarning')}
                          </p>
                          <div className="gap-sm flex items-center">
                            <code className="bg-muted px-sm py-xs min-w-0 flex-1 rounded text-xs break-all">
                              {newShareUrl}
                            </code>
                            <Button
                              aria-label={t('common.actions.copy')}
                              size="sm"
                              variant="outline"
                              onClick={handleCopyNewLink}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {!newShareUrl && (
              <StepNav
                onBack={goBack}
                onNext={goNext}
                isFirst={step === 0}
                isLast={step === 2}
                disabled={isCreating}
              />
            )}
          </div>

          <div className="space-y-sm">
            <p className="gap-xs flex items-center text-sm font-medium">
              <Link2 className="text-muted-foreground h-4 w-4" />
              {t('pages.sharePassword.existingLinks')}
            </p>

            {tokens.length === 0 ? (
              <EmptyState title={t('pages.sharePassword.noLinks')} />
            ) : (
              <PaginatedSlide
                items={tokens}
                pageSize={LIST_PAGE_SIZE}
                pinNav={false}
                className="space-y-sm"
              >
                {(pageTokens) =>
                  pageTokens.map((token) => (
                    <div
                      key={token.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div className="space-y-xs min-w-0 flex-1">
                        <div className="gap-sm flex items-center">
                          {getTokenBadge(token)}
                          <span className="text-muted-foreground text-xs">
                            {token.use_count}/{token.max_uses}{' '}
                            {t('pages.sharePassword.uses')}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {t('pages.sharePassword.expiresAt')}{' '}
                          {formatDate(token.expires_at, 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="ml-sm gap-xs flex shrink-0">
                        {!token.is_revoked && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void handleRevoke(token.id)}
                            aria-label={t('pages.sharePassword.revokeBtn')}
                            className="text-destructive hover:text-destructive h-7 w-7"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                }
              </PaginatedSlide>
            )}
          </div>
        </div>

        {newShareUrl ? (
          <DialogCloseFooter />
        ) : (
          <DialogFooter className="gap-sm">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X />
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleCreate()} loading={isCreating}>
              {!isCreating && <Share2 />}
              {t('pages.sharePassword.confirmBtn')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
