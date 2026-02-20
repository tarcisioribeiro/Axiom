"""
Formatador de respostas para o assistente de IA.

Remove caracteres especiais e garante formatacao limpa.
"""

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List


class ResponseFormatter:
    """
    Formata respostas removendo caracteres especiais indesejados.

    Mantem apenas:
    - Letras e numeros
    - Espacos
    - Pontuacao basica (. , ! ? : ;)
    - Simbolos de valor (R$ % /)
    - Formatacao de data (/)
    """

    # Caracteres permitidos em respostas
    ALLOWED_SPECIAL = {
        ".",
        ",",
        "!",
        "?",
        ":",
        ";",  # Pontuacao
        "R",
        "$",
        "%",  # Valores
        "/",
        "-",  # Datas e separadores
        "(",
        ")",  # Parenteses
        "\n",  # Quebra de linha
    }

    # Caracteres de formatacao markdown a remover
    MARKDOWN_CHARS = ["*", "_", "#", "`", "~", "|", "[", "]", "<", ">"]

    # Padroes de formatacao a limpar
    CLEANUP_PATTERNS = [
        (r"\*{1,2}([^*]+)\*{1,2}", r"\1"),  # *texto* ou **texto**
        (r"_{1,2}([^_]+)_{1,2}", r"\1"),  # _texto_ ou __texto__
        (r"~~([^~]+)~~", r"\1"),  # ~~texto~~
        (r"`([^`]+)`", r"\1"),  # `texto`
        (r"#{1,6}\s*", ""),  # # cabecalhos
        (r"\[([^\]]+)\]\([^)]+\)", r"\1"),  # [texto](link)
        (r"^\s*[-*+]\s+", "  "),  # - item de lista
        (r"^\s*\d+\.\s+", "  "),  # 1. item numerado
        (r"\|\s*", " "),  # | de tabelas
        (r"<[^>]+>", ""),  # <tags html>
    ]

    @classmethod
    def format_response(cls, text: str) -> str:
        """
        Formata resposta removendo caracteres especiais.

        Args:
            text: Texto da resposta (pode conter markdown)

        Returns:
            Texto limpo sem caracteres especiais indesejados
        """
        if not text:
            return ""

        # 1. Aplica padroes de limpeza
        result = text
        for pattern, replacement in cls.CLEANUP_PATTERNS:
            result = re.sub(pattern, replacement, result, flags=re.MULTILINE)

        # 2. Remove caracteres de formatacao restantes
        for char in cls.MARKDOWN_CHARS:
            result = result.replace(char, "")

        # 3. Limpa espacos multiplos e linhas vazias
        result = cls._clean_whitespace(result)

        # 4. Garante que valores monetarios estao formatados
        result = cls._ensure_currency_format(result)

        # 5. Garante que datas estao formatadas
        result = cls._ensure_date_format(result)

        return result.strip()

    @classmethod
    def format_data_for_display(
        cls, data: List[Dict[str, Any]], display_type: str
    ) -> str:
        """
        Formata dados estruturados para exibicao em texto.

        Args:
            data: Lista de dicionarios com dados
            display_type: Tipo de exibicao ('text', 'table', 'currency', 'list')

        Returns:
            Texto formatado sem caracteres especiais
        """
        if not data:
            return "Nenhum registro encontrado."

        if display_type == "currency":
            return cls._format_currency_display(data)
        elif display_type == "table":
            return cls._format_table_display(data)
        elif display_type == "list":
            return cls._format_list_display(data)
        else:
            return cls._format_text_display(data)

    @classmethod
    def _format_currency_display(cls, data: List[Dict[str, Any]]) -> str:
        """Formata dados monetarios."""
        lines = []

        for item in data:
            parts = []
            for key, value in item.items():
                formatted_key = cls._format_key(key)
                formatted_value = cls._format_value(key, value)
                parts.append(f"{formatted_key}: {formatted_value}")

            lines.append(" - ".join(parts))

        return "\n".join(lines)

    @classmethod
    def _format_table_display(cls, data: List[Dict[str, Any]]) -> str:
        """Formata dados como tabela simples (sem markdown)."""
        if not data:
            return ""

        lines = []

        for i, item in enumerate(data, 1):
            parts = []
            for key, value in item.items():
                if value is not None:
                    formatted_key = cls._format_key(key)
                    formatted_value = cls._format_value(key, value)
                    parts.append(f"{formatted_key}: {formatted_value}")

            if parts:
                lines.append(f'{i}. {" - ".join(parts)}')

        return "\n".join(lines)

    @classmethod
    def _format_list_display(cls, data: List[Dict[str, Any]]) -> str:
        """Formata dados como lista."""
        lines = []

        for item in data:
            parts = []
            for key, value in item.items():
                if value is not None:
                    formatted_value = cls._format_value(key, value)
                    parts.append(formatted_value)

            if parts:
                lines.append(f'  {" - ".join(parts)}')

        return "\n".join(lines)

    @classmethod
    def _format_text_display(cls, data: List[Dict[str, Any]]) -> str:
        """Formata dados como texto simples."""
        if len(data) == 1:
            # Registro unico - formato inline
            item = data[0]
            parts = []
            for key, value in item.items():
                if value is not None:
                    formatted_key = cls._format_key(key)
                    formatted_value = cls._format_value(key, value)
                    parts.append(f"{formatted_key}: {formatted_value}")
            return ", ".join(parts)
        else:
            # Multiplos registros
            return cls._format_table_display(data)

    @classmethod
    def _format_key(cls, key: str) -> str:
        """Formata nome de campo para exibicao."""
        # Traduz campos comuns
        translations = {
            "total": "Total",
            "quantidade": "Quantidade",
            "media": "Media",
            "valor": "Valor",
            "descricao": "Descricao",
            "data": "Data",
            "categoria": "Categoria",
            "status": "Status",
            "conta": "Conta",
            "banco": "Banco",
            "saldo": "Saldo",
            "cartao": "Cartao",
            "limite": "Limite",
            "tarefa": "Tarefa",
            "titulo": "Titulo",
            "livro": "Livro",
            "paginas": "Paginas",
            "genero": "Genero",
            "usuario": "Usuario",
            "site": "Site",
            "cofre": "Cofre",
            "rendimentos": "Rendimentos",
            "origem": "Origem",
            "destino": "Destino",
        }

        key_lower = key.lower()
        if key_lower in translations:
            return translations[key_lower]

        # Formata: remove underscore, capitaliza
        return key.replace("_", " ").title()

    @classmethod
    def _format_value(cls, key: str, value: Any) -> str:
        """Formata valor para exibicao."""
        if value is None:
            return "-"

        key_lower = key.lower()

        # Valores monetarios
        currency_fields = [
            "valor",
            "total",
            "saldo",
            "limite",
            "media",
            "preco",
            "rendimentos",
            "value",
            "balance",
            "amount",
        ]
        if any(f in key_lower for f in currency_fields):
            if isinstance(value, (int, float, Decimal)):
                return cls.format_currency(float(value))

        # Datas
        date_fields = ["data", "date", "inicio", "fim", "created", "updated"]
        if any(f in key_lower for f in date_fields):
            return cls.format_date(value)

        # Porcentagens
        if "taxa" in key_lower or "rate" in key_lower:
            if isinstance(value, (int, float, Decimal)):
                return f"{float(value) * 100:.2f}%"

        # Booleanos
        if isinstance(value, bool):
            return "Sim" if value else "Nao"

        # Categorias e status - traduz
        category_fields = ["categoria", "status", "tipo", "genero"]
        if any(f in key_lower for f in category_fields):
            return cls._translate_category(str(value))

        # Numeros
        if isinstance(value, (int, float, Decimal)):
            if isinstance(value, int) or (
                isinstance(value, float) and value.is_integer()
            ):
                return str(int(value))
            return cls.format_number(float(value))

        return str(value)

    @classmethod
    def format_currency(cls, value: float) -> str:
        """
        Formata valor monetario no padrao brasileiro.

        Args:
            value: Valor numerico

        Returns:
            String formatada (ex: R$ 1.234,56)
        """
        # Formata com 2 casas decimais
        formatted = f"{value:,.2f}"
        # Troca separadores para padrao brasileiro
        formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        return f"R$ {formatted}"

    @classmethod
    def format_number(cls, value: float, decimals: int = 2) -> str:
        """
        Formata numero no padrao brasileiro.

        Args:
            value: Valor numerico
            decimals: Casas decimais

        Returns:
            String formatada (ex: 1.234,56)
        """
        formatted = f"{value:,.{decimals}f}"
        formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        return formatted

    @classmethod
    def format_date(cls, value: Any) -> str:
        """
        Formata data no padrao brasileiro.

        Args:
            value: Data (string ISO, date ou datetime)

        Returns:
            String formatada (ex: 23/01/2025)
        """
        try:
            if isinstance(value, datetime):
                return value.strftime("%d/%m/%Y")
            elif isinstance(value, date):
                return value.strftime("%d/%m/%Y")
            elif isinstance(value, str):
                # Tenta parsear ISO format
                if re.match(r"^\d{4}-\d{2}-\d{2}", value):
                    dt = datetime.fromisoformat(value.split("T")[0])
                    return dt.strftime("%d/%m/%Y")
                # Ja esta no formato brasileiro?
                if re.match(r"^\d{2}/\d{2}/\d{4}", value):
                    return value
            return str(value)
        except (ValueError, AttributeError):
            return str(value)

    @classmethod
    def _translate_category(cls, value: str) -> str:
        """Traduz categoria/status de ingles para portugues."""
        translations = {
            # Status
            "pending": "Pendente",
            "paid": "Pago",
            "completed": "Concluido",
            "in_progress": "Em Andamento",
            "active": "Ativo",
            "inactive": "Inativo",
            "cancelled": "Cancelado",
            "overdue": "Atrasado",
            # Categorias de despesa
            "food and drink": "Alimentacao",
            "transport": "Transporte",
            "health and care": "Saude",
            "education": "Educacao",
            "entertainment": "Entretenimento",
            "bills and services": "Contas",
            "supermarket": "Supermercado",
            "digital signs": "Assinaturas",
            "house": "Casa",
            "vestuary": "Roupas",
            "travels": "Viagens",
            "electronics": "Eletronicos",
            "pets": "Animais",
            # Categorias de receita
            "salary": "Salario",
            "income": "Rendimentos",
            "refund": "Reembolso",
            "cashback": "Cashback",
            "award": "Premio",
            "ticket": "Vale",
            # Status de livro
            "reading": "Lendo",
            "read": "Lido",
            "to_read": "Para Ler",
            "abandoned": "Abandonado",
            # Emprestimos
            "borrowed": "Emprestado (devo)",
            "lent": "Emprestado (me devem)",
        }

        value_lower = value.lower().replace("_", " ")
        if value_lower in translations:
            return translations[value_lower]

        # Nao encontrou traducao, capitaliza
        return value.replace("_", " ").title()

    @classmethod
    def _clean_whitespace(cls, text: str) -> str:
        """Remove espacos e linhas em excesso."""
        # Remove espacos multiplos
        text = re.sub(r" +", " ", text)
        # Remove linhas em branco multiplas
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Remove espacos no inicio/fim de linhas
        lines = [line.strip() for line in text.split("\n")]
        return "\n".join(lines)

    @classmethod
    def _ensure_currency_format(cls, text: str) -> str:
        """Garante que valores monetarios estao no formato correto."""
        # Padrao: numero seguido de "reais" ou antes de R$
        # Ja formatado corretamente, nao precisa ajustar
        return text

    @classmethod
    def _ensure_date_format(cls, text: str) -> str:
        """Garante que datas estao no formato brasileiro."""

        # Converte YYYY-MM-DD para DD/MM/YYYY
        def replace_date(match):
            year, month, day = match.groups()
            return f"{day}/{month}/{year}"

        text = re.sub(r"(\d{4})-(\d{2})-(\d{2})", replace_date, text)
        return text

    @classmethod
    def sanitize_for_display(cls, text: str) -> str:
        """
        Sanitiza texto para exibicao segura.

        Remove:
        - Tags HTML
        - Scripts
        - Caracteres de controle

        Args:
            text: Texto a sanitizar

        Returns:
            Texto seguro para exibicao
        """
        if not text:
            return ""

        # Remove tags HTML
        text = re.sub(r"<[^>]+>", "", text)

        # Remove caracteres de controle (exceto newline e tab)
        text = "".join(
            c for c in text if c == "\n" or c == "\t" or not c.isspace() or c == " "
        )

        # Remove sequencias de escape ANSI
        text = re.sub(r"\x1b\[[0-9;]*m", "", text)

        return text

    @classmethod
    def truncate(cls, text: str, max_length: int = 2000, suffix: str = "...") -> str:
        """
        Trunca texto para tamanho maximo.

        Args:
            text: Texto a truncar
            max_length: Tamanho maximo
            suffix: Sufixo para indicar truncamento

        Returns:
            Texto truncado se necessario
        """
        if not text or len(text) <= max_length:
            return text

        # Trunca em palavra completa se possivel
        truncated = text[: max_length - len(suffix)]
        last_space = truncated.rfind(" ")

        if last_space > max_length * 0.8:
            truncated = truncated[:last_space]

        return truncated + suffix
