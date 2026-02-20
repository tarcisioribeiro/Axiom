import { forwardRef } from 'react';
import type { ReceiptData } from '@/types/receipt';
import {
  formatReceiptCurrency,
  formatReceiptDate,
  formatReceiptTime,
  formatGeneratedAt,
} from '@/lib/receipt-utils';
import { autoTranslate } from '@/config/constants';

interface ReceiptTemplateProps {
  data: ReceiptData;
  /** Se true, usa cores claras fixas para exportação (PDF/PNG) */
  forExport?: boolean;
}

// Cores para tema claro (usadas em exportação)
const lightColors = {
  background: '#ffffff',
  foreground: '#1f2937',
  foregroundStrong: '#111827',
  foregroundMuted: '#4b5563',
  foregroundSubtle: '#6b7280',
  foregroundNote: '#374151',
  border: '#d1d5db',
  borderSubtle: '#e5e7eb',
  borderFaint: '#f3f4f6',
  success: '#16a34a',
  destructive: '#dc2626',
  warning: '#d97706',
};

// Cores usando variáveis CSS do tema (para visualização na tela)
const themeColors = {
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  foregroundStrong: 'hsl(var(--foreground))',
  foregroundMuted: 'hsl(var(--muted-foreground))',
  foregroundSubtle: 'hsl(var(--muted-foreground))',
  foregroundNote: 'hsl(var(--foreground) / 0.85)',
  border: 'hsl(var(--border))',
  borderSubtle: 'hsl(var(--border) / 0.7)',
  borderFaint: 'hsl(var(--border) / 0.4)',
  success: 'hsl(var(--success))',
  destructive: 'hsl(var(--destructive))',
  warning: 'hsl(var(--warning))',
};

const createStyles = (colors: typeof lightColors | typeof themeColors) => ({
  container: {
    width: '600px',
    backgroundColor: colors.background,
    color: colors.foreground,
    padding: '24px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    boxSizing: 'border-box' as const,
    lineHeight: '1.5',
  },
  header: {
    textAlign: 'center' as const,
    borderBottom: `2px solid ${colors.border}`,
    paddingBottom: '16px',
    marginBottom: '16px',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: colors.foregroundStrong,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: 0,
  },
  row: {
    display: 'table',
    width: '100%',
    marginBottom: '12px',
  },
  labelCell: {
    display: 'table-cell',
    width: '40%',
    color: colors.foregroundMuted,
    fontSize: '14px',
    verticalAlign: 'middle' as const,
  },
  valueCell: {
    display: 'table-cell',
    width: '60%',
    textAlign: 'right' as const,
    color: colors.foregroundStrong,
    verticalAlign: 'middle' as const,
  },
  descriptionBlock: {
    marginBottom: '12px',
  },
  descriptionLabel: {
    color: colors.foregroundMuted,
    fontSize: '14px',
    display: 'block',
    marginBottom: '4px',
  },
  descriptionValue: {
    color: colors.foregroundStrong,
    fontWeight: 500,
    wordBreak: 'break-word' as const,
  },
  valueHighlight: {
    textAlign: 'center' as const,
    padding: '8px 0',
    borderTop: `1px solid ${colors.borderSubtle}`,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    marginBottom: '12px',
  },
  valueLarge: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: colors.foregroundStrong,
  },
  statusPaid: {
    color: colors.success,
    fontWeight: 500,
  },
  statusOverdue: {
    color: colors.destructive,
    fontWeight: 500,
  },
  statusPending: {
    color: colors.warning,
    fontWeight: 500,
  },
  notes: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: `1px solid ${colors.borderSubtle}`,
  },
  notesLabel: {
    color: colors.foregroundMuted,
    fontSize: '14px',
    display: 'block',
    marginBottom: '4px',
  },
  notesText: {
    color: colors.foregroundNote,
    fontSize: '14px',
    wordBreak: 'break-word' as const,
    margin: 0,
  },
  statementSection: {
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: `1px solid ${colors.borderSubtle}`,
  },
  statementTitle: {
    color: colors.foregroundNote,
    fontWeight: 500,
    fontSize: '14px',
    marginBottom: '8px',
  },
  statementItem: {
    display: 'table',
    width: '100%',
    borderBottom: `1px solid ${colors.borderFaint}`,
    paddingBottom: '4px',
    marginBottom: '8px',
  },
  statementItemDesc: {
    display: 'table-cell',
    width: '70%',
    verticalAlign: 'top' as const,
    paddingRight: '8px',
  },
  statementItemValue: {
    display: 'table-cell',
    width: '30%',
    textAlign: 'right' as const,
    verticalAlign: 'top' as const,
    fontSize: '14px',
  },
  statementCategory: {
    color: colors.foregroundSubtle,
    fontSize: '12px',
    display: 'block',
  },
  installmentBadge: {
    color: colors.foregroundSubtle,
    fontSize: '12px',
    marginLeft: '4px',
  },
  statementSummary: {
    marginTop: '8px',
    fontSize: '12px',
    color: colors.foregroundSubtle,
  },
  signature: {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: `1px solid ${colors.border}`,
    textAlign: 'center' as const,
  },
  signatureLine: {
    borderBottom: `1px solid ${colors.foregroundSubtle}`,
    width: '256px',
    margin: '24px auto 4px auto',
  },
  signatureName: {
    color: colors.foregroundNote,
    fontSize: '14px',
  },
  footer: {
    marginTop: '24px',
    paddingTop: '12px',
    borderTop: `1px solid ${colors.borderSubtle}`,
    textAlign: 'center' as const,
  },
  footerText: {
    color: colors.foregroundSubtle,
    fontSize: '12px',
  },
  // Cores para status dinâmicos
  itemDescText: {
    color: colors.foreground,
    fontSize: '14px',
  },
  itemValueDefault: {
    color: colors.foreground,
  },
  itemValuePaid: {
    color: colors.success,
  },
});

/**
 * Receipt Template Component
 *
 * Visual layout of the financial receipt/voucher.
 * Fixed width of 600px for consistent export sizing.
 * Uses table-based layout for html2canvas compatibility.
 *
 * @param forExport - When true, uses fixed light colors for PDF/PNG export.
 *                    When false (default), respects the current theme.
 */
export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  ({ data, forExport = false }, ref) => {
    const colors = forExport ? lightColors : themeColors;
    const styles = createStyles(colors);

    const getStatusStyle = (status?: string) => {
      if (
        status === 'payed' ||
        status === 'paid' ||
        status === 'received' ||
        status === 'completed' ||
        status === 'transfered'
      ) {
        return styles.statusPaid;
      }
      if (status === 'overdue') {
        return styles.statusOverdue;
      }
      return styles.statusPending;
    };

    return (
      <div ref={ref} style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Comprovante de {data.typeLabel}</h1>
        </div>

        {/* Main Content */}
        <div>
          {/* Description */}
          <div style={styles.descriptionBlock}>
            <span style={styles.descriptionLabel}>Descrição:</span>
            <span style={styles.descriptionValue}>{data.description}</span>
          </div>

          {/* Value - Prominent display */}
          <div style={styles.valueHighlight}>
            <span style={styles.valueLarge}>{formatReceiptCurrency(data.value)}</span>
          </div>

          {/* Date */}
          <div style={styles.row}>
            <span style={styles.labelCell}>Data:</span>
            <span style={styles.valueCell}>{formatReceiptDate(data.date)}</span>
          </div>

          {/* Time (if available) */}
          {data.time && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Horário:</span>
              <span style={styles.valueCell}>{formatReceiptTime(data.time)}</span>
            </div>
          )}

          {/* Category (if available) */}
          {data.category && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Categoria:</span>
              <span style={styles.valueCell}>{autoTranslate(data.category)}</span>
            </div>
          )}

          {/* Status */}
          {data.statusLabel && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Status:</span>
              <span style={{ ...styles.valueCell, ...getStatusStyle(data.status) }}>
                {data.statusLabel}
              </span>
            </div>
          )}

          {/* Account (if available) */}
          {data.accountName && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Conta:</span>
              <span style={styles.valueCell}>{data.accountName}</span>
            </div>
          )}

          {/* Card Name (for credit card types) */}
          {data.cardName && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Cartão:</span>
              <span style={styles.valueCell}>{data.cardName}</span>
            </div>
          )}

          {/* Transfer specific fields */}
          {data.originAccountName && data.destinyAccountName && (
            <>
              <div style={styles.row}>
                <span style={styles.labelCell}>Conta Origem:</span>
                <span style={styles.valueCell}>{data.originAccountName}</span>
              </div>
              <div style={styles.row}>
                <span style={styles.labelCell}>Conta Destino:</span>
                <span style={styles.valueCell}>{data.destinyAccountName}</span>
              </div>
            </>
          )}

          {/* Loan specific fields */}
          {data.benefitedName && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Beneficiado:</span>
              <span style={styles.valueCell}>{data.benefitedName}</span>
            </div>
          )}
          {data.creditorName && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Credor:</span>
              <span style={styles.valueCell}>{data.creditorName}</span>
            </div>
          )}

          {/* Installments (for credit card purchases) */}
          {data.totalInstallments && data.totalInstallments > 1 && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Parcelas:</span>
              <span style={styles.valueCell}>
                {data.installments || 0}/{data.totalInstallments}x de{' '}
                {formatReceiptCurrency(data.installmentValue || 0)}
              </span>
            </div>
          )}

          {/* Vault specific fields */}
          {data.vaultName && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Cofre:</span>
              <span style={styles.valueCell}>{data.vaultName}</span>
            </div>
          )}
          {data.balanceAfter !== undefined && (
            <div style={styles.row}>
              <span style={styles.labelCell}>Saldo Após:</span>
              <span style={styles.valueCell}>
                {formatReceiptCurrency(data.balanceAfter)}
              </span>
            </div>
          )}

          {/* Notes (if available) */}
          {data.notes && (
            <div style={styles.notes}>
              <span style={styles.notesLabel}>Observações:</span>
              <p style={styles.notesText}>{data.notes}</p>
            </div>
          )}

          {/* Extrato de Fatura (apenas para credit_card_bill com items) */}
          {data.type === 'credit_card_bill' &&
            data.statementItems &&
            data.statementItems.length > 0 && (
              <div style={styles.statementSection}>
                <div style={styles.statementTitle}>
                  Extrato ({data.totalItems} {data.totalItems === 1 ? 'item' : 'itens'}
                  ):
                </div>
                <div>
                  {data.statementItems.map((item, index) => (
                    <div key={index} style={styles.statementItem}>
                      <div style={styles.statementItemDesc}>
                        <span style={styles.itemDescText}>{item.description}</span>
                        {item.totalInstallments && item.totalInstallments > 1 && (
                          <span style={styles.installmentBadge}>
                            ({item.installmentNumber}/{item.totalInstallments})
                          </span>
                        )}
                        <span style={styles.statementCategory}>
                          {item.categoryLabel}
                        </span>
                      </div>
                      <div
                        style={{
                          ...styles.statementItemValue,
                          ...(item.payed
                            ? styles.itemValuePaid
                            : styles.itemValueDefault),
                        }}
                      >
                        {formatReceiptCurrency(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={styles.statementSummary}>
                  {data.totalPaidItems} de {data.totalItems} itens pagos
                </div>
              </div>
            )}
        </div>

        {/* Signature Section */}
        <div style={styles.signature}>
          <div style={styles.signatureLine}></div>
          <span style={styles.signatureName}>{data.memberName}</span>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerText}>
            Gerado em: {formatGeneratedAt(data.generatedAt)}
          </span>
        </div>
      </div>
    );
  }
);

ReceiptTemplate.displayName = 'ReceiptTemplate';
