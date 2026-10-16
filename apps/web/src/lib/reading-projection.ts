/**
 * Projeta o progresso da obra incluindo esta leitura. O ritmo segue a regra do
 * backend (BookSerializer._calc_avg_pages_per_day): páginas ÷ dias distintos.
 */
export function projectReading({
  bookPages,
  previousReadings,
  pagesRead,
  readingDate,
  today = new Date(),
}: {
  bookPages: number;
  previousReadings: { reading_date: string; pages_read: number }[];
  pagesRead: number;
  readingDate: string;
  today?: Date;
}) {
  const previousPages = previousReadings.reduce((sum, r) => sum + r.pages_read, 0);
  const totalPages = Math.min(bookPages, previousPages + pagesRead);
  const pct = (pages: number) =>
    bookPages > 0 ? Math.round((pages / bookPages) * 1000) / 10 : 0;
  const days = new Set(previousReadings.map((r) => r.reading_date));
  if (pagesRead > 0 && readingDate) days.add(readingDate);
  const avgPagesPerDay = days.size > 0 ? (previousPages + pagesRead) / days.size : 0;
  const remaining = bookPages - totalPages;
  let estimatedCompletion: Date | null = null;
  if (remaining > 0 && avgPagesPerDay > 0) {
    estimatedCompletion = new Date(today);
    estimatedCompletion.setDate(
      today.getDate() + Math.floor(remaining / avgPagesPerDay)
    );
  }
  return {
    totalPages,
    previousProgress: pct(Math.min(bookPages, previousPages)),
    progress: pct(totalPages),
    avgPagesPerDay: Math.round(avgPagesPerDay * 10) / 10,
    finished: remaining <= 0,
    estimatedCompletion,
  };
}
