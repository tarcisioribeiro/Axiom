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

    queryset = Account.objects.filter(is_deleted=False)  # GlobalDefaultPermission
    serializer_class = AccountSerializer
    ordering = ["name"]

    def get_queryset(self):
        # Usa defer() para excluir campo criptografado na listagem (performance)
        return Account.objects.filter(
            is_deleted=False, created_by=self.request.user
        ).defer("_account_number")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)


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

    queryset = Account.objects.filter(is_deleted=False)  # GlobalDefaultPermission
    serializer_class = AccountSerializer

    def get_queryset(self):
        return Account.objects.filter(is_deleted=False, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
