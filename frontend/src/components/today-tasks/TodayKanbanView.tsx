/* eslint-disable max-lines */
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CheckCircle2, RefreshCw, Save, StickyNote } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { KanbanCard } from '@/components/personal-planning/KanbanCard';
import { KanbanColumn } from '@/components/personal-planning/KanbanColumn';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatLocalDate, parseLocalDate, cn } from '@/lib/utils';
import { MOOD_CHOICES, type TaskCard, type KanbanStatus } from '@/types';

interface TodayKanbanViewProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  cards: TaskCard[];
  onCardsChange: (cards: TaskCard[]) => void;
  reflection: string;
  onReflectionChange: (v: string) => void;
  mood: string;
  onMoodChange: (v: string) => void;
  summary: { completion_rate: number };
  isSyncing: boolean;
  isSaving: boolean;
  onSync: () => void;
  onSave: () => void;
}

export function TodayKanbanView({
  selectedDate,
  onDateChange,
  cards,
  onCardsChange,
  reflection,
  onReflectionChange,
  mood,
  onMoodChange,
  summary,
  isSyncing,
  isSaving,
  onSync,
  onSave,
}: TodayKanbanViewProps) {
  const { t } = useTranslation();
  const [activeCard, setActiveCard] = useState<TaskCard | null>(null);
  const [isReflectionOpen, setIsReflectionOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const measuringConfig = { droppable: { strategy: MeasuringStrategy.Always } };

  const cardsByStatus = useMemo(
    () => ({
      todo: cards.filter((c) => c.status === 'todo'),
      doing: cards.filter((c) => c.status === 'doing'),
      done: cards.filter((c) => c.status === 'done'),
    }),
    [cards]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    onCardsChange(
      cards.map((c) => {
        if (c.id !== activeId) return c;
        const overCard = cards.find((x) => x.id === overId);
        let targetStatus: KanbanStatus | undefined;
        if (overCard) targetStatus = overCard.status;
        else if (['todo', 'doing', 'done'].includes(overId))
          targetStatus = overId as KanbanStatus;
        if (!targetStatus || c.status === targetStatus) return c;
        return { ...c, status: targetStatus };
      })
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const activeCard = cards.find((c) => c.id === activeId);
    const overCard = cards.find((c) => c.id === overId);
    if (!activeCard) return;
    let finalStatus: KanbanStatus | undefined;
    if (overCard) finalStatus = overCard.status;
    else if (['todo', 'doing', 'done'].includes(overId))
      finalStatus = overId as KanbanStatus;
    if (!finalStatus) return;
    if (activeCard.status === finalStatus && overCard) {
      const activeIndex = cards.findIndex((c) => c.id === activeId);
      const overIndex = cards.findIndex((c) => c.id === overId);
      onCardsChange(arrayMove(cards, activeIndex, overIndex));
    }
  };

  return (
    <>
      <div className="flex items-center gap-md">
        <div className="flex items-end gap-sm">
          <div>
            <Label htmlFor="date">{t('common.fields.date')}</Label>
            <DatePicker
              value={selectedDate ? parseLocalDate(selectedDate) : undefined}
              onChange={(date) => onDateChange(date ? formatLocalDate(date) : '')}
              placeholder={t('pages.dailyChecklist.datePlaceholder')}
              className="max-w-xs"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onSync}
            disabled={isSyncing}
            title={t('pages.dailyChecklist.syncBtn')}
            aria-label={t('pages.dailyChecklist.syncBtn')}
          >
            <RefreshCw
              className={cn('h-4 w-4', isSyncing && 'animate-spin')}
              aria-hidden="true"
            />
          </Button>
          <Dialog open={isReflectionOpen} onOpenChange={setIsReflectionOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative"
                title={t('pages.dailyChecklist.addReflection')}
                aria-label={t('pages.dailyChecklist.addReflection')}
              >
                <StickyNote className="h-4 w-4" aria-hidden="true" />
                {(reflection.trim() || mood) && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>{t('pages.dailyChecklist.reflectionTitle')}</DialogTitle>
                <DialogDescription>
                  {t('pages.dailyChecklist.reflectionPlaceholder')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-md py-md">
                <div>
                  <Label htmlFor="mood">{t('pages.dailyChecklist.moodQuestion')}</Label>
                  <Select value={mood} onValueChange={onMoodChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('pages.dailyChecklist.moodPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {MOOD_CHOICES.map((choice) => (
                        <SelectItem key={choice.value} value={choice.value}>
                          {choice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reflection">
                    {t('pages.dailyChecklist.reflectionLabel')}
                  </Label>
                  <Textarea
                    id="reflection"
                    value={reflection}
                    onChange={(e) => onReflectionChange(e.target.value)}
                    placeholder={t('pages.dailyChecklist.reflectionTextPlaceholder')}
                    rows={6}
                  />
                  {reflection.length > 0 && reflection.length < 10 && (
                    <p className="mt-xs text-sm text-destructive">
                      {t('pages.dailyChecklist.reflectionMinLength')}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsReflectionOpen(false)}>
                  {t('common.actions.close')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex-1" />
        <div className="text-lg font-semibold">
          {cardsByStatus.done.length}{' '}
          {t('pages.dailyChecklist.itemsCompleted', { total: cards.length })}
          {summary.completion_rate > 0 && (
            <span className="ml-sm text-sm">
              ({summary.completion_rate.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-12 w-12 text-muted-foreground" />}
          title={t('pages.dailyChecklist.noTasks')}
          message={t('pages.dailyChecklist.noTasksDesc')}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          measuring={measuringConfig}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-3 gap-lg">
            <KanbanColumn
              status="todo"
              title={t('pages.dailyChecklist.todo')}
              cards={cardsByStatus.todo}
            />
            <KanbanColumn
              status="doing"
              title={t('pages.dailyChecklist.inProgress')}
              cards={cardsByStatus.doing}
            />
            <KanbanColumn
              status="done"
              title={t('pages.dailyChecklist.done')}
              cards={cardsByStatus.done}
            />
          </div>
          <DragOverlay>
            {activeCard ? <KanbanCard card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <>
              <Save className="mr-sm h-4 w-4 animate-pulse" />
              {t('common.actions.saving')}
            </>
          ) : (
            <>
              <Save className="mr-sm h-4 w-4" />
              {t('common.actions.save')}
            </>
          )}
        </Button>
      </div>
    </>
  );
}
