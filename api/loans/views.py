from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from loans.models import Loan
from loans.serializers import LoanSerializer


class LoanCreateListView(BaseListCreateView):
    """
    ViewSet para listar e criar empréstimos.

    Permite:
    - GET: Lista todos os empréstimos (exclui deletados)
    - POST: Cria um novo empréstimo

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de empréstimos não deletados
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Loan.objects.filter(is_deleted=False)
    serializer_class = LoanSerializer


class LoanRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em empréstimos.

    Permite:
    - GET: Recupera um empréstimo específico (exclui deletados)
    - PUT/PATCH: Atualiza um empréstimo existente
    - DELETE: Remove um empréstimo (soft delete)

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de empréstimos não deletados
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Loan.objects.filter(is_deleted=False)
    serializer_class = LoanSerializer
