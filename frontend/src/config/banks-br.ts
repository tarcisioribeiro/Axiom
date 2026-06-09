export interface BrazilianBank {
  name: string;
  shortName: string;
  code: string;
  type: 'bank' | 'fintech' | 'coop';
}

export const BRAZILIAN_BANKS: BrazilianBank[] = [
  {
    name: 'Banco do Brasil S.A.',
    shortName: 'Banco do Brasil',
    code: '001',
    type: 'bank',
  },
  { name: 'Banco Bradesco S.A.', shortName: 'Bradesco', code: '237', type: 'bank' },
  { name: 'Itaú Unibanco S.A.', shortName: 'Itaú', code: '341', type: 'bank' },
  { name: 'Caixa Econômica Federal', shortName: 'Caixa', code: '104', type: 'bank' },
  {
    name: 'Banco Santander (Brasil) S.A.',
    shortName: 'Santander',
    code: '033',
    type: 'bank',
  },
  { name: 'Nu Pagamentos S.A.', shortName: 'Nubank', code: '260', type: 'fintech' },
  { name: 'Inter S.A.', shortName: 'Inter', code: '077', type: 'fintech' },
  {
    name: 'Banco BTG Pactual S.A.',
    shortName: 'BTG Pactual',
    code: '208',
    type: 'bank',
  },
  { name: 'XP Investimentos S.A. CTVM', shortName: 'XP', code: '102', type: 'fintech' },
  { name: 'Banco Original S.A.', shortName: 'Original', code: '212', type: 'bank' },
  { name: 'C6 Bank S.A.', shortName: 'C6 Bank', code: '336', type: 'fintech' },
  { name: 'PicPay', shortName: 'PicPay', code: '380', type: 'fintech' },
  {
    name: 'Mercado Pago S.A.',
    shortName: 'Mercado Pago',
    code: '323',
    type: 'fintech',
  },
  {
    name: 'Next Tecnologia e Participações S.A.',
    shortName: 'Next',
    code: '090',
    type: 'fintech',
  },
  { name: 'Banco Neon S.A.', shortName: 'Neon', code: '735', type: 'fintech' },
  { name: 'Banco Safra S.A.', shortName: 'Safra', code: '422', type: 'bank' },
  { name: 'Banco Votorantim S.A.', shortName: 'BV', code: '655', type: 'bank' },
  { name: 'Banco Sicredi', shortName: 'Sicredi', code: '748', type: 'coop' },
  { name: 'Banco Sicoob', shortName: 'Sicoob', code: '756', type: 'coop' },
  { name: 'Banco Daycoval S.A.', shortName: 'Daycoval', code: '707', type: 'bank' },
  { name: 'Banco ABC Brasil S.A.', shortName: 'ABC Brasil', code: '246', type: 'bank' },
  { name: 'Banco Rendimento S.A.', shortName: 'Rendimento', code: '633', type: 'bank' },
  { name: 'Banco Sofisa S.A.', shortName: 'Sofisa', code: '637', type: 'bank' },
  { name: 'Banco Pan S.A.', shortName: 'Banco Pan', code: '623', type: 'bank' },
  { name: 'Banco BMG S.A.', shortName: 'BMG', code: '318', type: 'bank' },
  { name: 'Banco BS2 S.A.', shortName: 'BS2', code: '218', type: 'fintech' },
  { name: 'Stone Pagamentos S.A.', shortName: 'Stone', code: '197', type: 'fintech' },
  {
    name: 'Pagbank - PagSeguro Internet S.A.',
    shortName: 'PagBank',
    code: '290',
    type: 'fintech',
  },
  {
    name: 'Will Financeira S.A.',
    shortName: 'Will Bank',
    code: '280',
    type: 'fintech',
  },
  { name: 'Banco Totvs S.A.', shortName: 'Totvs', code: '278', type: 'fintech' },
  {
    name: 'Banco Industrial do Brasil S.A.',
    shortName: 'Industrial',
    code: '604',
    type: 'bank',
  },
  { name: 'Banco Fibra S.A.', shortName: 'Fibra', code: '224', type: 'bank' },
  {
    name: 'Cooperativa Central de Crédito AILOS',
    shortName: 'AILOS',
    code: '085',
    type: 'coop',
  },
  { name: 'Banco Modal S.A.', shortName: 'Modal', code: '746', type: 'bank' },
  { name: 'Banco Ourinvest S.A.', shortName: 'Ourinvest', code: '712', type: 'bank' },
  { name: 'Paraná Banco S.A.', shortName: 'Paraná Banco', code: '254', type: 'bank' },
  { name: 'Banco Indusval S.A.', shortName: 'Indusval', code: '653', type: 'bank' },
  {
    name: 'Banco Ribeirão Preto S.A.',
    shortName: 'Ribeirão Preto',
    code: '741',
    type: 'bank',
  },
  { name: 'Banco Rodobens S.A.', shortName: 'Rodobens', code: '120', type: 'bank' },
  {
    name: 'Agibank Financeira S.A.',
    shortName: 'Agibank',
    code: '172',
    type: 'fintech',
  },
];

export function searchBanks(query: string): BrazilianBank[] {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  return BRAZILIAN_BANKS.filter(
    (b) =>
      b.shortName.toLowerCase().includes(lower) ||
      b.name.toLowerCase().includes(lower) ||
      b.code.includes(query)
  ).slice(0, 8);
}
