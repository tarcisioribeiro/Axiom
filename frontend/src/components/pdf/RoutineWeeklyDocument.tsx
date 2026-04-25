import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { PRIORITY_PDF_COLORS, type DaySchedule } from '@/lib/routine-export';

// ── Design tokens (Alucard light theme) ──────────────────────────────────────
const C = {
  background: '#FFFBEB',
  primary: '#644AC9',
  primaryLight: '#EDE9F8',
  foreground: '#1F1F1F',
  muted: '#6C664B',
  separator: '#D4D4D8',
  timeText: '#4A33A0',
  timeBg: '#EDE9F8',
};

Font.registerHyphenationCallback((word) => [word]);

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.foreground,
    backgroundColor: C.background,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 22,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
  },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.primary },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  headerTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.foreground },
  headerSub: { fontSize: 8, color: C.muted, marginTop: 2 },

  // ── Day block ─────────────────────────────────────────────────────────────
  dayBlock: { marginBottom: 16 },
  dayHeaderBar: {
    backgroundColor: C.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 6,
  },
  dayTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    letterSpacing: 0.6,
  },
  emptyDay: { fontSize: 8, color: C.muted, fontStyle: 'italic', marginLeft: 4 },

  // ── Task entry ────────────────────────────────────────────────────────────
  taskRow: {
    marginBottom: 5,
    paddingLeft: 6,
    paddingTop: 3,
    paddingBottom: 3,
  },
  timeRow: { flexDirection: 'row', marginBottom: 2 },
  timeBox: {
    backgroundColor: C.timeBg,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 5,
    paddingRight: 5,
    borderRadius: 3,
  },
  timeLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.timeText },
  timeNone: { fontSize: 7.5, color: C.muted, fontStyle: 'italic' },
  taskName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.foreground,
    marginBottom: 2,
  },
  taskDesc: { fontSize: 8, color: C.muted, marginBottom: 2, lineHeight: 1.4 },
  metaRow: { flexDirection: 'row' },
  metaCategory: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    marginRight: 6,
  },
  metaDot: { fontSize: 7.5, color: C.muted, marginRight: 6 },
  metaPriority: { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  // ── Separator ─────────────────────────────────────────────────────────────
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: C.separator,
    marginVertical: 4,
    marginLeft: 6,
  },

  // ── Page number ───────────────────────────────────────────────────────────
  pageNum: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 7,
    color: C.muted,
  },
});

interface Props {
  schedule: DaySchedule[];
  ownerName?: string;
}

export function RoutineWeeklyDocument({ schedule, ownerName }: Props) {
  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document title="Rotina Semanal — MindLedger" author="MindLedger">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.brand}>MindLedger</Text>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>Rotina Semanal</Text>
            {ownerName && <Text style={s.headerSub}>{ownerName}</Text>}
            <Text style={s.headerSub}>Gerado em {today}</Text>
          </View>
        </View>

        {/* Days */}
        {schedule.map((day) => (
          <View key={day.dayName} style={s.dayBlock}>
            <View style={s.dayHeaderBar}>
              <Text style={s.dayTitle}>{day.dayName.toUpperCase()}</Text>
            </View>

            {day.entries.length === 0 ? (
              <Text style={s.emptyDay}>Nenhuma tarefa programada</Text>
            ) : (
              day.entries.map((entry, idx) => {
                const priorityColor =
                  PRIORITY_PDF_COLORS[entry.task.priority] ?? PRIORITY_PDF_COLORS.low;
                const isLast = idx === day.entries.length - 1;

                return (
                  <View key={`${entry.task.id}-${idx}`} wrap={false}>
                    <View style={s.taskRow}>
                      {/* Time */}
                      <View style={s.timeRow}>
                        {entry.time ? (
                          <View style={s.timeBox}>
                            <Text style={s.timeLabel}>
                              {entry.time}
                              {entry.task.daily_occurrences === 1 &&
                              entry.task.closing_time
                                ? ` — ${entry.task.closing_time.substring(0, 5)}`
                                : ''}
                            </Text>
                          </View>
                        ) : (
                          <Text style={s.timeNone}>Sem horario definido</Text>
                        )}
                      </View>

                      {/* Name */}
                      <Text style={s.taskName}>{entry.task.name}</Text>

                      {/* Description */}
                      {entry.task.description ? (
                        <Text style={s.taskDesc}>{entry.task.description}</Text>
                      ) : null}

                      {/* Category · Priority */}
                      <View style={s.metaRow}>
                        <Text style={s.metaCategory}>
                          {entry.task.category_display}
                        </Text>
                        <Text style={s.metaDot}>·</Text>
                        <Text style={[s.metaPriority, { color: priorityColor }]}>
                          {entry.task.priority_display}
                        </Text>
                      </View>
                    </View>

                    {!isLast && <View style={s.divider} />}
                  </View>
                );
              })
            )}
          </View>
        ))}

        <Text
          style={s.pageNum}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
