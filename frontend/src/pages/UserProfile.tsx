import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  ShieldOff,
  User,
  UserCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageContainer } from '@/components/common/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth-service';
import { membersService } from '@/services/members-service';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/utils/error-utils';

// ─── Avatar ──────────────────────────────────────────────────────────────────

function ProfileAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-2xl font-bold text-primary-foreground shadow-lg ring-4 ring-background">
      {initials || <UserCircle className="h-10 w-10" />}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <div className="mb-4 h-px bg-border" />
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ─── Personal data section ────────────────────────────────────────────────────

function PersonalDataForm({
  memberId,
  initialName,
  initialEmail,
  initialPhone,
}: {
  memberId: number;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);

  const mutation = useMutation({
    mutationFn: () =>
      membersService.patch(memberId, {
        name,
        email: email || undefined,
        phone,
      } as Parameters<typeof membersService.patch>[1]),
    onSuccess: () => {
      toast({ title: t('userProfile.personalData.success') });
      void queryClient.invalidateQueries({ queryKey: ['members', 'me'] });
    },
    onError: (err) => {
      toast({
        title: t('userProfile.personalData.error'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  return (
    <Section
      icon={<User className="h-4 w-4" />}
      title={t('userProfile.personalData.title')}
      description={t('userProfile.personalData.description')}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">{t('userProfile.personalData.name')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="email">{t('userProfile.personalData.email')}</Label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="phone">{t('userProfile.personalData.phone')}</Label>
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="gradient-primary font-semibold text-white"
        >
          {mutation.isPending
            ? t('userProfile.personalData.saving')
            : t('userProfile.personalData.save')}
        </Button>
      </div>
    </Section>
  );
}

function PersonalDataSection({ memberId }: { memberId: number }) {
  const { data: member } = useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
  });

  if (!member) return null;

  return (
    <PersonalDataForm
      key={member.id}
      memberId={memberId}
      initialName={member.name ?? ''}
      initialEmail={member.email ?? ''}
      initialPhone={member.phone ?? ''}
    />
  );
}

// ─── Email verification section ───────────────────────────────────────────────

function EmailVerificationSection({ emailVerified }: { emailVerified: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => authService.sendEmailVerification(),
    onSuccess: () => {
      toast({ title: t('userProfile.emailVerification.sent') });
    },
    onError: (err) => {
      toast({
        title: 'Erro',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  return (
    <Section
      icon={<Mail className="h-4 w-4" />}
      title={t('userProfile.emailVerification.title')}
      description={t('userProfile.emailVerification.description')}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {emailVerified ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Mail className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {emailVerified
                ? t('userProfile.emailVerification.verified')
                : t('userProfile.emailVerification.unverified')}
            </p>
          </div>
        </div>
        <Badge
          variant={emailVerified ? 'default' : 'outline'}
          className={
            emailVerified ? 'bg-green-500/15 text-green-600 hover:bg-green-500/15' : ''
          }
        >
          {emailVerified ? 'Verificado' : 'Pendente'}
        </Badge>
      </div>

      {!emailVerified && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {mutation.isPending
            ? t('userProfile.emailVerification.sending')
            : t('userProfile.emailVerification.resend')}
        </Button>
      )}
    </Section>
  );
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authService.changePassword(current, next, confirm),
    onSuccess: () => {
      toast({ title: t('userProfile.security.passwordSuccess') });
      setCurrent('');
      setNext('');
      setConfirm('');
    },
    onError: (err) => {
      toast({
        title: t('userProfile.security.passwordError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('userProfile.security.changePassword')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="current-pw">
            {t('userProfile.security.currentPassword')}
          </Label>
          <div className="relative mt-1">
            <Input
              id="current-pw"
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrent ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="new-pw">{t('userProfile.security.newPassword')}</Label>
          <div className="relative mt-1">
            <Input
              id="new-pw"
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowNext((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="confirm-pw">
            {t('userProfile.security.confirmPassword')}
          </Label>
          <Input
            id="confirm-pw"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !current || !next || !confirm}
          className="gap-2"
        >
          <KeyRound className="h-4 w-4" />
          {mutation.isPending
            ? t('userProfile.security.savingPassword')
            : t('userProfile.security.savePassword')}
        </Button>
      </div>
    </div>
  );
}

// ─── 2FA row ──────────────────────────────────────────────────────────────────

function TwoFactorRow() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => authService.getTwoFactorStatus(),
  });

  const isActive = data?.is_active ?? false;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {isActive ? (
          <ShieldCheck className="h-5 w-5 text-green-500" />
        ) : (
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">{t('userProfile.security.twoFactor')}</p>
          <p className="text-xs text-muted-foreground">
            {t('userProfile.security.twoFactorDesc')}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant={isActive ? 'default' : 'outline'}
          className={
            isActive ? 'bg-green-500/15 text-green-600 hover:bg-green-500/15' : ''
          }
        >
          {isActive
            ? t('userProfile.security.twoFactorActive')
            : t('userProfile.security.twoFactorInactive')}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void navigate('/settings/two-factor')}
        >
          {t('userProfile.security.twoFactorManage')}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserProfile() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const { data: member } = useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
  });

  const fullName = member?.name ?? user?.first_name ?? '';
  const email = member?.email ?? user?.email ?? '';
  const emailVerified = member?.email_verified ?? false;

  return (
    <PageContainer>
      {/* ── Profile hero ── */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {/* Decorative background */}
        <div className="from-primary/8 to-primary/4 absolute inset-0 bg-gradient-to-br via-transparent" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="bg-primary/8 absolute -bottom-8 -left-8 h-32 w-32 rounded-full blur-2xl" />

        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <ProfileAvatar name={fullName} />

          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{fullName || '—'}</h1>
              {emailVerified && (
                <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/15">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Verificado
                </Badge>
              )}
            </div>
            {email && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Settings className="h-3 w-3" />
              {t('userProfile.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Sections ── */}
      <div className="space-y-6">
        {member && <PersonalDataSection memberId={member.id} />}

        <EmailVerificationSection emailVerified={emailVerified} />

        <Section
          icon={<Shield className="h-4 w-4" />}
          title={t('userProfile.security.title')}
          description={t('userProfile.security.description')}
        >
          <TwoFactorRow />
          <div className="h-px bg-border" />
          <PasswordSection />
        </Section>
      </div>
    </PageContainer>
  );
}
