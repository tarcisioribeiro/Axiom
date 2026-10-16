"""setup_members.py (run on every boot) must grant every app that
setup_permissions grants, or members lose access (e.g. webhooks → 403)."""

import ast
from pathlib import Path

from django.test import SimpleTestCase

ROOT = Path(__file__).resolve().parent.parent


def _assigned(path: Path, name: str) -> ast.expr:
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == name for t in node.targets
        ):
            return node.value
    raise AssertionError(f"{name} not found in {path}")


class MembersGroupAppsTest(SimpleTestCase):
    def test_setup_members_covers_setup_permissions_apps(self) -> None:
        boot_apps = set(
            ast.literal_eval(_assigned(ROOT / "setup_members.py", "apps"))
        )
        cmd = ROOT / "app/management/commands/setup_permissions.py"
        granted = set(ast.literal_eval(_assigned(cmd, "app_models")))
        self.assertEqual(granted - boot_apps, set())
