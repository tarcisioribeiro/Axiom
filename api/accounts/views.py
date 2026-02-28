from accounts.models import Account
from accounts.serializers import AccountSerializer
from app.base_views import BaseListCreateView, BaseRetrieveUpdateDestroyView


class AccountCreateListView(BaseListCreateView):
    """
    ViewSet para listar e criar contas bancárias.

    Permite:
    - GET: Lista todas as contas ordenadas por nome (exclui deletadas)
    - POST: Cria uma nova conta

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de contas não deletadas
    serializer_class : class
        Serializer usado para validação e serialização
    ordering : list
        Ordenação padrão por nome
    """

    serializer_class = AccountSerializer
    ordering = ["name"]  # Consistent ordering

    def get_queryset(self):
        # Usa defer() para excluir campo criptografado na listagem (performance)
        return Account.objects.filter(is_deleted=False).defer("_account_number")


class AccountRetrieveUpdateDestroyView(BaseRetrieveUpdateDestroyView):
    """
    ViewSet para operações individuais em contas bancárias.

    Permite:
    - GET: Recupera uma conta específica (exclui deletadas)
    - PUT/PATCH: Atualiza uma conta existente
    - DELETE: Remove uma conta (soft delete)

    Attributes
    ----------
    queryset : QuerySet
        QuerySet de contas não deletadas
    serializer_class : class
        Serializer usado para validação e serialização
    """

    queryset = Account.objects.filter(is_deleted=False)
    serializer_class = AccountSerializer
