import { UserCircle } from 'lucide-react';

export function ProfileAvatar({ name }: { name: string }) {
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
