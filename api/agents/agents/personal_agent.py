"""
Agente Pessoal — cobre todo o módulo de Planejamento Pessoal:
rotinas, hábitos, metas, treino físico e nutrição.
"""

import unicodedata
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from agents.core.base_agent import AgentContext, BaseAgent, safe_str
from agents.core.prompts import get_system_prompt
from agents.core.temporal import parse_temporal_intent

# Palavras-chave agrupadas por tema para scoring ponderado
_KW_ROUTINE = [
    "rotina",
    "rotinas",
    "hábito",
    "hábitos",
    "habito",
    "habitos",
    "tarefa",
    "tarefas",
    "checklist",
    "checklist",
    "lista",
    "diário",
    "diario",
    "planejamento",
    "plano pessoal",
    "organização",
    "organizacao",
    "disciplina",
    "consistência",
    "consistencia",
    "produtividade",
    "completei",
    "cumpri",
    "fiz hoje",
    "deixei de fazer",
    "pulei",
    "sequência",
    "sequencia",
    "streak",
    "dias consecutivos",
    "taxa de cumprimento",
    "percentual",
    "como estou indo",
    "agenda",
    "compromisso",
    "hábito diário",
]

_KW_GOALS = [
    "meta",
    "metas",
    "objetivo",
    "objetivos",
    "goal",
    "goals",
    "progresso",
    "avanço",
    "avanco",
    "resultado",
    "conquista",
    "prazo",
    "deadline",
    "atingir",
    "alcançar",
    "alcançar meta",
    "evolução pessoal",
    "evolucao",
    "desenvolvimento pessoal",
]

_KW_WORKOUT = [
    "treino",
    "treinar",
    "academia",
    "musculação",
    "musculacao",
    "exercício",
    "exercicios",
    "exercitar",
    "atividade física",
    "atividade fisica",
    "cardio",
    "aeróbico",
    "aerobico",
    "corrida",
    "caminhada",
    "supino",
    "agachamento",
    "rosca",
    "barra",
    "levantamento",
    "peso",
    "série",
    "series",
    "repetição",
    "repeticoes",
    "rep",
    "reps",
    "carga",
    "kg no exercício",
    "musculação hoje",
    "treinei",
    "não treinei",
    "nao treinei",
    "faltei treino",
    "sessão de treino",
    "sessao",
    "plano de treino",
    "divisão de treino",
    "a b c",
    "upper lower",
    "push pull legs",
    "hipertrofia",
    "perda de gordura",
    "ganho de massa",
    "definição",
]

_KW_NUTRITION = [
    "dieta",
    "nutrição",
    "nutricao",
    "alimentação",
    "alimentacao",
    "refeição",
    "refeicao",
    "refeições",
    "café da manhã",
    "cafe da manha",
    "almoço",
    "almoco",
    "jantar",
    "lanche",
    "ceia",
    "calorias",
    "caloria",
    "proteína",
    "proteinas",
    "carboidrato",
    "gordura",
    "macro",
    "macronutrientes",
    "kcal",
    "cardápio",
    "cardapio",
    "menu",
    "opção alimentar",
    "comi",
    "o que comi",
    "fui de folha",
    "refeição livre",
    "plano alimentar",
    "diário alimentar",
    "log de refeição",
    "emagrecer",
    "perder peso",
    "ganhar massa",
    "bulking",
    "cutting",
]

_ALL_KW = _KW_ROUTINE + _KW_GOALS + _KW_WORKOUT + _KW_NUTRITION


def _normalize(text: str) -> str:
    """Remove acentos e converte para minúsculas para matching robusto."""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(c) != "Mn"
    )


class PersonalAgent(BaseAgent):
    name = "personal"
    description = (
        "Assistente pessoal: rotinas, hábitos, metas, treino e nutrição"
    )
    ollama_model = "llama3.1:8b"
    anthropic_model = "claude-sonnet-4-6"
    groq_model = "llama-3.3-70b-versatile"

    def can_handle(self, query: str) -> float:
        q = _normalize(query)
        hits = sum(1 for w in _ALL_KW if _normalize(w) in q)
        return min(hits * 0.22, 1.0)

    def build_context(self, ctx: AgentContext) -> dict[str, Any]:
        from agents.tools.personal_tools import (
            get_active_workout_plan,
            get_nutrition_summary,
            get_workout_summary,
        )
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
            routine_summary = get_routine_summary(
                user, start=t_start, end=t_end
            )
            missed = get_top_missed_routines(user, start=t_start, end=t_end)
            workout = get_workout_summary(user, start=t_start, end=t_end)
            nutrition = get_nutrition_summary(user, start=t_start, end=t_end)
            pending_today: list[dict[str, Any]] = []
            period_label = (
                f"{t_start.strftime('%d/%m')}–{t_end.strftime('%d/%m/%Y')}"
            )
        else:
            routine_summary = get_routine_summary(user, days=7)
            missed = get_top_missed_routines(user, days=7)
            workout = get_workout_summary(user, days=14)
            nutrition = get_nutrition_summary(user, days=7)
            pending_today = get_today_pending_tasks(user)
            period_label = "últimos 7–14 dias"

        goals = get_active_goals(user)
        workout_plan = get_active_workout_plan(user)

        return {
            "system_prompt": get_system_prompt(ctx.language),
            "routine_summary": routine_summary,
            "missed_routines": missed,
            "goals": goals,
            "pending_today": pending_today,
            "workout": workout,
            "nutrition": nutrition,
            "workout_plan": workout_plan,
            "period_label": period_label,
            "is_historical": temporal is not None,
            "sources": [f"Planejamento Pessoal — {period_label}"],
        }

    def build_prompt(self, ctx: AgentContext, data: dict[str, Any]) -> str:
        rs = data["routine_summary"]
        routine_block = (
            "  Completadas: {}/{} ({}%)\n"
            "  Puladas: {} | Pendentes: {}".format(
                rs["completed"],
                rs["total"],
                rs["completion_rate"],
                rs["skipped"],
                rs["pending"],
            )
        )

        missed_block = (
            "\n".join(
                "  - {} ({}): faltou {}x".format(
                    safe_str(m["name"]), safe_str(m["category"]), m["missed"]
                )
                for m in data["missed_routines"]
            )
            or "  Nenhuma rotina com falhas no período."
        )

        goals_block = (
            "\n".join(
                "  - {}: {:.0f}% ({:.0f}/{:.0f}){}".format(
                    safe_str(g["title"]),
                    g["progress_pct"],
                    g["current"],
                    g["target"],
                    f" — prazo {g['target_date']}" if g["target_date"] else "",
                )
                for g in data["goals"]
            )
            or "  Nenhuma meta ativa."
        )

        w = data["workout"]
        workout_block = (
            f"  Sessões: {w['total_sessions']} em {w['days_analyzed']} dias\n"
            + (
                "\n".join(
                    f"  - {s['date']}: {safe_str(s['plan'])}"
                    + (f" ({s['duration']})" if s["duration"] else "")
                    for s in w["sessions"][:5]
                )
                or "  Sem sessões registradas no período."
            )
        )

        n = data["nutrition"]
        nutrition_block = (
            f"  Refeições registradas: {n['total_logs']}"
            f" em {n['days_analyzed']} dias"
            + (f" ({n['free_meals']} livre(s))" if n["free_meals"] else "")
        )

        plan = data["workout_plan"]
        plan_block = ""
        if plan.get("has_plan"):
            days_str = ", ".join(
                f"{d['name']}" for d in plan.get("days", [])[:6]
            )
            plan_block = "\nPlano de treino atual: {} — {}\n".format(
                safe_str(plan["plan_name"]), days_str
            )

        pending_section = ""
        if not data["is_historical"] and data["pending_today"]:
            pending_items = "\n".join(
                f"  - {safe_str(t['name'])} ({safe_str(t['category'])})"
                for t in data["pending_today"]
            )
            pending_section = f"\nPendente hoje:\n{pending_items}\n"

        return (
            f"Dados pessoais — {data['period_label']}:\n\n"
            f"Rotinas ({rs['start']} a {rs['end']}):\n{routine_block}\n\n"
            f"Rotinas com mais falhas:\n{missed_block}\n\n"
            f"Metas ativas:\n{goals_block}\n\n"
            f"Treino físico:\n{workout_block}\n\n"
            f"Nutrição:\n{nutrition_block}\n"
            f"{plan_block}"
            f"{pending_section}\n"
            f"Pergunta: {ctx.query}\n\n"
            "Use markdown para tabelas e listas quando útil. "
            "Seja encorajador e específico. "
            "Sugira melhorias concretas quando identificar padrões de falha."
        )
