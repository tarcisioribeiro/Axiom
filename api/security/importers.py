"""
Password import parsers for multiple password manager export formats.

All parsing is done in-memory. No files are ever persisted to disk.

Supported formats:
  bitwarden_json  — Bitwarden JSON export
  lastpass_csv    — LastPass CSV export
  onepassword_csv — 1Password CSV export
  dashlane_csv    — Dashlane CSV export
  keepass_xml     — KeePass XML export (kdbx4 unencrypted XML
                    or KeePass 1.x XML)
"""

import csv
import io
import json
import xml.etree.ElementTree as ET  # nosec B405 — parsing trusted in-memory

# uploads

SUPPORTED_FORMATS = (
    "bitwarden_json",
    "lastpass_csv",
    "onepassword_csv",
    "dashlane_csv",
    "keepass_xml",
)


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
            raise ImportParseError(
                f"Não foi possível decodificar o arquivo: {e}"
            )

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


def parse_onepassword_csv(content: bytes) -> list[dict]:
    """
    Parse a 1Password CSV export file.

    Expected columns (1Password 7+): Title, Username, Password, URL, Notes,
    Type
    Also handles the older format: title, username, password, url, notes
    """
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError as e:
            raise ImportParseError(
                f"Não foi possível decodificar o arquivo: {e}"
            )

    reader = csv.DictReader(io.StringIO(text))

    entries: list[dict] = []
    try:
        rows = list(reader)
    except csv.Error as e:
        raise ImportParseError(f"Erro ao ler CSV: {e}")

    if not rows:
        return entries

    def _get(row: dict, *keys: str) -> str:
        for k in keys:
            for row_key in row:
                if row_key.strip().lower() == k.lower():
                    v = row.get(row_key, "") or ""
                    return v.strip()
        return ""

    for row in rows:
        item_type = _get(row, "type", "Type")
        if item_type and item_type.lower() not in ("login", ""):
            continue

        title = _get(row, "title", "Title", "name", "Name")
        username = _get(row, "username", "Username")
        password = _get(row, "password", "Password")
        url = _get(row, "url", "URL", "website", "Website")
        notes = _get(row, "notes", "Notes", "note", "Note")

        if not title and not username:
            continue

        entries.append(
            {
                "title": title or username,
                "username": username,
                "password": password,
                "site": url,
                "category": "other",
                "notes": notes,
            }
        )

    return entries


def parse_dashlane_csv(content: bytes) -> list[dict]:
    """
    Parse a Dashlane CSV export file.

    Expected columns: username, username2, username3, url, password,
                      note, name, email, category, type
    """
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError as e:
            raise ImportParseError(
                f"Não foi possível decodificar o arquivo: {e}"
            )

    reader = csv.DictReader(io.StringIO(text))

    entries: list[dict] = []
    try:
        rows = list(reader)
    except csv.Error as e:
        raise ImportParseError(f"Erro ao ler CSV: {e}")

    if not rows:
        return entries

    for row in rows:
        item_type = (row.get("type", "") or "").strip().lower()
        if item_type and item_type not in (
            "password",
            "login",
            "credentials",
            "",
        ):
            continue

        name = (row.get("name", "") or "").strip()
        username = (
            row.get("username", "")
            or row.get("email", "")
            or row.get("username2", "")
            or ""
        ).strip()
        password = (row.get("password", "") or "").strip()
        url = (row.get("url", "") or "").strip()
        notes = (row.get("note", "") or row.get("notes", "") or "").strip()
        category = (row.get("category", "") or "").strip().lower()

        if not name and not username:
            continue

        category_map = {
            "social": "social",
            "email": "email",
            "finance": "banking",
            "banking": "banking",
            "work": "work",
            "entertainment": "entertainment",
            "shopping": "shopping",
            "streaming": "streaming",
            "gaming": "gaming",
        }

        entries.append(
            {
                "title": name or username,
                "username": username,
                "password": password,
                "site": url,
                "category": category_map.get(category, "other"),
                "notes": notes,
            }
        )

    return entries


def parse_keepass_xml(content: bytes) -> list[dict]:
    """
    Parse a KeePass XML export file (KeePass 1.x or KeePassXC unencrypted XML).

    KeePass XML structure:
      <KeePassFile>
        <Root>
          <Group>
            <Entry>
              <String><Key>Title</Key><Value>...</Value></String>
              <String><Key>UserName</Key><Value>...</Value></String>
              <String><Key>Password</Key><Value>...</Value></String>
              <String><Key>URL</Key><Value>...</Value></String>
              <String><Key>Notes</Key><Value>...</Value></String>
            </Entry>
          </Group>
        </Root>
      </KeePassFile>
    """
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError as e:
            raise ImportParseError(
                f"Não foi possível decodificar o arquivo: {e}"
            )

    try:
        root = ET.fromstring(text)  # nosec B314
    except ET.ParseError as e:
        raise ImportParseError(f"Arquivo XML inválido: {e}")

    entries: list[dict] = []

    def _extract_entries(group_elem) -> None:
        for entry in group_elem.findall("Entry"):
            fields: dict[str, str] = {}
            for string_elem in entry.findall("String"):
                key_elem = string_elem.find("Key")
                value_elem = string_elem.find("Value")
                if key_elem is not None and value_elem is not None:
                    key = (key_elem.text or "").strip()
                    value = (value_elem.text or "").strip()
                    fields[key] = value

            title = fields.get("Title", "").strip()
            username = fields.get("UserName", "").strip()
            password = fields.get("Password", "").strip()
            url = fields.get("URL", "").strip()
            notes = fields.get("Notes", "").strip()

            if not title and not username:
                continue

            entries.append(
                {
                    "title": title or username,
                    "username": username,
                    "password": password,
                    "site": url,
                    "category": "other",
                    "notes": notes,
                }
            )

        for sub_group in group_elem.findall("Group"):
            _extract_entries(sub_group)

    root_group = root.find(".//Root/Group") or root.find(".//Group")
    if root_group is None:
        raise ImportParseError(
            "Formato KeePass inválido: estrutura de grupos não encontrada."
        )

    _extract_entries(root_group)
    return entries
