from typing import Any

from django.contrib.auth.models import User

from agents.core.base_agent import AgentContext, BaseAgent
from agents.core.prompts import BASE_SYSTEM_PROMPT

_TRIGGER_WORDS = [
    "rotina",
    "rotinas",
    "hábito",
    "hábitos",
    "tarefa",
    "tarefas",
    "planejamento",
    "meta",
    "metas",
    "goal",
    "objetivo",
    "completei",
    "cumpri",
    "streak",
    "sequência",
    "dias consecutivos",
    "produtividade",
    "disciplina",
    "fiz hoje",
    "deixei de fazer",
    "percentual de cumprimento",
    "taxa",
    "como estou indo",
]


class PlanningAgent(BaseAgent):
    name = "planning"
    description = "Análise de rotinas, hábitos e progresso de metas"
    ollama_model = "llama3.1:8b"
    anthropic_model = "claude-haiku-4-5-20251001"

    def can_handle(self, query: str) -> float:
        q = query.lower()
        hits = sum(1 for w in _TRIGGER_WORDS if w in q)
        return min(hits * 0.28, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.planning_tools import (
            get_active_goals,
            get_routine_summary,
            get_today_pending_tasks,
            get_top_missed_routines,
        )

        user = User.objects.get(pk=ctx.user_id)
        summary = get_routine_summary(user, days=7)
        missed = get_top_missed_routines(user, days=7)
        goals = get_active_goals(user)
        pending_today = get_today_pending_tasks(user)

        return {
            "system_prompt": BASE_SYSTEM_PROMPT,
            "summary": summary,
            "missed_routines": missed,
            "goals": goals,
            "pending_today": pending_today,
            "sources": ["Tarefas e rotinas — últimos 7 dias"],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        s = data["summary"]
        summary_block = (
            f"Período: {s['start']} a {s['end']}\n"
            f"  Completadas: {s['completed']}/{s['total']} ({s['completion_rate']}%)\n"
            f"  Puladas: {s['skipped']} | Pendentes: {s['pending']}"
        )

        missed_block = (
            "\n".join(
                f"  - {m['name']} ({m['category']}): faltou {m['missed']}x"
                for m in data["missed_routines"]
            )
            or "  Nenhuma rotina com falhas neste período."
        )

        goals_block = (
            "\n".join(
                f"  - {g['title']}: {g['progress_pct']:.0f}% "
                f"({g['current']:.0f}/{g['target']:.0f})"
                + (f" — prazo {g['target_date']}" if g["target_date"] else "")
                for g in data["goals"]
            )
            or "  Nenhuma meta ativa."
        )

        pending_block = (
            "\n".join(
                f"  - {t['name']} ({t['category']})" for t in data["pending_today"]
            )
            or "  Todas as tarefas de hoje já foram tratadas."
        )

        history_block = ""
        if ctx.history:
            from agents.core.memory import ConversationMemory

            history_block = (
                f"\nHistórico:\n{ConversationMemory.format_for_prompt(ctx.history)}\n"
            )

        return (
            f"Resumo de rotinas — últimos 7 dias:\n"
            f"{summary_block}\n\n"
            f"Rotinas com mais falhas:\n"
            f"{missed_block}\n\n"
            f"Metas ativas:\n"
            f"{goals_block}\n\n"
            f"Pendente hoje:\n"
            f"{pending_block}\n"
            f"{history_block}\n"
            f"Pergunta: {ctx.query}\n\n"
            "Seja encorajador mas realista. "
            "Sugira ajustes de horário ou frequência "
            "quando identificar padrões de falha."
        )
