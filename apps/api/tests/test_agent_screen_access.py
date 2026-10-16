import inspect
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from admin_panel.models import UserScreenAccess
from agents.core.base_agent import AgentContext
from agents.core.router import NO_ACCESS_MESSAGE, AgentRouter, NoAccessAgent
from agents.providers import (
    financial_provider,
    library_provider,
    personal_provider,
    security_provider,
)
from agents.providers.access import requires_screen
from agents.tools.rag_tools import search_embeddings

PROVIDERS = (
    financial_provider,
    library_provider,
    personal_provider,
    security_provider,
)


def grant(user: User, **screens: list[str]) -> None:
    UserScreenAccess.objects.filter(user=user).delete()
    for key, actions in screens.items():
        UserScreenAccess.objects.create(
            user=user, screen=key.replace("__", "."), actions=actions
        )


class ProviderAccessTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("comum", "c@test.com", "pw")

    def test_every_user_provider_function_is_guarded(self):
        unguarded = [
            f"{module.__name__}.{name}"
            for module in PROVIDERS
            for name, fn in inspect.getmembers(module, inspect.isfunction)
            if fn.__module__ == module.__name__
            and "user" in inspect.signature(fn).parameters
            and not hasattr(fn, "__wrapped__")
        ]
        self.assertEqual(unguarded, [])

    def test_decorator_returns_empty_without_screen(self):
        @requires_screen("finance.accounts", empty=[])
        def data(user):
            return ["secreto"]

        grant(self.user, security__passwords=["view"])
        self.assertEqual(data(self.user), [])
        grant(self.user, finance__accounts=["view"])
        self.assertEqual(data(self.user), ["secreto"])

    def test_staff_sees_everything(self):
        @requires_screen("finance.accounts", empty=[])
        def data(user):
            return ["secreto"]

        staff = User.objects.create_user(
            "stf", "s@test.com", "pw", is_staff=True
        )
        self.assertEqual(data(staff), ["secreto"])


@patch("agents.core.router.LLMClient.embed", return_value=None)
class RouterAccessTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("comum", "c@test.com", "pw")
        self.ctx = AgentContext(user_id=self.user.pk, query="quanto gastei?")

    def test_blocked_override_answers_without_llm(self, _embed):
        grant(self.user, security__passwords=["view"])
        agent = AgentRouter.select(self.ctx, agent_override="financial")
        self.assertIsInstance(agent, NoAccessAgent)
        self.assertEqual(agent.run(self.ctx).content, NO_ACCESS_MESSAGE)
        self.assertEqual(list(agent.stream(self.ctx)), [NO_ACCESS_MESSAGE])

    def test_routes_only_among_allowed_agents(self, _embed):
        grant(self.user, security__passwords=["view"])
        self.assertEqual(AgentRouter.select(self.ctx).name, "security")

    def test_no_module_at_all(self, _embed):
        grant(self.user)
        self.assertIsInstance(AgentRouter.select(self.ctx), NoAccessAgent)


class RagAccessTest(TestCase):
    def test_blocked_domain_skips_search(self):
        user = User.objects.create_user("comum", "c@test.com", "pw")
        grant(user, security__passwords=["view"])
        with patch("agents.core.llm_client.LLMClient.embed") as embed:
            self.assertEqual(search_embeddings("livro", user, "library"), [])
            embed.assert_not_called()
