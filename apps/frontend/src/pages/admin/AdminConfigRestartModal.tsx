import { useMutation } from '@tanstack/react-query';
import { Container, RefreshCw, RotateCcw, Server, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { adminService } from '@/services/admin-service';
import { useAuthStore } from '@/stores/auth-store';

type RestartMode = 'docker' | 'kubernetes';

export function RestartModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<RestartMode>('docker');
  const [countdown, setCountdown] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const mutation = useMutation({
    mutationFn: () => adminService.restartAll(mode),
    onSuccess: () => {
      let seconds = 5;
      setCountdown(seconds);
      const interval = setInterval(() => {
        seconds -= 1;
        setCountdown(seconds);
        if (seconds <= 0) {
          clearInterval(interval);
          logout();
          void navigate('/login');
        }
      }, 1000);
    },
    onError: (err: Error) => {
      toast({
        title: t('pages.adminConfig.restartError', { reason: err.message }),
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    if (mutation.isPending || countdown !== null) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={RotateCcw}>
            {t('pages.adminConfig.restartModal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.adminConfig.restartModal.desc')}
          </DialogDescription>
        </DialogHeader>

        {countdown !== null ? (
          <div className="py-lg flex flex-col items-center gap-3">
            <RefreshCw className="text-primary h-10 w-10 animate-spin" />
            <p className="text-muted-foreground text-sm">
              {t('pages.adminConfig.restartModal.countdown', { seconds: countdown })}
            </p>
          </div>
        ) : (
          <div className="py-sm grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('docker')}
              className={`gap-sm p-md flex flex-col items-center rounded-lg border-2 text-sm font-medium transition-colors ${
                mode === 'docker'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Container className="h-6 w-6" />
              {t('pages.adminConfig.restartModal.docker')}
            </button>
            <button
              type="button"
              onClick={() => setMode('kubernetes')}
              className={`gap-sm p-md flex flex-col items-center rounded-lg border-2 text-sm font-medium transition-colors ${
                mode === 'kubernetes'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Server className="h-6 w-6" />
              {t('pages.adminConfig.restartModal.kubernetes')}
            </button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={mutation.isPending || countdown !== null}
          >
            <X className="h-4 w-4" />
            {t('pages.adminConfig.restartModal.cancel')}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={countdown !== null}
            loading={mutation.isPending}
          >
            {!mutation.isPending && <RotateCcw className="h-4 w-4" />}
            {t('pages.adminConfig.restartModal.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
