from rest_framework.pagination import PageNumberPagination


class SmallResultsSetPagination(PageNumberPagination):
    """5-per-page pagination for expenses/revenues listings.

    Global default (`PAGE_SIZE=50`) stays unchanged for every other endpoint.
    """

    page_size = 5
