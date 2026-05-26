"""
Agente de Segurança — módulo Security.
REGRA CRÍTICA: JAMAIS expõe senhas, PINs, chaves ou valores criptografados.
Trabalha apenas com metadados, contagens, datas e logs de atividade.
"""

import unicodedata
from typing import Any

from django.contrib.auth.models import User

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt

_KW_PASSWORD = [
    "senha",
    "senhas",
    "password",
    "passwords",
    "credencial",
    "credenciais",
    "login",
    "acesso",
    "acessos",
    "conta armazenada",
    "contas armazenadas",
    "minhas senhas",
    "quantas senhas",
    "senha fraca",
    "senha forte",
    "senha antiga",
    "atualizar senha",
    "trocar senha",
    "senha expirada",
    "senha desatualizada",
    "segurança das senhas",
]

_KW_VAULT = [
    "cofre",
    "vault",
    "meu cofre",
    "dados do cofre",
    "cofre bloqueado",
    "cofre aberto",
    "desbloqueado",
    "criptografia",
    "criptografado",
    "seguro",
    "protegido",
    "guardado",
    "dados seguros",
]

_KW_SECURITY = [
    "segurança",
    "segurança digital",
    "proteção",
    "protecao",
    "violação",
    "violacao",
    "comprometido",
    "hackeado",
    "invadido",
    "ameaça",
    "ameaca",
    "risco",
    "vulnerabilidade",
    "auditoria",
    "monitoramento",
    "vigilância",
    "vigilancia",
]

_KW_ACTIVITY = [
    "log",
    "logs",
    "atividade",
    "atividades",
    "histórico de acesso",
    "historico",
    "quem acessou",
    "último acesso",
    "ultimo acesso",
    "acessou minha conta",
    "atividade suspeita",
    "acesso não autorizado",
    "auditoria de acesso",
    "eventos de segurança",
]

_KW_CARD = [
    "cartão armazenado",
    "cartoes armazenados",
    "cartão salvo",
    "dados do cartão",
    "cartão seguro",
    "cartão no cofre",
]

_KW_ARCHIVE = [
    "arquivo",
    "arquivos",
    "arquivo seguro",
    "documento seguro",
    "nota criptografada",
    "texto criptografado",
    "arquivo cifrado",
]

_ALL_KW = (
    _KW_PASSWORD
    + _KW_VAULT
    + _KW_SECURITY
    + _KW_ACTIVITY
    + _KW_CARD
    + _KW_ARCHIVE
)


def _normalize(text: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(c) != "Mn"
    )


class SecurityAgent(BaseAgent):
    name = "security"
    description = (
        "Segurança digital: senhas armazenadas, cofre, logs de atividade "
        "e boas práticas (metadados apenas — nunca expõe valores)"
    )
    ollama_model = "mistral:7b-instruct"
    anthropic_model = "claude-sonnet-4-6"
    groq_model = "llama-3.1-8b-instant"

    def can_handle(self, query: str) -> float:
        q = _normalize(query)
        hits = sum(1 for w in _ALL_KW if _normalize(w) in q)
        return min(hits * 0.26, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.security_tools import (
            get_password_categories,
            get_recent_activity,
            get_security_overview,
        )

        user = User.objects.get(pk=ctx.user_id)

        overview = get_security_overview(user)
        activity = get_recent_activity(user, limit=10)
        categories = get_password_categories(user)

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "overview": overview,
            "recent_activity": activity,
            "password_categories": categories,
            "sources": ["Módulo de Segurança — metadados"],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        ov = data["overview"]
        overview_block = (
            f"  Senhas armazenadas: {ov['passwords']}\n"
            f"  Cartões armazenados: {ov['stored_cards']}\n"
            f"  Contas armazenadas: {ov['stored_accounts']}\n"
            f"  Arquivos seguros: {ov['archives']}\n"
            f"  Senhas sem atualização há +180 dias: {ov['old_passwords']}\n"
            f"  Senhas atualizadas nos últimos 30 dias:"
            f" {ov['recently_updated']}"
        )

        cats = data["password_categories"]
        cats_block = (
            "\n".join(
                f"  - {safe_str(c['category'])}: {c['count']} senha(s)"
                for c in cats[:8]
            )
            or "  Nenhuma categoria cadastrada."
        )

        activity = data["recent_activity"]
        activity_block = (
            "\n".join(
                "  - [{}] {} — {} {}".format(
                    safe_str(a["when"]),
                    safe_str(a["action"]),
                    safe_str(a["model"]),
                    f"(IP: {safe_str(a['ip'])})" if a["ip"] else "",
                )
                for a in activity[:8]
            )
            or "  Sem eventos de atividade registrados."
        )

        security_notes = (
            "  ⚠️ Atenção: {} senha(s) sem atualização"
            " há mais de 180 dias.".format(ov["old_passwords"])
            if ov["old_passwords"] > 0
            else "  ✓ Nenhuma senha com idade crítica detectada."
        )

        return (
            "IMPORTANTE: Este agente trabalha APENAS com"
            " metadados de segurança. "
            "Nunca revelar senhas, PINs, números de cartão"
            " ou dados criptografados.\n\n"
            f"Visão geral do cofre:\n{overview_block}\n\n"
            f"Alertas de segurança:\n{security_notes}\n\n"
            f"Senhas por categoria:\n{cats_block}\n\n"
            f"Atividade recente:\n{activity_block}\n\n"
            f"Pergunta: {ctx.query}\n\n"
            "Responda com foco em: análise do estado"
            " de segurança, boas práticas, "
            "recomendações de atualização e orientações sobre o cofre. "
            "Use markdown para destacar alertas e recomendações. "
            "NUNCA sugira revelar ou copiar senhas reais."
        )
