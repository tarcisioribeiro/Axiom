from django.db.models import Q

from django_filters import rest_framework as filters

from revenues.models import REVENUES_CATEGORIES, Revenue


class RevenueFilter(filters.FilterSet):
    """Advanced filtering for revenues"""

    # Date range filters
    date_from = filters.DateFilter(
        field_name="date",
        lookup_expr="gte",
        help_text="Filter revenues from this date (YYYY-MM-DD)",
    )
    date_to = filters.DateFilter(
        field_name="date",
        lookup_expr="lte",
        help_text="Filter revenues until this date (YYYY-MM-DD)",
    )

    # Value range filters
    min_value = filters.NumberFilter(
        field_name="value",
        lookup_expr="gte",
        help_text=(
            "Filter revenues with value greater than or equal to this amount"
        ),
    )
    max_value = filters.NumberFilter(
        field_name="value",
        lookup_expr="lte",
        help_text=(
            "Filter revenues with value less than or equal to this amount"
        ),
    )

    # Category filter
    category = filters.ChoiceFilter(
        choices=REVENUES_CATEGORIES, help_text="Filter by revenue category"
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

    # Receipt status
    received = filters.BooleanFilter(
        help_text="Filter by received status (true/false)"
    )

    # Search in description
    search = filters.CharFilter(
        method="filter_search", help_text="Search in revenue description"
    )

    # Year and month filters
    year = filters.NumberFilter(
        field_name="date__year", help_text="Filter by year (YYYY)"
    )
    month = filters.NumberFilter(
        field_name="date__month", help_text="Filter by month (1-12)"
    )

    class Meta:
        model = Revenue
        fields = {
            "value": ["exact", "gte", "lte"],
            "date": ["exact", "gte", "lte"],
            "category": ["exact"],
            "received": ["exact"],
        }

    def filter_search(self, queryset, name, value):
        """Custom search filter for description"""
        if value:
            return queryset.filter(Q(description__icontains=value))
        return queryset
