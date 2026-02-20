"""
Processador de perguntas - Orquestrador das camadas de inteligencia.

Coordena o fluxo completo de processamento:
1. Pre-processamento de texto
2. Classificacao de intencao
3. Extracao de entidades
4. Geracao de query
5. Formatacao de resposta
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, List

from .entity_extractor import EntityExtractor, ExtractedEntities
from .intent_classifier import IntentClassifier, IntentResult, IntentType
from .response_formatter import ResponseFormatter
from .text_preprocessor import TextPreprocessor

logger = logging.getLogger(__name__)


@dataclass
class ProcessedQuestion:
    """Resultado do processamento de uma pergunta."""

    # Texto original e processado
    original_text: str
    preprocessed_text: str

    # Intencao detectada
    intent: IntentResult

    # Entidades extraidas
    entities: ExtractedEntities

    # Modulo detectado
    detected_module: str

    # Tipo de agregacao sugerido
    suggested_aggregation: str

    # Confianca geral do processamento
    confidence: float

    # Metadados adicionais
    metadata: Dict[str, Any]


class QuestionProcessor:
    """
    Orquestrador do processamento de perguntas.

    Coordena todas as camadas de inteligencia para:
    - Entender a pergunta do usuario
    - Detectar intencao e entidades
    - Preparar parametros para geracao de query
    """

    # Mapeamento de modulo baseado em palavras-chave (backup)
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
            "quanto ganhei",
            "quanto recebi",
            "rendimento",
        ],
        "expenses": [
            "despesa",
            "despesas",
            "gasto",
            "gastos",
            "custo",
            "pagamento",
            "pagamentos",
            "compra",
            "compras",
            "quanto gastei",
            "quanto paguei",
        ],
        "accounts": [
            "saldo",
            "saldos",
            "conta bancaria",
            "conta corrente",
            "poupanca",
            "banco",
            "quanto tenho",
        ],
        "credit_cards": [
            "cartao",
            "cartoes",
            "cartao de credito",
            "fatura",
            "limite",
            "credito disponivel",
        ],
        "loans": [
            "emprestimo",
            "emprestimos",
            "divida",
            "dividas",
            "devo",
            "devem",
            "emprestei",
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
        ],
        "personal_planning": [
            "tarefa",
            "tarefas",
            "objetivo",
            "objetivos",
            "meta",
            "rotina",
            "habito",
            "pendente",
            "concluido",
        ],
        "security": [
            "senha",
            "senhas",
            "credencial",
            "credenciais",
            "login",
            "usuario",
            "password",
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
        ],
        "transfers": [
            "transferencia",
            "transferencias",
            "pix",
            "ted",
            "doc",
            "transferi",
            "enviei",
        ],
    }

    @classmethod
    def process(cls, question: str) -> ProcessedQuestion:
        """
        Processa uma pergunta através de todas as camadas.

        Args:
            question: Pergunta original do usuario

        Returns:
            ProcessedQuestion com todos os resultados
        """
        logger.debug(f"Processando pergunta: {question[:100]}...")

        # 1. Pre-processamento
        preprocessed = TextPreprocessor.preprocess(question)
        logger.debug(f"Texto pre-processado: {preprocessed[:100]}...")

        # 2. Classificacao de intencao
        intent_result = IntentClassifier.classify(question)
        logger.debug(
            f"Intencao detectada: {intent_result.intent.value} "
            f"(confianca: {intent_result.confidence:.2f})"
        )

        # 3. Deteccao de modulo
        detected_module = cls._detect_module(preprocessed, intent_result)
        logger.debug(f"Modulo detectado: {detected_module}")

        # 4. Extracao de entidades
        entities = EntityExtractor.extract(question, detected_module)
        logger.debug(
            f"Entidades extraidas - Datas: {entities.date_range.description}, "
            f"Categorias: {entities.categories}"
        )

        # 5. Determina agregacao
        suggested_aggregation = IntentClassifier.intent_to_aggregation(
            intent_result.intent
        )

        # 6. Calcula confianca geral
        confidence = cls._calculate_confidence(intent_result, detected_module, entities)

        # 7. Coleta metadados
        metadata = cls._build_metadata(question, intent_result, entities)

        return ProcessedQuestion(
            original_text=question,
            preprocessed_text=preprocessed,
            intent=intent_result,
            entities=entities,
            detected_module=detected_module,
            suggested_aggregation=suggested_aggregation,
            confidence=confidence,
            metadata=metadata,
        )

    @classmethod
    def _detect_module(cls, text: str, intent_result: IntentResult) -> str:
        """
        Detecta o modulo mais provavel para a pergunta.

        Combina:
        - Hint do classificador de intencao
        - Matching de palavras-chave
        """
        # 1. Verifica hint do classificador
        if intent_result.entities_hint and "module" in intent_result.entities_hint:
            module_hint = intent_result.entities_hint["module"]
            if module_hint:
                return module_hint

        # 2. Matching de palavras-chave
        text_lower = text.lower()
        scores: Dict[str, int] = {}

        for module, keywords in cls.MODULE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scores[module] = score

        if scores:
            return max(scores, key=lambda k: scores[k])

        # 3. Fallback para unknown
        return "unknown"

    @classmethod
    def _calculate_confidence(
        cls, intent_result: IntentResult, module: str, entities: ExtractedEntities
    ) -> float:
        """
        Calcula confianca geral do processamento.

        Considera:
        - Confianca da intencao
        - Se o modulo foi detectado
        - Se entidades relevantes foram encontradas
        """
        confidence = intent_result.confidence

        # Penaliza se modulo nao foi identificado
        if module == "unknown":
            confidence *= 0.5

        # Bonus se encontrou entidades
        if entities.date_range.start is not None:
            confidence *= 1.1

        if entities.categories:
            confidence *= 1.1

        # Limita entre 0 e 1
        return min(max(confidence, 0.0), 1.0)

    @classmethod
    def _build_metadata(
        cls, question: str, intent_result: IntentResult, entities: ExtractedEntities
    ) -> Dict[str, Any]:
        """Constroi metadados do processamento."""
        return {
            "question_length": len(question),
            "intent_type": intent_result.intent.value,
            "intent_confidence": intent_result.confidence,
            "has_date_filter": entities.date_range.start is not None,
            "date_description": entities.date_range.description,
            "categories_found": len(entities.categories),
            "values_found": len(entities.values),
            "names_found": len(entities.names),
        }

    @classmethod
    def format_response(cls, text: str) -> str:
        """
        Formata resposta para exibicao.

        Remove caracteres especiais e garante formatacao limpa.
        """
        return ResponseFormatter.format_response(text)

    @classmethod
    def is_greeting(cls, intent_result: IntentResult) -> bool:
        """Verifica se a intencao e uma saudacao."""
        return intent_result.intent == IntentType.GREETING

    @classmethod
    def is_help_request(cls, intent_result: IntentResult) -> bool:
        """Verifica se a intencao e pedido de ajuda."""
        return intent_result.intent == IntentType.HELP

    @classmethod
    def get_greeting_response(cls, agent_config=None) -> str:
        """Retorna resposta para saudacao, contextualizada pelo agente."""
        if agent_config:
            agent_greetings = {
                "financial": (
                    "Ola! Sou o assistente de Controle Financeiro do MindLedger. "
                    "Posso ajudar voce com informacoes sobre receitas, despesas, "
                    "saldos, cartoes de credito, emprestimos, transferencias e cofres. "
                    "O que voce gostaria de saber?"
                ),
                "security": (
                    "Ola! Sou o assistente de Seguranca do MindLedger. "
                    "Posso ajudar voce a consultar suas senhas e credenciais "
                    "armazenadas de forma segura. O que voce precisa?"
                ),
                "planning": (
                    "Ola! Sou o assistente de Planejamento Pessoal do MindLedger. "
                    "Posso ajudar voce com suas tarefas, habitos, objetivos e metas. "
                    "Como posso ajudar?"
                ),
                "reading": (
                    "Ola! Sou o assistente de Leitura do MindLedger. "
                    "Posso ajudar voce com informacoes sobre seus livros, "
                    "sessoes de leitura e progresso. O que voce gostaria de saber?"
                ),
            }
            return agent_greetings.get(
                agent_config.key,
                (
                    f"Ola! Sou o assistente {agent_config.name} do MindLedger. "
                    f"Posso ajudar com: {agent_config.description}. "
                    "O que voce gostaria de saber?"
                ),
            )

        return (
            "Ola! Sou o assistente do MindLedger. "
            "Posso ajudar voce com informacoes sobre suas financas, "
            "como despesas, receitas, saldos, cartoes, e muito mais. "
            "O que voce gostaria de saber?"
        )

    @classmethod
    def get_help_response(cls, agent_config=None) -> str:
        """Retorna resposta para pedido de ajuda, contextualizada pelo agente."""
        if agent_config:
            agent_help = {
                "financial": (
                    "Posso ajudar com consultas financeiras. Exemplos:\n\n"
                    "Receitas:\n"
                    "  - Quanto recebi este mes?\n"
                    "  - Qual meu faturamento em janeiro?\n\n"
                    "Despesas:\n"
                    "  - Quanto gastei este mes?\n"
                    "  - Quais minhas maiores despesas?\n"
                    "  - Despesas por categoria?\n\n"
                    "Contas:\n"
                    "  - Qual meu saldo total?\n"
                    "  - Saldo das minhas contas?\n\n"
                    "Cartoes:\n"
                    "  - Limite disponivel nos cartoes?\n"
                    "  - Faturas abertas?\n\n"
                    "Emprestimos:\n"
                    "  - Quanto devo?\n"
                    "  - Quem me deve?\n\n"
                    "Voce pode usar periodos como: hoje, esta semana, "
                    "mes passado, ultimos 3 meses, etc."
                ),
                "security": (
                    "Posso ajudar com suas senhas e credenciais. Exemplos:\n\n"
                    "  - Qual a senha do Netflix?\n"
                    "  - Quais senhas tenho cadastradas?\n"
                    "  - Login do Spotify?\n"
                    "  - Senha do email do trabalho?\n\n"
                    "As senhas sao exibidas parcialmente mascaradas por seguranca."
                ),
                "planning": (
                    "Posso ajudar com seu planejamento pessoal. Exemplos:\n\n"
                    "Tarefas:\n"
                    "  - Quais sao minhas tarefas de hoje?\n"
                    "  - Quais tarefas estao pendentes?\n\n"
                    "Metas:\n"
                    "  - Quais metas estao ativas?\n"
                    "  - Qual minha taxa de conclusao?\n\n"
                    "Rotinas:\n"
                    "  - Quais sao minhas tarefas rotineiras?\n"
                    "  - Quantas tarefas completei esta semana?"
                ),
                "reading": (
                    "Posso ajudar com sua biblioteca pessoal. Exemplos:\n\n"
                    "  - Quais livros estou lendo?\n"
                    "  - Quantos livros ja li?\n"
                    "  - Minhas sessoes de leitura recentes?\n"
                    "  - Quais livros tenho para ler?\n\n"
                    "Voce pode filtrar por periodo: este mes, esta semana, etc."
                ),
            }
            return agent_help.get(
                agent_config.key,
                (
                    f"Este agente ({agent_config.name}) pode ajudar com: "
                    f"{agent_config.description}. Tente fazer uma pergunta!"
                ),
            )

        return (
            "Posso ajudar com diversas consultas. Aqui estao alguns exemplos:\n\n"
            "Financas:\n"
            "  - Quanto gastei este mes?\n"
            "  - Qual meu saldo total?\n"
            "  - Quais foram minhas maiores despesas?\n"
            "  - Quanto recebi em janeiro?\n\n"
            "Cartoes:\n"
            "  - Qual o limite disponivel nos cartoes?\n"
            "  - Quanto devo nos cartoes?\n\n"
            "Emprestimos:\n"
            "  - Quanto devo?\n"
            "  - Quem me deve?\n\n"
            "Biblioteca:\n"
            "  - Quantos livros ja li?\n"
            "  - Quais livros estou lendo?\n\n"
            "Tarefas:\n"
            "  - Quais sao minhas tarefas de hoje?\n"
            "  - Qual minha taxa de conclusao?\n\n"
            "Senhas:\n"
            "  - Qual a senha do Netflix?\n\n"
            "Voce pode usar periodos como: hoje, ontem, esta semana, "
            "mes passado, ultimos 3 meses, janeiro de 2024, etc."
        )

    @classmethod
    def get_unknown_response(cls, question: str) -> str:
        """Retorna resposta quando nao entende a pergunta."""
        return (
            "Nao consegui entender sua pergunta. "
            "Posso ajudar com informacoes sobre despesas, receitas, saldos, "
            "cartoes de credito, emprestimos, livros, tarefas e senhas. "
            "Tente reformular sua pergunta ou digite 'ajuda' para ver exemplos."
        )
