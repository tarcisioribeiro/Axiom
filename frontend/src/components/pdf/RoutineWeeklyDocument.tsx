import {
  Circle,
  Document,
  Font,
  Page,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';

import { translate } from '@/config/constants';
import {
  CATEGORY_COLORS,
  PDF_PALETTE,
  PRIORITY_PDF_COLORS,
  type DaySchedule,
} from '@/lib/routine-export';

const C = PDF_PALETTE;

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
  headerSub: { fontSize: 8, color: C.mutedForeground, marginTop: 2 },

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
  emptyDay: {
    fontSize: 8,
    color: C.mutedForeground,
    fontStyle: 'italic',
    marginLeft: 4,
  },

  // ── Task entry ────────────────────────────────────────────────────────────
  taskRow: {
    marginBottom: 5,
    paddingLeft: 6,
    paddingTop: 3,
    paddingBottom: 3,
  },
  fieldRow: { flexDirection: 'row', marginBottom: 2, alignItems: 'flex-start' },
  labelText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.mutedForeground,
    width: 65,
  },
  valueText: { fontSize: 8, color: C.foreground, flex: 1, lineHeight: 1.4 },
  taskTitleValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.foreground,
    flex: 1,
  },
  categoryValue: { flexDirection: 'row', alignItems: 'center', flex: 1 },

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
    color: C.mutedForeground,
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
    <Document title="Rotina Semanal — Axiom" author="Axiom">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.brand}>Axiom</Text>
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
                      {/* Horário */}
                      <View style={s.fieldRow}>
                        <Text style={s.labelText}>Horário:</Text>
                        {entry.time ? (
                          <Text style={s.valueText}>
                            {entry.time}
                            {entry.task.daily_occurrences === 1 &&
                            entry.task.closing_time
                              ? ` - ${entry.task.closing_time.substring(0, 5)}`
                              : ''}
                          </Text>
                        ) : (
                          <Text
                            style={[
                              s.valueText,
                              { color: C.mutedForeground, fontStyle: 'italic' },
                            ]}
                          >
                            Sem horário definido
                          </Text>
                        )}
                      </View>

                      {/* Tarefa */}
                      <View style={s.fieldRow}>
                        <Text style={s.labelText}>Tarefa:</Text>
                        <Text style={s.taskTitleValue}>{entry.task.name}</Text>
                      </View>

                      {/* Descrição */}
                      {entry.task.description ? (
                        <View style={s.fieldRow}>
                          <Text style={s.labelText}>Descrição:</Text>
                          <Text style={s.valueText}>{entry.task.description}</Text>
                        </View>
                      ) : null}

                      {/* Categoria */}
                      <View style={s.fieldRow}>
                        <Text style={s.labelText}>Categoria:</Text>
                        <View style={s.categoryValue}>
                          <Svg width={8} height={8} style={{ marginRight: 4 }}>
                            <Circle
                              cx="4"
                              cy="4"
                              r="4"
                              fill={
                                CATEGORY_COLORS[entry.task.category] ??
                                C.mutedForeground
                              }
                            />
                          </Svg>
                          <Text style={s.valueText}>
                            {translate('taskCategories', entry.task.category)}
                          </Text>
                        </View>
                      </View>

                      {/* Prioridade */}
                      <View style={s.fieldRow}>
                        <Text style={s.labelText}>Prioridade:</Text>
                        <Text
                          style={[
                            s.valueText,
                            { color: priorityColor, fontFamily: 'Helvetica-Bold' },
                          ]}
                        >
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
