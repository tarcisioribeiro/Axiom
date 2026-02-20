"""
Cliente HTTP para comunicacao com Ollama.

Envia prompts estruturados e recebe respostas em linguagem natural.
Integrado com ResponseFormatter para garantir respostas limpas.
"""

import logging
import os
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

import requests
from requests.exceptions import RequestException, Timeout

from .response_formatter import ResponseFormatter

logger = logging.getLogger(__name__)


# Dicionário de traduções de inglês para português
TRANSLATIONS = {
    # Categorias de despesas
    "food and drink": "Alimentação",
    "food": "Alimentação",
    "bills and services": "Contas e Serviços",
    "electronics": "Eletrônicos",
    "family and friends": "Família e Amigos",
    "pets": "Animais de Estimação",
    "digital signs": "Assinaturas Digitais",
    "subscriptions": "Assinaturas",
    "house": "Casa",
    "home": "Casa",
    "housing": "Moradia",
    "purchases": "Compras",
    "shopping": "Compras",
    "donate": "Doações",
    "donation": "Doações",
    "education": "Educação",
    "loans": "Empréstimos",
    "entertainment": "Entretenimento",
    "leisure": "Lazer",
    "taxes": "Impostos",
    "investments": "Investimentos",
    "others": "Outros",
    "other": "Outro",
    "vestuary": "Roupas",
    "clothing": "Roupas",
    "health and care": "Saúde",
    "health": "Saúde",
    "healthcare": "Saúde",
    "professional services": "Serviços Profissionais",
    "services": "Serviços",
    "supermarket": "Supermercado",
    "groceries": "Supermercado",
    "rates": "Taxas",
    "fees": "Taxas",
    "transport": "Transporte",
    "transportation": "Transporte",
    "travels": "Viagens",
    "travel": "Viagens",
    "utilities": "Utilidades",
    "insurance": "Seguros",
    "personal": "Pessoal",
    "beauty": "Beleza",
    "fitness": "Fitness",
    "gym": "Academia",
    # Categorias de receitas
    "deposit": "Depósito",
    "award": "Prêmio",
    "bonus": "Bônus",
    "salary": "Salário",
    "ticket": "Vale",
    "income": "Rendimentos",
    "interest": "Juros",
    "dividend": "Dividendos",
    "refund": "Reembolso",
    "cashback": "Cashback",
    "transfer": "Transferência",
    "received_loan": "Empréstimo Recebido",
    "loan_devolution": "Devolução de Empréstimo",
    "freelance": "Freelance",
    "rental": "Aluguel Recebido",
    "commission": "Comissão",
    "gift": "Presente",
    "inheritance": "Herança",
    "sale": "Venda",
    "reimbursement": "Reembolso",
    "pension": "Pensão",
    "retirement": "Aposentadoria",
    "investment_return": "Retorno de Investimento",
    # Status de pagamento
    "pending": "Pendente",
    "paid": "Pago",
    "overdue": "Atrasado",
    "cancelled": "Cancelado",
    "scheduled": "Agendado",
    "processing": "Processando",
    "active": "Ativo",
    "inactive": "Inativo",
    "completed": "Concluído",
    "in_progress": "Em Andamento",
    # Status de empréstimos
    "borrowed": "Emprestado (devo)",
    "lent": "Emprestado (me devem)",
    # Tipos de conta
    "checking": "Conta Corrente",
    "savings": "Conta Poupança",
    "investment": "Investimento",
    "credit": "Crédito",
    # Categorias de senhas
    "social": "Redes Sociais",
    "email": "E-mail",
    "banking": "Banco",
    "bank": "Banco",
    "streaming": "Streaming",
    "gaming": "Jogos",
    "work": "Trabalho",
    "government": "Governo",
    "finance": "Finanças",
    "financial": "Financeiro",
    "communication": "Comunicação",
    "productivity": "Produtividade",
    "development": "Desenvolvimento",
    "cloud": "Nuvem",
    "security": "Segurança",
    "crypto": "Criptomoedas",
    "cryptocurrency": "Criptomoedas",
    # Gêneros de livros
    "fiction": "Ficção",
    "non_fiction": "Não-Ficção",
    "nonfiction": "Não-Ficção",
    "fantasy": "Fantasia",
    "science_fiction": "Ficção Científica",
    "scifi": "Ficção Científica",
    "mystery": "Mistério",
    "thriller": "Suspense",
    "romance": "Romance",
    "horror": "Terror",
    "biography": "Biografia",
    "autobiography": "Autobiografia",
    "history": "História",
    "self_help": "Autoajuda",
    "selfhelp": "Autoajuda",
    "business": "Negócios",
    "psychology": "Psicologia",
    "philosophy": "Filosofia",
    "religion": "Religião",
    "spirituality": "Espiritualidade",
    "science": "Ciência",
    "technology": "Tecnologia",
    "programming": "Programação",
    "art": "Arte",
    "poetry": "Poesia",
    "drama": "Drama",
    "comedy": "Comédia",
    "adventure": "Aventura",
    "children": "Infantil",
    "young_adult": "Jovem Adulto",
    "cooking": "Culinária",
    "sports": "Esportes",
    "music": "Música",
    "graphic_novel": "Graphic Novel",
    "manga": "Mangá",
    "comics": "Quadrinhos",
    "classic": "Clássico",
    "contemporary": "Contemporâneo",
    "literary": "Literário",
    "dystopian": "Distopia",
    "paranormal": "Paranormal",
    "crime": "Crime",
    "detective": "Detetive",
    "political": "Político",
    "economics": "Economia",
    "sociology": "Sociologia",
    "anthropology": "Antropologia",
    # Status de leitura
    "to_read": "Para Ler",
    "reading": "Lendo",
    "read": "Lido",
    "abandoned": "Abandonado",
    "on_hold": "Em Pausa",
    # Categorias de tarefas
    "studies": "Estudos",
    "spiritual": "Espiritual",
    "exercise": "Exercício",
    "nutrition": "Nutrição",
    "meditation": "Meditação",
    "writing": "Escrita",
    "family": "Família",
    "household": "Casa",
    "personal_care": "Cuidados Pessoais",
    "creativity": "Criatividade",
    "learning": "Aprendizado",
    "career": "Carreira",
    "relationships": "Relacionamentos",
    "mindfulness": "Mindfulness",
    "sleep": "Sono",
    "hydration": "Hidratação",
    "gratitude": "Gratidão",
    "journaling": "Diário",
    "planning": "Planejamento",
    "review": "Revisão",
    # Periodicidade
    "daily": "Diário",
    "weekly": "Semanal",
    "biweekly": "Quinzenal",
    "monthly": "Mensal",
    "bimonthly": "Bimestral",
    "quarterly": "Trimestral",
    "semiannual": "Semestral",
    "annual": "Anual",
    "yearly": "Anual",
    "once": "Uma vez",
    # Bandeiras de cartão
    "visa": "Visa",
    "mastercard": "Mastercard",
    "elo": "Elo",
    "amex": "American Express",
    "american express": "American Express",
    "hipercard": "Hipercard",
    "diners": "Diners Club",
    # Status de fatura
    "open": "Aberta",
    "closed": "Fechada",
    # Termos comuns
    "total": "Total",
    "average": "Média",
    "minimum": "Mínimo",
    "maximum": "Máximo",
    "count": "Quantidade",
    "sum": "Soma",
    "balance": "Saldo",
    "profit": "Lucro",
    "loss": "Prejuízo",
    "category": "Categoria",
    "type": "Tipo",
    "status": "Status",
    "date": "Data",
    "description": "Descrição",
    "value": "Valor",
    "amount": "Quantia",
    "name": "Nome",
    "title": "Título",
    "month": "Mês",
    "year": "Ano",
    "day": "Dia",
    "week": "Semana",
    "today": "Hoje",
    "yesterday": "Ontem",
    "tomorrow": "Amanhã",
    "current": "Atual",
    "previous": "Anterior",
    "next": "Próximo",
    "true": "Sim",
    "false": "Não",
    "yes": "Sim",
    "no": "Não",
}


def translate_term(term: str) -> str:
    """
    Traduz um termo de inglês para português.

    Args:
        term: Termo em inglês

    Returns:
        Termo traduzido ou o original se não encontrado
    """
    if not term:
        return term

    # Normaliza o termo (lowercase, remove espaços extras)
    normalized = str(term).lower().strip()

    # Busca tradução direta
    if normalized in TRANSLATIONS:
        return TRANSLATIONS[normalized]

    # Tenta com underscores convertidos para espaços
    with_spaces = normalized.replace("_", " ")
    if with_spaces in TRANSLATIONS:
        return TRANSLATIONS[with_spaces]

    # Se não encontrou, retorna o original com primeira letra maiúscula
    return str(term).replace("_", " ").title()


def format_number_br(value: Union[int, float, Decimal], decimals: int = 2) -> str:
    """
    Formata número para o padrão brasileiro.

    Args:
        value: Valor numérico
        decimals: Casas decimais

    Returns:
        Número formatado (ex: 1.234,56)
    """
    try:
        num = float(value)
        # Formata com separadores brasileiros
        formatted = f"{num:,.{decimals}f}"
        # Troca separadores: vírgula -> X, ponto -> vírgula, X -> ponto
        formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        return formatted
    except (ValueError, TypeError):
        return str(value)


def format_currency_br(value: Union[int, float, Decimal]) -> str:
    """
    Formata valor monetário para o padrão brasileiro (R$).

    Args:
        value: Valor monetário

    Returns:
        Valor formatado (ex: R$ 1.234,56)
    """
    return f"R$ {format_number_br(value, 2)}"


def format_date_br(value: Union[str, date, datetime]) -> str:
    """
    Formata data para o padrão brasileiro (DD/MM/AAAA).

    Args:
        value: Data em string ISO ou objeto date/datetime

    Returns:
        Data formatada (ex: 23/01/2025)
    """
    try:
        if isinstance(value, datetime):
            return value.strftime("%d/%m/%Y")
        elif isinstance(value, date):
            return value.strftime("%d/%m/%Y")
        elif isinstance(value, str):
            # Tenta parsear ISO format (YYYY-MM-DD)
            if re.match(r"^\d{4}-\d{2}-\d{2}", value):
                dt = datetime.fromisoformat(value.split("T")[0])
                return dt.strftime("%d/%m/%Y")
            # Já está no formato brasileiro?
            if re.match(r"^\d{2}/\d{2}/\d{4}", value):
                return value
        return str(value)
    except (ValueError, AttributeError):
        return str(value)


def format_datetime_br(value: Union[str, datetime]) -> str:
    """
    Formata data e hora para o padrão brasileiro.

    Args:
        value: DateTime

    Returns:
        Data/hora formatada (ex: 23/01/2025 14:30)
    """
    try:
        if isinstance(value, datetime):
            return value.strftime("%d/%m/%Y %H:%M")
        elif isinstance(value, str):
            if "T" in value:
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return dt.strftime("%d/%m/%Y %H:%M")
        return str(value)
    except (ValueError, AttributeError):
        return str(value)


def format_value(key: str, value: Any) -> str:
    """
    Formata um valor baseado no nome da chave.

    Args:
        key: Nome da chave/coluna
        value: Valor a formatar

    Returns:
        Valor formatado
    """
    if value is None:
        return "-"

    key_lower = key.lower()

    # Campos monetários
    currency_fields = [
        "valor",
        "value",
        "total",
        "saldo",
        "balance",
        "limite",
        "limit",
        "media",
        "average",
        "rendimentos",
        "yield",
        "preco",
        "price",
        "valor_total",
        "valor_pago",
        "valor_restante",
        "valor_recebido",
        "valor_a_receber",
        "saldo_total",
        "limite_disponivel",
        "limite_total",
        "total_guardado",
        "total_rendimentos",
        "valor_fatura",
        "payed_value",
        "current_balance",
        "credit_limit",
        "accumulated_yield",
    ]
    if any(field in key_lower for field in currency_fields):
        if isinstance(value, (int, float, Decimal)):
            return format_currency_br(value)

    # Campos de data
    date_fields = [
        "data",
        "date",
        "inicio",
        "start",
        "fim",
        "end",
        "created",
        "updated",
        "ultima_alteracao",
    ]
    if any(field in key_lower for field in date_fields):
        if isinstance(value, (date, datetime)):
            return format_date_br(value)
        elif isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}", value):
            return format_date_br(value)

    # Campos de porcentagem
    if "taxa" in key_lower or "rate" in key_lower or "percent" in key_lower:
        if isinstance(value, (int, float, Decimal)):
            return f"{float(value) * 100:.2f}%"

    # Campos booleanos
    if isinstance(value, bool):
        return "Sim" if value else "Não"

    # Campos de categoria/status - traduz
    category_fields = [
        "categoria",
        "category",
        "status",
        "tipo",
        "type",
        "genero",
        "genre",
        "periodicidade",
        "periodicity",
    ]
    if any(field in key_lower for field in category_fields):
        return translate_term(str(value))

    # Números genéricos (quantidade, etc.)
    if isinstance(value, (int, float, Decimal)) and not any(
        field in key_lower for field in currency_fields
    ):
        if isinstance(value, int) or (isinstance(value, float) and value.is_integer()):
            return str(int(value))
        return format_number_br(value, 2)

    return str(value)


def translate_column_name(name: str) -> str:
    """
    Traduz nome de coluna para português.

    Args:
        name: Nome da coluna em inglês/snake_case

    Returns:
        Nome traduzido
    """
    translations = {
        # Campos comuns
        "description": "Descrição",
        "descricao": "Descrição",
        "value": "Valor",
        "valor": "Valor",
        "date": "Data",
        "data": "Data",
        "category": "Categoria",
        "categoria": "Categoria",
        "status": "Status",
        "name": "Nome",
        "title": "Título",
        "titulo": "Título",
        "type": "Tipo",
        "tipo": "Tipo",
        # Contas
        "account_name": "Conta",
        "conta": "Conta",
        "institution_name": "Banco",
        "banco": "Banco",
        "account_type": "Tipo de Conta",
        "current_balance": "Saldo Atual",
        "saldo": "Saldo",
        "saldo_total": "Saldo Total",
        # Cartões
        "cartao": "Cartão",
        "card_name": "Cartão",
        "flag": "Bandeira",
        "bandeira": "Bandeira",
        "credit_limit": "Limite",
        "limite": "Limite",
        "limite_total": "Limite Total",
        "limite_disponivel": "Limite Disponível",
        "due_day": "Dia Vencimento",
        "dia_vencimento": "Dia Vencimento",
        "closing_day": "Dia Fechamento",
        "dia_fechamento": "Dia Fechamento",
        "valor_fatura": "Valor da Fatura",
        "mes": "Mês",
        "ano": "Ano",
        # Empréstimos
        "credor": "Credor",
        "devedor": "Devedor",
        "valor_total": "Valor Total",
        "valor_pago": "Valor Pago",
        "valor_restante": "Valor Restante",
        "valor_recebido": "Valor Recebido",
        "valor_a_receber": "A Receber",
        "payed_value": "Valor Pago",
        # Agregações
        "total": "Total",
        "quantidade": "Quantidade",
        "count": "Quantidade",
        "media": "Média",
        "average": "Média",
        # Livros
        "livro": "Livro",
        "book": "Livro",
        "paginas": "Páginas",
        "pages": "Páginas",
        "paginas_lidas": "Páginas Lidas",
        "genero": "Gênero",
        "genre": "Gênero",
        "read_status": "Status de Leitura",
        "avaliacao": "Avaliação",
        "rating": "Avaliação",
        "minutos": "Minutos",
        "reading_time": "Tempo de Leitura",
        # Tarefas
        "tarefa": "Tarefa",
        "task_name": "Tarefa",
        "horario": "Horário",
        "scheduled_time": "Horário",
        "scheduled_date": "Data Agendada",
        "meta": "Meta",
        "target_quantity": "Meta",
        "target_value": "Meta",
        "realizado": "Realizado",
        "quantity_completed": "Realizado",
        "current_value": "Atual",
        "atual": "Atual",
        "objetivo": "Objetivo",
        "goal_type": "Tipo de Objetivo",
        "inicio": "Início",
        "start_date": "Início",
        "concluidas": "Concluídas",
        "taxa_conclusao": "Taxa de Conclusão",
        "periodicidade": "Periodicidade",
        "periodicity": "Periodicidade",
        "unidade": "Unidade",
        "unit": "Unidade",
        "ativa": "Ativa",
        "is_active": "Ativa",
        # Cofres
        "cofre": "Cofre",
        "vault": "Cofre",
        "rendimentos": "Rendimentos",
        "accumulated_yield": "Rendimentos",
        "taxa_rendimento": "Taxa de Rendimento",
        "yield_rate": "Taxa de Rendimento",
        "total_guardado": "Total Guardado",
        "total_rendimentos": "Total de Rendimentos",
        "quantidade_cofres": "Quantidade de Cofres",
        # Transferências
        "origem": "Origem",
        "origin": "Origem",
        "destino": "Destino",
        "destiny": "Destino",
        "total_transferido": "Total Transferido",
        # Senhas
        "usuario": "Usuário",
        "username": "Usuário",
        "site": "Site",
        "senha": "Senha",
        "senha_criptografada": "Senha",
        "ultima_alteracao": "Última Alteração",
        "last_password_change": "Última Alteração",
    }

    name_lower = name.lower()
    if name_lower in translations:
        return translations[name_lower]

    # Se não encontrou, formata o nome (remove underscores, capitaliza)
    return name.replace("_", " ").title()


class OllamaClient:
    """
    Cliente para API do Ollama.

    Usa o endpoint /api/chat para gerar respostas em linguagem natural.
    Suporta modelos e prompts de sistema customizados para agentes especializados.
    """

    DEFAULT_HOST = "http://localhost:11434"
    DEFAULT_MODEL = "llama3.2"
    DEFAULT_TIMEOUT = 120  # segundos

    def __init__(
        self,
        model: Optional[str] = None,
        host: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        """
        Inicializa o cliente Ollama.

        Args:
            model: Modelo a ser usado. Se None, usa OLLAMA_MODEL env ou default.
            host: URL do servidor Ollama (default: localhost:11434)
            timeout: Timeout em segundos (default: 120)
        """
        self.host = host or os.getenv("OLLAMA_HOST", self.DEFAULT_HOST)
        self.model = model or os.getenv("OLLAMA_MODEL", self.DEFAULT_MODEL)
        self.timeout = timeout or int(os.getenv("OLLAMA_TIMEOUT", self.DEFAULT_TIMEOUT))

    def generate_response(
        self,
        query_description: str,
        data: List[Dict[str, Any]],
        display_type: str,
        module: str,
        system_prompt: Optional[str] = None,
        user_question: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        num_predict: Optional[int] = None,
    ) -> str:
        """
        Gera resposta em linguagem natural usando Ollama.

        Pos-processa a resposta para remover caracteres especiais
        e garantir formatacao limpa.

        Args:
            query_description: Descricao do que foi consultado
            data: Dados retornados pela query
            display_type: Tipo de exibicao (text, table, list, currency, password)
            module: Modulo consultado
            system_prompt: Prompt de sistema customizado (opcional).
                          Se None, usa o prompt padrao.
            user_question: Pergunta original do usuario (opcional).
            conversation_history: Historico de conversa recente (opcional).
            temperature: Temperatura do modelo (opcional).
            top_p: Top-p sampling (opcional).
            num_predict: Numero maximo de tokens (opcional).

        Returns:
            Resposta em portugues brasileiro, limpa e formatada
        """
        prompt = self._build_prompt(
            query_description, data, display_type, module, user_question=user_question
        )
        effective_system_prompt = system_prompt or self._get_system_prompt()

        # Constroi lista de mensagens com historico de conversa
        messages = [{"role": "system", "content": effective_system_prompt}]

        # Adiciona ultimas mensagens de conversa (max 6 = 3 pares)
        if conversation_history:
            for msg in conversation_history[-6:]:
                if isinstance(msg, dict) and "role" in msg and "content" in msg:
                    messages.append({"role": msg["role"], "content": msg["content"]})

        # Adiciona mensagem atual
        messages.append({"role": "user", "content": prompt})

        try:
            response = requests.post(
                f"{self.host}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": temperature or 0.3,
                        "top_p": top_p or 0.9,
                        "num_predict": num_predict or 600,
                    },
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            result = response.json()

            raw_response = result.get("message", {}).get(
                "content", "Nao foi possivel gerar uma resposta."
            )

            # Pos-processa a resposta para remover caracteres especiais
            clean_response = ResponseFormatter.format_response(raw_response)

            # Sanitiza para exibicao segura
            clean_response = ResponseFormatter.sanitize_for_display(clean_response)

            # Trunca se muito longa
            clean_response = ResponseFormatter.truncate(clean_response, max_length=2000)

            return clean_response

        except Timeout:
            logger.error(f"Ollama timeout after {self.timeout}s")
            return self._fallback_response(query_description, data, display_type)
        except RequestException as e:
            logger.error(f"Ollama request error: {e}")
            return self._fallback_response(query_description, data, display_type)
        except Exception as e:
            logger.error(f"Ollama unexpected error: {e}")
            return self._fallback_response(query_description, data, display_type)

    def _get_system_prompt(self) -> str:
        """Retorna o prompt de sistema para o Ollama."""
        return """Voce e um assistente financeiro pessoal amigavel e prestativo.

REGRAS IMPORTANTES DE FORMATACAO:
- NAO use caracteres especiais de formatacao como asteriscos (*),
  underscores (_), hashtags (#), crases (`) ou til (~~)
- NAO use formatacao markdown
- Escreva texto puro e simples
- Use apenas pontuacao normal: ponto, virgula, exclamacao, interrogacao, dois pontos

Suas respostas devem ser:
- Em portugues brasileiro
- Naturais e conversacionais
- Concisas mas informativas
- Texto simples sem formatacao especial

Para valores monetarios:
- Use o formato R$ X.XXX,XX (exemplo: R$ 1.234,56)
- Arredonde para 2 casas decimais

Para datas:
- Use formato brasileiro DD/MM/AAAA (exemplo: 23/01/2025)
- Mencione "hoje", "ontem", "esta semana" quando apropriado

Para listas:
- Use numeracao simples (1. 2. 3.) ou travessao (-)
- NAO use asteriscos ou outros simbolos

Nunca invente dados. Use apenas as informacoes fornecidas.
Se nao houver dados, diga que nao encontrou registros."""

    def _build_prompt(
        self,
        query_description: str,
        data: List[Dict[str, Any]],
        display_type: str,
        module: str,
        user_question: Optional[str] = None,
    ) -> str:
        """Constrói o prompt estruturado com XML tags."""
        # Formata os dados de acordo com o tipo
        if not data:
            data_str = "Nenhum registro encontrado."
        elif display_type == "currency":
            # Para valores monetários, formata como moeda
            data_str = self._format_currency_data(data)
        elif display_type == "password":
            # Para senhas, formata de forma segura
            data_str = self._format_password_data(data)
        else:
            # Para outros tipos, formata como lista/tabela
            data_str = self._format_general_data(data)

        # Inclui a pergunta original se disponivel
        question_section = ""
        if user_question:
            question_section = f"""<user_question>{user_question}</user_question>

"""

        pwd_note = (
            "IMPORTANTE: Nao revele senhas. Confirme que encontrou a credencial."
            if display_type == "password"
            else ""
        )
        return f"""{question_section}<context>
Modulo: {self._get_module_description(module)}.
Consulta realizada: {query_description}
</context>

<data>
{data_str}
</data>

<instruction>
Responda a pergunta do usuario com base nos dados acima.
{"Formate valores monetarios como R$ X.XXX,XX." if display_type == 'currency' else ""}
{pwd_note}
Se nao houver dados, informe educadamente que nao encontrou registros.

LEMBRE-SE: NAO use formatacao markdown (asteriscos, underscores, hashtags).
Escreva texto puro e simples.
</instruction>"""

    def _get_module_description(self, module: str) -> str:
        """Retorna descrição amigável do módulo."""
        descriptions = {
            "revenues": "receitas e faturamento",
            "expenses": "despesas e gastos",
            "accounts": "contas bancárias e saldos",
            "credit_cards": "cartões de crédito",
            "loans": "empréstimos",
            "library": "biblioteca pessoal e leituras",
            "personal_planning": "planejamento pessoal e tarefas",
            "security": "senhas e credenciais",
            "vaults": "cofres e reservas",
            "transfers": "transferências",
            "unknown": "dados gerais",
        }
        return descriptions.get(module, "dados gerais")

    def _format_currency_data(self, data: List[Dict[str, Any]]) -> str:
        """Formata dados monetários."""
        if not data:
            return "Nenhum valor encontrado."

        lines = []
        for item in data:
            parts = []
            for key, value in item.items():
                # Traduz o nome da coluna
                translated_key = translate_column_name(key)
                # Formata o valor
                formatted_value = format_value(key, value)
                parts.append(f"{translated_key}: {formatted_value}")
            lines.append(" | ".join(parts))

        return "\n".join(lines)

    def _format_password_data(self, data: List[Dict[str, Any]]) -> str:
        """Formata dados de senhas (ocultando parcialmente)."""
        if not data:
            return "Nenhuma credencial encontrada."

        lines = []
        for item in data:
            titulo = item.get("titulo", item.get("title", "N/A"))
            usuario = item.get("usuario", item.get("username", "N/A"))
            site = item.get("site", "N/A")
            senha = item.get("senha", "")
            categoria = item.get("categoria", item.get("category", ""))

            # Mascara a senha parcialmente
            if senha and len(senha) > 4:
                senha_masked = senha[:2] + "*" * (len(senha) - 4) + senha[-2:]
            elif senha:
                senha_masked = "*" * len(senha)
            else:
                senha_masked = "***"

            # Traduz a categoria
            categoria_traduzida = translate_term(categoria) if categoria else ""
            categoria_str = (
                f", categoria={categoria_traduzida}" if categoria_traduzida else ""
            )

            lines.append(
                f"- {titulo}: usuário={usuario}, site={site},"
                f" senha={senha_masked}{categoria_str}"
            )

        return "\n".join(lines)

    def _format_general_data(self, data: List[Dict[str, Any]]) -> str:
        """Formata dados gerais como lista."""
        if not data:
            return "Nenhum registro encontrado."

        lines = []
        for i, item in enumerate(data, 1):
            parts = []
            for key, value in item.items():
                if value is not None:
                    # Traduz o nome da coluna
                    translated_key = translate_column_name(key)
                    # Formata o valor
                    formatted_value = format_value(key, value)
                    parts.append(f"{translated_key}: {formatted_value}")
            lines.append(f"{i}. " + " | ".join(parts))

        return "\n".join(lines)

    def _fallback_response(
        self, query_description: str, data: List[Dict[str, Any]], display_type: str
    ) -> str:
        """
        Resposta de fallback quando Ollama não está disponível.

        Gera uma resposta básica sem IA.
        """
        if not data:
            return f"Não encontrei registros para: {query_description}"

        if display_type == "currency":
            # Tenta extrair o valor total
            for item in data:
                for key, value in item.items():
                    if "total" in key.lower() or "saldo" in key.lower():
                        if isinstance(value, (int, float, Decimal)):
                            formatted = format_currency_br(value)
                            return f"{query_description}: {formatted}"

        if display_type == "password":
            count = len(data)
            return (
                f"Encontrei {count} credencial(is) correspondente(s)."
                " Por segurança, acesse o módulo de Segurança para ver os detalhes."
            )

        if display_type == "table":
            # Formata como lista simples
            lines = [f"{query_description}:"]
            for i, item in enumerate(data[:5], 1):  # Limita a 5 itens
                parts = []
                for key, value in item.items():
                    if value is not None:
                        translated_key = translate_column_name(key)
                        formatted_value = format_value(key, value)
                        parts.append(f"{translated_key}: {formatted_value}")
                if parts:
                    lines.append(
                        f"  {i}. " + " | ".join(parts[:3])
                    )  # Limita a 3 campos
            if len(data) > 5:
                lines.append(f"  ... e mais {len(data) - 5} registro(s)")
            return "\n".join(lines)

        # Resposta genérica
        count = len(data)
        return f"{query_description}: encontrados {count} registro(s)."

    def check_health(self) -> bool:
        """
        Verifica se o Ollama está disponível.

        Returns:
            True se Ollama está respondendo, False caso contrário
        """
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception:
            return False
