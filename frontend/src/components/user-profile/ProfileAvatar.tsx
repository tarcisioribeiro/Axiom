import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Trash2, UserCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/hooks/use-toast';
import { membersService } from '@/services/members-service';

interface ProfileAvatarProps {
  name: string;
  photoUrl?: string | null;
}

export function ProfileAvatar({ name, photoUrl }: ProfileAvatarProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const uploadMutation = useMutation({
    mutationFn: (file: File) => membersService.uploadProfilePhoto(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', 'me'] });
      toast({ title: t('userProfile.avatar.uploadSuccess') });
    },
    onError: () => {
      toast({ title: t('userProfile.avatar.uploadError'), variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => membersService.deleteProfilePhoto(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', 'me'] });
      toast({ title: t('userProfile.avatar.deleteSuccess') });
    },
    onError: () => {
      toast({ title: t('userProfile.avatar.deleteError'), variant: 'destructive' });
    },
  });

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: t('userProfile.avatar.invalidFile'), variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('userProfile.avatar.fileTooLarge'), variant: 'destructive' });
      return;
    }
    uploadMutation.mutate(file);
    e.target.value = '';
  }

  function handleClick() {
    if (!isLoading) inputRef.current?.click();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <div className="relative shrink-0">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('userProfile.avatar.change')}
        className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/60 text-2xl font-bold text-primary-foreground shadow-lg ring-4 ring-background transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : initials ? (
          initials
        ) : (
          <UserCircle className="h-10 w-10" />
        )}

        {(hovered || isLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </div>
        )}
      </div>

      {photoUrl && !isLoading && (
        <button
          type="button"
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-opacity hover:opacity-90"
          onClick={(e) => {
            e.stopPropagation();
            deleteMutation.mutate();
          }}
          title={t('userProfile.avatar.remove')}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />
    </div>
  );
}
