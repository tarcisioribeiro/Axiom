export const VAULT_TRANSACTION_TYPES = [
  { value: 'deposit', label: 'Depósito' },
  { value: 'withdrawal', label: 'Saque' },
  { value: 'yield', label: 'Rendimento' },
] as const;

export const FINANCIAL_GOAL_CATEGORIES = [
  { value: 'savings', label: 'Poupança' },
  { value: 'investment', label: 'Investimento' },
  { value: 'emergency', label: 'Reserva de Emergência' },
  { value: 'travel', label: 'Viagem' },
  { value: 'education', label: 'Educação' },
  { value: 'property', label: 'Imóvel' },
  { value: 'vehicle', label: 'Veículo' },
  { value: 'retirement', label: 'Aposentadoria' },
  { value: 'health', label: 'Saúde' },
  { value: 'reduce_expenses', label: 'Reduzir Despesas' },
  { value: 'increase_revenue', label: 'Aumentar Receitas' },
  { value: 'other', label: 'Outro' },
] as const;
