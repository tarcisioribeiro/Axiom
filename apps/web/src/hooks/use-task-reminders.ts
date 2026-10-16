import { useEffect, useRef } from 'react';

import { useToast } from '@/hooks/use-toast';
import type { TaskCard } from '@/types';

const CHECK_INTERVAL_MS = 60_000;
const ALERT_WINDOW_MINUTES = 2;

export function useTaskReminders(cards: TaskCard[]) {
  const { toast } = useToast();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      for (const card of cards) {
        if (card.status === 'done' || !card.scheduled_time) continue;

        const [h, m] = card.scheduled_time.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) continue;

        const taskMinutes = h * 60 + m;
        const diff = taskMinutes - nowMinutes;

        const key = `${card.id}-${card.scheduled_time}`;

        if (
          diff >= 0 &&
          diff <= ALERT_WINDOW_MINUTES &&
          !notifiedRef.current.has(key)
        ) {
          notifiedRef.current.add(key);
          toast({
            title:
              diff === 0
                ? `A tarefa ${card.task_name} é agora!`
                : `A tarefa ${card.task_name} começa em ${diff} min, às ${card.scheduled_time}.`,
          });
        }
      }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cards, toast]);
}
