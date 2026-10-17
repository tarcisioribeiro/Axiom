from django.db import models

from app.models import BaseModel


class ReviewProgress(BaseModel):
    """Último dia cuja revisão o usuário concluiu."""

    owner = models.OneToOneField(
        "members.Member",
        on_delete=models.CASCADE,
        related_name="review_progress",
        verbose_name="Dono",
    )
    last_reviewed_date = models.DateField(verbose_name="Último dia revisado")

    class Meta:
        verbose_name = "Progresso da revisão diária"
        verbose_name_plural = "Progressos da revisão diária"

    def __str__(self) -> str:
        return f"{self.owner} — {self.last_reviewed_date}"


class ReviewResolution(BaseModel):
    """
    Justificativa dada a um item pendente da revisão. Com ela o item não volta
    mais (etapas por dia) ou some até o fim da janela (etapas contínuas).
    """

    ACTION_CHOICES = (
        ("skip", "Pular"),
        ("keep_pending", "Manter pendente"),
    )

    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.CASCADE,
        related_name="review_resolutions",
        verbose_name="Dono",
    )
    step = models.CharField(max_length=32, verbose_name="Etapa")
    reference_date = models.DateField(verbose_name="Data de referência")
    item_key = models.CharField(
        max_length=64, blank=True, default="", verbose_name="Item"
    )
    action = models.CharField(
        max_length=16, choices=ACTION_CHOICES, verbose_name="Ação"
    )
    justification = models.CharField(
        max_length=32, verbose_name="Justificativa"
    )

    class Meta:
        verbose_name = "Justificativa da revisão diária"
        verbose_name_plural = "Justificativas da revisão diária"
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "step", "reference_date", "item_key"],
                name="unique_review_resolution",
            )
        ]

    def __str__(self) -> str:
        return f"{self.step} {self.reference_date} {self.justification}"
