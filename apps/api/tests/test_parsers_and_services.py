"""Tests for statement parsers, category suggestion and FX conversion."""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase

from bank_reconciliation.parsers import (
    _parse_amount,
    parse_cnab240,
    parse_cnab400,
    parse_csv,
    parse_ofx,
    parse_statement,
)
from exchange_rates.models import ExchangeRate
from expenses import categorization_service as cs


def _fixed(width: int, fields: dict[int, str]) -> str:
    """Build a fixed-width line placing each value at its 0-based offset."""
    line = [" "] * width
    for pos, val in fields.items():
        line[pos : pos + len(val)] = list(val)
    return "".join(line)


class ParseAmountTest(SimpleTestCase):
    def test_locale_formats(self) -> None:
        self.assertEqual(_parse_amount("1.234,56"), Decimal("1234.56"))
        self.assertEqual(_parse_amount("1,234.56"), Decimal("1234.56"))
        self.assertEqual(_parse_amount("-150,00"), Decimal("-150.00"))
        self.assertEqual(_parse_amount(" 42 "), Decimal("42"))
        with self.assertRaises(ValueError):
            _parse_amount("  ")


class OfxParserTest(SimpleTestCase):
    OFX = """
<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261001120000<TRNAMT>-50.25<FITID>A1<MEMO>Padaria</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261002<TRNAMT>1000,00<FITID>A2<NAME>Salario</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>bad<TRNAMT>1<FITID>A3</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261003<TRNAMT>abc<FITID>A4</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<FITID>A5</STMTTRN>
</BANKTRANLIST></OFX>"""

    def test_parses_valid_blocks_and_skips_broken_ones(self) -> None:
        txs = parse_ofx(self.OFX)
        self.assertEqual(len(txs), 2)
        self.assertEqual(txs[0]["date"], date(2026, 10, 1))
        self.assertEqual(txs[0]["amount"], Decimal("-50.25"))
        self.assertEqual(txs[0]["type"], "debit")
        self.assertEqual(txs[0]["description"], "Padaria")
        self.assertEqual(txs[1]["type"], "credit")
        self.assertEqual(txs[1]["description"], "Salario")


class CsvParserTest(SimpleTestCase):
    def test_semicolon_with_header_detection(self) -> None:
        content = (
            "Data;Histórico;Valor\n"
            "01/10/2026;Mercado;-1.234,56\n"
            "2026-10-02;Pix recebido;300,00\n"
            "xx;Linha ruim;10\n"
            "03/10/2026;Valor ruim;abc\n"
            "curta\n"
        )
        txs = parse_csv(content)
        self.assertEqual(len(txs), 2)
        self.assertEqual(txs[0]["amount"], Decimal("-1234.56"))
        self.assertEqual(txs[0]["type"], "debit")
        self.assertEqual(txs[0]["description"], "Mercado")
        self.assertEqual(txs[1]["date"], date(2026, 10, 2))

    def test_comma_separator_and_positional_fallback(self) -> None:
        txs = parse_csv("a,b,c\n05-10-2026,12.50,Uber\n")
        self.assertEqual(txs[0]["amount"], Decimal("12.50"))
        self.assertEqual(txs[0]["description"], "Uber")

    def test_empty(self) -> None:
        self.assertEqual(parse_csv(""), [])


class CnabParserTest(SimpleTestCase):
    def test_cnab240_detail_segment(self) -> None:
        detail = _fixed(
            240,
            {
                7: "3",
                13: "E",
                15: "D",
                73: "01102026",
                119: "0000000012345",
                133: "TARIFA",
            },
        )
        header = _fixed(240, {7: "0"})
        zero_value = _fixed(
            240, {7: "3", 13: "E", 73: "01102026", 119: "0" * 13}
        )
        txs = parse_cnab240("\n".join([header, detail, zero_value, "short"]))
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0]["amount"], Decimal("123.45"))
        self.assertEqual(txs[0]["type"], "debit")
        self.assertEqual(txs[0]["description"], "TARIFA")
        self.assertEqual(txs[0]["date"], date(2026, 10, 1))

    def test_cnab400_detail_record(self) -> None:
        detail = _fixed(
            400,
            {
                0: "1",
                62: "NOSSO123",
                110: "011026",
                141: "C",
                152: "0000000050000",
            },
        )
        txs = parse_cnab400("\n".join([_fixed(400, {0: "0"}), detail]))
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0]["amount"], Decimal("500.00"))
        self.assertEqual(txs[0]["type"], "credit")
        self.assertEqual(txs[0]["transaction_id"], "NOSSO123")


class ParseStatementTest(SimpleTestCase):
    def test_dispatch_and_errors(self) -> None:
        txs = parse_statement(
            b"data;valor;descricao\n01/10/2026;10,00;X\n", "csv"
        )
        self.assertEqual(len(txs), 1)
        with self.assertRaisesMessage(ValueError, "Formato não suportado"):
            parse_statement(b"", "pdf")
        with self.assertRaisesMessage(ValueError, "Nenhuma transação"):
            parse_statement(b"<OFX></OFX>", "ofx")


class CategorizationServiceTest(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user("cat_user", password="x")

    def test_prompt_includes_only_given_info(self) -> None:
        p = cs._build_classification_prompt("Almoço", "", Decimal("30"))
        self.assertIn("Descrição: Almoço", p)
        self.assertIn("Valor: R$ 30", p)
        self.assertNotIn("Estabelecimento", p)
        self.assertIn(
            "Sem informação", cs._build_classification_prompt("", "")
        )

    def test_no_rules_or_merchant_returns_none(self) -> None:
        self.assertIsNone(cs.apply_heuristic_rules(self.user, ""))
        self.assertIsNone(cs.apply_heuristic_rules(self.user, "Loja"))

    @patch("agents.core.llm_client.LLMClient.complete")
    def test_llm_exact_partial_invalid_and_failure(self, complete) -> None:
        complete.return_value = " 'Transport'.\n"
        self.assertEqual(cs._llm_classify("Uber", ""), "transport")
        complete.return_value = "categoria: supermarket"
        self.assertEqual(cs._llm_classify("Mercado", ""), "supermarket")
        complete.return_value = "zzz"
        self.assertIsNone(cs._llm_classify("?", ""))
        complete.side_effect = RuntimeError("down")
        self.assertIsNone(cs._llm_classify("?", ""))

    @patch.object(cs, "_llm_classify")
    def test_suggest_category_paths(self, llm) -> None:
        llm.return_value = "pets"
        self.assertEqual(
            cs.suggest_category(self.user, "Ração", "PetShop"),
            {"category": "pets", "method": "llm"},
        )
        llm.return_value = "others"
        self.assertEqual(
            cs.suggest_category(self.user, "x", "")["method"], "none"
        )
        llm.reset_mock()
        self.assertEqual(
            cs.suggest_category(self.user, "", "")["method"], "none"
        )
        llm.assert_not_called()

    @patch.object(cs, "apply_heuristic_rules", return_value="house")
    def test_rule_wins_over_llm(self, _rules) -> None:
        self.assertEqual(
            cs.suggest_category(self.user, "Aluguel", "Imob"),
            {"category": "house", "method": "rule"},
        )


class ExchangeRateConvertTest(TestCase):
    def setUp(self) -> None:
        for cur, buy, sell in (
            ("USD", "5.00", "5.20"),
            ("EUR", "6.00", "6.00"),
        ):
            ExchangeRate.objects.create(
                currency_from=cur,
                rate_buy=Decimal(buy),
                rate_sell=Decimal(sell),
                reference_date=date(2026, 10, 1),
                source="test",
            )

    def test_conversions(self) -> None:
        conv = ExchangeRate.convert
        self.assertEqual(conv(Decimal("10"), "BRL", "BRL"), Decimal("10"))
        self.assertEqual(conv(Decimal("10"), "USD"), Decimal("51.00"))
        self.assertEqual(
            conv(Decimal("51"), "BRL", "USD"), Decimal("10.00000000")
        )
        self.assertEqual(
            conv(Decimal("6"), "EUR", "USD"), Decimal("7.05882353")
        )
        self.assertIsNone(conv(Decimal("1"), "GBP"))
        self.assertIsNone(conv(Decimal("1"), "BRL", "GBP"))
        self.assertIsNone(conv(Decimal("1"), "GBP", "USD"))
        self.assertIn("USD/BRL", str(ExchangeRate.latest_rate("usd")))
