"""
Tests for `DebtPayoffPlanView` (`dashboard/views.py`).

Covers the real-cash-flow-driven debt payoff planner: surplus
projection (fixed revenues/expenses, credit card bills, receivables),
the double-counting guard between projected expenses and the debts
being planned, the snowball/avalanche simulation gated by an actual
running cash position, infeasible-date recalculation, and urgency
tiering.
"""

from datetime import date, time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from rest_framework import status

from expenses.models import Expense
from loans.models import Loan
from members.models import Member
from payables.models import Payable
from receivables.models import Receivable
from revenues.models import FixedRevenue, Revenue
from tests.test_dashboard_coverage import _DashboardCoverageBaseTestCase


class DebtPayoffPlanViewTest(_DashboardCoverageBaseTestCase):
    def _make_loan(
        self,
        value=Decimal("1200.00"),
        payed_value=Decimal("0.00"),
        installments=12,
        interest_rate=None,
        due_date=None,
        description="Test Loan",
        status_="active",
        date_=None,
        loan_type="borrowed",
        creditor=None,
    ):
        return Loan.objects.create(
            description=description,
            value=value,
            payed_value=payed_value,
            date=date_ or date.today(),
            horary=time(9, 0),
            category="others",
            account=self.account,
            benefited=self.member,
            creditor=creditor or self.member,
            interest_rate=interest_rate,
            installments=installments,
            due_date=due_date,
            status=status_,
            loan_type=loan_type,
            created_by=self.user,
        )

    def _make_payable(
        self,
        value=Decimal("300.00"),
        paid_value=Decimal("0.00"),
        due_date=None,
        description="Test Payable",
        status_="active",
    ):
        return Payable.objects.create(
            description=description,
            value=value,
            paid_value=paid_value,
            date=date.today(),
            due_date=due_date,
            category="health and care",
            status=status_,
            member=self.member,
            created_by=self.user,
        )

    def test_empty_state_returns_no_debts(self):
        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["snowball"]["debts"], [])
        self.assertEqual(response.data["avalanche"]["debts"], [])
        self.assertEqual(response.data["surplus_projection"], [])
        self.assertEqual(response.data["current_total_balance"], 10000.0)
        self.assertEqual(response.data["surplus_at_due_dates"], 10000.0)
        self.assertIsNone(response.data["surplus_at_due_dates_month"])

    def test_surplus_at_due_dates_ignores_recalculation_buffer(self):
        """
        The headline surplus figure must reflect the cumulative surplus
        up to the furthest DUE DATE among current debts, not the
        padded internal horizon used to search for a feasible
        recalculated date (which spans many extra months of income
        that have nothing to do with "sobra ate o vencimento").
        """
        due_date = date.today() + timedelta(days=60)
        self._make_loan(
            value=Decimal("100.00"),
            installments=1,
            due_date=due_date,
        )
        FixedRevenue.objects.create(
            description="Monthly income",
            default_value=Decimal("5000.00"),
            category="salary",
            account=self.account,
            due_day=1,
            is_active=True,
            created_by=self.user,
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)

        due_month = response.data["surplus_at_due_dates_month"]
        self.assertEqual(
            (due_month["year"], due_month["month"]),
            (
                due_date.year,
                due_date.month,
            ),
        )

        buffered_last_month_surplus = response.data["surplus_projection"][-1][
            "cumulative_surplus"
        ]
        # The buffered horizon extends ~24 months past the due date and
        # keeps accumulating the same recurring income - its final
        # cumulative surplus must be strictly larger than the
        # due-date-scoped figure actually surfaced to the user.
        self.assertGreater(
            buffered_last_month_surplus, response.data["surplus_at_due_dates"]
        )

    def test_loan_balance_and_minimum_payment(self):
        self._make_loan(
            value=Decimal("1200.00"),
            payed_value=Decimal("200.00"),
            installments=10,
            interest_rate=Decimal("12.00"),
            due_date=date.today() + timedelta(days=200),
        )
        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        debts = response.data["snowball"]["debts"]
        self.assertEqual(len(debts), 1)
        loan_debt = debts[0]
        self.assertEqual(loan_debt["type"], "loan")
        self.assertEqual(loan_debt["balance"], 1000.0)
        self.assertEqual(loan_debt["interest_rate"], 12.0)
        self.assertEqual(loan_debt["minimum_payment"], 100.0)

    def test_payable_minimum_payment_is_full_remaining_value(self):
        self._make_payable(
            value=Decimal("900.00"),
            paid_value=Decimal("100.00"),
            due_date=date.today() + timedelta(days=30),
        )
        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        debts = response.data["snowball"]["debts"]
        self.assertEqual(len(debts), 1)
        payable_debt = debts[0]
        self.assertEqual(payable_debt["type"], "payable")
        self.assertEqual(payable_debt["balance"], 800.0)
        # Payable has no installment concept - minimum payment is the
        # full remaining balance, not divided by anything.
        self.assertEqual(payable_debt["minimum_payment"], 800.0)

    def test_credit_card_bill_excluded_from_debts_but_reduces_surplus(self):
        """
        Confirms the scope decision: credit card bills never enter the
        debt-payoff list (paid in full every cycle), but their full
        remaining value still reduces the projected surplus in the
        month they're due.
        """
        self._make_loan(due_date=date.today() + timedelta(days=100))

        card = self._make_credit_card(due_day=10)
        due_date = date.today() + timedelta(days=15)
        self._make_bill(
            card,
            due_date=due_date,
            total_amount=Decimal("500.00"),
            paid_amount=Decimal("100.00"),
            status_="open",
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        debt_types = {d["type"] for d in response.data["snowball"]["debts"]}
        self.assertNotIn("bill", debt_types)
        self.assertEqual(debt_types, {"loan"})

        month_entry = next(
            m
            for m in response.data["surplus_projection"]
            if m["year"] == due_date.year and m["month"] == due_date.month
        )
        self.assertEqual(month_entry["credit_card_bills"], 400.0)

    def test_double_counting_guard_excludes_debt_linked_expense(self):
        """
        An unpaid Expense already linked to a payable that's part of
        the debt list must NOT also be subtracted as a generic fixed
        expense - that money is already accounted for inside the
        payoff simulation itself.
        """
        payable = self._make_payable(
            value=Decimal("500.00"),
            due_date=date.today() + timedelta(days=20),
        )
        linked_expense_date = date.today() + timedelta(days=5)
        Expense.objects.create(
            description="Payable installment expense",
            value=Decimal("500.00"),
            date=linked_expense_date,
            horary=time(10, 0),
            category="health and care",
            account=self.account,
            payed=False,
            related_payable=payable,
            created_by=self.user,
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        month_entry = next(
            m
            for m in response.data["surplus_projection"]
            if m["year"] == linked_expense_date.year
            and m["month"] == linked_expense_date.month
        )
        self.assertEqual(month_entry["fixed_expenses"], 0.0)

    def test_unrelated_expense_still_counted(self):
        """Sanity check for the guard above: an Expense with no debt
        linkage IS subtracted as a normal fixed expense."""
        unrelated_date = date.today() + timedelta(days=5)
        Expense.objects.create(
            description="Rent",
            value=Decimal("250.00"),
            date=unrelated_date,
            horary=time(10, 0),
            category="house",
            account=self.account,
            payed=False,
            created_by=self.user,
        )
        self._make_loan(due_date=date.today() + timedelta(days=100))

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        month_entry = next(
            m
            for m in response.data["surplus_projection"]
            if m["year"] == unrelated_date.year
            and m["month"] == unrelated_date.month
        )
        self.assertEqual(month_entry["fixed_expenses"], 250.0)

    def test_debt_linked_fixed_expense_still_excluded_from_surplus_projection(
        self,
    ):
        """
        Regression guard for the debt payment plan feature: once a
        Payable has a payment plan, its parcel is represented by a
        FixedExpense (related_payable set) that flows through the normal
        monthly-agenda generation pipeline
        (expenses.services.bulk_generate_fixed_expenses). The resulting
        Expense also carries related_payable (copied from the template) -
        the pre-existing double-counting guard tested above must still
        exclude it from the generic fixed-expenses surplus projection.
        """
        from expenses.models import FixedExpense
        from expenses.services import bulk_generate_fixed_expenses
        from payables.signals import generate_payable_installments

        payable = self._make_payable(
            value=Decimal("300.00"),
            due_date=date.today() + timedelta(days=20),
        )
        generate_payable_installments(payable, 3, self.user, self.account)
        payable.refresh_from_db()
        fixed_expense = FixedExpense.objects.get(related_payable=payable)

        today = date.today()
        month = f"{today.year}-{today.month:02d}"
        result = bulk_generate_fixed_expenses(
            month,
            [
                {
                    "fixed_expense_id": fixed_expense.id,
                    "value": float(fixed_expense.default_value),
                }
            ],
            self.user,
        )
        expense = result["expenses"][0]
        self.assertEqual(expense.related_payable_id, payable.id)

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        month_entry = next(
            m
            for m in response.data["surplus_projection"]
            if m["year"] == expense.date.year
            and m["month"] == expense.date.month
        )
        self.assertEqual(month_entry["fixed_expenses"], 0.0)

    def test_debt_entries_expose_installment_progress_fields(self):
        """Each debt entry surfaces installments_total/installments_paid/
        payment_plan_exists so the frontend can show 'parcela N/M'."""
        from payables.signals import generate_payable_installments

        payable = self._make_payable(value=Decimal("300.00"))
        generate_payable_installments(payable, 3, self.user, self.account)

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        debt = next(
            d
            for d in response.data["snowball"]["debts"]
            if d["type"] == "payable"
        )
        self.assertEqual(debt["installments_total"], 3)
        self.assertEqual(debt["installments_paid"], 0)
        self.assertTrue(debt["payment_plan_exists"])

    def test_fixed_revenue_projection_helper(self):
        """
        Mirrors CashFlowForecastViewTest.
        test_fixed_expenses_and_credit_card_bills_projection, but for
        the new `_add_ungenerated_fixed_revenues` helper mirroring
        FixedRevenue instead of FixedExpense.
        """
        frozen_today = date(2026, 11, 15)

        class _FrozenDate(date):
            @classmethod
            def today(cls):
                return frozen_today

        self._make_loan(due_date=date(2027, 3, 1))

        fr_skipped_by_last_generated = FixedRevenue.objects.create(
            description="Salary (already generated this month)",
            default_value=Decimal("3000.00"),
            category="salary",
            account=self.account,
            due_day=20,
            is_active=True,
            last_generated_month="2026-11",
            created_by=self.user,
        )
        fr_skipped_by_existing = FixedRevenue.objects.create(
            description="Side income (existing launched revenue)",
            default_value=Decimal("400.00"),
            category="income",
            account=self.account,
            due_day=10,
            is_active=True,
            created_by=self.user,
        )
        Revenue.objects.create(
            description="Side income Dec",
            value=Decimal("400.00"),
            date=date(2026, 12, 10),
            horary=time(10, 0),
            category="income",
            account=self.account,
            received=False,
            fixed_revenue_template=fr_skipped_by_existing,
            created_by=self.user,
        )
        fr_generates_normally = FixedRevenue.objects.create(
            description="Freelance",
            default_value=Decimal("600.00"),
            category="income",
            account=self.account,
            due_day=31,  # forces clamp to last day of shorter months
            is_active=True,
            created_by=self.user,
        )

        with patch("dashboard.views.date", _FrozenDate):
            url = reverse("debt-payoff-plan")
            response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        november_entry = next(
            m
            for m in response.data["surplus_projection"]
            if m["year"] == 2026 and m["month"] == 11
        )
        # "Freelance" generates normally in November (clamped to day 30);
        # "Salary" is skipped (last_generated_month), "Side income" is
        # skipped in November (its already-generated occurrence is in
        # December).
        self.assertEqual(november_entry["revenues"], 600.0)

        december_entry = next(
            m
            for m in response.data["surplus_projection"]
            if m["year"] == 2026 and m["month"] == 12
        )
        # December: "Freelance" (600, generated normally) + the already
        # materialized "Side income" Revenue (400) + "Salary" (3000,
        # generated normally - `last_generated_month="2026-11"` only
        # blocks months up to and including November, not December).
        self.assertEqual(december_entry["revenues"], 4000.0)
        self.assertIsInstance(fr_generates_normally.due_day, int)
        self.assertIsInstance(fr_skipped_by_last_generated.pk, int)

    def test_receivable_increases_surplus_in_due_month(self):
        self._make_loan(due_date=date.today() + timedelta(days=100))
        due_date = date.today() + timedelta(days=10)
        Receivable.objects.create(
            description="Service rendered",
            value=Decimal("700.00"),
            received_value=Decimal("200.00"),
            date=date.today(),
            due_date=due_date,
            category="income",
            status="active",
            member=self.member,
            created_by=self.user,
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        month_entry = next(
            m
            for m in response.data["surplus_projection"]
            if m["year"] == due_date.year and m["month"] == due_date.month
        )
        self.assertEqual(month_entry["receivables"], 500.0)

    def test_infeasible_target_date_is_recalculated(self):
        """
        With a small account balance, no other income, and only a
        modest recurring `extra_monthly`, a debt due very soon cannot
        realistically be paid off in time - the simulation should
        still find a feasible (later) payoff date once enough months
        of `extra_monthly` accumulate, and flag the original target
        as not achievable.
        """
        self.account.current_balance = Decimal("100.00")
        self.account.save()

        self._make_payable(
            value=Decimal("1300.00"),
            due_date=date.today() + timedelta(days=5),
            description="Big unaffordable payable",
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url, {"extra_monthly": "300"})
        debt = response.data["snowball"]["debts"][0]
        self.assertTrue(debt["date_recalculated"])
        self.assertIsNotNone(debt["feasible_date"])
        self.assertIsNotNone(debt["payoff_date"])
        self.assertGreater(debt["feasible_date"], debt["original_target_date"])

    def test_feasible_target_date_is_not_recalculated(self):
        self._make_payable(
            value=Decimal("50.00"),
            due_date=date.today() + timedelta(days=200),
            description="Small affordable payable",
        )
        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        debt = response.data["snowball"]["debts"][0]
        self.assertFalse(debt["date_recalculated"])
        self.assertIsNone(debt["feasible_date"])

    def test_urgency_tiers(self):
        cases = [
            ("Overdue", -5, "overdue"),
            ("Critical", 3, "critical"),
            ("High", 20, "high"),
            ("Medium", 60, "medium"),
            ("Low", 200, "low"),
        ]
        for description, offset, _expected_tier in cases:
            self._make_payable(
                value=Decimal("10.00"),
                due_date=date.today() + timedelta(days=offset),
                description=description,
            )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        by_name = {
            d["name"]: d["urgency"] for d in response.data["snowball"]["debts"]
        }
        for description, _offset, expected_tier in cases:
            self.assertEqual(by_name[description], expected_tier)

    def test_no_due_date_is_low_urgency(self):
        self._make_payable(value=Decimal("10.00"), due_date=None)
        url = reverse("debt-payoff-plan")
        response = self.client.get(url)
        debt = response.data["snowball"]["debts"][0]
        self.assertEqual(debt["urgency"], "low")

    def test_invalid_strategy_param_does_not_error(self):
        self._make_loan(due_date=date.today() + timedelta(days=100))
        url = reverse("debt-payoff-plan")
        response = self.client.get(url, {"strategy": "bogus"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("snowball", response.data)
        self.assertIn("avalanche", response.data)

    def test_cache_hit_returns_identical_response(self):
        self._make_loan(due_date=date.today() + timedelta(days=100))
        url = reverse("debt-payoff-plan")
        first = self.client.get(url)
        second = self.client.get(url)
        self.assertEqual(first.data, second.data)

    def test_snowball_orders_by_balance_avalanche_by_interest_rate(self):
        # Balance order and interest-rate order deliberately disagree,
        # so this test actually distinguishes the two strategies.
        self._make_loan(
            value=Decimal("5000.00"),
            interest_rate=Decimal("30.00"),
            installments=1,
            due_date=date.today() + timedelta(days=300),
            description="Big high interest",
        )
        self._make_loan(
            value=Decimal("500.00"),
            interest_rate=Decimal("5.00"),
            installments=1,
            due_date=date.today() + timedelta(days=300),
            description="Small low interest",
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)

        snowball_first = min(
            response.data["snowball"]["debts"], key=lambda d: d["priority"]
        )
        avalanche_first = min(
            response.data["avalanche"]["debts"], key=lambda d: d["priority"]
        )
        self.assertEqual(snowball_first["name"], "Small low interest")
        self.assertEqual(avalanche_first["name"], "Big high interest")

    def test_extra_monthly_accelerates_payoff(self):
        # Debt bigger than the account balance and no other income in
        # the fixture: unreachable at extra_monthly=0 (cash position
        # gets stuck once the initial balance is spent), but reachable
        # once a recurring extra is added on top of the real surplus.
        self._make_payable(
            value=Decimal("15000.00"),
            due_date=date.today() + timedelta(days=300),
        )
        url = reverse("debt-payoff-plan")
        cache.clear()
        baseline = self.client.get(url)
        cache.clear()
        boosted = self.client.get(url, {"extra_monthly": "1000"})

        baseline_date = baseline.data["snowball"]["debts"][0]["payoff_date"]
        boosted_date = boosted.data["snowball"]["debts"][0]["payoff_date"]
        self.assertIsNone(baseline_date)
        self.assertIsNotNone(boosted_date)

    def test_loan_without_persisted_loan_type_is_still_collected(self):
        """
        Regression test: loans created without `loan_type` gravado na
        coluna (o valor real do frontend antes da correcao em
        loans-service.ts) devem continuar aparecendo no planejador,
        via a mesma inferencia usada por LoanSerializer.
        """
        creditor = Member.objects.create(
            name="Creditor Institution",
            document_hash=self._unique("hash").ljust(64, "0")[:64],
            phone="11988887777",
            sex="M",
            user=None,
        )
        self._make_loan(
            value=Decimal("1000.00"),
            installments=1,
            description="Aporte Sicoob",
            loan_type=None,
            creditor=creditor,
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)

        names = {d["name"] for d in response.data["snowball"]["debts"]}
        self.assertIn("Aporte Sicoob", names)

    def test_loan_inferred_as_lent_is_not_collected_as_debt(self):
        """
        Quando o proprio usuario e o credor (emprestimo realizado, nao
        tomado), a inferencia deve resolver para "lent" e o registro
        NAO deve aparecer no planejador de divida.
        """
        borrower = Member.objects.create(
            name="Borrower",
            document_hash=self._unique("hash").ljust(64, "0")[:64],
            phone="11977776666",
            sex="F",
            user=None,
        )
        Loan.objects.create(
            description="Loan I gave out",
            value=Decimal("500.00"),
            payed_value=Decimal("0.00"),
            date=date.today(),
            horary=time(9, 0),
            category="others",
            account=self.account,
            benefited=borrower,
            creditor=self.member,
            installments=1,
            status="active",
            loan_type=None,
            created_by=self.user,
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)

        names = {d["name"] for d in response.data["snowball"]["debts"]}
        self.assertNotIn("Loan I gave out", names)

    def test_avalanche_ties_prefer_interest_bearing_debt(self):
        """
        Empate no saldo devedor: a divida com juros deve vir primeiro
        na Avalanche, mesmo com valor identico a uma sem juros.
        """
        self._make_loan(
            value=Decimal("500.00"),
            installments=1,
            interest_rate=None,
            due_date=date.today() + timedelta(days=300),
            description="No interest",
        )
        self._make_loan(
            value=Decimal("500.00"),
            installments=1,
            interest_rate=Decimal("2.00"),
            due_date=date.today() + timedelta(days=300),
            description="Has interest",
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)

        avalanche_first = min(
            response.data["avalanche"]["debts"], key=lambda d: d["priority"]
        )
        self.assertEqual(avalanche_first["name"], "Has interest")

    def test_snowball_and_avalanche_ties_prefer_oldest_record(self):
        """
        Empate total (mesmo saldo, ambas sem juros): o registro mais
        antigo (menor `date`) deve vir primeiro, nas duas estrategias.
        """
        self._make_loan(
            value=Decimal("500.00"),
            installments=1,
            due_date=date.today() + timedelta(days=300),
            description="Newer",
            date_=date.today() - timedelta(days=5),
        )
        self._make_loan(
            value=Decimal("500.00"),
            installments=1,
            due_date=date.today() + timedelta(days=300),
            description="Older",
            date_=date.today() - timedelta(days=50),
        )

        url = reverse("debt-payoff-plan")
        response = self.client.get(url)

        for strategy in ("snowball", "avalanche"):
            first = min(
                response.data[strategy]["debts"], key=lambda d: d["priority"]
            )
            self.assertEqual(first["name"], "Older")

    def test_monthly_payment_reflects_strategy_and_extra(self):
        """
        `monthly_payment` deve refletir o pagamento real simulado no
        primeiro mes (minimo + extra quando prioritaria), nao o valor
        estatico da parcela original - e deve variar entre estrategias
        quando a ordem de prioridade diverge.
        """
        FixedRevenue.objects.create(
            description="Monthly income",
            default_value=Decimal("5000.00"),
            category="salary",
            account=self.account,
            due_day=1,
            is_active=True,
            created_by=self.user,
        )
        # Saldos bem maiores que o caixa disponível no 1o mes (conta +
        # receita fixa ~ R$ 15.000), para que nenhuma das duas seja
        # quitada de uma vez no mes 1 - so assim o extra_monthly
        # tem efeito visivel no monthly_payment daquele mes.
        self._make_loan(
            value=Decimal("200000.00"),
            installments=100,
            interest_rate=Decimal("30.00"),
            due_date=date.today() + timedelta(days=300),
            description="Big high interest",
        )
        self._make_loan(
            value=Decimal("100000.00"),
            installments=100,
            interest_rate=Decimal("5.00"),
            due_date=date.today() + timedelta(days=300),
            description="Small low interest",
        )

        url = reverse("debt-payoff-plan")
        cache.clear()
        no_extra = self.client.get(url)
        cache.clear()
        with_extra = self.client.get(url, {"extra_monthly": "1000"})

        def payment_for(payload, strategy, name):
            entry = next(
                d for d in payload.data[strategy]["debts"] if d["name"] == name
            )
            return entry["monthly_payment"]

        # A dívida prioritária de cada estratégia recebe o extra além
        # do mínimo, então seu monthly_payment cresce quando o extra
        # é informado - o que nunca acontecia antes da correção.
        self.assertGreater(
            payment_for(with_extra, "snowball", "Small low interest"),
            payment_for(no_extra, "snowball", "Small low interest"),
        )
        self.assertGreater(
            payment_for(with_extra, "avalanche", "Big high interest"),
            payment_for(no_extra, "avalanche", "Big high interest"),
        )
        # As duas estratégias priorizam dívidas diferentes (menor
        # saldo vs. maior saldo), então o monthly_payment do primeiro
        # mês diverge entre elas para a mesma dívida.
        self.assertNotEqual(
            payment_for(with_extra, "snowball", "Small low interest"),
            payment_for(with_extra, "avalanche", "Small low interest"),
        )
