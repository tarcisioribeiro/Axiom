import { useMutation } from '@tanstack/react-query';
import { Container, RefreshCw, RotateCcw, Server } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
        title: t('pages.adminConfig.restartError'),
        description: err.message,
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
          <DialogTitle className="flex items-center gap-sm">
            <RotateCcw className="h-5 w-5 text-primary" />
            {t('pages.adminConfig.restartModal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.adminConfig.restartModal.desc')}
          </DialogDescription>
        </DialogHeader>

        {countdown !== null ? (
          <div className="flex flex-col items-center gap-3 py-lg">
            <RefreshCw className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('pages.adminConfig.restartModal.countdown', { seconds: countdown })}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-sm">
            <button
              type="button"
              onClick={() => setMode('docker')}
              className={`flex flex-col items-center gap-sm rounded-lg border-2 p-md text-sm font-medium transition-colors ${
                mode === 'docker'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              <Container className="h-6 w-6" />
              {t('pages.adminConfig.restartModal.docker')}
              <span className="text-xs font-normal opacity-70">
                {t('pages.adminConfig.restartModal.dockerDesc')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('kubernetes')}
              className={`flex flex-col items-center gap-sm rounded-lg border-2 p-md text-sm font-medium transition-colors ${
                mode === 'kubernetes'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              <Server className="h-6 w-6" />
              {t('pages.adminConfig.restartModal.kubernetes')}
              <span className="text-xs font-normal opacity-70">
                {t('pages.adminConfig.restartModal.kubernetesDesc')}
              </span>
            </button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={mutation.isPending || countdown !== null}
          >
            {t('pages.adminConfig.restartModal.cancel')}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || countdown !== null}
            variant="destructive"
          >
            {mutation.isPending ? (
              <>
                <RefreshCw className="mr-sm h-4 w-4 animate-spin" />
                {t('pages.adminConfig.restartModal.sending')}
              </>
            ) : (
              <>
                <RotateCcw className="mr-sm h-4 w-4" />
                {t('pages.adminConfig.restartModal.confirm')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
