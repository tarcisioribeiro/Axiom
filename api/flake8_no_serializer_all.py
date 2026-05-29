"""
Flake8 plugin that flags `fields = "__all__"` inside DRF ModelSerializer
Meta classes.

Error code: DRF001
"""

import ast
from typing import Generator, Tuple, Type

MSG = (
    'DRF001 Use explicit field list instead of fields = "__all__"'
    " in serializers"
)


def _is_serializer_class(class_node: ast.ClassDef) -> bool:
    """Return True if the class appears to inherit from a DRF serializer."""
    for base in class_node.bases:
        if isinstance(base, ast.Attribute) and "Serializer" in base.attr:
            return True
        if isinstance(base, ast.Name) and "Serializer" in base.id:
            return True
    return False


class NoSerializerAllChecker:
    """Flake8 AST checker that disallows fields = \"__all__\" in
    serializers."""

    name = "flake8_no_serializer_all"
    version = "1.0.0"

    def __init__(self, tree: ast.AST) -> None:
        self.tree = tree

    def run(
        self,
    ) -> Generator[
        Tuple[int, int, str, Type["NoSerializerAllChecker"]], None, None
    ]:
        for node in ast.walk(self.tree):
            if not isinstance(node, ast.ClassDef):
                continue
            if not _is_serializer_class(node):
                continue
            for item in node.body:
                if not isinstance(item, ast.ClassDef) or item.name != "Meta":
                    continue
                for stmt in item.body:
                    if not isinstance(stmt, ast.Assign):
                        continue
                    for target in stmt.targets:
                        if (
                            isinstance(target, ast.Name)
                            and target.id == "fields"
                            and isinstance(stmt.value, ast.Constant)
                            and stmt.value.value == "__all__"
                        ):
                            yield (
                                stmt.lineno,
                                stmt.col_offset,
                                MSG,
                                type(self),
                            )
