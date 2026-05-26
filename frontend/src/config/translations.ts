/* eslint-disable max-lines */
import i18next from 'i18next';

// Translations - English (API) to Portuguese (UI)
export const TRANSLATIONS = {
  // Account Types
  accountTypes: {
    CC: 'Conta Corrente',
    CS: 'Conta Salário',
    FG: 'Fundo de Garantia',
    VA: 'Vale Alimentação',
    VR: 'Vale Refeição',
    CP: 'Conta Poupança',
  },

  // Institutions
  institutions: {
    NUB: 'Nubank',
    SIC: 'Sicoob',
    MPG: 'Mercado Pago',
    IFB: 'Ifood Benefícios',
    CEF: 'Caixa Econômica Federal',
    BB: 'Banco do Brasil',
    SAN: 'Santander',
    ITA: 'Itaú',
    BRA: 'Bradesco',
    INT: 'Inter',
    C6B: 'C6 Bank',
    PIC: 'PicPay',
  },

  // Expense Categories
  expenseCategories: {
    'food and drink': 'Comida e Bebida',
    food: 'Alimentação',
    'bills and services': 'Contas e Serviços',
    electronics: 'Eletrônicos',
    'family and friends': 'Amizades e Família',
    pets: 'Animais de Estimação',
    'digital signs': 'Assinaturas Digitais',
    subscriptions: 'Assinaturas',
    house: 'Casa',
    home: 'Casa',
    housing: 'Moradia',
    purchases: 'Compras',
    shopping: 'Compras',
    donate: 'Doações',
    donation: 'Doações',
    education: 'Educação',
    loans: 'Empréstimos',
    entertainment: 'Entretenimento',
    leisure: 'Lazer',
    taxes: 'Impostos',
    investments: 'Investimentos',
    others: 'Outros',
    other: 'Outro',
    vestuary: 'Roupas',
    clothing: 'Roupas',
    'health and care': 'Saúde e Cuidados Pessoais',
    health: 'Saúde',
    healthcare: 'Saúde',
    'professional services': 'Serviços Profissionais',
    services: 'Serviços',
    supermarket: 'Supermercado',
    groceries: 'Supermercado',
    rates: 'Taxas',
    fees: 'Taxas',
    transport: 'Transporte',
    transportation: 'Transporte',
    travels: 'Viagens',
    travel: 'Viagens',
    utilities: 'Utilidades',
    insurance: 'Seguros',
    personal: 'Pessoal',
    beauty: 'Beleza',
    fitness: 'Fitness',
    gym: 'Academia',
    restaurant: 'Restaurante',
    restaurants: 'Restaurantes',
    cafe: 'Café',
    delivery: 'Delivery',
    rent: 'Aluguel',
    fuel: 'Combustível',
    parking: 'Estacionamento',
    maintenance: 'Manutenção',
    repairs: 'Reparos',
    gifts: 'Presentes',
    charity: 'Caridade',
    kids: 'Crianças',
    baby: 'Bebê',
    pharmacy: 'Farmácia',
    medical: 'Médico',
    dental: 'Dentista',
    vision: 'Oftalmologia',
    streaming: 'Streaming',
    games: 'Jogos',
    books: 'Livros',
    hobbies: 'Hobbies',
    sports: 'Esportes',
    vacation: 'Férias',
    flight: 'Passagem Aérea',
    hotel: 'Hotel',
    accommodation: 'Hospedagem',
    fatura_cartao: 'Fatura de Cartão',
  },

  // Revenue Categories
  revenueCategories: {
    deposit: 'Depósito',
    award: 'Prêmio',
    salary: 'Salário',
    ticket: 'Vale',
    income: 'Rendimentos',
    refund: 'Reembolso',
    cashback: 'Cashback',
    transfer: 'Transferência Recebida',
    received_loan: 'Empréstimo Recebido',
    loan_devolution: 'Devolução de Empréstimo',
  },

  // Card Brands
  cardBrands: {
    MSC: 'Master Card',
    VSA: 'Visa',
    ELO: 'Elo',
    EXP: 'American Express',
    HCD: 'Hipercard',
    DIN: 'Diners Club',
  },

  // Transfer Types
  transferTypes: {
    doc: 'DOC',
    ted: 'TED',
    pix: 'PIX',
    internal: 'Transferência Interna',
  },

  // Payment Status
  paymentStatus: {
    pending: 'Pendente',
    paid: 'Pago',
    overdue: 'Atrasado',
    cancelled: 'Cancelado',
    scheduled: 'Agendado',
    processing: 'Processando',
  },

  // Loan Status
  loanStatus: {
    active: 'Ativo',
    paid: 'Pago',
    overdue: 'Atrasado',
    cancelled: 'Cancelado',
    pending: 'Pendente',
  },

  // Payable Status
  payableStatus: {
    active: 'Ativo',
    paid: 'Quitado',
    overdue: 'Em Atraso',
    cancelled: 'Cancelado',
  },

  // Member Types
  memberTypes: {
    user: 'Usuário',
    creditor: 'Credor',
    beneficiary: 'Beneficiário',
    both: 'Ambos',
    other: 'Outro',
  },

  // Bill Status
  billStatus: {
    open: 'Aberta',
    closed: 'Fechada',
    paid: 'Paga',
    overdue: 'Em Atraso',
  },

  // Months
  months: {
    Jan: 'Janeiro',
    Feb: 'Fevereiro',
    Mar: 'Março',
    Apr: 'Abril',
    May: 'Maio',
    Jun: 'Junho',
    Jul: 'Julho',
    Aug: 'Agosto',
    Sep: 'Setembro',
    Oct: 'Outubro',
    Nov: 'Novembro',
    Dec: 'Dezembro',
  },

  // Payment Frequency
  paymentFrequency: {
    daily: 'Diário',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
    bimonthly: 'Bimestral',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual',
    once: 'Uma vez',
    yearly: 'Anual',
  },

  // Password Categories (Security Module)
  passwordCategories: {
    social: 'Redes Sociais',
    email: 'E-mail',
    banking: 'Banco',
    bank: 'Banco',
    shopping: 'Compras',
    streaming: 'Streaming',
    gaming: 'Jogos',
    work: 'Trabalho',
    education: 'Educação',
    government: 'Governo',
    healthcare: 'Saúde',
    health: 'Saúde',
    utilities: 'Utilidades',
    entertainment: 'Entretenimento',
    finance: 'Finanças',
    financial: 'Financeiro',
    travel: 'Viagens',
    food: 'Alimentação',
    communication: 'Comunicação',
    productivity: 'Produtividade',
    development: 'Desenvolvimento',
    cloud: 'Nuvem',
    security: 'Segurança',
    crypto: 'Criptomoedas',
    cryptocurrency: 'Criptomoedas',
    investment: 'Investimentos',
    insurance: 'Seguros',
    personal: 'Pessoal',
    family: 'Família',
    other: 'Outro',
    others: 'Outros',
  },

  // Password Strength
  passwordStrength: {
    weak: 'Fraca',
    medium: 'Média',
    strong: 'Forte',
    very_strong: 'Muito Forte',
  },

  // Book Genres (Library Module)
  bookGenres: {
    fiction: 'Ficção',
    non_fiction: 'Não-Ficção',
    nonfiction: 'Não-Ficção',
    fantasy: 'Fantasia',
    science_fiction: 'Ficção Científica',
    scifi: 'Ficção Científica',
    mystery: 'Mistério',
    thriller: 'Suspense',
    romance: 'Romance',
    horror: 'Terror',
    biography: 'Biografia',
    autobiography: 'Autobiografia',
    history: 'História',
    self_help: 'Autoajuda',
    selfhelp: 'Autoajuda',
    business: 'Negócios',
    psychology: 'Psicologia',
    philosophy: 'Filosofia',
    religion: 'Religião',
    spirituality: 'Espiritualidade',
    science: 'Ciência',
    technology: 'Tecnologia',
    programming: 'Programação',
    art: 'Arte',
    poetry: 'Poesia',
    drama: 'Drama',
    comedy: 'Comédia',
    adventure: 'Aventura',
    children: 'Infantil',
    young_adult: 'Jovem Adulto',
    education: 'Educação',
    cooking: 'Culinária',
    travel: 'Viagens',
    health: 'Saúde',
    fitness: 'Fitness',
    sports: 'Esportes',
    music: 'Música',
    graphic_novel: 'Graphic Novel',
    manga: 'Mangá',
    comics: 'Quadrinhos',
    classic: 'Clássico',
    contemporary: 'Contemporâneo',
    literary: 'Literário',
    dystopian: 'Distopia',
    paranormal: 'Paranormal',
    crime: 'Crime',
    detective: 'Detetive',
    political: 'Político',
    economics: 'Economia',
    sociology: 'Sociologia',
    anthropology: 'Antropologia',
    other: 'Outro',
    others: 'Outros',
  },

  // Book Media Types
  bookMediaTypes: {
    physical: 'Físico',
    ebook: 'E-book',
    audiobook: 'Audiolivro',
    pdf: 'PDF',
    kindle: 'Kindle',
  },

  // Book Languages
  bookLanguages: {
    portuguese: 'Português',
    english: 'Inglês',
    spanish: 'Espanhol',
    french: 'Francês',
    german: 'Alemão',
    italian: 'Italiano',
    japanese: 'Japonês',
    chinese: 'Chinês',
    korean: 'Coreano',
    russian: 'Russo',
    arabic: 'Árabe',
    other: 'Outro',
  },

  // Reading Status
  readingStatus: {
    to_read: 'Para Ler',
    reading: 'Lendo',
    read: 'Lido',
    abandoned: 'Abandonado',
    on_hold: 'Em Pausa',
  },

  // Task Categories (Planning Module)
  taskCategories: {
    health: 'Saúde',
    studies: 'Estudos',
    spiritual: 'Espiritual',
    exercise: 'Exercício',
    nutrition: 'Nutrição',
    meditation: 'Meditação',
    reading: 'Leitura',
    writing: 'Escrita',
    work: 'Trabalho',
    leisure: 'Lazer',
    family: 'Família',
    social: 'Social',
    finance: 'Finanças',
    household: 'Casa',
    personal_care: 'Cuidados Pessoais',
    creativity: 'Criatividade',
    learning: 'Aprendizado',
    career: 'Carreira',
    relationships: 'Relacionamentos',
    mindfulness: 'Mindfulness',
    sleep: 'Sono',
    hydration: 'Hidratação',
    gratitude: 'Gratidão',
    journaling: 'Diário',
    planning: 'Planejamento',
    review: 'Revisão',
    other: 'Outro',
    others: 'Outros',
  },

  // Mood Types
  moodTypes: {
    excellent: 'Excelente',
    good: 'Bom',
    neutral: 'Neutro',
    bad: 'Ruim',
    terrible: 'Péssimo',
  },

  // Entity Types (for AI responses)
  entityTypes: {
    expense: 'Despesa',
    expenses: 'Despesas',
    revenue: 'Receita',
    revenues: 'Receitas',
    account: 'Conta',
    accounts: 'Contas',
    transfer: 'Transferência',
    transfers: 'Transferências',
    credit_card: 'Cartão de Crédito',
    credit_cards: 'Cartões de Crédito',
    loan: 'Empréstimo',
    loans: 'Empréstimos',
    password: 'Senha',
    passwords: 'Senhas',
    book: 'Livro',
    books: 'Livros',
    reading: 'Leitura',
    readings: 'Leituras',
    author: 'Autor',
    authors: 'Autores',
    publisher: 'Editora',
    publishers: 'Editoras',
    task: 'Tarefa',
    tasks: 'Tarefas',
    goal: 'Objetivo',
    goals: 'Objetivos',
    reflection: 'Reflexão',
    reflections: 'Reflexões',
  },

  // Notification Types
  notificationTypes: {
    task_today: 'Tarefa do Dia',
    task_overdue: 'Tarefa Atrasada',
    payable_due_soon: 'Vencimento Próximo',
    payable_overdue: 'Pagamento Atrasado',
    loan_due_soon: 'Empréstimo Vencendo',
    loan_overdue: 'Empréstimo Atrasado',
    bill_due_soon: 'Fatura Vencendo',
    bill_overdue: 'Fatura Atrasada',
    budget_warning: 'Alerta de Orçamento',
    budget_exceeded: 'Orçamento Estourado',
    financial_goal_reached: 'Meta Financeira Atingida',
    financial_goal_approaching: 'Meta Financeira Próxima do Prazo',
  },

  // Common Terms
  commonTerms: {
    total: 'Total',
    average: 'Média',
    minimum: 'Mínimo',
    maximum: 'Máximo',
    count: 'Quantidade',
    sum: 'Soma',
    balance: 'Saldo',
    income: 'Receita',
    outcome: 'Despesa',
    profit: 'Lucro',
    loss: 'Prejuízo',
    category: 'Categoria',
    type: 'Tipo',
    status: 'Status',
    date: 'Data',
    description: 'Descrição',
    value: 'Valor',
    amount: 'Quantia',
    name: 'Nome',
    title: 'Título',
    month: 'Mês',
    year: 'Ano',
    day: 'Dia',
    week: 'Semana',
    today: 'Hoje',
    yesterday: 'Ontem',
    tomorrow: 'Amanhã',
    current: 'Atual',
    previous: 'Anterior',
    next: 'Próximo',
  },

  // Categorization Rules
  categorizationRules: {
    autoCategorized: 'Auto',
    merchantContains: 'Estabelecimento contém',
    applyRules: 'Aplicar Regras',
    rulesApplied: 'regras aplicadas',
    noRulesFound: 'Nenhuma regra encontrada',
    newRule: 'Nova Regra',
    editRule: 'Editar Regra',
    ruleActive: 'Ativa',
    ruleInactive: 'Inativa',
  },
};

// Reverse translations - Portuguese to English
export const REVERSE_TRANSLATIONS = {
  accountTypes: Object.fromEntries(
    Object.entries(TRANSLATIONS.accountTypes).map(([k, v]) => [v, k])
  ),
  institutions: Object.fromEntries(
    Object.entries(TRANSLATIONS.institutions).map(([k, v]) => [v, k])
  ),
  expenseCategories: Object.fromEntries(
    Object.entries(TRANSLATIONS.expenseCategories).map(([k, v]) => [v, k])
  ),
  revenueCategories: Object.fromEntries(
    Object.entries(TRANSLATIONS.revenueCategories).map(([k, v]) => [v, k])
  ),
  cardBrands: Object.fromEntries(
    Object.entries(TRANSLATIONS.cardBrands).map(([k, v]) => [v, k])
  ),
  transferTypes: Object.fromEntries(
    Object.entries(TRANSLATIONS.transferTypes).map(([k, v]) => [v, k])
  ),
  paymentStatus: Object.fromEntries(
    Object.entries(TRANSLATIONS.paymentStatus).map(([k, v]) => [v, k])
  ),
  loanStatus: Object.fromEntries(
    Object.entries(TRANSLATIONS.loanStatus).map(([k, v]) => [v, k])
  ),
  payableStatus: Object.fromEntries(
    Object.entries(TRANSLATIONS.payableStatus).map(([k, v]) => [v, k])
  ),
  memberTypes: Object.fromEntries(
    Object.entries(TRANSLATIONS.memberTypes).map(([k, v]) => [v, k])
  ),
  billStatus: Object.fromEntries(
    Object.entries(TRANSLATIONS.billStatus).map(([k, v]) => [v, k])
  ),
  months: Object.fromEntries(
    Object.entries(TRANSLATIONS.months).map(([k, v]) => [v, k])
  ),
  paymentFrequency: Object.fromEntries(
    Object.entries(TRANSLATIONS.paymentFrequency).map(([k, v]) => [v, k])
  ),
  passwordCategories: Object.fromEntries(
    Object.entries(TRANSLATIONS.passwordCategories).map(([k, v]) => [v, k])
  ),
  passwordStrength: Object.fromEntries(
    Object.entries(TRANSLATIONS.passwordStrength).map(([k, v]) => [v, k])
  ),
  bookGenres: Object.fromEntries(
    Object.entries(TRANSLATIONS.bookGenres).map(([k, v]) => [v, k])
  ),
  bookMediaTypes: Object.fromEntries(
    Object.entries(TRANSLATIONS.bookMediaTypes).map(([k, v]) => [v, k])
  ),
  bookLanguages: Object.fromEntries(
    Object.entries(TRANSLATIONS.bookLanguages).map(([k, v]) => [v, k])
  ),
  readingStatus: Object.fromEntries(
    Object.entries(TRANSLATIONS.readingStatus).map(([k, v]) => [v, k])
  ),
  taskCategories: Object.fromEntries(
    Object.entries(TRANSLATIONS.taskCategories).map(([k, v]) => [v, k])
  ),
  moodTypes: Object.fromEntries(
    Object.entries(TRANSLATIONS.moodTypes).map(([k, v]) => [v, k])
  ),
  entityTypes: Object.fromEntries(
    Object.entries(TRANSLATIONS.entityTypes).map(([k, v]) => [v, k])
  ),
  notificationTypes: Object.fromEntries(
    Object.entries(TRANSLATIONS.notificationTypes).map(([k, v]) => [v, k])
  ),
  commonTerms: Object.fromEntries(
    Object.entries(TRANSLATIONS.commonTerms).map(([k, v]) => [v, k])
  ),
};

// English display labels (for en-US locale)
export const TRANSLATIONS_EN = {
  accountTypes: {
    CC: 'Checking Account',
    CS: 'Salary Account',
    FG: 'Severance Fund',
    VA: 'Meal Voucher',
    VR: 'Food Voucher',
    CP: 'Savings Account',
  },

  months: {
    Jan: 'January',
    Feb: 'February',
    Mar: 'March',
    Apr: 'April',
    May: 'May',
    Jun: 'June',
    Jul: 'July',
    Aug: 'August',
    Sep: 'September',
    Oct: 'October',
    Nov: 'November',
    Dec: 'December',
  },

  billStatus: {
    open: 'Open',
    closed: 'Closed',
    paid: 'Paid',
    overdue: 'Overdue',
  },

  passwordCategories: {
    social: 'Social Networks',
    email: 'E-mail',
    banking: 'Banking',
    bank: 'Banking',
    shopping: 'Shopping',
    streaming: 'Streaming',
    gaming: 'Gaming',
    work: 'Work',
    education: 'Education',
    government: 'Government',
    healthcare: 'Healthcare',
    health: 'Health',
    utilities: 'Utilities',
    entertainment: 'Entertainment',
    finance: 'Finance',
    financial: 'Financial',
    travel: 'Travel',
    food: 'Food',
    communication: 'Communication',
    productivity: 'Productivity',
    development: 'Development',
    cloud: 'Cloud',
    security: 'Security',
    crypto: 'Crypto',
    cryptocurrency: 'Cryptocurrency',
    investment: 'Investments',
    insurance: 'Insurance',
    personal: 'Personal',
    family: 'Family',
    other: 'Other',
    others: 'Others',
  },

  passwordStrength: {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
    very_strong: 'Very Strong',
  },
  institutions: {
    NUB: 'Nubank',
    SIC: 'Sicoob',
    MPG: 'Mercado Pago',
    IFB: 'Ifood Benefícios',
    CEF: 'Caixa Econômica Federal',
    BB: 'Banco do Brasil',
    SAN: 'Santander',
    ITA: 'Itaú',
    BRA: 'Bradesco',
    INT: 'Inter',
    C6B: 'C6 Bank',
    PIC: 'PicPay',
  },
  payableStatus: {
    active: 'Active',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
  },
  expenseCategories: {
    'food and drink': 'Food and Drink',
    food: 'Food',
    'bills and services': 'Bills and Services',
    electronics: 'Electronics',
    'family and friends': 'Family and Friends',
    pets: 'Pets',
    'digital signs': 'Digital Subscriptions',
    subscriptions: 'Subscriptions',
    house: 'Home',
    home: 'Home',
    housing: 'Housing',
    purchases: 'Purchases',
    shopping: 'Shopping',
    donate: 'Donations',
    donation: 'Donation',
    education: 'Education',
    loans: 'Loans',
    entertainment: 'Entertainment',
    leisure: 'Leisure',
    taxes: 'Taxes',
    investments: 'Investments',
    others: 'Others',
    other: 'Other',
    vestuary: 'Clothing',
    clothing: 'Clothing',
    'health and care': 'Health and Personal Care',
    health: 'Health',
    healthcare: 'Healthcare',
    'professional services': 'Professional Services',
    services: 'Services',
    supermarket: 'Supermarket',
    groceries: 'Groceries',
    rates: 'Fees',
    fees: 'Fees',
    transport: 'Transport',
    transportation: 'Transport',
    travels: 'Travel',
    travel: 'Travel',
    utilities: 'Utilities',
    insurance: 'Insurance',
    personal: 'Personal',
    beauty: 'Beauty',
    fitness: 'Fitness',
    gym: 'Gym',
    restaurant: 'Restaurant',
    restaurants: 'Restaurants',
    cafe: 'Café',
    delivery: 'Delivery',
    rent: 'Rent',
    fuel: 'Fuel',
    parking: 'Parking',
    maintenance: 'Maintenance',
    repairs: 'Repairs',
    gifts: 'Gifts',
    charity: 'Charity',
    kids: 'Kids',
    baby: 'Baby',
    pharmacy: 'Pharmacy',
    medical: 'Medical',
    dental: 'Dental',
    vision: 'Vision',
    streaming: 'Streaming',
    games: 'Games',
    books: 'Books',
    hobbies: 'Hobbies',
    sports: 'Sports',
    vacation: 'Vacation',
    flight: 'Flight',
    hotel: 'Hotel',
    accommodation: 'Accommodation',
    fatura_cartao: 'Credit Card Bill',
  },
  revenueCategories: {
    deposit: 'Deposit',
    award: 'Award',
    salary: 'Salary',
    ticket: 'Voucher',
    income: 'Income',
    refund: 'Refund',
    cashback: 'Cashback',
    transfer: 'Transfer Received',
    received_loan: 'Loan Received',
    loan_devolution: 'Loan Repayment',
  },
  taskCategories: {
    health: 'Health',
    intellect: 'Intellect',
    studies: 'Studies',
    spiritual: 'Spiritual',
    exercise: 'Exercise',
    nutrition: 'Nutrition',
    meditation: 'Meditation',
    reading: 'Reading',
    writing: 'Writing',
    work: 'Work',
    leisure: 'Leisure',
    family: 'Family',
    social: 'Social',
    finance: 'Finance',
    household: 'Household',
    personal_care: 'Personal Care',
    creativity: 'Creativity',
    learning: 'Learning',
    career: 'Career',
    relationships: 'Relationships',
    mindfulness: 'Mindfulness',
    sleep: 'Sleep',
    hydration: 'Hydration',
    gratitude: 'Gratitude',
    journaling: 'Journaling',
    planning: 'Planning',
    review: 'Review',
    other: 'Other',
    others: 'Others',
  },
};

// Helper function to translate
export const translate = (category: keyof typeof TRANSLATIONS, key: string): string => {
  if (i18next.language === 'en-US' && category in TRANSLATIONS_EN) {
    const enSection = TRANSLATIONS_EN[category as keyof typeof TRANSLATIONS_EN];
    const found = (enSection as Record<string, string>)[key];
    if (found) return found;
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
  }
  return (
    TRANSLATIONS[category][key as keyof (typeof TRANSLATIONS)[typeof category]] || key
  );
};

// Helper function to reverse translate
export const reverseTranslate = (
  category: keyof typeof REVERSE_TRANSLATIONS,
  value: string
): string => {
  return (
    REVERSE_TRANSLATIONS[category][
      value as keyof (typeof REVERSE_TRANSLATIONS)[typeof category]
    ] || value
  );
};

/**
 * Tradução automática - procura em todas as seções
 * Útil quando não se sabe de qual categoria vem o termo
 *
 * @param key - Termo em inglês a ser traduzido
 * @returns Termo traduzido em português ou o termo original se não encontrado
 *
 * @example
 * autoTranslate('entertainment') // "Entretenimento"
 * autoTranslate('supermarket') // "Supermercado"
 * autoTranslate('salary') // "Salário"
 */
export const autoTranslate = (key: string): string => {
  if (!key) return key;

  const normalizedKey = key.toLowerCase().trim();
  const isEnglish = i18next.language === 'en-US';
  const primaryMap = isEnglish ? TRANSLATIONS_EN : TRANSLATIONS;

  for (const section of Object.values(primaryMap)) {
    const found = (section as Record<string, string>)[normalizedKey];
    if (found) return found;
  }

  const withSpaces = normalizedKey.replace(/_/g, ' ');
  for (const section of Object.values(primaryMap)) {
    const found = (section as Record<string, string>)[withSpaces];
    if (found) return found;
  }

  if (!isEnglish) {
    for (const section of Object.values(TRANSLATIONS)) {
      const found = (section as Record<string, string>)[normalizedKey];
      if (found) return found;
    }
    const withSpacesFallback = normalizedKey.replace(/_/g, ' ');
    for (const section of Object.values(TRANSLATIONS)) {
      const found = (section as Record<string, string>)[withSpacesFallback];
      if (found) return found;
    }
  }

  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
};

/**
 * Traduz um texto completo, substituindo termos em inglês por português
 * Útil para traduzir respostas do AI que contenham termos técnicos
 *
 * @param text - Texto a ser traduzido
 * @returns Texto com termos traduzidos
 *
 * @example
 * translateText("Your expenses in entertainment were high")
 * // "Your expenses in Entretenimento were high"
 */
export const translateText = (text: string): string => {
  if (!text) return text;

  let translatedText = text;

  // Coleta todos os termos para tradução
  const allTerms: [string, string][] = [];
  for (const section of Object.values(TRANSLATIONS)) {
    for (const [key, value] of Object.entries(section as Record<string, string>)) {
      allTerms.push([key, value]);
    }
  }

  // Ordena por tamanho (maior primeiro) para evitar substituições parciais
  allTerms.sort((a, b) => b[0].length - a[0].length);

  // Substitui os termos
  for (const [englishTerm, portugueseTerm] of allTerms) {
    // Cria regex case-insensitive para substituir
    const regex = new RegExp(
      `\\b${englishTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'gi'
    );
    translatedText = translatedText.replace(regex, portugueseTerm);
  }

  return translatedText;
};
