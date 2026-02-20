from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView
from revenues.models import Revenue
from revenues.serializers import RevenueSerializer


class RevenueCreateListView(BaseListCreateView):
    """
    ViewSet para listar e criar receitas.

    Permite:
    - GET: Lista todas as receitas ordenadas por data decrescente
    - POST: Cria uma nova receita

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de todas as receitas (exclui deletadas) com relação
        account pré-carregada
    serializer_class : class
        Serializer usado para validação e serialização
    ordering : list
        Ordenação padrão por data e ID decrescente
    """

    queryset = Revenue.objects.filter(is_deleted=False).select_related("account")
    serializer_class = RevenueSerializer
    ordering = ["-date", "-id"]  # Consistent ordering for pagination


class RevenueRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em receitas.

    Permite:
    - GET: Recupera uma receita específica
    - PUT/PATCH: Atualiza uma receita existente
    - DELETE: Remove uma receita

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de todas as receitas (exclui deletadas) com relação
        account pré-carregada
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Revenue.objects.filter(is_deleted=False).select_related("account")
    serializer_class = RevenueSerializer
