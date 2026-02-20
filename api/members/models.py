from django.contrib.auth.models import User
from django.db import models

from app.models import BaseModel

SEX_OPTION = (("M", "Masculino"), ("F", "Feminino"))


class Member(BaseModel):
    name = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Nome"
    )
    document = models.CharField(
        max_length=200, blank=False, null=False, verbose_name="Documento", unique=True
    )
    phone = models.CharField(
        max_length=200, blank=False, null=False, verbose_name="Telefone"
    )
    email = models.CharField(
        max_length=200, blank=True, null=True, verbose_name="Email"
    )
    sex = models.CharField(max_length=200, choices=SEX_OPTION, verbose_name="Sexo")
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="Usuário do Sistema",
        help_text="Vincular membro a um usuário do sistema para permitir login",
    )
    is_creditor = models.BooleanField(
        verbose_name="Credor", null=False, blank=False, default=True
    )
    is_benefited = models.BooleanField(
        verbose_name="Beneficiário", null=False, blank=False, default=True
    )
    active = models.BooleanField(
        verbose_name="Ativo", null=False, blank=False, default=True
    )
    birth_date = models.DateField(
        verbose_name="Data de Nascimento", null=True, blank=True
    )
    address = models.TextField(verbose_name="Endereço", null=True, blank=True)
    profile_photo = models.ImageField(
        upload_to="members/photos/",
        verbose_name="Foto de Perfil",
        null=True,
        blank=True,
    )
    emergency_contact = models.CharField(
        max_length=200, verbose_name="Contato de Emergência", null=True, blank=True
    )
    monthly_income = models.DecimalField(
        verbose_name="Renda Mensal",
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    occupation = models.CharField(
        max_length=200, verbose_name="Profissão", null=True, blank=True
    )
    notes = models.TextField(verbose_name="Observações", null=True, blank=True)

    class Meta:
        verbose_name = "Membro"
        verbose_name_plural = "Membros"

    @property
    def is_user(self):
        """
        Retorna True se o membro está vinculado a um usuário do sistema.

        Returns
        -------
        bool
            True se o membro tem um usuário associado, False caso contrário.
        """
        return self.user is not None

    @property
    def age(self):
        """
        Calcula a idade baseada na data de nascimento.

        Returns
        -------
        int or None
            Idade em anos ou None se a data de nascimento não estiver definida.
        """
        if self.birth_date:
            from datetime import date

            today = date.today()
            return (
                today.year
                - self.birth_date.year
                - (
                    (today.month, today.day)
                    < (self.birth_date.month, self.birth_date.day)
                )
            )
        return None

    def __str__(self):
        return self.name
