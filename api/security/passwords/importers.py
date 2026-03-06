"""
Password import parsers for Bitwarden JSON and LastPass CSV formats.

All parsing is done in-memory. No files are ever persisted to disk.
"""

import csv
import io
import json

SUPPORTED_FORMATS = ("bitwarden_json", "lastpass_csv")


class ImportParseError(Exception):
    pass


def parse_bitwarden_json(content: bytes) -> list[dict]:
    """
    Parse a Bitwarden JSON export file.

    Only login items (type=1) are imported; cards, notes, and identity
    items are silently skipped.

    Expected format:
      { "items": [ { "type": 1, "name": "...", "login": { ... } }, ... ] }
    """
    try:
        data = json.loads(content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ImportParseError(f"Arquivo JSON inválido: {e}")

    if not isinstance(data, dict) or "items" not in data:
        raise ImportParseError(
            "Formato Bitwarden inválido: campo 'items' não encontrado."
        )

    entries: list[dict] = []
    for item in data.get("items", []):
        # type 1 = login; skip cards (3), secure notes (2), identity (4)
        if item.get("type") != 1:
            continue

        login = item.get("login") or {}
        uris = login.get("uris") or []
        site = uris[0].get("uri", "") if uris else ""

        entries.append(
            {
                "title": item.get("name", "").strip(),
                "username": login.get("username", "").strip(),
                "password": login.get("password", "") or "",
                "site": site.strip(),
                "category": "other",
                "notes": (item.get("notes", "") or "").strip(),
            }
        )

    return entries


def parse_lastpass_csv(content: bytes) -> list[dict]:
    """
    Parse a LastPass CSV export file.

    Expected columns: url, username, password, extra, name, grouping, fav
    Rows where url starts with 'http://sn' are LastPass section headers
    and are skipped.
    """
    # LastPass exports UTF-8; fall back to latin-1 for older exports
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError as e:
            raise ImportParseError(f"Não foi possível decodificar o arquivo: {e}")

    reader = csv.DictReader(io.StringIO(text))

    required_fields = {"url", "username", "password", "name"}

    entries: list[dict] = []
    try:
        rows = list(reader)
    except csv.Error as e:
        raise ImportParseError(f"Erro ao ler CSV: {e}")

    if not rows:
        return entries

    # Validate that expected columns are present
    first_row_keys = set(rows[0].keys())
    if not required_fields.issubset(first_row_keys):
        raise ImportParseError(
            f"Formato LastPass inválido. "
            f"Campos esperados: {required_fields}. "
            f"Campos encontrados: {first_row_keys}"
        )

    for row in rows:
        url = row.get("url", "").strip()
        # Skip LastPass section header rows (url = http://sn)
        if url.startswith("http://sn"):
            continue

        entries.append(
            {
                "title": (row.get("name", "") or "").strip(),
                "username": (row.get("username", "") or "").strip(),
                "password": row.get("password", "") or "",
                "site": url,
                "category": "other",
                "notes": (row.get("extra", "") or "").strip(),
            }
        )

    return entries
