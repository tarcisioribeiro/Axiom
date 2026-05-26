from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt
from agents.core.temporal import parse_temporal_intent

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
    groq_model = "llama-3.1-8b-instant"

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
        now = timezone.now().date()

        temporal = (
            parse_temporal_intent(ctx.query, now)
            if not ctx.metadata.get("date_from")
            else None
        )

        if temporal:
            t_start, t_end = temporal
            summary = get_routine_summary(user, start=t_start, end=t_end)
            missed = get_top_missed_routines(user, start=t_start, end=t_end)
            pending_today: list[dict[str, Any]] = []
            sources_label = (
                f"Rotinas {t_start.strftime('%d/%m')}"
                f"–{t_end.strftime('%d/%m/%Y')}"
            )
        else:
            summary = get_routine_summary(user, days=7)
            missed = get_top_missed_routines(user, days=7)
            pending_today = get_today_pending_tasks(user)
            sources_label = "Tarefas e rotinas — últimos 7 dias"

        goals = get_active_goals(user)

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "summary": summary,
            "missed_routines": missed,
            "goals": goals,
            "pending_today": pending_today,
            "is_historical": temporal is not None,
            "sources": [sources_label],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        s = data["summary"]
        summary_block = (
            f"Período: {s['start']} a {s['end']}\n"
            f"  Completadas: {s['completed']}/{s['total']}"
            f" ({s['completion_rate']}%)\n"
            f"  Puladas: {s['skipped']} | Pendentes: {s['pending']}"
        )

        missed_block = (
            "\n".join(
                "  - {} ({}): faltou {}x".format(
                    safe_str(m["name"]), safe_str(m["category"]), m["missed"]
                )
                for m in data["missed_routines"]
            )
            or "  Nenhuma rotina com falhas neste período."
        )

        goals_block = (
            "\n".join(
                f"  - {safe_str(g['title'])}: {g['progress_pct']:.0f}% "
                f"({g['current']:.0f}/{g['target']:.0f})"
                + (f" — prazo {g['target_date']}" if g["target_date"] else "")
                for g in data["goals"]
            )
            or "  Nenhuma meta ativa."
        )

        pending_section = ""
        if not data["is_historical"]:
            pending_block = (
                "\n".join(
                    f"  - {safe_str(t['name'])} ({safe_str(t['category'])})"
                    for t in data["pending_today"]
                )
                or "  Todas as tarefas de hoje já foram tratadas."
            )
            pending_section = f"\nPendente hoje:\n{pending_block}\n"

        return (
            f"Resumo de rotinas — {s['start']} a {s['end']}:\n"
            f"{summary_block}\n\n"
            f"Rotinas com mais falhas:\n"
            f"{missed_block}\n\n"
            f"Metas ativas:\n"
            f"{goals_block}\n"
            f"{pending_section}\n"
            f"Pergunta: {ctx.query}\n\n"
            "Seja encorajador mas realista. "
            "Sugira ajustes de horário ou frequência "
            "quando identificar padrões de falha."
        )
