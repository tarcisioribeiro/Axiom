/* eslint-disable max-lines */
import {
  Square2StackIcon as Copy,
  ArrowPathIcon as Loader2,
  ShareIcon as Share2,
  TrashIcon as Trash2,
  MagnifyingGlassIcon as Search,
  UserIcon as User,
  CheckIcon as Check,
} from '@heroicons/react/24/solid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 60 : -60,
    opacity: 0,
  }),
};

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
          title: t('pages.sharePassword.loadError'),
          description: getErrorMessage(error),
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
        title: t('pages.sharePassword.createError'),
        description: getErrorMessage(error),
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
        description: t('pages.sharePassword.revokedDesc'),
      });
      void refreshTokens();
    } catch (error: unknown) {
      toast({
        title: t('pages.sharePassword.revokeError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleCopyNewLink = async () => {
    if (!newShareUrl) return;
    await copyToClipboard(newShareUrl);
    toast({
      title: t('common.messages.copied'),
      description: t('pages.sharePassword.linkCopied'),
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
    return (
      <Badge variant="default" className="bg-green-600">
        {t('pages.sharePassword.statusActive')}
      </Badge>
    );
  };

  const selectedTtlLabel =
    TTL_OPTIONS.find((o) => o.value === ttlHours)?.labelKey ?? 'expiresIn24h';

  const progressValue = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <Share2 className="h-5 w-5" />
            {t('pages.sharePassword.title')}
          </DialogTitle>
          <DialogDescription>
            {password?.title} — {t('pages.sharePassword.description')}
          </DialogDescription>
        </DialogHeader>

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

          <div className="relative min-h-[280px] overflow-hidden">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {step === 0 && (
                  <div className="space-y-sm">
                    <p className="text-muted-foreground text-sm">
                      {t('pages.sharePassword.step1Desc')}
                    </p>
                    <div className="relative">
                      <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder={t('pages.sharePassword.searchMembers')}
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-lg border">
                      {isLoadingMembers ? (
                        <div className="py-md flex justify-center">
                          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                        </div>
                      ) : filteredMembers.length === 0 ? (
                        <p className="py-md text-muted-foreground text-center text-sm">
                          {t('pages.sharePassword.noMembers')}
                        </p>
                      ) : (
                        filteredMembers.map((member) => (
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
                      )}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-md">
                    <p className="text-muted-foreground text-sm">
                      {t('pages.sharePassword.step2Desc')}
                    </p>

                    <div className="space-y-sm">
                      <Label>{t('pages.sharePassword.expiryLabel')}</Label>
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
                      <Label htmlFor="max-uses">
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
                      <p className="mt-xs text-muted-foreground font-mono text-sm">
                        ••••••••
                      </p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-md">
                    <p className="text-muted-foreground text-sm">
                      {t('pages.sharePassword.step3Desc')}
                    </p>

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
                      <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
                        <p className="mb-sm font-medium text-yellow-600 dark:text-yellow-400">
                          {t('pages.sharePassword.copyNowWarning')}
                        </p>
                        <div className="gap-sm flex items-center">
                          <code className="bg-muted px-sm py-xs min-w-0 flex-1 rounded text-xs break-all">
                            {newShareUrl}
                          </code>
                          <Button
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

          <div className="gap-sm pt-md flex justify-between border-t">
            {step > 0 ? (
              <Button variant="outline" onClick={goBack} disabled={isCreating}>
                {t('pages.sharePassword.backBtn')}
              </Button>
            ) : (
              <div />
            )}
            {step < 2 ? (
              <Button onClick={goNext}>{t('pages.sharePassword.nextBtn')}</Button>
            ) : (
              <Button
                onClick={() => void handleCreate()}
                disabled={isCreating || !!newShareUrl}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                    {t('common.actions.saving')}
                  </>
                ) : (
                  <>
                    <Share2 className="mr-sm h-4 w-4" />
                    {t('pages.sharePassword.confirmBtn')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-sm pt-md border-t">
          <p className="text-sm font-medium">
            {t('pages.sharePassword.existingLinks')}
          </p>

          {isLoadingTokens ? (
            <div className="py-md flex justify-center">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="py-sm text-muted-foreground text-center text-sm">
              {t('pages.sharePassword.noLinks')}
            </p>
          ) : (
            <div className="space-y-sm max-h-48 overflow-y-auto">
              {tokens.map((token) => (
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
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleRevoke(token.id)}
                        title={t('pages.sharePassword.revokeBtn')}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
