"""
Post-processador de respostas LLM para exibição no frontend.

Pipeline executado na ordem:
1. Remoção de blocos <think>…</think> (chain-of-thought do DeepSeek R1)
2. Tradução de termos de domínio EN → PT-BR (categorias de despesa/receita)
3. Inserção de linha separadora em tabelas Markdown sem separador
4. Colapso de múltiplas linhas em branco consecutivas
"""

import re
from typing import Final

# ── Categorias de despesa — valores exatos do banco (EXPENSES_CATEGORIES) ────

_EXPENSE_CATEGORIES: Final[dict[str, str]] = {
    "food and drink": "Comida e Bebida",
    "bills and services": "Contas e Serviços",
    "electronics": "Eletrônicos",
    "family and friends": "Amizades e Família",
    "pets": "Animais de Estimação",
    "digital signs": "Assinaturas Digitais",
    "house": "Casa",
    "purchases": "Compras",
    "donate": "Doações",
    "education": "Educação",
    "loans": "Empréstimos",
    "entertainment": "Entretenimento",
    "taxes": "Impostos",
    "investments": "Investimentos",
    "others": "Outros",
    "vestuary": "Roupas",
    "health and care": "Saúde e Cuidados Pessoais",
    "professional services": "Serviços Profissionais",
    "supermarket": "Supermercado",
    "rates": "Taxas",
    "transport": "Transporte",
    "travels": "Viagens",
}

# ── Categorias de receita — valores exatos do banco (REVENUES_CATEGORIES) ────

_REVENUE_CATEGORIES: Final[dict[str, str]] = {
    "loan_devolution": "Devolução de Empréstimo",
    "received_loan": "Empréstimo Recebido",
    "deposit": "Depósito",
    "award": "Prêmio",
    "salary": "Salário",
    "ticket": "Vale",
    "income": "Rendimentos",
    "refund": "Reembolso",
    "cashback": "Cashback",
    "transfer": "Transferência Recebida",
}

# ── Dicionário unificado e regex compilado ───────────────────────────────────

_ALL_TERMS: Final[dict[str, str]] = {
    **_EXPENSE_CATEGORIES,
    **_REVENUE_CATEGORIES,
}

# Termos ordenados do mais longo ao mais curto — evita match parcial de
# substrings (e.g. "food" não deve substituir antes de "food and drink").
_sorted_terms = sorted(_ALL_TERMS.keys(), key=len, reverse=True)

# Limites de palavra estendidos para acentos (evita match dentro de palavras
# portuguesas). Usa lookahead/lookbehind em vez de \b por compatibilidade com
# caracteres acentuados.
_TERM_RE: re.Pattern[str] = re.compile(
    r"(?<![A-Za-zÀ-ÿ\-_])(?:"
    + "|".join(re.escape(t) for t in _sorted_terms)
    + r")(?![A-Za-zÀ-ÿ\-_])",
    re.IGNORECASE,
)

# ── Funções de processamento ─────────────────────────────────────────────────


def strip_think_blocks(text: str) -> str:
    """Remove blocos <think>…</think> do DeepSeek R1 antes de exibir."""
    return re.sub(
        r"<think>.*?</think>\s*", "", text, flags=re.DOTALL | re.IGNORECASE
    ).strip()


def translate_domain_terms(text: str) -> str:
    """
    Substitui categorias EN pelos equivalentes PT-BR.

    Segmentos dentro de blocos de código fenced (``` ```) ou inline (`)
    são preservados sem alteração.
    """
    # Divide em: [texto, bloco-código, texto, bloco-código, ...]
    parts = re.split(r"(```[\s\S]*?```|`[^`\n]+`)", text)
    result: list[str] = []
    for idx, part in enumerate(parts):
        if idx % 2 == 1:
            # Bloco de código — não traduz
            result.append(part)
        else:
            result.append(
                _TERM_RE.sub(lambda m: _ALL_TERMS[m.group(0).lower()], part)
            )
    return "".join(result)


def fix_markdown_tables(text: str) -> str:
    """
    Insere linha separadora (| --- | --- |) em tabelas Markdown sem ela.

    Só age na primeira linha de uma tabela (cabeçalho): linha com pipes que
    não é precedida por outra linha de tabela e cuja próxima linha é de dados
    (não é separadora).
    """
    lines = text.splitlines()
    result: list[str] = []

    for idx, line in enumerate(lines):
        result.append(line)
        prev = lines[idx - 1] if idx > 0 else ""
        nxt = lines[idx + 1] if idx + 1 < len(lines) else ""

        is_header = (
            _is_table_row(line)
            and not _is_separator_row(line)
            and not _is_table_row(prev)  # primeira linha do bloco de tabela
            and _is_table_row(nxt)
            and not _is_separator_row(nxt)  # próxima linha não é já separadora
        )
        if is_header:
            n_cols = _count_cols(line)
            result.append("| " + " | ".join(["---"] * n_cols) + " |")

    return "\n".join(result)


def clean_whitespace(text: str) -> str:
    """Colapsa 3+ linhas em branco consecutivas para no máximo 2."""
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def format_response(text: str) -> str:
    """Pipeline completo de pós-processamento da resposta do agente."""
    text = strip_think_blocks(text)
    text = translate_domain_terms(text)
    text = fix_markdown_tables(text)
    text = clean_whitespace(text)
    return text


# ── Helpers internos ─────────────────────────────────────────────────────────


def _is_table_row(line: str) -> bool:
    stripped = line.strip()
    return (
        stripped.startswith("|")
        and stripped.endswith("|")
        and len(stripped) > 2
    )


def _is_separator_row(line: str) -> bool:
    """True se a linha é uma linha separadora de tabela Markdown."""
    return bool(re.match(r"^\s*\|[\s\-:|]+(\|[\s\-:|]+)*\|\s*$", line))


def _count_cols(line: str) -> int:
    """Conta colunas em uma linha de tabela Markdown pelo número de pipes."""
    return max(1, line.count("|") - 1)
