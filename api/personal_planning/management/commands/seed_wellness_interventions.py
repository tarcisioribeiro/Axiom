"""Popula o catálogo de intervenções de bem-estar emocional."""

from django.core.management.base import BaseCommand

from personal_planning.models import WellnessIntervention

INTERVENTIONS = [
    # Autoestima
    {
        "title": "Registrar 3 conquistas do dia",
        "description": (
            "Escreva três coisas que você fez bem hoje, por menores que"
            " sejam. Podem ser tarefas simples como beber água, responder"
            " uma mensagem ou acordar cedo."
        ),
        "category": "self_esteem",
        "duration_minutes": 5,
        "difficulty": "easy",
        "expected_benefit": (
            "Treina o cérebro a reconhecer progresso e cultivar uma visão"
            " mais positiva de si mesmo."
        ),
    },
    {
        "title": "Escrever 3 qualidades pessoais",
        "description": (
            "Liste três características positivas suas. Reflita sobre como"
            " essas qualidades já te ajudaram em situações concretas."
        ),
        "category": "self_esteem",
        "duration_minutes": 10,
        "difficulty": "easy",
        "expected_benefit": (
            "Fortalece a autoestima ao reconhecer suas próprias virtudes."
        ),
    },
    {
        "title": "Carta de gratidão para si mesmo",
        "description": (
            "Escreva uma carta curta agradecendo a si mesmo por algo que"
            " você superou ou conquistou nos últimos meses."
        ),
        "category": "self_esteem",
        "duration_minutes": 20,
        "difficulty": "medium",
        "expected_benefit": (
            "Desenvolve autocompaixão e reconhecimento do próprio"
            " crescimento."
        ),
    },
    {
        "title": "Relembrar uma situação em que ajudou alguém",
        "description": (
            "Pense em um momento em que você fez a diferença na vida de"
            " alguém. Reviva esse momento com detalhes e observe como se"
            " sente."
        ),
        "category": "self_esteem",
        "duration_minutes": 5,
        "difficulty": "easy",
        "expected_benefit": (
            "Reforça o senso de valor e contribuição pessoal."
        ),
    },
    # Solidão
    {
        "title": "Enviar mensagem para um amigo",
        "description": (
            "Escolha alguém com quem não conversa há um tempo e envie uma"
            " mensagem genuína. Não precisa ser longa — basta um 'Tô"
            " pensando em você, tudo bem?'"
        ),
        "category": "loneliness",
        "duration_minutes": 5,
        "difficulty": "easy",
        "expected_benefit": (
            "Reconecta com a rede de apoio social e reduz o isolamento."
        ),
    },
    {
        "title": "Participar de uma comunidade online",
        "description": (
            "Encontre um fórum, grupo ou comunidade sobre algo que você"
            " gosta e contribua com um comentário ou pergunta genuína."
        ),
        "category": "loneliness",
        "duration_minutes": 20,
        "difficulty": "medium",
        "expected_benefit": (
            "Cria senso de pertencimento sem exigir interação presencial"
            " imediata."
        ),
    },
    {
        "title": "Ligar para alguém próximo",
        "description": (
            "Ligue para um amigo ou familiar. Não precisa de um motivo"
            " especial — só para ouvir a voz de alguém e se sentir"
            " presente na vida dele."
        ),
        "category": "loneliness",
        "duration_minutes": 15,
        "difficulty": "medium",
        "expected_benefit": (
            "Fortalece vínculos reais e reduz a sensação de isolamento."
        ),
    },
    # Carência
    {
        "title": "Escrever sobre o que está faltando",
        "description": (
            "Em um diário, descreva o que você está sentindo falta. Tente"
            " identificar se é afeto, validação, atenção ou algo específico."
            " Seja honesto consigo mesmo."
        ),
        "category": "neediness",
        "duration_minutes": 15,
        "difficulty": "medium",
        "expected_benefit": (
            "Clareza sobre as necessidades emocionais reais, reduzindo"
            " comportamentos impulsivos de busca de validação."
        ),
    },
    {
        "title": "Diferenciar afeto de validação",
        "description": (
            "Reflita: o que você está buscando nas outras pessoas — carinho"
            " genuíno ou aprovação? Anote exemplos recentes onde você buscou"
            " validação."
        ),
        "category": "neediness",
        "duration_minutes": 10,
        "difficulty": "medium",
        "expected_benefit": (
            "Desenvolve autoconhecimento emocional e reduz dependência de"
            " aprovação externa."
        ),
    },
    {
        "title": "Exercício de autocompaixão",
        "description": (
            "Feche os olhos. Coloque a mão no peito. Diga para si mesmo:"
            " 'Estou passando por um momento difícil. Isso é humano. Mereço"
            " cuidado.' Repita três vezes."
        ),
        "category": "neediness",
        "duration_minutes": 5,
        "difficulty": "easy",
        "expected_benefit": (
            "Ativa o sistema de cuidado interno, reduzindo a necessidade de"
            " buscar afeto externo de forma compulsiva."
        ),
    },
    # Ansiedade
    {
        "title": "Respiração 4-7-8",
        "description": (
            "Inspire por 4 segundos. Segure por 7 segundos. Expire"
            " lentamente por 8 segundos. Repita 4 vezes. Faça em posição"
            " confortável."
        ),
        "category": "anxiety",
        "duration_minutes": 5,
        "difficulty": "easy",
        "expected_benefit": (
            "Ativa o sistema nervoso parassimpático, reduzindo a resposta"
            " de luta-ou-fuga."
        ),
    },
    {
        "title": "Caminhada consciente",
        "description": (
            "Saia para caminhar por 10 minutos sem celular. Preste atenção"
            " nos sons, cheiros e sensações físicas. Caminhe no seu ritmo."
        ),
        "category": "anxiety",
        "duration_minutes": 10,
        "difficulty": "easy",
        "expected_benefit": (
            "Interrompe o ciclo de pensamentos ansiosos e ancora no"
            " momento presente."
        ),
    },
    {
        "title": "Exercício físico rápido",
        "description": (
            "Faça 20 agachamentos, 10 flexões e 30 segundos de jumping"
            " jack. Repita 2 vezes. Não precisa de equipamento."
        ),
        "category": "anxiety",
        "duration_minutes": 10,
        "difficulty": "medium",
        "expected_benefit": (
            "Libera endorfina e cortisol de forma saudável, reduzindo"
            " tensão acumulada."
        ),
    },
    {
        "title": "Técnica 5-4-3-2-1 (grounding)",
        "description": (
            "Identifique: 5 coisas que você vê, 4 que pode tocar, 3 que"
            " ouve, 2 que cheira, 1 que pode saborear. Faça com calma."
        ),
        "category": "anxiety",
        "duration_minutes": 5,
        "difficulty": "easy",
        "expected_benefit": (
            "Interrompe espirais ansiosas ao trazer a atenção de volta ao"
            " momento presente."
        ),
    },
    # Dependência Emocional
    {
        "title": "Lista de objetivos pessoais",
        "description": (
            "Escreva 5 objetivos que são seus — não relacionados a nenhuma"
            " outra pessoa. Incluam coisas que você quer aprender, conquistar"
            " ou experienciar sozinho."
        ),
        "category": "emotional_dependency",
        "duration_minutes": 15,
        "difficulty": "medium",
        "expected_benefit": (
            "Reforça a identidade individual e reduz a centralização da"
            " vida em outras pessoas."
        ),
    },
    {
        "title": "Planejamento da semana solo",
        "description": (
            "Planeje sua próxima semana incluindo atividades que você fará"
            " independentemente de outras pessoas: hobbies, estudos, cuidado"
            " pessoal."
        ),
        "category": "emotional_dependency",
        "duration_minutes": 20,
        "difficulty": "medium",
        "expected_benefit": (
            "Desenvolve autonomia e senso de agência sobre a própria vida."
        ),
    },
    {
        "title": "Exercício de autonomia emocional",
        "description": (
            "Faça algo sozinho que normalmente espera fazer acompanhado:"
            " ir a um café, assistir um filme, cozinhar uma refeição especial"
            " para si mesmo."
        ),
        "category": "emotional_dependency",
        "duration_minutes": 60,
        "difficulty": "hard",
        "expected_benefit": (
            "Combate o medo de estar consigo mesmo e fortalece a"
            " auto-suficiência emocional."
        ),
    },
]


class Command(BaseCommand):
    help = "Popula o catálogo de intervenções de bem-estar emocional."

    def handle(self, *args, **options):
        created = 0
        for data in INTERVENTIONS:
            _, new = WellnessIntervention.objects.get_or_create(
                title=data["title"],
                is_global=True,
                defaults={**data, "is_global": True},
            )
            if new:
                created += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"{created} intervenções criadas"
                f" ({len(INTERVENTIONS) - created} já existiam)."
            )
        )
