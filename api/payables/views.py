from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from payables.models import Payable
from payables.serializers import PayableSerializer


class PayableCreateListView(BaseListCreateView):
    """
    ViewSet para listar e criar Payables (valores a pagar).

    Permite:
    - GET: Lista todos os payables (exclui deletados)
    - POST: Cria um novo payable

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de payables não deletados
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Payable.objects.filter(is_deleted=False)
    serializer_class = PayableSerializer


class PayableRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em Payables.

    Permite:
    - GET: Recupera um payable específico (exclui deletados)
    - PUT/PATCH: Atualiza um payable existente
    - DELETE: Remove um payable (soft delete)

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de payables não deletados
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Payable.objects.filter(is_deleted=False)
    serializer_class = PayableSerializer
