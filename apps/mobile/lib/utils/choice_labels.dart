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

  static const payableStatuses = {
    'active': 'Ativo',
    'paid': 'Quitado',
    'overdue': 'Em atraso',
    'cancelled': 'Cancelado',
  };

  static const receivableStatuses = {
    'active': 'Ativo',
    'received': 'Recebido',
    'overdue': 'Em atraso',
    'cancelled': 'Cancelado',
  };

  static const loanStatuses = {
    'active': 'Ativo',
    'paid': 'Quitado',
    'overdue': 'Em atraso',
    'cancelled': 'Cancelado',
  };

  static const loanTypes = {
    'borrowed': 'Tomado',
    'lent': 'Concedido',
  };

  static const paymentFrequencies = {
    'daily': 'Diário',
    'weekly': 'Semanal',
    'monthly': 'Mensal',
    'quarterly': 'Trimestral',
    'semiannual': 'Semestral',
    'annual': 'Anual',
  };

  /// Subset of the backend `MEASUREMENT_UNIT_CHOICES` used for menu-option
  /// ingredients on mobile.
  static const measurementUnits = {
    'g': 'g',
    'kg': 'kg',
    'mg': 'mg',
    'ml': 'ml',
    'l': 'l',
    'unit': 'unidade',
    'slice': 'fatia',
    'portion': 'porção',
    'cup': 'xícara',
    'glass': 'copo',
    'tablespoon': 'colher de sopa',
    'teaspoon': 'colher de chá',
    'to_taste': 'a gosto',
  };

  static const memberSex = {
    'M': 'Masculino',
    'F': 'Feminino',
  };

  static const emotionalStates = {
    'loneliness': 'Solidão',
    'neediness': 'Carência',
    'anxiety': 'Ansiedade',
    'boredom': 'Tédio',
    'frustration': 'Frustração',
    'anger': 'Raiva',
    'other': 'Outro',
  };

  static const impulseTypes = {
    'pornography': 'Pornografia',
    'alcohol': 'Álcool',
    'social_media': 'Redes Sociais',
    'shopping': 'Compras',
    'procrastination': 'Procrastinação',
    'other': 'Outro',
  };

  static const wellnessCategories = {
    'self_esteem': 'Autoestima',
    'loneliness': 'Solidão',
    'neediness': 'Carência',
    'anxiety': 'Ansiedade',
    'emotional_dependency': 'Dependência Emocional',
  };

  static const goalCategories = {
    'savings': 'Poupança',
    'investment': 'Investimento',
    'emergency': 'Reserva de Emergência',
    'travel': 'Viagem',
    'education': 'Educação',
    'property': 'Imóvel',
    'vehicle': 'Veículo',
    'retirement': 'Aposentadoria',
    'health': 'Saúde',
    'reduce_expenses': 'Reduzir Despesas',
    'increase_revenue': 'Aumentar Receitas',
    'other': 'Outro',
  };

  static const vaultTransactionTypes = {
    'deposit': 'Depósito',
    'withdrawal': 'Saque',
    'yield': 'Rendimento',
  };

  static const storedCardFlags = {
    'MSC': 'Mastercard',
    'VSA': 'Visa',
    'ELO': 'Elo',
    'EXP': 'American Express',
    'HCD': 'Hipercard',
    'DIN': 'Diners Club',
    'OTHER': 'Outro',
  };

  static const storedAccountTypes = {
    'CC': 'Conta Corrente',
    'CS': 'Conta Salário',
    'CP': 'Conta Poupança',
    'CI': 'Conta Investimento',
    'OTHER': 'Outro',
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
