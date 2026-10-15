from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """Global default: 50 per page, overridable via `?page_size=` (max 500).

    Telas que filtram/paginam no cliente pedem um `page_size` maior; sem o
    `page_size_query_param` o DRF ignorava o parâmetro e cortava em 50.
    """

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500


class SmallResultsSetPagination(PageNumberPagination):
    """5-per-page pagination for expenses/revenues listings.

    Global default (`PAGE_SIZE=50`) stays unchanged for every other endpoint.
    """

    page_size = 5
