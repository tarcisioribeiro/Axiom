"""
Export Utilities

Shared helpers for generating CSV and PDF export responses.
Used by ExportExpensesView and ExportRevenuesView.
"""

import csv
import io
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional

from django.http import HttpResponse, StreamingHttpResponse

from reportlab.lib import colors  # type: ignore
from reportlab.lib.pagesizes import A4, landscape  # type: ignore
from reportlab.lib.styles import (  # type: ignore
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm  # type: ignore
from reportlab.platypus import Paragraph  # type: ignore
from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle


class _Echo:
    """Pseudo-buffer whose write() returns the value so csv.writer
    can stream."""

    def write(self, value: str) -> str:
        return value


def build_csv_response(
    rows: Iterable[List[Any]],
    headers: List[str],
    filename: str,
) -> StreamingHttpResponse:
    """
    Build a StreamingHttpResponse with CSV content, UTF-8 BOM for
    Excel compatibility.

    Accepts any iterable for ``rows`` — including generators — so callers can
    pass a queryset iterator without loading all records into memory at once.

    Parameters
    ----------
    rows : iterable of lists
        Data rows (each row is a list of cell values). May be a generator.
    headers : list of str
        Column header labels.
    filename : str
        Suggested download filename (without extension; .csv appended).

    Returns
    -------
    StreamingHttpResponse
        Response with content-type text/csv and UTF-8 BOM encoding.
    """
    pseudo_buffer = _Echo()
    writer = csv.writer(pseudo_buffer)

    def _generate() -> Iterable[str]:
        yield "\ufeff"  # BOM — Excel UTF-8 recognition
        yield writer.writerow(headers)
        for row in rows:
            yield writer.writerow(row)

    response = StreamingHttpResponse(
        _generate(), content_type="text/csv; charset=utf-8-sig"
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
    return response


def build_pdf_response(
    title: str,
    headers: List[str],
    rows: List[List[Any]],
    totals_row: Optional[List[Any]],
    meta: Dict[str, str],
    filename: str,
) -> HttpResponse:
    """
    Build an HttpResponse with PDF content generated via ReportLab.

    The PDF includes:
    - Header with title, user name, period and generation timestamp
    - Data table with alternating row colours
    - Optional totals footer row

    Parameters
    ----------
    title : str
        Report title (e.g. "Relatório de Despesas").
    headers : list of str
        Column header labels.
    rows : list of lists
        Data rows.
    totals_row : list or None
        Optional summary row rendered with bold styling at the bottom.
    meta : dict
        Extra metadata shown in the header:
        - ``user_name``: authenticated user's display name
        - ``period``: human-readable period string
          (e.g. "01/01/2026 – 31/01/2026")
        - ``total``: formatted total amount
    filename : str
        Suggested download filename (without extension; .pdf appended).

    Returns
    -------
    HttpResponse
        Response with content-type application/pdf.
    """
    buffer = io.BytesIO()

    page_size = landscape(A4)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=4,
        textColor=colors.HexColor("#1a1a2e"),
    )
    meta_style = ParagraphStyle(
        "MetaInfo",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#555555"),
        spaceAfter=2,
    )
    # Paragraph styles for table cells — enables proper word wrapping
    header_cell_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=colors.white,
        leading=11,
        alignment=1,  # CENTER
    )
    data_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=8,
        fontName="Helvetica",
        leading=10,
    )
    total_cell_style = ParagraphStyle(
        "TableTotal",
        parent=styles["Normal"],
        fontSize=8,
        fontName="Helvetica-Bold",
        leading=10,
    )

    def _cell(text: Any, style: ParagraphStyle) -> Paragraph:
        return Paragraph(
            str(text) if not isinstance(text, str) else text, style
        )

    story: List[Any] = []

    # --- Header section ---
    story.append(Paragraph(title, title_style))
    if meta.get("user_name"):
        story.append(Paragraph(f"Usuário: {meta['user_name']}", meta_style))
    if meta.get("period"):
        story.append(Paragraph(f"Período: {meta['period']}", meta_style))
    if meta.get("total"):
        story.append(Paragraph(f"Total: {meta['total']}", meta_style))
    story.append(Spacer(1, 6 * mm))

    # --- Table: wrap all cells in Paragraph for proper word wrap ---
    header_row = [_cell(h, header_cell_style) for h in headers]
    data_rows = [[_cell(c, data_cell_style) for c in row] for row in rows]
    table_data: List[Any] = [header_row] + data_rows
    if totals_row:
        table_data.append([_cell(c, total_cell_style) for c in totals_row])

    col_count = len(headers)
    available_width = page_size[0] - 30 * mm  # landscape width minus margins
    col_widths = [available_width / col_count] * col_count

    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Alternating row colours
    row_count = len(table_data)
    row_backgrounds = []
    for i in range(1, row_count):
        bg = colors.HexColor("#f9f9f9") if i % 2 == 0 else colors.white
        row_backgrounds.append(("BACKGROUND", (0, i), (-1, i), bg))

    totals_styles = []
    if totals_row:
        last = row_count - 1
        totals_styles = [
            ("BACKGROUND", (0, last), (-1, last), colors.HexColor("#e8f4fd")),
            (
                "LINEABOVE",
                (0, last),
                (-1, last),
                1,
                colors.HexColor("#4a90d9"),
            ),
        ]

    tbl.setStyle(
        TableStyle(
            [
                # Header row background (text style set via header_cell_style)
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                # All rows
                ("TOPPADDING", (0, 1), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
            + row_backgrounds
            + totals_styles
        )
    )
    story.append(tbl)

    doc.build(story)

    buffer.seek(0)
    response = HttpResponse(buffer.read(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
    return response


def format_decimal(value: Any) -> str:
    """Format a Decimal or numeric value as a Brazilian Real string."""
    try:
        return (
            f"R$ {Decimal(str(value)):,.2f}".replace(",", "X")
            .replace(".", ",")
            .replace("X", ".")
        )
    except Exception:
        return str(value)
