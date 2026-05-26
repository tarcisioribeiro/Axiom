/* eslint-disable max-lines */
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

import { PDF_PALETTE as COLORS } from '@/lib/routine-export';

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.foreground,
    backgroundColor: COLORS.background,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  brandBlock: {
    flexDirection: 'column',
    gap: 3,
  },
  brandName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 8,
    color: COLORS.mutedForeground,
    letterSpacing: 0.5,
  },
  headerMeta: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
  },
  headerMetaTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.foreground,
  },
  headerMetaText: {
    fontSize: 8,
    color: COLORS.mutedForeground,
  },

  // ── Summary cards ────────────────────────────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryCardRevenue: {
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.success,
  },
  summaryCardExpense: {
    backgroundColor: COLORS.destructiveLight,
    borderColor: COLORS.destructive,
  },
  summaryCardBalance: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  summaryLabel: {
    fontSize: 7,
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  summaryValueRevenue: { color: COLORS.success },
  summaryValueExpense: { color: COLORS.destructive },
  summaryValueBalance: { color: COLORS.primary },
  summarySubtext: {
    fontSize: 7,
    color: COLORS.mutedForeground,
    marginTop: 3,
  },

  // ── Section title ────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
  },

  // ── Account balances ─────────────────────────────────────────────────────────
  accountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  accountChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 160,
  },
  accountChipName: {
    fontSize: 8,
    color: COLORS.foreground,
    fontFamily: 'Helvetica-Bold',
  },
  accountChipInstitution: {
    fontSize: 7,
    color: COLORS.mutedForeground,
  },
  accountChipBalance: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  accountChipBalancePositive: { color: COLORS.success },
  accountChipBalanceNegative: { color: COLORS.destructive },

  // ── Transactions table ────────────────────────────────────────────────────────
  table: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: COLORS.surface,
  },
  tableRowOdd: {
    backgroundColor: COLORS.card,
  },
  tableCell: {
    fontSize: 8,
    color: COLORS.foreground,
  },
  tableCellMuted: {
    fontSize: 7,
    color: COLORS.mutedForeground,
  },

  // column widths
  colDate: { width: '12%' },
  colDescription: { width: '33%' },
  colCategory: { width: '20%' },
  colAccount: { width: '20%' },
  colValue: { width: '15%', textAlign: 'right' },

  // Value colors
  valueRevenue: { color: COLORS.success, fontFamily: 'Helvetica-Bold' },
  valueExpense: { color: COLORS.destructive, fontFamily: 'Helvetica-Bold' },
  valueTransfer: { color: COLORS.info, fontFamily: 'Helvetica-Bold' },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.mutedForeground,
  },
  footerBrand: {
    fontSize: 7,
    color: COLORS.primary,
    fontFamily: 'Helvetica-Bold',
  },

  // ── Empty state ────────────────────────────────────────────────────────────────
  emptyState: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  emptyStateText: {
    fontSize: 9,
    color: COLORS.mutedForeground,
    textAlign: 'center',
  },

  // ── Balance summary row ─────────────────────────────────────────────────────
  balanceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: COLORS.primaryLight,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  balanceSummaryLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    marginRight: 6,
  },
  balanceSummaryValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
});

// ── Types ────────────────────────────────────────────────────────────────────
export interface StatementTransaction {
  id: number;
  date: string;
  description: string;
  category: string;
  account_name: string;
  value: string;
  type: 'revenue' | 'expense';
  is_transfer?: boolean;
}

export interface StatementAccount {
  id: number;
  account_name: string;
  institution: string;
  balance: string;
}

export interface StatementLabels {
  docTitle: string;
  tagline: string;
  pdfTitle: string;
  period: string;
  holder: string;
  generatedAt: string;
  totalRevenues: string;
  totalExpenses: string;
  netBalance: string;
  surplus: string;
  deficit: string;
  releaseCount: (count: number) => string;
  accountBalances: string;
  transactions: string;
  colDate: string;
  colDescription: string;
  colCategory: string;
  colAccount: string;
  colValue: string;
  noTransactions: string;
  periodBalance: string;
  footer: string;
  page: string;
  of: string;
}

export interface StatementData {
  period: { from: string; to: string };
  generatedAt: string;
  userName: string;
  totalRevenues: number;
  totalExpenses: number;
  netBalance: number;
  accounts: StatementAccount[];
  transactions: StatementTransaction[];
  labels: StatementLabels;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// ── Document ──────────────────────────────────────────────────────────────────
export function StatementDocument({ data }: { data: StatementData }) {
  const {
    period,
    generatedAt,
    userName,
    totalRevenues,
    totalExpenses,
    netBalance,
    accounts,
    transactions,
    labels,
  } = data;

  const revenueCount = transactions.filter((t) => t.type === 'revenue').length;
  const expenseCount = transactions.filter((t) => t.type === 'expense').length;

  return (
    <Document
      title={`${labels.docTitle} – ${period.from} a ${period.to}`}
      author="Axiom"
      creator="Axiom"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>Axiom</Text>
            <Text style={styles.brandTagline}>{labels.tagline}</Text>
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.headerMetaTitle}>{labels.pdfTitle}</Text>
            <Text style={styles.headerMetaText}>
              {labels.period}: {period.from} – {period.to}
            </Text>
            <Text style={styles.headerMetaText}>
              {labels.holder}: {userName}
            </Text>
            <Text style={styles.headerMetaText}>
              {labels.generatedAt}: {generatedAt}
            </Text>
          </View>
        </View>

        {/* ── Summary cards ──────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryCardRevenue]}>
            <Text style={styles.summaryLabel}>{labels.totalRevenues}</Text>
            <Text style={[styles.summaryValue, styles.summaryValueRevenue]}>
              {fmtCurrency(totalRevenues)}
            </Text>
            <Text style={styles.summarySubtext}>
              {labels.releaseCount(revenueCount)}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardExpense]}>
            <Text style={styles.summaryLabel}>{labels.totalExpenses}</Text>
            <Text style={[styles.summaryValue, styles.summaryValueExpense]}>
              {fmtCurrency(totalExpenses)}
            </Text>
            <Text style={styles.summarySubtext}>
              {labels.releaseCount(expenseCount)}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardBalance]}>
            <Text style={styles.summaryLabel}>{labels.netBalance}</Text>
            <Text style={[styles.summaryValue, styles.summaryValueBalance]}>
              {fmtCurrency(netBalance)}
            </Text>
            <Text style={styles.summarySubtext}>
              {netBalance >= 0 ? labels.surplus : labels.deficit}
            </Text>
          </View>
        </View>

        {/* ── Account balances ───────────────────────────────────── */}
        {accounts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{labels.accountBalances}</Text>
            <View style={styles.accountsRow}>
              {accounts.map((acc) => {
                const bal = parseFloat(acc.balance);
                return (
                  <View key={acc.id} style={styles.accountChip}>
                    <View>
                      <Text style={styles.accountChipName}>
                        {truncate(acc.account_name, 20)}
                      </Text>
                      <Text style={styles.accountChipInstitution}>
                        {acc.institution}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.accountChipBalance,
                        bal >= 0
                          ? styles.accountChipBalancePositive
                          : styles.accountChipBalanceNegative,
                      ]}
                    >
                      {fmtCurrency(bal)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Transactions table ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{labels.transactions}</Text>
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>
              {labels.colDate}
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>
              {labels.colDescription}
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colCategory]}>
              {labels.colCategory}
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colAccount]}>
              {labels.colAccount}
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colValue]}>
              {labels.colValue}
            </Text>
          </View>

          {/* Rows */}
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{labels.noTransactions}</Text>
            </View>
          ) : (
            transactions.map((tx, index) => {
              const value = parseFloat(tx.value);
              const isEven = index % 2 === 0;
              const valueStyle = tx.is_transfer
                ? styles.valueTransfer
                : tx.type === 'revenue'
                  ? styles.valueRevenue
                  : styles.valueExpense;

              return (
                <View
                  key={`${tx.type}-${tx.id}`}
                  style={[
                    styles.tableRow,
                    isEven ? styles.tableRowEven : styles.tableRowOdd,
                  ]}
                >
                  <Text style={[styles.tableCell, styles.colDate]}>{tx.date}</Text>
                  <Text style={[styles.tableCell, styles.colDescription]}>
                    {truncate(tx.description, 36)}
                  </Text>
                  <Text style={[styles.tableCellMuted, styles.colCategory]}>
                    {truncate(tx.category, 22)}
                  </Text>
                  <Text style={[styles.tableCellMuted, styles.colAccount]}>
                    {truncate(tx.account_name ?? '', 22)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colValue, valueStyle]}>
                    {tx.type === 'expense' ? '−' : '+'}
                    {fmtCurrency(Math.abs(value))}
                  </Text>
                </View>
              );
            })
          )}

          {/* Balance summary row */}
          {transactions.length > 0 && (
            <View style={styles.balanceSummaryRow}>
              <Text style={styles.balanceSummaryLabel}>{labels.periodBalance}:</Text>
              <Text
                style={[
                  styles.balanceSummaryValue,
                  netBalance >= 0
                    ? styles.summaryValueRevenue
                    : styles.summaryValueExpense,
                ]}
              >
                {fmtCurrency(netBalance)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{labels.footer}</Text>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <Text style={styles.footerText}>{labels.page}</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} ${labels.of} ${totalPages}`
              }
            />
            <Text style={styles.footerText}> · </Text>
            <Text style={styles.footerBrand}>Axiom</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
