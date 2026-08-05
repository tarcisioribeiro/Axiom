/// Portuguese labels for backend `choices=` enums, transcribed from the
/// Django models (`accounts`, `expenses`, `revenues`, `credit_cards`,
/// `transfers`) so the UI can show the same labels as the web app without
/// a client-side translation framework (the mobile app has none — see
/// `documentation/mobile/README.md`).
class ChoiceLabels {
  const ChoiceLabels._();

  static const accountTypes = {
    'CC': 'Conta Corrente',
    'CS': 'Conta Salário',
    'FG': 'Fundo de Garantia',
    'VA': 'Vale Alimentação',
  };

  static const institutions = {
    'NUB': 'Nubank',
    'SIC': 'Sicoob',
    'MPG': 'Mercado Pago',
    'IFB': 'Ifood Benefícios',
    'CEF': 'Caixa Econômica Federal',
  };

  static const expenseCategories = {
    'food and drink': 'Comida e bebida',
    'bills and services': 'Contas e serviços',
    'electronics': 'Eletrônicos',
    'family and friends': 'Amizades e Família',
    'pets': 'Animais de estimação',
    'digital signs': 'Assinaturas digitais',
    'house': 'Casa',
    'purchases': 'Compras',
    'donate': 'Doações',
    'education': 'Educação',
    'loans': 'Empréstimos',
    'entertainment': 'Entretenimento',
    'taxes': 'Impostos',
    'investments': 'Investimentos',
    'others': 'Outros',
    'vestuary': 'Roupas',
    'health and care': 'Saúde e cuidados pessoais',
    'professional services': 'Serviços profissionais',
    'supermarket': 'Supermercado',
    'rates': 'Taxas',
    'transport': 'Transporte',
    'travels': 'Viagens',
  };

  static const revenueCategories = {
    'deposit': 'Depósito',
    'award': 'Prêmio',
    'salary': 'Salário',
    'ticket': 'Vale',
    'income': 'Rendimentos',
    'refund': 'Reembolso',
    'cashback': 'Cashback',
    'transfer': 'Transferência Recebida',
    'received_loan': 'Empréstimo Recebido',
    'loan_devolution': 'Devolução de empréstimo',
  };

  static const paymentMethods = {
    'cash': 'Dinheiro',
    'debit_card': 'Cartão de Débito',
    'credit_card': 'Cartão de Crédito',
    'pix': 'PIX',
    'transfer': 'Transferência',
    'check': 'Cheque',
    'other': 'Outro',
  };

  static const cardFlags = {
    'MSC': 'Mastercard',
    'VSA': 'Visa',
    'ELO': 'Elo',
    'EXP': 'American Express',
    'HCD': 'Hipercard',
  };

  static const billStatuses = {
    'open': 'Aberta',
    'closed': 'Fechada',
    'paid': 'Paga',
    'overdue': 'Em atraso',
  };

  static const transferCategories = {
    'doc': 'DOC',
    'ted': 'TED',
    'pix': 'PIX',
  };

  static const transferStatuses = {
    'pending': 'Pendente',
    'processing': 'Processando',
    'completed': 'Concluída',
    'failed': 'Falhou',
    'cancelled': 'Cancelada',
  };

  static const taskCategories = {
    'health': 'Saúde',
    'intellect': 'Intelecto',
    'spiritual': 'Espiritual',
    'exercise': 'Exercício',
    'nutrition': 'Nutrição',
    'work': 'Trabalho',
    'social': 'Social',
    'finance': 'Finanças',
    'household': 'Casa',
    'personal_care': 'Cuidado pessoal',
    'other': 'Outro',
  };

  static const taskPriorities = {
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'critical': 'Crítica',
  };

  static const periodicities = {
    'daily': 'Diária',
    'weekly': 'Semanal',
  };

  static const weekdays = {
    0: 'Segunda',
    1: 'Terça',
    2: 'Quarta',
    3: 'Quinta',
    4: 'Sexta',
    5: 'Sábado',
    6: 'Domingo',
  };

  static const taskInstanceStatuses = {
    'pending': 'Pendente',
    'in_progress': 'Em andamento',
    'completed': 'Concluída',
    'skipped': 'Pulada',
    'cancelled': 'Cancelada',
  };

  static const goalTypes = {
    'consecutive_days': 'Dias consecutivos',
    'total_days': 'Total de dias',
    'avoid_habit': 'Evitar hábito',
    'custom': 'Personalizada',
  };

  static const goalStatuses = {
    'active': 'Ativa',
    'completed': 'Concluída',
    'failed': 'Falhou',
    'cancelled': 'Cancelada',
  };

  static const passwordCategories = {
    'social': 'Social',
    'email': 'E-mail',
    'banking': 'Bancos',
    'work': 'Trabalho',
    'entertainment': 'Entretenimento',
    'shopping': 'Compras',
    'streaming': 'Streaming',
    'gaming': 'Jogos',
    'other': 'Outro',
  };

  static String of(Map<String, String> table, String? key) =>
      table[key] ?? key ?? '';
}
