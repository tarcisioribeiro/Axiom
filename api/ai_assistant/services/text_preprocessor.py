"""
Pre-processador de texto para o assistente de IA.

Normaliza e limpa texto antes da interpretacao.
"""

import re
import unicodedata
from typing import List


class TextPreprocessor:
    """
    Pre-processa texto de entrada para melhorar a interpretacao.

    Funcionalidades:
    - Normalizacao de acentos e caracteres especiais
    - Correcao de erros comuns de digitacao
    - Expansao de abreviacoes
    - Remocao de stopwords irrelevantes
    """

    # Abreviacoes comuns e suas expansoes
    ABBREVIATIONS = {
        # Perguntas
        "qto": "quanto",
        "qts": "quantos",
        "qtas": "quantas",
        "qnd": "quando",
        "q": "que",
        "pq": "porque",
        "td": "todo",
        "tds": "todos",
        "tbm": "tambem",
        "tb": "tambem",
        "mt": "muito",
        "mts": "muitos",
        "msm": "mesmo",
        "cm": "como",
        "cmg": "comigo",
        "ctg": "contigo",
        "n": "nao",
        "nn": "nao",
        "vc": "voce",
        "vcs": "voces",
        "hj": "hoje",
        "hr": "hora",
        "hrs": "horas",
        "min": "minutos",
        "seg": "segundos",
        "sem": "semana",
        "sems": "semanas",
        "d": "de",
        "p": "para",
        "pra": "para",
        "pro": "para o",
        "c": "com",
        "s": "sim",
        "obg": "obrigado",
        "vlw": "valeu",
        "blz": "beleza",
        "fds": "fim de semana",
        # Financeiro
        "cta": "conta",
        "ctas": "contas",
        "pgto": "pagamento",
        "pgtos": "pagamentos",
        "desp": "despesa",
        "desps": "despesas",
        "rec": "receita",
        "recs": "receitas",
        "transf": "transferencia",
        "transfs": "transferencias",
        "sld": "saldo",
        "fat": "fatura",
        "fats": "faturas",
        "lim": "limite",
        "cart": "cartao",
        "carts": "cartoes",
        # Meses abreviados
        "jan": "janeiro",
        "fev": "fevereiro",
        "mar": "marco",
        "abr": "abril",
        "mai": "maio",
        "jun": "junho",
        "jul": "julho",
        "ago": "agosto",
        "set": "setembro",
        "out": "outubro",
        "nov": "novembro",
        "dez": "dezembro",
    }

    # Erros de digitacao comuns e suas correcoes
    TYPO_CORRECTIONS = {
        # Acentos faltando (comum em digitacao rapida)
        "voce": "voce",
        "tambem": "tambem",
        "entao": "entao",
        "nao": "nao",
        "ja": "ja",
        "so": "so",
        "ate": "ate",
        "apos": "apos",
        "tres": "tres",
        "mes": "mes",
        "meses": "meses",
        "ano": "ano",
        "proxima": "proxima",
        "proximo": "proximo",
        "ultima": "ultima",
        "ultimo": "ultimo",
        "unica": "unica",
        "unico": "unico",
        # Erros comuns de digitacao
        "gastei": "gastei",
        "gasto": "gasto",
        "gastos": "gastos",
        "depsesa": "despesa",
        "desepsa": "despesa",
        "despea": "despesa",
        "despesas": "despesas",
        "recita": "receita",
        "receiat": "receita",
        "recetas": "receitas",
        "salod": "saldo",
        "slado": "saldo",
        "tranferencia": "transferencia",
        "trasferencia": "transferencia",
        "transferenca": "transferencia",
        "emprestmo": "emprestimo",
        "emrpestimo": "emprestimo",
        "cartaoo": "cartao",
        "carato": "cartao",
        "cartoao": "cartao",
        "faturaa": "fatura",
        "fatuar": "fatura",
        "livrso": "livros",
        "livross": "livros",
        "taerfas": "tarefas",
        "tarfeas": "tarefas",
        "senhas": "senhas",
        "senahss": "senhas",
    }

    # Stopwords que podem ser removidas sem perda de significado
    STOPWORDS = {
        "o",
        "a",
        "os",
        "as",
        "um",
        "uma",
        "uns",
        "umas",
        "de",
        "da",
        "do",
        "das",
        "dos",
        "em",
        "na",
        "no",
        "nas",
        "nos",
        "por",
        "pela",
        "pelo",
        "pelas",
        "pelos",
        "e",
        "ou",
        "mas",
        "que",
        "qual",
        "quais",
        "se",
        "isso",
        "isto",
        "eu",
        "meu",
        "minha",
        "meus",
        "minhas",
        "me",
        "te",
        "lhe",
        "nos",
        "vos",
        "lhes",
        "esse",
        "essa",
        "esses",
        "essas",
        "este",
        "esta",
        "estes",
        "estas",
        "aquele",
        "aquela",
        "aqueles",
        "aquelas",
        "foi",
        "foram",
        "era",
        "eram",
        "ser",
        "estar",
        "ter",
        "haver",
        "muito",
        "muita",
        "muitos",
        "muitas",
        "bem",
        "mal",
        "mais",
        "menos",
        "ja",
        "ainda",
        "agora",
        "depois",
        "antes",
        "aqui",
        "ali",
        "la",
        "ca",
        "sim",
        "nao",
        "tambem",
        "so",
        "apenas",
        "entao",
        "portanto",
        "assim",
        "pois",
        "porque",
        "porquanto",
        "onde",
        "aonde",
        "donde",
        "como",
        "quando",
        "mesmo",
        "propria",
        "proprio",
        "toda",
        "todo",
        "todas",
        "todos",
        "cada",
        "algum",
        "alguma",
        "alguns",
        "algumas",
        "nenhum",
        "nenhuma",
        "nenhuns",
        "nenhumas",
        "outro",
        "outra",
        "outros",
        "outras",
        "tal",
        "tais",
        "tanto",
        "tanta",
        "tantos",
        "tantas",
        "pouco",
        "pouca",
        "poucos",
        "poucas",
    }

    # Palavras que NAO devem ser removidas (importantes para contexto financeiro)
    KEEP_WORDS = {
        "quanto",
        "quantos",
        "quantas",
        "qual",
        "quais",
        "total",
        "soma",
        "media",
        "maior",
        "menor",
        "maximo",
        "minimo",
        "hoje",
        "ontem",
        "amanha",
        "semana",
        "mes",
        "ano",
        "trimestre",
        "ultimo",
        "ultima",
        "ultimos",
        "ultimas",
        "primeiro",
        "primeira",
        "primeiros",
        "primeiras",
        "proximo",
        "proxima",
        "proximos",
        "proximas",
        "entre",
        "desde",
        "ate",
        "janeiro",
        "fevereiro",
        "marco",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
        "saldo",
        "despesa",
        "despesas",
        "receita",
        "receitas",
        "gasto",
        "gastos",
        "faturamento",
        "ganho",
        "ganhos",
        "conta",
        "contas",
        "cartao",
        "cartoes",
        "fatura",
        "faturas",
        "limite",
        "emprestimo",
        "emprestimos",
        "divida",
        "dividas",
        "transferencia",
        "transferencias",
        "pix",
        "ted",
        "doc",
        "livro",
        "livros",
        "leitura",
        "leituras",
        "lendo",
        "li",
        "tarefa",
        "tarefas",
        "objetivo",
        "objetivos",
        "meta",
        "metas",
        "senha",
        "senhas",
        "credencial",
        "credenciais",
        "login",
        "cofre",
        "cofres",
        "reserva",
        "reservas",
        "poupanca",
        "categoria",
        "categorias",
        "tipo",
        "tipos",
        "pendente",
        "pendentes",
        "pago",
        "pagos",
        "atrasado",
        "atrasados",
        "ativo",
        "ativos",
        "inativo",
        "inativos",
        "devo",
        "devem",
        "devendo",
    }

    @classmethod
    def preprocess(cls, text: str) -> str:
        """
        Executa o pipeline completo de pre-processamento.

        Args:
            text: Texto original do usuario

        Returns:
            Texto normalizado e limpo
        """
        if not text:
            return ""

        # 1. Normaliza unicode e espacos
        text = cls._normalize_unicode(text)

        # 2. Converte para minusculas
        text = text.lower()

        # 3. Expande abreviacoes
        text = cls._expand_abbreviations(text)

        # 4. Corrige erros comuns
        text = cls._fix_typos(text)

        # 5. Remove caracteres especiais (mantendo acentos e pontuacao basica)
        text = cls._clean_special_chars(text)

        # 6. Normaliza espacos multiplos
        text = cls._normalize_spaces(text)

        return text.strip()

    @classmethod
    def preprocess_for_matching(cls, text: str) -> str:
        """
        Pre-processa texto para matching de palavras-chave.

        Remove stopwords alem do pre-processamento basico.

        Args:
            text: Texto original

        Returns:
            Texto otimizado para matching
        """
        text = cls.preprocess(text)
        text = cls._remove_stopwords(text)
        return text

    @classmethod
    def extract_keywords(cls, text: str) -> List[str]:
        """
        Extrai palavras-chave significativas do texto.

        Args:
            text: Texto pre-processado

        Returns:
            Lista de palavras-chave
        """
        text = cls.preprocess_for_matching(text)
        words = text.split()

        # Filtra palavras muito curtas (menos de 2 caracteres)
        keywords = [w for w in words if len(w) >= 2]

        return keywords

    @classmethod
    def normalize_for_comparison(cls, text: str) -> str:
        """
        Normaliza texto para comparacao (remove acentos).

        Args:
            text: Texto original

        Returns:
            Texto sem acentos, minusculas
        """
        if not text:
            return ""

        text = text.lower()
        # Remove acentos
        text = unicodedata.normalize("NFKD", text)
        text = "".join(c for c in text if not unicodedata.combining(c))

        return text

    @classmethod
    def _normalize_unicode(cls, text: str) -> str:
        """Normaliza caracteres unicode."""
        # Normaliza para forma composta (NFC)
        text = unicodedata.normalize("NFC", text)
        return text

    @classmethod
    def _expand_abbreviations(cls, text: str) -> str:
        """Expande abreviacoes conhecidas."""
        words = text.split()
        expanded = []

        for word in words:
            # Remove pontuacao para verificar abreviacao
            clean_word = word.rstrip(".,!?;:")
            suffix = word[len(clean_word) :]

            if clean_word.lower() in cls.ABBREVIATIONS:
                expanded.append(cls.ABBREVIATIONS[clean_word.lower()] + suffix)
            else:
                expanded.append(word)

        return " ".join(expanded)

    @classmethod
    def _fix_typos(cls, text: str) -> str:
        """Corrige erros de digitacao conhecidos."""
        words = text.split()
        fixed = []

        for word in words:
            # Remove pontuacao para verificar erro
            clean_word = word.rstrip(".,!?;:")
            suffix = word[len(clean_word) :]

            if clean_word.lower() in cls.TYPO_CORRECTIONS:
                fixed.append(cls.TYPO_CORRECTIONS[clean_word.lower()] + suffix)
            else:
                fixed.append(word)

        return " ".join(fixed)

    @classmethod
    def _clean_special_chars(cls, text: str) -> str:
        """Remove caracteres especiais mantendo pontuacao basica."""
        # Mantem letras, numeros, espacos e pontuacao basica
        # Mantem tambem caracteres acentuados
        text = re.sub(r"[^\w\s.,!?;:\-/]", " ", text, flags=re.UNICODE)
        return text

    @classmethod
    def _normalize_spaces(cls, text: str) -> str:
        """Normaliza espacos multiplos."""
        return re.sub(r"\s+", " ", text)

    @classmethod
    def _remove_stopwords(cls, text: str) -> str:
        """Remove stopwords preservando palavras importantes."""
        words = text.split()
        filtered = []

        for word in words:
            # Remove pontuacao para verificar
            clean_word = word.rstrip(".,!?;:").lower()

            # Mantem se for uma palavra importante ou se nao for stopword
            if clean_word in cls.KEEP_WORDS or clean_word not in cls.STOPWORDS:
                filtered.append(word)

        return " ".join(filtered)

    @classmethod
    def get_text_variations(cls, text: str) -> List[str]:
        """
        Gera variacoes do texto para matching flexivel.

        Args:
            text: Texto original

        Returns:
            Lista de variacoes do texto
        """
        variations = [text]

        # Versao pre-processada
        preprocessed = cls.preprocess(text)
        if preprocessed != text:
            variations.append(preprocessed)

        # Versao sem acentos
        no_accents = cls.normalize_for_comparison(text)
        if no_accents != text.lower():
            variations.append(no_accents)

        # Versao sem stopwords
        no_stopwords = cls.preprocess_for_matching(text)
        if no_stopwords != preprocessed:
            variations.append(no_stopwords)

        return list(set(variations))
