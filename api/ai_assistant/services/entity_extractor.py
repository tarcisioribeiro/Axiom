"""
Extrator de entidades para o assistente de IA.

Extrai datas, valores, categorias e outras entidades do texto.
"""

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from django.utils import timezone

try:
    from rapidfuzz import fuzz, process

    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False

try:
    import dateparser

    DATEPARSER_AVAILABLE = True
except ImportError:
    DATEPARSER_AVAILABLE = False

from .text_preprocessor import TextPreprocessor


@dataclass
class DateRange:
    """Representa um intervalo de datas."""

    start: Optional[date] = None
    end: Optional[date] = None
    description: str = "todo o periodo"
    confidence: float = 1.0


@dataclass
class ExtractedEntities:
    """Resultado da extracao de entidades."""

    date_range: DateRange = field(default_factory=DateRange)
    categories: List[str] = field(default_factory=list)
    values: List[float] = field(default_factory=list)
    names: List[str] = field(default_factory=list)
    module_hints: List[str] = field(default_factory=list)
    raw_entities: Dict[str, Any] = field(default_factory=dict)


class EntityExtractor:
    """
    Extrai entidades de perguntas em linguagem natural.

    Suporta:
    - Datas e intervalos temporais
    - Categorias (com fuzzy matching)
    - Valores monetarios
    - Nomes proprios
    """

    # Mapeamento de meses
    MONTHS = {
        "janeiro": 1,
        "jan": 1,
        "fevereiro": 2,
        "fev": 2,
        "marco": 3,
        "mar": 3,
        "abril": 4,
        "abr": 4,
        "maio": 5,
        "mai": 5,
        "junho": 6,
        "jun": 6,
        "julho": 7,
        "jul": 7,
        "agosto": 8,
        "ago": 8,
        "setembro": 9,
        "set": 9,
        "outubro": 10,
        "out": 10,
        "novembro": 11,
        "nov": 11,
        "dezembro": 12,
        "dez": 12,
    }

    # Categorias conhecidas por modulo (para fuzzy matching)
    KNOWN_CATEGORIES: Dict[str, Dict[str, str]] = {
        "expenses": {
            # Alimentacao
            "alimentacao": "food and drink",
            "comida": "food and drink",
            "refeicao": "food and drink",
            "restaurante": "food and drink",
            "lanche": "food and drink",
            "almoco": "food and drink",
            "jantar": "food and drink",
            "cafe": "food and drink",
            "delivery": "food and drink",
            "ifood": "food and drink",
            # Supermercado
            "supermercado": "supermarket",
            "mercado": "supermarket",
            "feira": "supermarket",
            "hortifruti": "supermarket",
            # Transporte
            "transporte": "transport",
            "uber": "transport",
            "99": "transport",
            "taxi": "transport",
            "onibus": "transport",
            "metro": "transport",
            "gasolina": "transport",
            "combustivel": "transport",
            "estacionamento": "transport",
            "pedagio": "transport",
            # Saude
            "saude": "health and care",
            "farmacia": "health and care",
            "remedio": "health and care",
            "medico": "health and care",
            "consulta": "health and care",
            "exame": "health and care",
            "dentista": "health and care",
            "hospital": "health and care",
            # Educacao
            "educacao": "education",
            "curso": "education",
            "faculdade": "education",
            "escola": "education",
            "livro": "education",
            "material": "education",
            # Assinaturas
            "streaming": "digital signs",
            "assinatura": "digital signs",
            "netflix": "digital signs",
            "spotify": "digital signs",
            "amazon": "digital signs",
            "disney": "digital signs",
            "hbo": "digital signs",
            "youtube": "digital signs",
            # Entretenimento
            "entretenimento": "entertainment",
            "lazer": "entertainment",
            "cinema": "entertainment",
            "teatro": "entertainment",
            "show": "entertainment",
            "festa": "entertainment",
            "bar": "entertainment",
            "jogo": "entertainment",
            # Viagens
            "viagem": "travels",
            "hotel": "travels",
            "pousada": "travels",
            "passagem": "travels",
            "hospedagem": "travels",
            "airbnb": "travels",
            # Vestuario
            "roupa": "vestuary",
            "calcado": "vestuary",
            "tenis": "vestuary",
            "sapato": "vestuary",
            # Casa
            "casa": "house",
            "aluguel": "house",
            "moveis": "house",
            "decoracao": "house",
            "reforma": "house",
            # Contas
            "condominio": "bills and services",
            "luz": "bills and services",
            "energia": "bills and services",
            "agua": "bills and services",
            "gas": "bills and services",
            "internet": "bills and services",
            "telefone": "bills and services",
            "celular": "bills and services",
            # Eletronicos
            "eletronico": "electronics",
            "computador": "electronics",
            "notebook": "electronics",
            "tablet": "electronics",
            # Pet
            "pet": "pets",
            "cachorro": "pets",
            "gato": "pets",
            "racao": "pets",
            "veterinario": "pets",
            # Outros
            "imposto": "taxes",
            "taxa": "rates",
            "doacao": "donate",
        },
        "revenues": {
            "salario": "salary",
            "holerite": "salary",
            "contracheque": "salary",
            "decimo": "salary",
            "13o": "salary",
            "ferias": "salary",
            "freelance": "income",
            "freela": "income",
            "rendimento": "income",
            "dividendo": "income",
            "juros": "income",
            "investimento": "income",
            "lucro": "income",
            "reembolso": "refund",
            "devolucao": "refund",
            "estorno": "refund",
            "cashback": "cashback",
            "premio": "award",
            "bonus": "award",
            "gratificacao": "award",
            "vale": "ticket",
            "vr": "ticket",
            "va": "ticket",
            "vt": "ticket",
            "comissao": "income",
            "aluguel": "income",
            "pensao": "income",
            "aposentadoria": "income",
        },
        "library": {
            "filosofia": "philosophy",
            "historia": "history",
            "psicologia": "psychology",
            "autoajuda": "self_help",
            "ficcao": "fiction",
            "romance": "romance",
            "fantasia": "fantasy",
            "terror": "horror",
            "suspense": "thriller",
            "misterio": "mystery",
            "biografia": "biography",
            "negocios": "business",
            "tecnologia": "technology",
            "programacao": "programming",
            "religiao": "religion",
            "espiritualidade": "spirituality",
            "poesia": "poetry",
            "classico": "classic",
            "infantil": "children",
            "quadrinhos": "comics",
            "manga": "manga",
        },
        "personal_planning": {
            "saude": "health",
            "estudos": "studies",
            "estudo": "studies",
            "espiritual": "spiritual",
            "oracao": "spiritual",
            "meditacao": "meditation",
            "exercicio": "exercise",
            "academia": "exercise",
            "treino": "exercise",
            "leitura": "reading",
            "trabalho": "work",
            "familia": "family",
            "casa": "household",
            "limpeza": "household",
            "criatividade": "creativity",
            "sono": "sleep",
            "hidratacao": "hydration",
            "gratidao": "gratitude",
        },
        "security": {
            "banco": "banking",
            "financeiro": "finance",
            "rede social": "social",
            "email": "email",
            "streaming": "streaming",
            "trabalho": "work",
            "empresa": "work",
            "jogos": "gaming",
            "games": "gaming",
            "compras": "shopping",
            "loja": "shopping",
            "governo": "government",
            "gov": "government",
            "saude": "healthcare",
            "educacao": "education",
            "desenvolvimento": "development",
            "programacao": "development",
            "nuvem": "cloud",
            "cloud": "cloud",
        },
    }

    @classmethod
    def extract(cls, text: str, module: Optional[str] = None) -> ExtractedEntities:
        """
        Extrai todas as entidades do texto.

        Args:
            text: Pergunta do usuario
            module: Modulo detectado (opcional, melhora precisao de categorias)

        Returns:
            ExtractedEntities com todas as entidades encontradas
        """
        preprocessed = TextPreprocessor.preprocess(text)
        normalized = TextPreprocessor.normalize_for_comparison(text)

        entities = ExtractedEntities()

        # Extrai intervalo de datas
        entities.date_range = cls._extract_date_range(preprocessed)

        # Extrai categorias
        if module:
            entities.categories = cls._extract_categories(normalized, module)
        else:
            # Tenta em todos os modulos
            for mod in cls.KNOWN_CATEGORIES.keys():
                cats = cls._extract_categories(normalized, mod)
                entities.categories.extend(cats)

        # Extrai valores monetarios
        entities.values = cls._extract_monetary_values(text)

        # Extrai nomes (para busca de senhas, livros, etc.)
        entities.names = cls._extract_names(preprocessed)

        return entities

    @classmethod
    def _extract_date_range(cls, text: str) -> DateRange:
        """
        Extrai intervalo de datas do texto.

        Suporta:
        - Datas relativas (hoje, ontem, semana passada)
        - Datas especificas (01/01/2024)
        - Intervalos (entre X e Y, desde X)
        - Meses (janeiro, fev)
        """
        today = timezone.now().date()
        text_lower = text.lower()

        # Hoje
        if any(w in text_lower for w in ["hoje", "dia de hoje", "neste dia"]):
            return DateRange(today, today, "hoje")

        # Ontem
        if any(w in text_lower for w in ["ontem", "dia de ontem"]):
            yesterday = today - timedelta(days=1)
            return DateRange(yesterday, yesterday, "ontem")

        # Anteontem
        if any(w in text_lower for w in ["anteontem", "antes de ontem"]):
            day_before = today - timedelta(days=2)
            return DateRange(day_before, day_before, "anteontem")

        # Esta semana
        if any(
            w in text_lower
            for w in ["esta semana", "essa semana", "semana atual", "nesta semana"]
        ):
            start = today - timedelta(days=today.weekday())
            return DateRange(start, today, "esta semana")

        # Semana passada
        if any(
            w in text_lower
            for w in ["semana passada", "ultima semana", "semana anterior"]
        ):
            start = today - timedelta(days=today.weekday() + 7)
            end = start + timedelta(days=6)
            return DateRange(start, end, "semana passada")

        # Ultimas X semanas
        match = re.search(r"ultimas?\s+(\d+)\s+semanas?", text_lower)
        if match:
            weeks = int(match.group(1))
            start = today - timedelta(weeks=weeks)
            return DateRange(start, today, f"ultimas {weeks} semanas")

        # Este mes
        if any(
            w in text_lower
            for w in ["este mes", "mes atual", "neste mes", "esse mes", "mes corrente"]
        ):
            start = today.replace(day=1)
            return DateRange(start, today, "este mes")

        # Mes passado
        if any(w in text_lower for w in ["mes passado", "ultimo mes", "mes anterior"]):
            first_day_this_month = today.replace(day=1)
            last_day_last_month = first_day_this_month - timedelta(days=1)
            first_day_last_month = last_day_last_month.replace(day=1)
            return DateRange(first_day_last_month, last_day_last_month, "mes passado")

        # Ultimos X meses
        match = re.search(r"ultimos?\s+(\d+)\s+mes(?:es)?", text_lower)
        if match:
            months_count = int(match.group(1))
            year = today.year
            month = today.month - months_count
            while month <= 0:
                month += 12
                year -= 1
            start = date(year, month, 1)
            return DateRange(start, today, f"ultimos {months_count} meses")

        # Ultimos X dias
        match = re.search(r"ultimos?\s+(\d+)\s+dias?", text_lower)
        if match:
            days = int(match.group(1))
            start = today - timedelta(days=days)
            return DateRange(start, today, f"ultimos {days} dias")

        # Este trimestre
        if any(
            w in text_lower
            for w in ["este trimestre", "trimestre atual", "neste trimestre"]
        ):
            quarter = (today.month - 1) // 3
            start = date(today.year, quarter * 3 + 1, 1)
            return DateRange(start, today, "este trimestre")

        # Trimestre passado
        if any(w in text_lower for w in ["trimestre passado", "ultimo trimestre"]):
            quarter = (today.month - 1) // 3
            if quarter == 0:
                start = date(today.year - 1, 10, 1)
                end = date(today.year - 1, 12, 31)
            else:
                start = date(today.year, (quarter - 1) * 3 + 1, 1)
                end = date(today.year, quarter * 3, 1) - timedelta(days=1)
            return DateRange(start, end, "trimestre passado")

        # Este semestre
        if any(
            w in text_lower
            for w in ["este semestre", "semestre atual", "neste semestre"]
        ):
            if today.month <= 6:
                start = date(today.year, 1, 1)
            else:
                start = date(today.year, 7, 1)
            return DateRange(start, today, "este semestre")

        # Este ano
        if any(
            w in text_lower for w in ["este ano", "ano atual", "neste ano", "esse ano"]
        ):
            start = today.replace(month=1, day=1)
            return DateRange(start, today, "este ano")

        # Ano passado
        if any(w in text_lower for w in ["ano passado", "ultimo ano", "ano anterior"]):
            start = today.replace(year=today.year - 1, month=1, day=1)
            end = today.replace(year=today.year - 1, month=12, day=31)
            return DateRange(start, end, "ano passado")

        # Ultimos X anos
        match = re.search(r"ultimos?\s+(\d+)\s+anos?", text_lower)
        if match:
            years = int(match.group(1))
            start = date(today.year - years, today.month, today.day)
            return DateRange(start, today, f"ultimos {years} anos")

        # Desde + data
        match = re.search(r"desde\s+(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})", text_lower)
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
                return DateRange(start, today, f"desde {day:02d}/{month:02d}/{year}")
            except ValueError:
                pass

        # Entre datas
        match = re.search(
            r"entre\s+(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})"
            r"\s+e\s+(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})",
            text_lower,
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
                return DateRange(
                    start, end, f"{d1:02d}/{m1:02d}/{y1} a {d2:02d}/{m2:02d}/{y2}"
                )
            except ValueError:
                pass

        # Mes especifico com ano
        match = re.search(
            r"(?:em\s+|de\s+)?"
            r"(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto"
            r"|setembro|outubro|novembro|dezembro"
            r"|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)"
            r"(?:\s+de\s+|\s*/\s*|\s+)(\d{4})",
            text_lower,
        )
        if match:
            month_name = match.group(1)
            year = int(match.group(2))
            month_num = cls.MONTHS.get(month_name, 1)
            start = date(year, month_num, 1)
            if month_num == 12:
                end = date(year, 12, 31)
            else:
                end = date(year, month_num + 1, 1) - timedelta(days=1)
            return DateRange(start, end, f"{month_name.capitalize()} de {year}")

        # Mes especifico sem ano
        for month_name, month_num in cls.MONTHS.items():
            pattern = rf"\b{month_name}\b"
            if re.search(pattern, text_lower):
                year = today.year
                if month_num > today.month:
                    year -= 1
                start = date(year, month_num, 1)
                if month_num == 12:
                    end = date(year, 12, 31)
                else:
                    end = date(year, month_num + 1, 1) - timedelta(days=1)
                return DateRange(start, end, month_name.capitalize())

        # Ano especifico
        match = re.search(r"(?:em|no\s+ano\s+de|ano\s+de)\s+(\d{4})", text_lower)
        if match:
            year = int(match.group(1))
            start = date(year, 1, 1)
            end = date(year, 12, 31)
            return DateRange(start, end, f"ano de {year}")

        # Tenta dateparser se disponivel
        if DATEPARSER_AVAILABLE:
            date_range = cls._try_dateparser(text_lower, today)
            if date_range:
                return date_range

        # Nenhuma data encontrada
        return DateRange(description="todo o periodo")

    @classmethod
    def _try_dateparser(cls, text: str, today: date) -> Optional[DateRange]:
        """Tenta extrair data usando dateparser."""
        try:
            parsed = dateparser.parse(
                text,
                languages=["pt"],
                settings={
                    "PREFER_DATES_FROM": "past",
                    "RELATIVE_BASE": timezone.now(),
                },
            )
            if parsed:
                parsed_date = parsed.date()
                return DateRange(
                    parsed_date,
                    parsed_date,
                    parsed_date.strftime("%d/%m/%Y"),
                    confidence=0.7,
                )
        except Exception:
            pass
        return None

    @classmethod
    def _extract_categories(cls, text: str, module: str) -> List[str]:
        """
        Extrai categorias do texto usando matching exato e fuzzy.

        Args:
            text: Texto normalizado (sem acentos)
            module: Modulo para buscar categorias

        Returns:
            Lista de categorias encontradas (valores do banco)
        """
        if module not in cls.KNOWN_CATEGORIES:
            return []

        categories = cls.KNOWN_CATEGORIES[module]
        found = []
        text_lower = text.lower()

        # Primeiro, tenta matching exato
        for keyword, category in categories.items():
            if keyword in text_lower:
                if category not in found:
                    found.append(category)

        # Se nao encontrou e rapidfuzz disponivel, tenta fuzzy
        if not found and RAPIDFUZZ_AVAILABLE:
            keywords = list(categories.keys())
            words = text_lower.split()

            for word in words:
                if len(word) < 3:
                    continue

                matches = process.extract(word, keywords, scorer=fuzz.ratio, limit=1)
                if matches:
                    best_match, score, _ = matches[0]
                    if score >= 80:  # Threshold de similaridade
                        category = categories[best_match]
                        if category not in found:
                            found.append(category)

        return found

    @classmethod
    def _extract_monetary_values(cls, text: str) -> List[float]:
        """
        Extrai valores monetarios do texto.

        Suporta formatos:
        - R$ 1.234,56
        - 1234.56
        - 1.234,56
        - 1234
        """
        values = []

        # Padrao R$ X.XXX,XX
        pattern_br = r"R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)"
        for match in re.finditer(pattern_br, text):
            value_str = match.group(1).replace(".", "").replace(",", ".")
            try:
                values.append(float(value_str))
            except ValueError:
                pass

        # Padrao numerico brasileiro sem R$
        pattern_numeric = r"(\d{1,3}(?:\.\d{3})*,\d{2})"
        for match in re.finditer(pattern_numeric, text):
            value_str = match.group(1).replace(".", "").replace(",", ".")
            try:
                values.append(float(value_str))
            except ValueError:
                pass

        return values

    @classmethod
    def _extract_names(cls, text: str) -> List[str]:
        """
        Extrai possíveis nomes proprios do texto.

        Usado para buscar senhas, livros, etc.
        """
        names = []

        # Padroes de nome apos "do", "da", "de"
        patterns = [
            r"senha\s+(?:do|da|de)\s+([a-zA-Z0-9]+)",
            r"credencial\s+(?:do|da|de)\s+([a-zA-Z0-9]+)",
            r"login\s+(?:do|da|de)\s+([a-zA-Z0-9]+)",
            r"acesso\s+(?:ao|a)\s+([a-zA-Z0-9]+)",
            r'livro\s+(["\']?)([^"\']+)\1',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                # Pega o ultimo grupo nao vazio
                groups = [g for g in match.groups() if g and g.strip()]
                if groups:
                    names.append(groups[-1].strip())

        # Servicos conhecidos
        known_services = [
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
            "nubank",
            "itau",
            "bradesco",
            "santander",
            "caixa",
            "inter",
            "c6",
            "picpay",
            "mercadopago",
            "uber",
            "ifood",
            "steam",
            "playstation",
            "xbox",
            "discord",
            "telegram",
            "whatsapp",
            "zoom",
            "slack",
            "notion",
            "figma",
            "canva",
        ]

        text_lower = text.lower()
        for service in known_services:
            if service in text_lower:
                names.append(service)

        return list(set(names))
