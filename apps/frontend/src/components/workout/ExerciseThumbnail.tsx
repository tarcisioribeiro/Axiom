import { Dumbbell } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Preview de imagem do exercício (GIF, com fallback para thumbnail ou
 * ícone) — reusado no card do catálogo, na linha do plano e nas listagens
 * de sessão (registro rápido, formulário de sessão, cards de sessão). */
export function ExerciseThumbnail({
  gifUrl,
  thumbnailUrl,
  size = 'md',
  className,
}: {
  gifUrl?: string | null;
  thumbnailUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const src = gifUrl || thumbnailUrl;
  const dimClass =
    size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
  return (
    <div
      className={cn(
        'bg-category-exercise/10 flex shrink-0 items-center justify-center overflow-hidden rounded-lg',
        dimClass,
        className
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Dumbbell className="text-category-exercise h-5 w-5" />
      )}
    </div>
  );
}
