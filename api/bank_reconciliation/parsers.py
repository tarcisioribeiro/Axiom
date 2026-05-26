import re
from datetime import datetime
from decimal import Decimal, InvalidOperation


def _parse_amount(raw: str) -> Decimal:
    """
    Parse a monetary string that may use either locale format.

    Strategy: find the last separator character (. or ,).
    - If last separator is '.': dot is decimal; remove commas (thousands).
    - If last separator is ',': comma is decimal; remove dots (thousands),
      then replace , with .
    - If no separator: parse as integer/plain number.
    """
    s = raw.strip().replace(" ", "")
    if not s:
        raise ValueError("Empty amount string")

    last_dot = s.rfind(".")
    last_comma = s.rfind(",")

    if last_dot == -1 and last_comma == -1:
        # No separator — plain integer
        return Decimal(s)
    elif last_dot > last_comma:
        # English format: 1,234.56 or -150.00
        cleaned = s.replace(",", "")
    else:
        # Brazilian format: 1.234,56 or -150,00
        cleaned = s.replace(".", "").replace(",", ".")

    return Decimal(cleaned)


def parse_ofx(content: str) -> list:
    """
    Parse OFX 1.x SGML format (used by Brazilian banks like
    Bradesco, Itaú, Nubank).
    Returns list of transaction dicts.
    """
    transactions = []
    for block_match in re.finditer(
        r"<STMTTRN>(.*?)</STMTTRN>", content, re.DOTALL | re.IGNORECASE
    ):
        block = block_match.group(1)

        def extract(tag):
            m = re.search(
                r"<" + tag + r">(.*?)(?:<|\Z)",
                block,
                re.IGNORECASE | re.DOTALL,
            )
            return m.group(1).strip() if m else ""

        trntype = extract("TRNTYPE").lower()
        dtposted = extract("DTPOSTED")
        trnamt = extract("TRNAMT")
        fitid = extract("FITID")
        memo = extract("MEMO") or extract("NAME")

        if not dtposted or not trnamt:
            continue

        try:
            date = datetime.strptime(dtposted[:8], "%Y%m%d").date()
        except ValueError:
            continue

        try:
            amount = Decimal(trnamt.replace(",", ".").strip())
        except InvalidOperation:
            continue

        if amount < 0 or trntype in (
            "debit",
            "atm",
            "pos",
            "check",
            "payment",
        ):
            transaction_type = "debit"
        else:
            transaction_type = "credit"

        transactions.append(
            {
                "date": date,
                "amount": amount,
                "description": memo,
                "transaction_id": fitid,
                "type": transaction_type,
            }
        )

    return transactions


def parse_csv(content: str) -> list:
    """
    Parse CSV bank statement with auto-detection of columns and separator.
    """
    # Auto-detect separator
    separator = ";"
    first_line = content.split("\n")[0] if content else ""
    if first_line.count(";") < first_line.count(","):
        separator = ","

    lines = [
        line.strip() for line in content.strip().split("\n") if line.strip()
    ]
    if not lines:
        return []

    # Parse header
    header = [
        col.strip().strip('"').lower() for col in lines[0].split(separator)
    ]

    # Auto-detect column indices
    date_idx = None
    amount_idx = None
    desc_idx = None

    for i, col in enumerate(header):
        if any(kw in col for kw in ("data", "date", "dt")):
            if date_idx is None:
                date_idx = i
        if any(kw in col for kw in ("valor", "amount", "value", "vlr")):
            if amount_idx is None:
                amount_idx = i
        if any(
            kw in col
            for kw in ("descri", "memo", "hist", "estabelec", "comercio")
        ):
            if desc_idx is None:
                desc_idx = i

    # Fallback to positional
    if date_idx is None:
        date_idx = 0
    if amount_idx is None:
        amount_idx = 1
    if desc_idx is None:
        desc_idx = 2

    date_formats = ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"]

    transactions = []
    for line in lines[1:]:
        cols = [col.strip().strip('"') for col in line.split(separator)]
        if len(cols) <= max(date_idx, amount_idx, desc_idx):
            continue

        raw_date = cols[date_idx]
        raw_amount = cols[amount_idx]
        description = cols[desc_idx] if desc_idx < len(cols) else ""

        date = None
        for fmt in date_formats:
            try:
                date = datetime.strptime(raw_date.strip(), fmt).date()
                break
            except ValueError:
                continue

        if date is None:
            continue

        try:
            amount = _parse_amount(raw_amount)
        except (InvalidOperation, ValueError):
            continue

        transaction_type = "debit" if amount < 0 else "credit"

        transactions.append(
            {
                "date": date,
                "amount": amount,
                "description": description,
                "transaction_id": "",
                "type": transaction_type,
            }
        )

    return transactions


def parse_cnab240(content: str) -> list:
    """Parse CNAB 240 — padrão Febraban de 240 caracteres por linha.

    Cada linha de detalhe (segmento E/A/B) tem posições fixas.
    Trata apenas o segmento E (lançamentos) que é o mais comum entre bancos BR.
    """
    transactions = []
    lines = content.splitlines()

    for line in lines:
        line = line.rstrip("\r\n")
        if len(line) < 240:
            continue

        # Tipo de registro: 3=detalhe, 0=hdr arquivo, 1=hdr lote,
        # 5=trailer lote, 9=trailer arquivo
        record_type = line[7:8]  # col 8 (1-indexed)
        if record_type != "3":
            continue

        segment = line[
            13:14
        ]  # col 14 — segmento (E = lançamentos, J = outros)
        if segment not in ("E", "A"):
            continue

        try:
            # Data: cols 73-80 (formato DDMMAAAA)
            raw_date = line[73:81].strip()
            if not raw_date or raw_date == "00000000":
                continue
            date = datetime.strptime(raw_date, "%d%m%Y").date()

            # Valor: cols 119-132 (13 dígitos + 2 decimais, sem separador)
            raw_value = line[119:132].strip()
            if not raw_value or raw_value == "0" * len(raw_value):
                continue
            amount = Decimal(raw_value) / Decimal("100")
            if amount == 0:
                continue

            # Tipo crédito/débito: col 15 (C = crédito, D = débito)
            credit_debit = line[15:16].strip().upper()

            # Descrição: cols 133-172 (40 chars, descrição/histórico)
            description = line[133:173].strip()

            # ID transação: cols 73-85 (NOSSO NÚMERO)
            transaction_id = line[73:88].strip()

            transaction_type = "debit" if credit_debit == "D" else "credit"

            transactions.append(
                {
                    "date": date,
                    "amount": amount,
                    "description": description,
                    "transaction_id": transaction_id,
                    "type": transaction_type,
                }
            )
        except (ValueError, InvalidOperation):
            continue

    return transactions


def parse_cnab400(content: str) -> list:
    """Parse CNAB 400 — padrão de 400 caracteres por linha.

    Compatível com Bradesco, Banco do Brasil, Itaú e Santander
    (remessa/retorno).
    Trata apenas registros de detalhe (tipo 1).
    """
    transactions = []
    lines = content.splitlines()

    for line in lines:
        line = line.rstrip("\r\n")
        if len(line) < 400:
            continue

        record_type = line[0:1]
        if record_type != "1":  # 0 = header, 9 = trailer, 1 = detalhe
            continue

        try:
            # Data: cols 111-116 (DDMMAA) ou 146-151 dependendo do layout
            raw_date = line[110:116].strip()
            if not raw_date or raw_date == "000000":
                continue
            # Tenta DDMMAA; se falhar, tenta DDMMAAAA
            try:
                date = datetime.strptime(raw_date, "%d%m%y").date()
            except ValueError:
                date = datetime.strptime(raw_date[:8], "%d%m%Y").date()

            # Valor: cols 153-165 (13 chars com 2 decimais implícitos)
            raw_value = line[152:165].strip()
            if not raw_value or raw_value == "0" * len(raw_value):
                continue
            amount = Decimal(raw_value) / Decimal("100")
            if amount == 0:
                continue

            # Débito (D) ou crédito (C): col 142
            credit_debit = line[141:142].strip().upper()

            # Descrição: cols 63-72 (nosso número/descrição) + 173-212
            # (histórico)
            description = (
                line[62:72].strip() + " " + line[172:212].strip()
            ).strip()
            if not description:
                description = "Lançamento CNAB 400"

            transaction_id = line[62:72].strip()
            transaction_type = "debit" if credit_debit == "D" else "credit"

            transactions.append(
                {
                    "date": date,
                    "amount": amount,
                    "description": description,
                    "transaction_id": transaction_id,
                    "type": transaction_type,
                }
            )
        except (ValueError, InvalidOperation):
            continue

    return transactions


def parse_statement(file_content: bytes, file_format: str) -> list:
    """
    Dispatch to the appropriate parser based on file_format.
    Raises ValueError on parse failure.
    """
    try:
        content = file_content.decode("latin-1", errors="replace")
    except Exception as exc:
        raise ValueError(
            f"Não foi possível decodificar o arquivo: {exc}"
        ) from exc

    if file_format == "ofx":
        transactions = parse_ofx(content)
    elif file_format == "csv":
        transactions = parse_csv(content)
    elif file_format == "cnab240":
        transactions = parse_cnab240(content)
    elif file_format == "cnab400":
        transactions = parse_cnab400(content)
    else:
        raise ValueError(f"Formato não suportado: {file_format}")

    if not transactions:
        raise ValueError(
            "Nenhuma transação encontrada no arquivo. "
            "Verifique se o formato está correto."
        )

    return transactions
