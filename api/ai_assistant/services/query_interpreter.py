"""
Interpretador de perguntas em linguagem natural para SQL.

Usa regras baseadas em palavras-chave para identificar modulos e gerar queries.
Integrado com camadas de inteligencia para melhor interpretacao.
"""

import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from django.utils import timezone

from .question_processor import QuestionProcessor

logger = logging.getLogger(__name__)


@dataclass
class QueryResult:
    """Resultado da interpretacao de uma pergunta."""

    module: str
    sql: str
    params: Tuple
    display_type: str  # 'text', 'table', 'list', 'currency', 'password'
    description: str
    requires_decryption: bool = False
    decryption_fields: Optional[List[str]] = None
    # Novos campos para rastreabilidade
    confidence: float = 1.0
    detected_intent: str = ""
    processing_metadata: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.decryption_fields is None:
            self.decryption_fields = []
        if self.processing_metadata is None:
            self.processing_metadata = {}


class QueryInterpreter:
    """
    Interpreta perguntas em portugues e gera SQL correspondente.

    Integrado com camadas de inteligencia:
    - TextPreprocessor: Normalizacao de texto
    - IntentClassifier: Classificacao de intencao
    - EntityExtractor: Extracao de entidades
    - QuestionProcessor: Orquestracao
    """

    # Mapeamento de palavras-chave para módulos (expandido)
    MODULE_KEYWORDS: Dict[str, List[str]] = {
        "revenues": [
            # Termos principais
            "faturamento",
            "receita",
            "receitas",
            "ganho",
            "ganhos",
            "entrada",
            "entradas",
            "renda",
            "rendas",
            # Tipos de receita
            "salário",
            "salario",
            "salários",
            "salarios",
            "rendimento",
            "rendimentos",
            "dividendo",
            "dividendos",
            "reembolso",
            "reembolsos",
            "cashback",
            "bônus",
            "bonus",
            "prêmio",
            "premio",
            "prêmios",
            "premios",
            "freelance",
            "comissão",
            "comissao",
            "comissões",
            "comissoes",
            "aluguel recebido",
            "pensão",
            "pensao",
            "aposentadoria",
            # Verbos e expressões
            "quanto ganhei",
            "quanto recebi",
            "recebido",
            "recebidos",
            "entrou na conta",
            "recebi de",
            "ganhei de",
            "quanto entrou",
            "valor recebido",
            "valores recebidos",
            "meus ganhos",
            "minhas receitas",
            "minha renda",
        ],
        "expenses": [
            # Termos principais
            "despesa",
            "despesas",
            "gasto",
            "gastos",
            "conta",
            "contas a pagar",
            "custo",
            "custos",
            # Tipos de despesa
            "pagamento",
            "pagamentos",
            "compra",
            "compras",
            "débito",
            "debito",
            "débitos",
            "debitos",
            "saída",
            "saida",
            "saídas",
            "saidas",
            "boleto",
            "boletos",
            "fatura",
            "parcela",
            "parcelas",
            # Verbos e expressões
            "quanto gastei",
            "gastei com",
            "paguei",
            "comprei",
            "saiu da conta",
            "descontou",
            "debitou",
            "quanto paguei",
            "valor pago",
            "valores pagos",
            "meus gastos",
            "minhas despesas",
            "meus custos",
            # Categorias comuns (peso extra)
            "alimentação",
            "alimentacao",
            "comida",
            "restaurante",
            "supermercado",
            "mercado",
            "transporte",
            "uber",
            "gasolina",
            "combustível",
            "combustivel",
            "luz",
            "água",
            "agua",
            "internet",
            "telefone",
            "celular",
            "streaming",
            "assinatura",
            "assinaturas",
            "mensalidade",
            "mensalidades",
        ],
        "accounts": [
            # Termos principais
            "saldo",
            "saldos",
            "conta bancária",
            "conta bancaria",
            "conta corrente",
            "conta poupança",
            "conta poupanca",
            "minha conta",
            "minhas contas",
            "contas bancárias",
            # Bancos
            "banco",
            "bancos",
            "nubank",
            "sicoob",
            "mercado pago",
            "caixa",
            "bradesco",
            "itaú",
            "itau",
            "santander",
            "inter",
            "c6",
            "c6 bank",
            "picpay",
            "banco do brasil",
            "bb",
            "original",
            "next",
            "neon",
            "pagbank",
            "pagseguro",
            # Expressões
            "dinheiro disponível",
            "dinheiro disponivel",
            "quanto tenho",
            "tenho na conta",
            "tenho no banco",
            "dinheiro em conta",
            "valor em conta",
            "extrato",
            "posição bancária",
            "posicao bancaria",
        ],
        "credit_cards": [
            # Termos principais
            "cartão",
            "cartao",
            "cartões",
            "cartoes",
            "cartão de crédito",
            "cartao de credito",
            "cartões de crédito",
            "cartoes de credito",
            # Fatura e limite
            "fatura",
            "faturas",
            "fatura do cartão",
            "fatura do cartao",
            "limite",
            "limites",
            "limite disponível",
            "limite disponivel",
            "crédito disponível",
            "credito disponivel",
            "limite do cartão",
            "limite do cartao",
            # Bandeiras
            "visa",
            "mastercard",
            "master card",
            "master",
            "elo",
            "american express",
            "amex",
            "hipercard",
            "hiper",
            "diners",
            "diners club",
            # Expressões
            "dia de fechamento",
            "dia do fechamento",
            "dia de vencimento",
            "dia do vencimento",
            "quanto devo no cartão",
            "quanto devo no cartao",
            "gastei no cartão",
            "gastei no cartao",
            "compras no cartão",
            "compras no cartao",
        ],
        "loans": [
            # Termos principais
            "empréstimo",
            "emprestimo",
            "empréstimos",
            "emprestimos",
            "dívida",
            "divida",
            "dívidas",
            "dividas",
            "financiamento",
            "financiamentos",
            # Tipos
            "devo",
            "devendo",
            "me devem",
            "devem pra mim",
            "devem para mim",
            "emprestei",
            "peguei emprestado",
            "tomei emprestado",
            "emprestar",
            "emprestado",
            # Expressões
            "quanto devo",
            "quanto me devem",
            "quem me deve",
            "para quem devo",
            "pra quem devo",
            "valor emprestado",
            "valor devido",
            "parcela do empréstimo",
            "parcela do emprestimo",
            "quitação",
            "quitacao",
            "quitar",
        ],
        "library": [
            # Termos principais
            "livro",
            "livros",
            "leitura",
            "leituras",
            "biblioteca",
            "acervo",
            "estante",
            # Status de leitura
            "lendo",
            "estou lendo",
            "leio",
            "li",
            "lido",
            "lidos",
            "para ler",
            "quero ler",
            "vou ler",
            "abandonei",
            "abandonado",
            "pausado",
            # Componentes
            "autor",
            "autores",
            "escritor",
            "escritores",
            "editora",
            "editoras",
            "publicação",
            "publicacao",
            "resumo",
            "resumos",
            "sinopse",
            "páginas",
            "paginas",
            "página",
            "pagina",
            "obra",
            "obras",
            "título",
            "titulo",
            "gênero",
            "genero",
            "gêneros",
            "generos",
            # Expressões
            "quantos livros",
            "meus livros",
            "minhas leituras",
            "tempo de leitura",
            "minutos lendo",
            "horas lendo",
            "livros lidos",
            "livros que li",
        ],
        "personal_planning": [
            # Termos principais
            "tarefa",
            "tarefas",
            "rotina",
            "rotinas",
            "hábito",
            "habito",
            "hábitos",
            "habitos",
            "objetivo",
            "objetivos",
            "meta",
            "metas",
            "goal",
            "goals",
            # Planejamento
            "agenda",
            "checklist",
            "planejamento",
            "afazer",
            "afazeres",
            "to-do",
            "todo",
            "to do",
            # Status
            "pendente",
            "pendentes",
            "concluído",
            "concluido",
            "concluída",
            "concluida",
            "concluídas",
            "concluidas",
            "em andamento",
            "em progresso",
            "fazendo",
            "atrasado",
            "atrasada",
            "atrasados",
            "atrasadas",
            # Tempo
            "hoje",
            "amanhã",
            "amanha",
            "semana",
            "diário",
            "diario",
            "diária",
            "diaria",
            "semanal",
            "mensal",
            # Expressões
            "minhas tarefas",
            "meus objetivos",
            "minhas metas",
            "o que fazer",
            "o que tenho que fazer",
            "taxa de conclusão",
            "taxa de conclusao",
            "quantas tarefas",
            "tarefas do dia",
        ],
        "security": [
            # Termos principais
            "senha",
            "senhas",
            "password",
            "passwords",
            "credencial",
            "credenciais",
            "credential",
            "credentials",
            # Acesso
            "login",
            "logins",
            "acesso",
            "acessos",
            "usuário",
            "usuario",
            "username",
            # Sites e serviços comuns
            "site",
            "sites",
            "serviço",
            "servico",
            "serviços",
            "servicos",
            "netflix",
            "spotify",
            "amazon",
            "prime",
            "disney",
            "google",
            "gmail",
            "youtube",
            "facebook",
            "instagram",
            "twitter",
            "x",
            "tiktok",
            "linkedin",
            "github",
            "gitlab",
            "microsoft",
            "outlook",
            "apple",
            "icloud",
            "adobe",
            "dropbox",
            "onedrive",
            "whatsapp",
            "telegram",
            "discord",
            "slack",
            "zoom",
            # Bancos
            "nubank login",
            "itau login",
            "bradesco login",
            # Expressões
            "qual a senha",
            "minha senha",
            "minhas senhas",
            "senha do",
            "senha da",
            "credencial do",
            "credencial da",
            "login do",
            "login da",
            "acesso ao",
            "acesso à",
        ],
        "vaults": [
            # Termos principais
            "cofre",
            "cofres",
            "reserva",
            "reservas",
            "poupança",
            "poupanca",
            "poupanças",
            "poupancas",
            # Investimentos
            "guardado",
            "guardei",
            "guardar",
            "economizar",
            "investimento",
            "investimentos",
            "investido",
            "aplicação",
            "aplicacao",
            "aplicações",
            "aplicacoes",
            "rendimento",
            "rendimentos",
            "juros",
            # Expressões
            "quanto tenho guardado",
            "quanto economizei",
            "meu cofre",
            "meus cofres",
            "minhas reservas",
            "dinheiro guardado",
            "valor guardado",
            "taxa de rendimento",
            "quanto rendeu",
        ],
        "transfers": [
            # Termos principais
            "transferência",
            "transferencia",
            "transferências",
            "transferencias",
            "transfer",
            "transfers",
            # Tipos
            "pix",
            "ted",
            "doc",
            "débito automático",
            "debito automatico",
            # Verbos
            "transferi",
            "transferir",
            "enviei",
            "enviar",
            "mandei dinheiro",
            "mandar dinheiro",
            "recebi transferência",
            "recebi transferencia",
            # Expressões
            "transferência entre contas",
            "transferencia entre contas",
            "mover dinheiro",
            "movimentação",
            "movimentacao",
            "quanto transferi",
            "para onde transferi",
            "de onde recebi",
            "origem e destino",
        ],
    }

    # Mapeamento de períodos temporais
    TIME_KEYWORDS: Dict[str, Tuple[Optional[date], Optional[date]]] = {}

    @classmethod
    def _get_time_range(
        cls, question: str
    ) -> Tuple[Optional[date], Optional[date], str]:
        """
        Extrai o período temporal da pergunta.

        Returns:
            Tupla com (data_inicio, data_fim, descrição_período)
        """
        today = timezone.now().date()
        question_lower = question.lower()

        # Hoje
        if any(
            w in question_lower
            for w in ["hoje", "dia de hoje", "neste dia", "no dia de hoje"]
        ):
            return today, today, "hoje"

        # Ontem
        if any(w in question_lower for w in ["ontem", "dia de ontem"]):
            yesterday = today - timedelta(days=1)
            return yesterday, yesterday, "ontem"

        # Anteontem
        if any(w in question_lower for w in ["anteontem", "antes de ontem"]):
            day_before = today - timedelta(days=2)
            return day_before, day_before, "anteontem"

        # Esta semana
        if any(
            w in question_lower
            for w in ["esta semana", "essa semana", "semana atual", "nesta semana"]
        ):
            start = today - timedelta(days=today.weekday())
            return start, today, "esta semana"

        # Semana passada
        if any(
            w in question_lower
            for w in [
                "semana passada",
                "última semana",
                "ultima semana",
                "semana anterior",
            ]
        ):
            start = today - timedelta(days=today.weekday() + 7)
            end = start + timedelta(days=6)
            return start, end, "semana passada"

        # Últimas X semanas
        match = re.search(r"[uú]ltimas?\s+(\d+)\s+semanas?", question_lower)
        if match:
            weeks = int(match.group(1))
            start = today - timedelta(weeks=weeks)
            return start, today, f"últimas {weeks} semanas"

        # Este mês
        if any(
            w in question_lower
            for w in [
                "este mês",
                "este mes",
                "mês atual",
                "mes atual",
                "neste mês",
                "neste mes",
                "esse mês",
                "esse mes",
                "mês corrente",
                "mes corrente",
            ]
        ):
            start = today.replace(day=1)
            return start, today, "este mês"

        # Mês passado / último mês
        if any(
            w in question_lower
            for w in [
                "mês passado",
                "mes passado",
                "último mês",
                "ultimo mes",
                "mês anterior",
                "mes anterior",
            ]
        ):
            first_day_this_month = today.replace(day=1)
            last_day_last_month = first_day_this_month - timedelta(days=1)
            first_day_last_month = last_day_last_month.replace(day=1)
            return first_day_last_month, last_day_last_month, "mês passado"

        # Últimos X meses
        match = re.search(r"[uú]ltimos?\s+(\d+)\s+m[eê]s(?:es)?", question_lower)
        if match:
            months_count = int(match.group(1))
            # Calcula a data de início (X meses atrás)
            year = today.year
            month = today.month - months_count
            while month <= 0:
                month += 12
                year -= 1
            start = date(year, month, 1)
            return start, today, f"últimos {months_count} meses"

        # Últimos X dias
        match = re.search(r"[uú]ltimos?\s+(\d+)\s+dias?", question_lower)
        if match:
            days = int(match.group(1))
            start = today - timedelta(days=days)
            return start, today, f"últimos {days} dias"

        # Este trimestre
        if any(
            w in question_lower
            for w in ["este trimestre", "trimestre atual", "neste trimestre"]
        ):
            quarter = (today.month - 1) // 3
            start = date(today.year, quarter * 3 + 1, 1)
            return start, today, "este trimestre"

        # Trimestre passado
        if any(
            w in question_lower
            for w in ["trimestre passado", "último trimestre", "ultimo trimestre"]
        ):
            quarter = (today.month - 1) // 3
            if quarter == 0:
                start = date(today.year - 1, 10, 1)
                end = date(today.year - 1, 12, 31)
            else:
                start = date(today.year, (quarter - 1) * 3 + 1, 1)
                end = date(today.year, quarter * 3, 1) - timedelta(days=1)
            return start, end, "trimestre passado"

        # Este semestre
        if any(
            w in question_lower
            for w in ["este semestre", "semestre atual", "neste semestre"]
        ):
            if today.month <= 6:
                start = date(today.year, 1, 1)
            else:
                start = date(today.year, 7, 1)
            return start, today, "este semestre"

        # Este ano
        if any(
            w in question_lower
            for w in ["este ano", "ano atual", "neste ano", "esse ano"]
        ):
            start = today.replace(month=1, day=1)
            return start, today, "este ano"

        # Ano passado
        if any(
            w in question_lower
            for w in ["ano passado", "último ano", "ultimo ano", "ano anterior"]
        ):
            start = today.replace(year=today.year - 1, month=1, day=1)
            end = today.replace(year=today.year - 1, month=12, day=31)
            return start, end, "ano passado"

        # Últimos X anos
        match = re.search(r"[uú]ltimos?\s+(\d+)\s+anos?", question_lower)
        if match:
            years = int(match.group(1))
            start = date(today.year - years, today.month, today.day)
            return start, today, f"últimos {years} anos"

        # Desde + data ou período
        match = re.search(
            r"desde\s+(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})", question_lower
        )
        if match:
            day, month, year = (
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
            )
            if year < 100:
                year += 2000
            try:
                start = date(year, month, day)
                return start, today, f"desde {day:02d}/{month:02d}/{year}"
            except ValueError:
                pass

        # Entre datas
        match = re.search(
            r"entre\s+(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})"
            r"\s+e\s+(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})",
            question_lower,
        )
        if match:
            d1, m1, y1 = int(match.group(1)), int(match.group(2)), int(match.group(3))
            d2, m2, y2 = int(match.group(4)), int(match.group(5)), int(match.group(6))
            if y1 < 100:
                y1 += 2000
            if y2 < 100:
                y2 += 2000
            try:
                start = date(y1, m1, d1)
                end = date(y2, m2, d2)
                return start, end, f"{d1:02d}/{m1:02d}/{y1} a {d2:02d}/{m2:02d}/{y2}"
            except ValueError:
                pass

        # Mês específico com ano (ex: "janeiro de 2024", "em janeiro/2024")
        match = re.search(
            r"(?:em\s+|de\s+)?"
            r"(janeiro|fevereiro|mar[çc]o|abril|maio|junho"
            r"|julho|agosto|setembro|outubro|novembro|dezembro)"
            r"(?:\s+de\s+|\s*/\s*|\s+)(\d{4})",
            question_lower,
        )
        if match:
            month_name = match.group(1).replace("ç", "c")
            year = int(match.group(2))
            months = {
                "janeiro": 1,
                "fevereiro": 2,
                "marco": 3,
                "abril": 4,
                "maio": 5,
                "junho": 6,
                "julho": 7,
                "agosto": 8,
                "setembro": 9,
                "outubro": 10,
                "novembro": 11,
                "dezembro": 12,
            }
            month_num = months.get(month_name, 1)
            start = date(year, month_num, 1)
            if month_num == 12:
                end = date(year, 12, 31)
            else:
                end = date(year, month_num + 1, 1) - timedelta(days=1)
            return start, end, f"{month_name.capitalize()} de {year}"

        # Mês específico (janeiro, fevereiro, etc.) - sem ano
        months = {
            "janeiro": 1,
            "fevereiro": 2,
            "março": 3,
            "marco": 3,
            "abril": 4,
            "maio": 5,
            "junho": 6,
            "julho": 7,
            "agosto": 8,
            "setembro": 9,
            "outubro": 10,
            "novembro": 11,
            "dezembro": 12,
        }
        for month_name, month_num in months.items():
            # Verifica se o mês aparece isolado (não como parte de outra palavra)
            pattern = rf"\b{month_name}\b"
            if re.search(pattern, question_lower):
                year = today.year
                # Se o mês mencionado é posterior ao atual, assume ano anterior
                if month_num > today.month:
                    year -= 1
                start = date(year, month_num, 1)
                if month_num == 12:
                    end = date(year, 12, 31)
                else:
                    end = date(year, month_num + 1, 1) - timedelta(days=1)
                return start, end, month_name.capitalize()

        # Ano específico (ex: "em 2024", "no ano de 2023")
        match = re.search(r"(?:em|no\s+ano\s+de|ano\s+de)\s+(\d{4})", question_lower)
        if match:
            year = int(match.group(1))
            start = date(year, 1, 1)
            end = date(year, 12, 31)
            return start, end, f"ano de {year}"

        # Sem período específico - retorna None para usar todos os dados
        return None, None, "todo o período"

    @classmethod
    def _detect_module(cls, question: str) -> str:
        """Detecta o módulo baseado em palavras-chave."""
        question_lower = question.lower()

        # Conta ocorrências de palavras-chave por módulo
        scores: Dict[str, int] = {}
        for module, keywords in cls.MODULE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in question_lower)
            if score > 0:
                scores[module] = score

        if not scores:
            return "unknown"

        # Retorna o módulo com maior score
        return max(scores, key=lambda k: scores[k])

    @classmethod
    def _detect_aggregation(cls, question: str) -> str:
        """Detecta tipo de agregação desejada."""
        question_lower = question.lower()

        # Soma/Total
        if any(
            w in question_lower
            for w in [
                "total",
                "soma",
                "somado",
                "somar",
                "somando",
                "quanto foi",
                "quanto gastei",
                "quanto ganhei",
                "quanto paguei",
                "quanto recebi",
                "quanto entrou",
                "quanto saiu",
                "valor total",
                "montante",
                "no total",
                "ao todo",
                "tudo junto",
            ]
        ):
            return "sum"

        # Média
        if any(
            w in question_lower
            for w in [
                "média",
                "media",
                "médio",
                "medio",
                "em média",
                "em media",
                "por dia",
                "por mês",
                "valor médio",
                "gasto médio",
                "receita média",
                "média de",
                "media de",
            ]
        ):
            return "avg"

        # Máximo
        if any(
            w in question_lower
            for w in [
                "máximo",
                "maximo",
                "máxima",
                "maxima",
                "maior",
                "mais alto",
                "mais alta",
                "mais caro",
                "mais cara",
                "o maior",
                "a maior",
                "maior valor",
                "maior gasto",
                "mais gastei",
                "mais recebi",
                "top",
                "recorde",
            ]
        ):
            return "max"

        # Mínimo
        if any(
            w in question_lower
            for w in [
                "mínimo",
                "minimo",
                "mínima",
                "minima",
                "menor",
                "mais baixo",
                "mais baixa",
                "mais barato",
                "mais barata",
                "o menor",
                "a menor",
                "menor valor",
                "menor gasto",
                "menos gastei",
                "menos recebi",
            ]
        ):
            return "min"

        # Contagem
        if any(
            w in question_lower
            for w in [
                "quantos",
                "quantas",
                "quantidade",
                "contagem",
                "número de",
                "numero de",
                "conta de",
                "total de",
                "quantas vezes",
                "quantos registros",
                "quantas despesas",
                "quantas receitas",
                "quantos livros",
                "quantas tarefas",
                "quantos pagamentos",
                "quantas compras",
            ]
        ):
            return "count"

        # Agrupamento por categoria
        if any(
            w in question_lower
            for w in [
                "por categoria",
                "por categorias",
                "categorizado",
                "categorizada",
                "agrupado por",
                "agrupada por",
                "dividido por",
                "separado por",
                "em cada categoria",
                "de cada categoria",
            ]
        ):
            return "group_by_category"

        return "list"  # Padrão: listar registros

    @classmethod
    def _detect_category_filter(cls, question: str, module: str) -> Optional[str]:
        """Detecta filtro de categoria baseado no módulo."""
        question_lower = question.lower()

        # Categorias de despesas (expandido)
        expense_categories = {
            # Alimentação
            "alimentação": "food and drink",
            "alimentacao": "food and drink",
            "comida": "food and drink",
            "refeição": "food and drink",
            "refeicao": "food and drink",
            "lanche": "food and drink",
            "almoço": "food and drink",
            "almoco": "food and drink",
            "jantar": "food and drink",
            "café": "food and drink",
            "restaurante": "food and drink",
            "delivery": "food and drink",
            "ifood": "food and drink",
            "rappi": "food and drink",
            # Supermercado
            "supermercado": "supermarket",
            "mercado": "supermarket",
            "feira": "supermarket",
            "hortifruti": "supermarket",
            "compras do mês": "supermarket",
            "compras do mes": "supermarket",
            # Transporte
            "transporte": "transport",
            "uber": "transport",
            "99": "transport",
            "ônibus": "transport",
            "onibus": "transport",
            "metrô": "transport",
            "metro": "transport",
            "gasolina": "transport",
            "combustível": "transport",
            "combustivel": "transport",
            "estacionamento": "transport",
            "pedágio": "transport",
            "pedagio": "transport",
            "manutenção carro": "transport",
            "manutencao carro": "transport",
            # Saúde
            "saúde": "health and care",
            "saude": "health and care",
            "farmácia": "health and care",
            "farmacia": "health and care",
            "remédio": "health and care",
            "remedio": "health and care",
            "médico": "health and care",
            "medico": "health and care",
            "consulta": "health and care",
            "exame": "health and care",
            "dentista": "health and care",
            "hospital": "health and care",
            "plano de saúde": "health and care",
            "plano de saude": "health and care",
            # Educação
            "educação": "education",
            "educacao": "education",
            "curso": "education",
            "faculdade": "education",
            "escola": "education",
            "livro": "education",
            "material escolar": "education",
            "mensalidade": "education",
            # Assinaturas digitais
            "streaming": "digital signs",
            "assinatura": "digital signs",
            "netflix": "digital signs",
            "spotify": "digital signs",
            "amazon prime": "digital signs",
            "disney": "digital signs",
            "hbo": "digital signs",
            "youtube premium": "digital signs",
            "apple": "digital signs",
            "google one": "digital signs",
            "deezer": "digital signs",
            "globoplay": "digital signs",
            # Entretenimento
            "entretenimento": "entertainment",
            "lazer": "entertainment",
            "cinema": "entertainment",
            "teatro": "entertainment",
            "show": "entertainment",
            "festa": "entertainment",
            "bar": "entertainment",
            "balada": "entertainment",
            "jogo": "entertainment",
            "game": "entertainment",
            # Viagens
            "viagem": "travels",
            "viagens": "travels",
            "hotel": "travels",
            "pousada": "travels",
            "passagem": "travels",
            "aéreo": "travels",
            "aereo": "travels",
            "hospedagem": "travels",
            "airbnb": "travels",
            # Vestuário
            "roupa": "vestuary",
            "roupas": "vestuary",
            "vestuário": "vestuary",
            "vestuario": "vestuary",
            "calçado": "vestuary",
            "calcado": "vestuary",
            "tênis": "vestuary",
            "tenis": "vestuary",
            "sapato": "vestuary",
            "acessório": "vestuary",
            # Casa
            "casa": "house",
            "moradia": "house",
            "aluguel": "house",
            "móveis": "house",
            "moveis": "house",
            "decoração": "house",
            "decoracao": "house",
            "reforma": "house",
            "eletrodoméstico": "house",
            # Contas e serviços
            "condomínio": "bills and services",
            "condominio": "bills and services",
            "luz": "bills and services",
            "energia": "bills and services",
            "água": "bills and services",
            "agua": "bills and services",
            "gás": "bills and services",
            "gas": "bills and services",
            "internet": "bills and services",
            "telefone": "bills and services",
            "celular": "bills and services",
            "iptu": "bills and services",
            "ipva": "bills and services",
            "seguro": "bills and services",
            # Eletrônicos
            "eletrônico": "electronics",
            "eletronico": "electronics",
            "celular novo": "electronics",
            "computador": "electronics",
            "notebook": "electronics",
            "tablet": "electronics",
            # Pet
            "pet": "pets",
            "cachorro": "pets",
            "gato": "pets",
            "ração": "pets",
            "racao": "pets",
            "veterinário": "pets",
            # Doações
            "doação": "donate",
            "doacao": "donate",
            "caridade": "donate",
            "ajuda": "donate",
            # Impostos
            "imposto": "taxes",
            "impostos": "taxes",
            "tributo": "taxes",
            "taxa": "rates",
        }

        # Categorias de receitas (expandido)
        revenue_categories = {
            # Salário
            "salário": "salary",
            "salario": "salary",
            "pagamento": "salary",
            "holerite": "salary",
            "contracheque": "salary",
            "décimo": "salary",
            "decimo": "salary",
            "13º": "salary",
            "13o": "salary",
            "férias": "salary",
            "ferias": "salary",
            # Rendimentos
            "freelance": "income",
            "freela": "income",
            "rendimento": "income",
            "dividendo": "income",
            "juros": "income",
            "investimento": "income",
            "lucro": "income",
            "ganho": "income",
            # Reembolso
            "reembolso": "refund",
            "devolução": "refund",
            "devolvido": "refund",
            "estorno": "refund",
            # Cashback
            "cashback": "cashback",
            "cash back": "cashback",
            # Prêmios e bônus
            "prêmio": "award",
            "premio": "award",
            "bônus": "award",
            "bonus": "award",
            "gratificação": "award",
            "gratificacao": "award",
            # Vale
            "vale": "ticket",
            "vale alimentação": "ticket",
            "vale refeição": "ticket",
            "vale transporte": "ticket",
            "vr": "ticket",
            "va": "ticket",
            "vt": "ticket",
            # Outros
            "comissão": "income",
            "comissao": "income",
            "aluguel recebido": "income",
            "pensão": "income",
            "aposentadoria": "income",
            "herança": "income",
        }

        # Categorias de livros (expandido)
        book_genres = {
            # Filosofia e pensamento
            "filosofia": "philosophy",
            "filosófico": "philosophy",
            "estoicismo": "philosophy",
            "ética": "philosophy",
            # História
            "história": "history",
            "historia": "history",
            "histórico": "history",
            "historico": "history",
            # Psicologia
            "psicologia": "psychology",
            "psicológico": "psychology",
            "autoajuda": "self_help",
            "auto ajuda": "self_help",
            "desenvolvimento pessoal": "self_help",
            # Ficção
            "ficção": "fiction",
            "ficcao": "fiction",
            "romance": "romance",
            "fantasia": "fantasy",
            "ficção científica": "science_fiction",
            "sci-fi": "science_fiction",
            "scifi": "science_fiction",
            "terror": "horror",
            "suspense": "thriller",
            "mistério": "mystery",
            "misterio": "mystery",
            # Não-ficção
            "biografia": "biography",
            "autobiografia": "autobiography",
            # Política e economia
            "política": "political",
            "politica": "political",
            "economia": "economics",
            "negócios": "business",
            "negocios": "business",
            "empreendedorismo": "business",
            # Tecnologia
            "tecnologia": "technology",
            "programação": "programming",
            "programacao": "programming",
            "computação": "technology",
            # Religião e espiritualidade
            "teologia": "religion",
            "religião": "religion",
            "religiao": "religion",
            "espiritual": "spirituality",
            "espiritualidade": "spirituality",
            # Outros
            "poesia": "poetry",
            "clássico": "classic",
            "classico": "classic",
            "infantil": "children",
            "quadrinhos": "comics",
            "mangá": "manga",
            "manga": "manga",
        }

        # Categorias de tarefas (expandido)
        task_categories = {
            # Saúde
            "saúde": "health",
            "saude": "health",
            "médico": "health",
            "medico": "health",
            # Estudos
            "estudos": "studies",
            "estudo": "studies",
            "estudar": "studies",
            "aprender": "learning",
            "aprendizado": "learning",
            "curso": "studies",
            # Espiritual
            "espiritual": "spiritual",
            "oração": "spiritual",
            "oracao": "spiritual",
            "meditação": "meditation",
            "meditacao": "meditation",
            "mindfulness": "mindfulness",
            # Exercício
            "exercício": "exercise",
            "exercicio": "exercise",
            "academia": "exercise",
            "treino": "exercise",
            "corrida": "exercise",
            "caminhada": "exercise",
            "yoga": "exercise",
            "esporte": "exercise",
            # Leitura
            "leitura": "reading",
            "ler": "reading",
            # Trabalho
            "trabalho": "work",
            "profissional": "work",
            "carreira": "career",
            "projeto": "work",
            # Família e casa
            "família": "family",
            "familia": "family",
            "casa": "household",
            "doméstico": "household",
            "domestico": "household",
            "limpeza": "household",
            # Outros
            "social": "social",
            "lazer": "leisure",
            "finanças": "finance",
            "financas": "finance",
            "criatividade": "creativity",
            "hobby": "leisure",
            "sono": "sleep",
            "descanso": "sleep",
            "hidratação": "hydration",
            "hidratacao": "hydration",
            "gratidão": "gratitude",
            "gratidao": "gratitude",
        }

        # Categorias de senhas (para módulo security)
        password_categories = {
            "banco": "banking",
            "bancário": "banking",
            "bancario": "banking",
            "financeiro": "finance",
            "finanças": "finance",
            "rede social": "social",
            "redes sociais": "social",
            "email": "email",
            "e-mail": "email",
            "streaming": "streaming",
            "música": "streaming",
            "trabalho": "work",
            "empresa": "work",
            "jogos": "gaming",
            "games": "gaming",
            "compras": "shopping",
            "loja": "shopping",
            "governo": "government",
            "gov": "government",
            "saúde": "healthcare",
            "saude": "healthcare",
            "educação": "education",
            "educacao": "education",
            "desenvolvimento": "development",
            "programação": "development",
            "cloud": "cloud",
            "nuvem": "cloud",
        }

        categories = {}
        if module == "expenses":
            categories = expense_categories
        elif module == "revenues":
            categories = revenue_categories
        elif module == "library":
            categories = book_genres
        elif module == "personal_planning":
            categories = task_categories
        elif module == "security":
            categories = password_categories

        for keyword, category in categories.items():
            if keyword in question_lower:
                return category

        return None

    @classmethod
    def interpret(
        cls,
        question: str,
        member_id: int,
        allowed_modules: Optional[List[str]] = None,
        agent_config=None,
    ) -> QueryResult:
        """
        Interpreta uma pergunta e retorna a query SQL correspondente.

        Usa as camadas de inteligencia para melhor interpretacao:
        1. Pre-processamento de texto
        2. Classificacao de intencao
        3. Extracao de entidades

        Args:
            question: Pergunta em portugues
            member_id: ID do membro para filtrar dados
            allowed_modules: Lista de modulos permitidos para este agente.
                           Se None, todos os modulos sao permitidos.

        Returns:
            QueryResult com SQL, parametros e metadados
        """
        # Processa a pergunta atraves das camadas de inteligencia
        processed = QuestionProcessor.process(question)
        logger.debug(
            f"Pergunta processada: modulo={processed.detected_module}, "
            f"intencao={processed.intent.intent.value}, "
            f"confianca={processed.confidence:.2f}"
        )

        # Verifica casos especiais (saudacao, ajuda)
        if QuestionProcessor.is_greeting(processed.intent):
            return QueryResult(
                module="greeting",
                sql="",
                params=(),
                display_type="text",
                description=QuestionProcessor.get_greeting_response(agent_config),
                confidence=processed.confidence,
                detected_intent=processed.intent.intent.value,
                processing_metadata=processed.metadata,
            )

        if QuestionProcessor.is_help_request(processed.intent):
            return QueryResult(
                module="help",
                sql="",
                params=(),
                display_type="text",
                description=QuestionProcessor.get_help_response(agent_config),
                confidence=processed.confidence,
                detected_intent=processed.intent.intent.value,
                processing_metadata=processed.metadata,
            )

        # Usa o modulo detectado pelas camadas de inteligencia
        module = processed.detected_module

        # Usa as entidades extraidas
        date_range = processed.entities.date_range
        start_date = date_range.start
        end_date = date_range.end
        period_desc = date_range.description

        # Usa agregacao sugerida pela intencao
        aggregation = processed.suggested_aggregation

        # Fallback para deteccao tradicional se confianca baixa
        if processed.confidence < 0.4:
            logger.debug("Confianca baixa, usando deteccao tradicional")
            aggregation = cls._detect_aggregation(question)
            if module == "unknown":
                module = cls._detect_module(question)

        # Verifica se o modulo detectado e permitido para este agente
        if allowed_modules and module not in allowed_modules and module != "unknown":
            # Mapeamento de modulos para nomes amigaveis
            module_names = {
                "revenues": "receitas e faturamento",
                "expenses": "despesas e gastos",
                "accounts": "contas bancarias",
                "credit_cards": "cartoes de credito",
                "loans": "emprestimos",
                "transfers": "transferencias",
                "vaults": "cofres e reservas",
                "library": "livros e leituras",
                "personal_planning": "tarefas e planejamento",
                "security": "senhas e credenciais",
            }
            module_friendly = module_names.get(module, module)
            return QueryResult(
                module="restricted",
                sql="",
                params=(),
                display_type="text",
                description=(
                    f"Esta pergunta parece ser sobre {module_friendly}. "
                    f"Por favor, selecione o agente correto para este tipo de consulta."
                ),
                confidence=processed.confidence,
                detected_intent=processed.intent.intent.value,
                processing_metadata=processed.metadata,
            )

        # Usa categorias extraidas ou fallback para deteccao tradicional
        category = None
        if processed.entities.categories:
            category = processed.entities.categories[0]
        else:
            category = cls._detect_category_filter(question, module)

        # Delega para o metodo especifico do modulo
        method_name = f"_query_{module}"
        if hasattr(cls, method_name):
            result = getattr(cls, method_name)(
                question,
                member_id,
                start_date,
                end_date,
                period_desc,
                aggregation,
                category,
            )
            # Adiciona metadados de processamento
            result.confidence = processed.confidence
            result.detected_intent = processed.intent.intent.value
            result.processing_metadata = processed.metadata
            return result

        # Se modulo desconhecido, tenta resposta generica
        result = cls._query_unknown(question, member_id)
        result.confidence = processed.confidence
        result.detected_intent = processed.intent.intent.value
        result.processing_metadata = processed.metadata
        return result

    @classmethod
    def _query_revenues(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de receitas."""
        base_conditions = "deleted_at IS NULL AND member_id = %s"
        params: List[Any] = [member_id]

        if start_date and end_date:
            base_conditions += " AND date BETWEEN %s AND %s"
            params.extend([start_date, end_date])

        if category:
            base_conditions += " AND category = %s"
            params.append(category)

        if aggregation == "sum":
            sql = f"""
                SELECT
                    COALESCE(SUM(value), 0) as total,
                    COUNT(*) as quantidade
                FROM revenues_revenue
                WHERE {base_conditions}
            """
            display_type = "currency"
            description = f"Total de receitas {period_desc}"
        elif aggregation == "avg":
            sql = f"""
                SELECT
                    COALESCE(AVG(value), 0) as media,
                    COUNT(*) as quantidade
                FROM revenues_revenue
                WHERE {base_conditions}
            """
            display_type = "currency"
            description = f"Média de receitas {period_desc}"
        elif aggregation == "count":
            sql = f"""
                SELECT
                    COUNT(*) as quantidade,
                    COALESCE(SUM(value), 0) as total
                FROM revenues_revenue
                WHERE {base_conditions}
            """
            display_type = "text"
            description = f"Quantidade de receitas {period_desc}"
        elif aggregation == "max":
            sql = f"""
                SELECT
                    description as descricao,
                    value as valor,
                    date as data,
                    category as categoria
                FROM revenues_revenue
                WHERE {base_conditions}
                ORDER BY value DESC
                LIMIT 5
            """
            display_type = "table"
            description = f"Maiores receitas {period_desc}"
        elif aggregation == "min":
            sql = f"""
                SELECT
                    description as descricao,
                    value as valor,
                    date as data,
                    category as categoria
                FROM revenues_revenue
                WHERE {base_conditions}
                ORDER BY value ASC
                LIMIT 5
            """
            display_type = "table"
            description = f"Menores receitas {period_desc}"
        elif (
            aggregation == "group_by_category"
            or "categoria" in question.lower()
            or "categorias" in question.lower()
        ):
            sql = f"""
                SELECT
                    category as categoria,
                    COUNT(*) as quantidade,
                    SUM(value) as total,
                    AVG(value) as media
                FROM revenues_revenue
                WHERE {base_conditions}
                GROUP BY category
                ORDER BY total DESC
            """
            display_type = "table"
            description = f"Receitas por categoria {period_desc}"
        else:
            sql = f"""
                SELECT
                    description as descricao,
                    value as valor,
                    date as data,
                    category as categoria
                FROM revenues_revenue
                WHERE {base_conditions}
                ORDER BY date DESC
                LIMIT 10
            """
            display_type = "table"
            description = f"Últimas receitas {period_desc}"

        return QueryResult(
            module="revenues",
            sql=sql,
            params=tuple(params),
            display_type=display_type,
            description=description,
        )

    @classmethod
    def _query_expenses(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de despesas."""
        base_conditions = "deleted_at IS NULL AND member_id = %s"
        params: List[Any] = [member_id]

        if start_date and end_date:
            base_conditions += " AND date BETWEEN %s AND %s"
            params.extend([start_date, end_date])

        if category:
            base_conditions += " AND category = %s"
            params.append(category)

        if aggregation == "sum":
            sql = f"""
                SELECT
                    COALESCE(SUM(value), 0) as total,
                    COUNT(*) as quantidade
                FROM expenses_expense
                WHERE {base_conditions}
            """
            display_type = "currency"
            description = f"Total de despesas {period_desc}"
        elif aggregation == "avg":
            sql = f"""
                SELECT
                    COALESCE(AVG(value), 0) as media,
                    COUNT(*) as quantidade
                FROM expenses_expense
                WHERE {base_conditions}
            """
            display_type = "currency"
            description = f"Média de despesas {period_desc}"
        elif aggregation == "count":
            sql = f"""
                SELECT
                    COUNT(*) as quantidade,
                    COALESCE(SUM(value), 0) as total
                FROM expenses_expense
                WHERE {base_conditions}
            """
            display_type = "text"
            description = f"Quantidade de despesas {period_desc}"
        elif aggregation == "max":
            sql = f"""
                SELECT
                    description as descricao,
                    value as valor,
                    date as data,
                    category as categoria
                FROM expenses_expense
                WHERE {base_conditions}
                ORDER BY value DESC
                LIMIT 5
            """
            display_type = "table"
            description = f"Maiores despesas {period_desc}"
        elif aggregation == "min":
            sql = f"""
                SELECT
                    description as descricao,
                    value as valor,
                    date as data,
                    category as categoria
                FROM expenses_expense
                WHERE {base_conditions}
                ORDER BY value ASC
                LIMIT 5
            """
            display_type = "table"
            description = f"Menores despesas {period_desc}"
        elif (
            aggregation == "group_by_category"
            or "categoria" in question.lower()
            or "categorias" in question.lower()
        ):
            sql = f"""
                SELECT
                    category as categoria,
                    COUNT(*) as quantidade,
                    SUM(value) as total,
                    AVG(value) as media
                FROM expenses_expense
                WHERE {base_conditions}
                GROUP BY category
                ORDER BY total DESC
            """
            display_type = "table"
            description = f"Despesas por categoria {period_desc}"
        else:
            # Listar despesas recentes
            sql = f"""
                SELECT
                    description as descricao,
                    value as valor,
                    date as data,
                    category as categoria
                FROM expenses_expense
                WHERE {base_conditions}
                ORDER BY date DESC
                LIMIT 10
            """
            display_type = "table"
            description = f"Últimas despesas {period_desc}"

        return QueryResult(
            module="expenses",
            sql=sql,
            params=tuple(params),
            display_type=display_type,
            description=description,
        )

    @classmethod
    def _query_accounts(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de contas bancárias."""
        question_lower = question.lower()

        params: List[Any] = [member_id]

        # Saldo total
        if any(w in question_lower for w in ["total", "soma", "todos", "todas"]):
            sql = """
                SELECT
                    COALESCE(SUM(current_balance), 0) as saldo_total,
                    COUNT(*) as quantidade_contas
                FROM accounts_account
                WHERE deleted_at IS NULL AND is_active = true
                    AND owner_id = %s
            """
            display_type = "currency"
            description = "Saldo total de todas as contas"
        else:
            sql = """
                SELECT
                    account_name as conta,
                    institution_name as banco,
                    account_type as tipo,
                    current_balance as saldo
                FROM accounts_account
                WHERE deleted_at IS NULL AND is_active = true
                    AND owner_id = %s
                ORDER BY current_balance DESC
            """
            display_type = "table"
            description = "Saldo das contas bancárias"

        return QueryResult(
            module="accounts",
            sql=sql,
            params=tuple(params),
            display_type=display_type,
            description=description,
        )

    @classmethod
    def _query_credit_cards(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de cartões de crédito."""
        question_lower = question.lower()
        params: List[Any] = [member_id]

        # Limite disponível
        if any(w in question_lower for w in ["limite", "disponível", "disponivel"]):
            sql = """
                SELECT
                    name as cartao,
                    flag as bandeira,
                    credit_limit as limite_total,
                    (credit_limit - COALESCE(
                        (SELECT SUM(value) FROM credit_cards_creditcardexpense
                         WHERE card_id = credit_cards_creditcard.id
                         AND payed = false AND deleted_at IS NULL), 0
                    )) as limite_disponivel
                FROM credit_cards_creditcard
                WHERE deleted_at IS NULL AND is_active = true
                    AND owner_id = %s
            """
            display_type = "table"
            description = "Limite disponível dos cartões"
        # Fatura
        elif any(w in question_lower for w in ["fatura", "faturas"]):
            sql = """
                SELECT
                    cc.name as cartao,
                    b.month as mes,
                    b.year as ano,
                    b.total_amount as valor_fatura,
                    b.status
                FROM credit_cards_creditcardbill b
                JOIN credit_cards_creditcard cc ON cc.id = b.credit_card_id
                WHERE b.deleted_at IS NULL
                    AND cc.owner_id = %s
                ORDER BY b.year DESC, b.month DESC
                LIMIT 5
            """
            display_type = "table"
            description = "Últimas faturas dos cartões"
        else:
            sql = """
                SELECT
                    name as cartao,
                    flag as bandeira,
                    credit_limit as limite,
                    due_day as dia_vencimento,
                    closing_day as dia_fechamento
                FROM credit_cards_creditcard
                WHERE deleted_at IS NULL AND is_active = true
                    AND owner_id = %s
            """
            display_type = "table"
            description = "Cartões de crédito cadastrados"

        return QueryResult(
            module="credit_cards",
            sql=sql,
            params=tuple(params),
            display_type=display_type,
            description=description,
        )

    @classmethod
    def _query_loans(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de empréstimos."""
        question_lower = question.lower()

        # O que eu devo (empréstimos que peguei)
        if any(w in question_lower for w in ["devo", "devendo", "paguei", "pegar"]):
            sql = """
                SELECT
                    l.description as descricao,
                    l.value as valor_total,
                    l.payed_value as valor_pago,
                    (l.value - l.payed_value) as valor_restante,
                    m.name as credor,
                    l.status
                FROM loans_loan l
                LEFT JOIN members_member m ON m.id = l.creditor_id
                WHERE l.deleted_at IS NULL
                    AND (l.benefited_id = %s OR l.creditor_id = %s)
                    AND l.category = 'borrowed'
                    AND l.status != 'paid'
                ORDER BY l.date DESC
            """
            params = (member_id, member_id)
            description = "Empréstimos que você deve"
        # O que me devem (empréstimos que fiz)
        elif any(w in question_lower for w in ["me devem", "emprestei", "emprestar"]):
            sql = """
                SELECT
                    l.description as descricao,
                    l.value as valor_total,
                    l.payed_value as valor_recebido,
                    (l.value - l.payed_value) as valor_a_receber,
                    m.name as devedor,
                    l.status
                FROM loans_loan l
                LEFT JOIN members_member m ON m.id = l.benefited_id
                WHERE l.deleted_at IS NULL
                    AND (l.benefited_id = %s OR l.creditor_id = %s)
                    AND l.category = 'lent'
                    AND l.status != 'paid'
                ORDER BY l.date DESC
            """
            params = (member_id, member_id)
            description = "Empréstimos que você fez"
        else:
            sql = """
                SELECT
                    l.description as descricao,
                    l.value as valor,
                    l.category as tipo,
                    l.status,
                    l.date as data
                FROM loans_loan l
                WHERE l.deleted_at IS NULL
                    AND (l.benefited_id = %s OR l.creditor_id = %s)
                ORDER BY l.date DESC
                LIMIT 10
            """
            params = (member_id, member_id)
            description = "Últimos empréstimos"

        return QueryResult(
            module="loans",
            sql=sql,
            params=params,
            display_type="table",
            description=description,
        )

    @classmethod
    def _query_library(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de biblioteca."""
        question_lower = question.lower()
        params: List[Any] = [member_id]

        # Livros que estou lendo
        if any(w in question_lower for w in ["lendo", "estou lendo", "leio"]):
            sql = """
                SELECT
                    b.title as titulo,
                    b.pages as paginas,
                    b.genre as genero,
                    b.read_status as status,
                    COALESCE(SUM(r.pages_read), 0) as paginas_lidas
                FROM library_book b
                LEFT JOIN library_reading r ON r.book_id = b.id AND r.deleted_at IS NULL
                WHERE b.deleted_at IS NULL
                    AND b.owner_id = %s
                    AND b.read_status = 'reading'
                GROUP BY b.id, b.title, b.pages, b.genre, b.read_status
            """
            description = "Livros que você está lendo"
        # Quantos livros li
        elif any(
            w in question_lower
            for w in ["quantos livros li", "livros lidos", "já li", "ja li"]
        ):
            sql = """
                SELECT
                    COUNT(*) as quantidade,
                    COALESCE(SUM(pages), 0) as total_paginas
                FROM library_book
                WHERE deleted_at IS NULL
                    AND owner_id = %s
                    AND read_status = 'read'
            """
            display_type = "text"
            description = "Livros que você já leu"
            return QueryResult(
                module="library",
                sql=sql,
                params=tuple(params),
                display_type=display_type,
                description=description,
            )
        # Leituras recentes
        elif any(w in question_lower for w in ["leitura", "leituras", "li recente"]):
            if start_date and end_date:
                sql = """
                    SELECT
                        b.title as livro,
                        r.reading_date as data,
                        r.pages_read as paginas,
                        r.reading_time as minutos
                    FROM library_reading r
                    JOIN library_book b ON b.id = r.book_id
                    WHERE r.deleted_at IS NULL
                        AND r.owner_id = %s
                        AND r.reading_date BETWEEN %s AND %s
                    ORDER BY r.reading_date DESC
                """
                params.extend([start_date, end_date])
            else:
                sql = """
                    SELECT
                        b.title as livro,
                        r.reading_date as data,
                        r.pages_read as paginas,
                        r.reading_time as minutos
                    FROM library_reading r
                    JOIN library_book b ON b.id = r.book_id
                    WHERE r.deleted_at IS NULL
                        AND r.owner_id = %s
                    ORDER BY r.reading_date DESC
                    LIMIT 10
                """
            description = f"Sessões de leitura {period_desc}"
        else:
            # Lista de livros
            sql = """
                SELECT
                    title as titulo,
                    genre as genero,
                    pages as paginas,
                    read_status as status,
                    rating as avaliacao
                FROM library_book
                WHERE deleted_at IS NULL AND owner_id = %s
                ORDER BY created_at DESC
                LIMIT 10
            """
            description = "Seus livros"

        return QueryResult(
            module="library",
            sql=sql,
            params=tuple(params),
            display_type="table",
            description=description,
        )

    @classmethod
    def _query_personal_planning(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de planejamento pessoal."""
        question_lower = question.lower()
        today = timezone.now().date()
        params: List[Any] = [member_id]

        # Tarefas de hoje
        if any(w in question_lower for w in ["hoje", "dia", "agora"]):
            sql = """
                SELECT
                    task_name as tarefa,
                    category as categoria,
                    scheduled_time as horario,
                    status,
                    target_quantity as meta,
                    quantity_completed as realizado
                FROM personal_planning_taskinstance
                WHERE deleted_at IS NULL
                    AND owner_id = %s
                    AND scheduled_date = %s
                ORDER BY scheduled_time NULLS LAST, task_name
            """
            params.append(today)
            description = "Suas tarefas de hoje"
        # Tarefas pendentes
        elif any(
            w in question_lower for w in ["pendente", "pendentes", "falta", "faltam"]
        ):
            sql = """
                SELECT
                    task_name as tarefa,
                    category as categoria,
                    scheduled_date as data,
                    status
                FROM personal_planning_taskinstance
                WHERE deleted_at IS NULL
                    AND owner_id = %s
                    AND status IN ('pending', 'in_progress')
                    AND scheduled_date <= %s
                ORDER BY scheduled_date, scheduled_time NULLS LAST
                LIMIT 15
            """
            params.append(today)
            description = "Suas tarefas pendentes"
        # Objetivos/metas
        elif any(
            w in question_lower
            for w in ["objetivo", "objetivos", "meta", "metas", "goal"]
        ):
            sql = """
                SELECT
                    title as objetivo,
                    goal_type as tipo,
                    target_value as meta,
                    current_value as atual,
                    status,
                    start_date as inicio
                FROM personal_planning_goal
                WHERE deleted_at IS NULL
                    AND owner_id = %s
                    AND status = 'active'
                ORDER BY created_at DESC
            """
            description = "Seus objetivos ativos"
        # Taxa de conclusão
        elif any(
            w in question_lower
            for w in ["conclusão", "conclusao", "concluí", "conclui", "completei"]
        ):
            sql = """
                SELECT
                    COUNT(*) FILTER (WHERE status = 'completed') as concluidas,
                    COUNT(*) as total,
                    ROUND(
                        COUNT(*) FILTER (WHERE status = 'completed')::numeric
                        / NULLIF(COUNT(*), 0) * 100,
                        1
                    ) as taxa_conclusao
                FROM personal_planning_taskinstance
                WHERE deleted_at IS NULL
                    AND owner_id = %s
                    AND scheduled_date >= %s
            """
            params.append(today - timedelta(days=7))
            display_type = "text"
            description = "Taxa de conclusão (últimos 7 dias)"
            return QueryResult(
                module="personal_planning",
                sql=sql,
                params=tuple(params),
                display_type=display_type,
                description=description,
            )
        else:
            # Tarefas rotineiras ativas
            sql = """
                SELECT
                    name as tarefa,
                    category as categoria,
                    periodicity as periodicidade,
                    target_quantity as quantidade,
                    unit as unidade,
                    is_active as ativa
                FROM personal_planning_routinetask
                WHERE deleted_at IS NULL
                    AND owner_id = %s
                    AND is_active = true
                ORDER BY category, name
            """
            description = "Suas tarefas rotineiras ativas"

        return QueryResult(
            module="personal_planning",
            sql=sql,
            params=tuple(params),
            display_type="table",
            description=description,
        )

    @classmethod
    def _query_security(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """
        Gera query para módulo de segurança (senhas).

        IMPORTANTE: Retorna dados criptografados que precisam de decriptação.
        """
        question_lower = question.lower()
        params: List[Any] = [member_id]

        # Busca por site específico
        sites = [
            "netflix",
            "spotify",
            "amazon",
            "google",
            "facebook",
            "instagram",
            "twitter",
            "linkedin",
            "github",
            "microsoft",
            "apple",
            "adobe",
            "dropbox",
            "gmail",
            "outlook",
            "nubank",
            "itau",
            "itaú",
            "bradesco",
            "santander",
            "caixa",
            "bb",
            "inter",
            "c6",
            "picpay",
            "mercadopago",
            "mercado pago",
        ]

        site_filter = None
        for site in sites:
            if site in question_lower:
                site_filter = site
                break

        if site_filter:
            sql = """
                SELECT
                    id,
                    title as titulo,
                    site,
                    username as usuario,
                    _password as senha_criptografada,
                    category as categoria
                FROM security_password
                WHERE deleted_at IS NULL
                    AND owner_id = %s
                    AND (LOWER(title) LIKE %s OR LOWER(site) LIKE %s)
                LIMIT 5
            """
            search_term = f"%{site_filter}%"
            params.extend([search_term, search_term])
            description = f"Senha para {site_filter}"
        else:
            # Lista de senhas (sem revelar)
            sql = """
                SELECT
                    id,
                    title as titulo,
                    site,
                    username as usuario,
                    _password as senha_criptografada,
                    category as categoria,
                    last_password_change as ultima_alteracao
                FROM security_password
                WHERE deleted_at IS NULL
                    AND owner_id = %s
                ORDER BY title
                LIMIT 10
            """
            description = "Suas senhas armazenadas"

        return QueryResult(
            module="security",
            sql=sql,
            params=tuple(params),
            display_type="password",
            description=description,
            requires_decryption=True,
            decryption_fields=["senha_criptografada"],
        )

    @classmethod
    def _query_vaults(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de cofres."""
        question_lower = question.lower()
        params: List[Any] = [member_id]

        # Total em cofres
        if any(w in question_lower for w in ["total", "soma", "quanto tenho guardado"]):
            sql = """
                SELECT
                    COALESCE(SUM(v.current_balance), 0) as total_guardado,
                    COALESCE(SUM(v.accumulated_yield), 0) as total_rendimentos,
                    COUNT(*) as quantidade_cofres
                FROM vaults_vault v
                JOIN accounts_account a ON a.id = v.account_id
                WHERE v.deleted_at IS NULL AND v.is_active = true
                    AND a.owner_id = %s
            """
            display_type = "currency"
            description = "Total em cofres"
        else:
            sql = """
                SELECT
                    v.description as cofre,
                    a.account_name as conta,
                    v.current_balance as saldo,
                    v.accumulated_yield as rendimentos,
                    v.yield_rate as taxa_rendimento
                FROM vaults_vault v
                JOIN accounts_account a ON a.id = v.account_id
                WHERE v.deleted_at IS NULL AND v.is_active = true
                    AND a.owner_id = %s
                ORDER BY v.current_balance DESC
            """
            display_type = "table"
            description = "Seus cofres"

        return QueryResult(
            module="vaults",
            sql=sql,
            params=tuple(params),
            display_type=display_type,
            description=description,
        )

    @classmethod
    def _query_transfers(
        cls,
        question: str,
        member_id: int,
        start_date: Optional[date],
        end_date: Optional[date],
        period_desc: str,
        aggregation: str,
        category: Optional[str],
    ) -> QueryResult:
        """Gera query para módulo de transferências."""
        base_conditions = "t.deleted_at IS NULL AND t.member_id = %s"
        params: List[Any] = [member_id]

        if start_date and end_date:
            base_conditions += " AND t.date BETWEEN %s AND %s"
            params.extend([start_date, end_date])

        if aggregation == "sum":
            sql = f"""
                SELECT
                    COALESCE(SUM(t.value), 0) as total_transferido,
                    COUNT(*) as quantidade
                FROM transfers_transfer t
                WHERE {base_conditions}
            """
            display_type = "currency"
            description = f"Total transferido {period_desc}"
        else:
            sql = f"""
                SELECT
                    t.description as descricao,
                    t.value as valor,
                    t.date as data,
                    o.account_name as origem,
                    d.account_name as destino
                FROM transfers_transfer t
                LEFT JOIN accounts_account o ON o.id = t.origin_account_id
                LEFT JOIN accounts_account d ON d.id = t.destiny_account_id
                WHERE {base_conditions}
                ORDER BY t.date DESC
                LIMIT 10
            """
            display_type = "table"
            description = f"Últimas transferências {period_desc}"

        return QueryResult(
            module="transfers",
            sql=sql,
            params=tuple(params),
            display_type=display_type,
            description=description,
        )

    @classmethod
    def _query_unknown(cls, question: str, member_id: int) -> QueryResult:
        """Query padrão quando não consegue identificar o módulo."""
        return QueryResult(
            module="unknown",
            sql="",
            params=(),
            display_type="text",
            description="Não consegui identificar sobre o que você está perguntando.",
        )
