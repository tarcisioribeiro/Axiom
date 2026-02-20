"""
Classificador de intencao para o assistente de IA.

Detecta o tipo de intencao do usuario usando similaridade semantica.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

try:
    from rapidfuzz import fuzz, process

    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False

from .text_preprocessor import TextPreprocessor


class IntentType(Enum):
    """Tipos de intencao do usuario."""

    QUERY_TOTAL = "query_total"  # Soma, total, quanto
    QUERY_AVERAGE = "query_average"  # Media
    QUERY_MAX = "query_max"  # Maior, maximo
    QUERY_MIN = "query_min"  # Menor, minimo
    QUERY_COUNT = "query_count"  # Quantidade, quantos
    QUERY_LIST = "query_list"  # Listar, mostrar
    QUERY_COMPARISON = "query_comparison"  # Comparar, diferenca
    QUERY_TREND = "query_trend"  # Evolucao, tendencia
    QUERY_GROUP = "query_group"  # Por categoria, agrupado
    QUERY_SEARCH = "query_search"  # Buscar especifico
    GREETING = "greeting"  # Saudacao
    HELP = "help"  # Ajuda
    UNKNOWN = "unknown"  # Nao identificado


@dataclass
class IntentResult:
    """Resultado da classificacao de intencao."""

    intent: IntentType
    confidence: float  # 0.0 a 1.0
    sub_intent: Optional[str] = None
    entities_hint: Optional[Dict[str, str]] = None


class IntentClassifier:
    """
    Classifica a intencao do usuario baseado em padroes e similaridade.

    Usa matching de padroes e fuzzy matching para identificar intencao.
    """

    # Padroes de intencao com palavras-chave e peso
    INTENT_PATTERNS: Dict[IntentType, List[Tuple[str, float]]] = {
        IntentType.QUERY_TOTAL: [
            ("quanto gastei", 1.0),
            ("quanto ganhei", 1.0),
            ("quanto paguei", 1.0),
            ("quanto recebi", 1.0),
            ("quanto foi", 0.9),
            ("quanto entrou", 0.9),
            ("quanto saiu", 0.9),
            ("qual o total", 1.0),
            ("qual foi o total", 1.0),
            ("total de", 0.9),
            ("soma de", 0.9),
            ("soma das", 0.9),
            ("somado", 0.8),
            ("somar", 0.8),
            ("no total", 0.8),
            ("ao todo", 0.8),
            ("tudo junto", 0.7),
            ("valor total", 0.9),
            ("montante", 0.8),
            ("faturamento", 0.8),
        ],
        IntentType.QUERY_AVERAGE: [
            ("qual a media", 1.0),
            ("media de", 0.9),
            ("em media", 0.9),
            ("valor medio", 0.9),
            ("gasto medio", 0.9),
            ("receita media", 0.9),
            ("quanto em media", 0.9),
            ("por dia", 0.7),
            ("por mes", 0.7),
            ("por semana", 0.7),
            ("diariamente", 0.6),
            ("mensalmente", 0.6),
        ],
        IntentType.QUERY_MAX: [
            ("maior", 0.9),
            ("maiores", 0.9),
            ("mais alto", 0.9),
            ("mais cara", 0.9),
            ("mais caro", 0.9),
            ("maximo", 0.9),
            ("maxima", 0.9),
            ("qual o maior", 1.0),
            ("qual a maior", 1.0),
            ("top", 0.7),
            ("recordes", 0.7),
            ("mais gastei", 0.9),
            ("mais recebi", 0.9),
            ("maior valor", 0.9),
            ("maior gasto", 0.9),
            ("maior receita", 0.9),
        ],
        IntentType.QUERY_MIN: [
            ("menor", 0.9),
            ("menores", 0.9),
            ("mais baixo", 0.9),
            ("mais barata", 0.9),
            ("mais barato", 0.9),
            ("minimo", 0.9),
            ("minima", 0.9),
            ("qual o menor", 1.0),
            ("qual a menor", 1.0),
            ("menos gastei", 0.9),
            ("menos recebi", 0.9),
            ("menor valor", 0.9),
            ("menor gasto", 0.9),
        ],
        IntentType.QUERY_COUNT: [
            ("quantos", 1.0),
            ("quantas", 1.0),
            ("quantidade", 0.9),
            ("numero de", 0.9),
            ("total de registros", 0.8),
            ("quantas vezes", 0.9),
            ("quantos registros", 0.9),
            ("quantas despesas", 1.0),
            ("quantas receitas", 1.0),
            ("quantos livros", 1.0),
            ("quantas tarefas", 1.0),
            ("quantos pagamentos", 1.0),
            ("quantas compras", 1.0),
            ("contagem", 0.8),
        ],
        IntentType.QUERY_LIST: [
            ("listar", 0.9),
            ("liste", 0.9),
            ("mostrar", 0.9),
            ("mostre", 0.9),
            ("exibir", 0.9),
            ("quais sao", 0.9),
            ("quais foram", 0.9),
            ("me mostra", 0.9),
            ("ver", 0.7),
            ("visualizar", 0.8),
            ("todas as", 0.7),
            ("todos os", 0.7),
            ("minhas", 0.6),
            ("meus", 0.6),
        ],
        IntentType.QUERY_COMPARISON: [
            ("comparar", 1.0),
            ("comparacao", 1.0),
            ("diferenca entre", 1.0),
            ("versus", 0.9),
            ("vs", 0.8),
            ("em relacao a", 0.9),
            ("comparado com", 0.9),
            ("mais que", 0.7),
            ("menos que", 0.7),
            ("cresceu", 0.8),
            ("diminuiu", 0.8),
            ("aumentou", 0.8),
            ("reduziu", 0.8),
            ("variacao", 0.8),
        ],
        IntentType.QUERY_TREND: [
            ("evolucao", 1.0),
            ("tendencia", 1.0),
            ("historico", 0.9),
            ("ao longo", 0.8),
            ("ultimos meses", 0.8),
            ("como foi", 0.7),
            ("como esta", 0.7),
            ("progresso", 0.8),
            ("desempenho", 0.8),
            ("comportamento", 0.7),
        ],
        IntentType.QUERY_GROUP: [
            ("por categoria", 1.0),
            ("por categorias", 1.0),
            ("categorizado", 0.9),
            ("categorizada", 0.9),
            ("agrupado por", 1.0),
            ("agrupada por", 1.0),
            ("dividido por", 0.9),
            ("separado por", 0.9),
            ("em cada categoria", 0.9),
            ("de cada categoria", 0.9),
            ("por tipo", 0.8),
            ("por tipos", 0.8),
        ],
        IntentType.QUERY_SEARCH: [
            ("qual a senha", 1.0),
            ("onde esta", 0.8),
            ("buscar", 0.8),
            ("encontrar", 0.8),
            ("procurar", 0.8),
            ("achar", 0.7),
            ("localizar", 0.8),
            ("especifico", 0.7),
            ("especifica", 0.7),
            ("de nome", 0.7),
            ("chamado", 0.7),
            ("chamada", 0.7),
        ],
        IntentType.GREETING: [
            ("ola", 1.0),
            ("oi", 1.0),
            ("bom dia", 1.0),
            ("boa tarde", 1.0),
            ("boa noite", 1.0),
            ("hey", 0.8),
            ("eae", 0.8),
            ("e ai", 0.8),
            ("fala", 0.7),
            ("salve", 0.7),
            ("tudo bem", 0.8),
            ("como vai", 0.8),
        ],
        IntentType.HELP: [
            ("ajuda", 1.0),
            ("ajudar", 1.0),
            ("help", 0.9),
            ("como funciona", 1.0),
            ("o que voce faz", 1.0),
            ("o que pode fazer", 1.0),
            ("quais funcoes", 0.9),
            ("comandos", 0.8),
            ("instrucoes", 0.8),
            ("tutorial", 0.8),
            ("como usar", 0.9),
            ("nao entendi", 0.7),
            ("nao sei", 0.6),
        ],
    }

    # Mapeamento de modulo baseado em palavras-chave
    MODULE_KEYWORDS: Dict[str, List[str]] = {
        "revenues": [
            "faturamento",
            "receita",
            "receitas",
            "ganho",
            "ganhos",
            "entrada",
            "entradas",
            "renda",
            "rendas",
            "salario",
            "salarios",
            "quanto ganhei",
            "quanto recebi",
            "rendimento",
            "rendimentos",
        ],
        "expenses": [
            "despesa",
            "despesas",
            "gasto",
            "gastos",
            "custo",
            "custos",
            "pagamento",
            "pagamentos",
            "compra",
            "compras",
            "quanto gastei",
            "quanto paguei",
            "alimentacao",
            "transporte",
        ],
        "accounts": [
            "saldo",
            "saldos",
            "conta bancaria",
            "conta corrente",
            "poupanca",
            "banco",
            "nubank",
            "itau",
            "bradesco",
            "quanto tenho",
            "dinheiro disponivel",
        ],
        "credit_cards": [
            "cartao",
            "cartoes",
            "cartao de credito",
            "fatura",
            "faturas",
            "limite",
            "credito",
            "visa",
            "mastercard",
            "elo",
        ],
        "loans": [
            "emprestimo",
            "emprestimos",
            "divida",
            "dividas",
            "devo",
            "devem",
            "emprestei",
            "financiamento",
        ],
        "library": [
            "livro",
            "livros",
            "leitura",
            "leituras",
            "biblioteca",
            "lendo",
            "li",
            "autor",
            "autores",
            "paginas",
        ],
        "personal_planning": [
            "tarefa",
            "tarefas",
            "objetivo",
            "objetivos",
            "meta",
            "metas",
            "rotina",
            "rotinas",
            "habito",
            "habitos",
            "pendente",
            "concluido",
        ],
        "security": [
            "senha",
            "senhas",
            "credencial",
            "credenciais",
            "login",
            "logins",
            "usuario",
            "password",
            "netflix",
            "spotify",
            "acesso",
        ],
        "vaults": [
            "cofre",
            "cofres",
            "reserva",
            "reservas",
            "guardado",
            "economizei",
            "investimento",
            "investimentos",
        ],
        "transfers": [
            "transferencia",
            "transferencias",
            "pix",
            "ted",
            "doc",
            "transferi",
            "enviei",
            "movimentacao",
        ],
    }

    @classmethod
    def classify(cls, text: str) -> IntentResult:
        """
        Classifica a intencao do usuario.

        Args:
            text: Pergunta do usuario

        Returns:
            IntentResult com intencao, confianca e hints
        """
        # Pre-processa o texto
        preprocessed = TextPreprocessor.preprocess(text)
        normalized = TextPreprocessor.normalize_for_comparison(text)

        # Tenta matching exato primeiro
        intent, confidence = cls._match_patterns(preprocessed)

        # Se confianca baixa, tenta fuzzy matching
        if confidence < 0.6 and RAPIDFUZZ_AVAILABLE:
            fuzzy_intent, fuzzy_confidence = cls._fuzzy_match(normalized)
            if fuzzy_confidence > confidence:
                intent = fuzzy_intent
                confidence = fuzzy_confidence

        # Detecta modulo como hint
        module_hint = cls._detect_module(preprocessed)

        return IntentResult(
            intent=intent,
            confidence=confidence,
            entities_hint={"module": module_hint} if module_hint else None,
        )

    @classmethod
    def _match_patterns(cls, text: str) -> Tuple[IntentType, float]:
        """
        Faz matching de padroes contra o texto.

        Returns:
            Tupla (IntentType, confianca)
        """
        best_intent = IntentType.UNKNOWN
        best_score = 0.0

        text_lower = text.lower()

        for intent, patterns in cls.INTENT_PATTERNS.items():
            for pattern, weight in patterns:
                if pattern in text_lower:
                    # Calcula score baseado no peso e tamanho do match
                    match_ratio = len(pattern) / len(text_lower) if text_lower else 0
                    score = weight * (0.5 + 0.5 * min(match_ratio * 3, 1.0))

                    if score > best_score:
                        best_score = score
                        best_intent = intent

        return best_intent, min(best_score, 1.0)

    @classmethod
    def _fuzzy_match(cls, text: str) -> Tuple[IntentType, float]:
        """
        Faz matching fuzzy usando rapidfuzz.

        Returns:
            Tupla (IntentType, confianca)
        """
        if not RAPIDFUZZ_AVAILABLE:
            return IntentType.UNKNOWN, 0.0

        best_intent = IntentType.UNKNOWN
        best_score = 0.0

        # Coleta todos os padroes
        all_patterns = []
        pattern_to_intent = {}

        for intent, patterns in cls.INTENT_PATTERNS.items():
            for pattern, weight in patterns:
                all_patterns.append(pattern)
                pattern_to_intent[pattern] = (intent, weight)

        # Faz matching fuzzy
        matches = process.extract(
            text, all_patterns, scorer=fuzz.partial_ratio, limit=5
        )

        for match_text, score, _ in matches:
            if match_text in pattern_to_intent:
                intent, weight = pattern_to_intent[match_text]
                # Normaliza score (0-100 para 0-1) e aplica peso
                normalized_score = (score / 100) * weight

                if normalized_score > best_score:
                    best_score = normalized_score
                    best_intent = intent

        return best_intent, best_score

    @classmethod
    def _detect_module(cls, text: str) -> Optional[str]:
        """
        Detecta o modulo mais provavel baseado em palavras-chave.

        Returns:
            Nome do modulo ou None
        """
        text_lower = text.lower()
        scores: Dict[str, int] = {}

        for module, keywords in cls.MODULE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scores[module] = score

        if not scores:
            return None

        return max(scores, key=lambda k: scores[k])

    @classmethod
    def get_intent_description(cls, intent: IntentType) -> str:
        """Retorna descricao legivel da intencao."""
        descriptions = {
            IntentType.QUERY_TOTAL: "Consulta de total/soma",
            IntentType.QUERY_AVERAGE: "Consulta de media",
            IntentType.QUERY_MAX: "Consulta de valor maximo",
            IntentType.QUERY_MIN: "Consulta de valor minimo",
            IntentType.QUERY_COUNT: "Consulta de quantidade",
            IntentType.QUERY_LIST: "Listagem de registros",
            IntentType.QUERY_COMPARISON: "Comparacao de valores",
            IntentType.QUERY_TREND: "Analise de tendencia",
            IntentType.QUERY_GROUP: "Agrupamento por categoria",
            IntentType.QUERY_SEARCH: "Busca especifica",
            IntentType.GREETING: "Saudacao",
            IntentType.HELP: "Pedido de ajuda",
            IntentType.UNKNOWN: "Intencao nao identificada",
        }
        return descriptions.get(intent, "Desconhecido")

    @classmethod
    def intent_to_aggregation(cls, intent: IntentType) -> str:
        """
        Converte intencao para tipo de agregacao usado no QueryInterpreter.

        Returns:
            String de agregacao
            ('sum', 'avg', 'max', 'min', 'count', 'list', 'group_by_category')
        """
        mapping = {
            IntentType.QUERY_TOTAL: "sum",
            IntentType.QUERY_AVERAGE: "avg",
            IntentType.QUERY_MAX: "max",
            IntentType.QUERY_MIN: "min",
            IntentType.QUERY_COUNT: "count",
            IntentType.QUERY_LIST: "list",
            IntentType.QUERY_GROUP: "group_by_category",
            IntentType.QUERY_COMPARISON: "list",
            IntentType.QUERY_TREND: "list",
            IntentType.QUERY_SEARCH: "list",
        }
        return mapping.get(intent, "list")
