from django.db.models import Q

from django_filters import rest_framework as filters

from expenses.models import EXPENSES_CATEGORIES, Expense


class ExpenseFilter(filters.FilterSet):
    """Advanced filtering for expenses"""

    # Date range filters
    date_from = filters.DateFilter(
        field_name="date",
        lookup_expr="gte",
        help_text="Filter expenses from this date (YYYY-MM-DD)",
    )
    date_to = filters.DateFilter(
        field_name="date",
        lookup_expr="lte",
        help_text="Filter expenses until this date (YYYY-MM-DD)",
    )

    # Value range filters
    min_value = filters.NumberFilter(
        field_name="value",
        lookup_expr="gte",
        help_text=(
            "Filter expenses with value greater than or "
            "equal to this amount"
        ),
    )
    max_value = filters.NumberFilter(
        field_name="value",
        lookup_expr="lte",
        help_text=(
            "Filter expenses with value less than or " "equal to this amount"
        ),
    )

    # Category filter
    category = filters.ChoiceFilter(
        choices=EXPENSES_CATEGORIES, help_text="Filter by expense category"
    )

    # Account filter
    account = filters.NumberFilter(
        field_name="account__id", help_text="Filter by account ID"
    )
    accounts = filters.BaseInFilter(
        field_name="account__id",
        lookup_expr="in",
        help_text="Filter by multiple account IDs (comma-separated: 1,2,3)",
    )
    account_name = filters.ChoiceFilter(
        field_name="account__name",
        choices=[],  # Will be populated in __init__
        help_text="Filter by account name",
    )

    # Payment status
    payed = filters.BooleanFilter(
        help_text="Filter by payment status (true/false)"
    )

    # Search in description
    search = filters.CharFilter(
        method="filter_search", help_text="Search in expense description"
    )

    # Year and month filters
    year = filters.NumberFilter(
        field_name="date__year", help_text="Filter by year (YYYY)"
    )
    month = filters.NumberFilter(
        field_name="date__month", help_text="Filter by month (1-12)"
    )

    class Meta:
        model = Expense
        fields = {
            "value": ["exact", "gte", "lte"],
            "date": ["exact", "gte", "lte"],
            "category": ["exact"],
            "payed": ["exact"],
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Dynamically populate account name choices
        from accounts.models import ACCOUNT_NAMES

        self.filters["account_name"].extra["choices"] = ACCOUNT_NAMES

    def filter_search(self, queryset, name, value):
        """Custom search filter for description"""
        if value:
            return queryset.filter(Q(description__icontains=value))
        return queryset
