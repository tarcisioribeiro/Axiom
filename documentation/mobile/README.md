# Mobile

App mobile do Axiom (`apps/mobile/`), construído em Flutter/Dart.

## Estado Atual

O app tem login real (2FA incluso) e, a partir dele, 4 módulos autenticados
que cobrem as telas de uso diário do frontend web (registro/consulta rápida)
— o "Tier 1" mais os módulos financeiros "Tier 2" (a pagar/receber,
empréstimos, calendário) e a expansão do cofre (cartões e contas guardados).
Ficam de fora relatórios, configuração e administração, que continuam
exclusivos do web.

- **Login real**: `services/auth_service.dart` chama
  `POST /api/v1/authentication/token/`, trata o fluxo de 2FA
  (`requires_2fa` → `POST /api/v1/users/2fa/verify/`) e confirma a sessão via
  `GET /api/v1/me/`. Como o backend nunca devolve o JWT no corpo da resposta
  (só via cookie `httpOnly`, igual ao frontend web), `services/api_client.dart`
  usa `dio` + `cookie_jar` (`PersistCookieJar`) para persistir a sessão entre
  execuções do app da mesma forma que o navegador faz. Um interceptor faz
  refresh automático em `401` (mirror do interceptor do
  `apps/frontend/src/services/api-client.ts`) e expõe `onSessionExpired` para
  o app redirecionar ao login quando o refresh falha. Como a sessão persiste
  entre execuções, o bootstrap chama `GET /me/` antes de decidir a tela
  inicial — uma sessão válida pula o login e vai direto para o shell.
- **Ambiente configurável**: `config/api_environment.dart` permite alternar,
  em runtime, entre a API local (Docker, `http://192.168.2.200:39100` — IPv4
  da máquina de desenvolvimento na LAN, já que nem o emulador Android nem
  aparelhos físicos alcançam o host via `localhost`) e a API de produção na
  VPS (`https://axiom.tjtux.duckdns.org`), acessível pelo ícone de ambiente
  na tela de login.
- **Seleção de tema**: `theme/app_themes.dart` replica as 16 variantes do
  frontend web (Dracula + 7 variantes escuras, Alucard + 7 variantes claras),
  com os mesmos tokens HSL de `apps/frontend/src/index.css`. O seletor fica
  no ícone de tema da tela de login (`theme/theme_picker_sheet.dart`).
  `theme/app_theme_variant.dart` também expõe `AppSemanticColors` (uma
  `ThemeExtension`) para as cores success/warning/info que não têm um slot
  correspondente no `ColorScheme` do Flutter.
- **Navegação + estado**: `go_router` com um `StatefulShellRoute.indexedStack`
  de 4 abas (Finanças/Planejamento/Agente IA/Segurança — ver
  `router/app_router.dart`), cada uma com sua própria pilha de navegação.
  `flutter_riverpod` cuida de injeção de dependência e cache de dados
  (`providers/*_providers.dart`): cada tela lê um `FutureProvider`, e como o
  `indexedStack` mantém as abas montadas ao trocar, o dado buscado não é
  recarregado só por sair de tela — o equivalente ao cache do TanStack Query
  no web. Mutações (criar/editar/excluir) invalidam o provider correspondente
  depois de concluir.
- **Finanças** (`screens/finance/`): dashboard (saldo, receitas/despesas,
  crédito, previsão de fluxo de caixa via `fl_chart`, **grid de navegação**
  para os submódulos — antes as telas de contas/transações/cartões/
  transferências não tinham ponto de entrada na UI), contas, despesas e
  receitas (abas), cartões de crédito com faturas e lançamento de compras
  (parcelas geradas pelo backend), transferências, **contas a pagar / a
  receber** (`payables`/`receivables` em abas, com barra de progresso e ação
  "Pagar"/"Receber" que debita/credita uma conta), **empréstimos** (`loans`
  — concedidos/tomados, com picker de membros e criação rápida de `Member`
  via nome + CPF; ação pagar/receber por parcela), **calendário financeiro**
  (grade mensal com vencimentos de contas a pagar/receber, empréstimos e
  faturas — agregação client-side, sem endpoint dedicado, igual à página web
  `FinancialCalendar`), **cofres** (`vaults` — reservas com rendimento anual;
  depósito/saque/aplicar rendimento e extrato de movimentações; a mecânica de
  receita/saldo é toda do backend), **metas financeiras**
  (`vaults.FinancialGoal` — agregam cofres, barra de progresso, vincular/
  desvincular cofres via `add-vaults`/`remove-vaults`) e **membros**
  (`members` — cadastro completo: CPF, telefone, sexo, nascimento, endereço,
  profissão, renda, flags credor/devedor). `loans`/`payables`/`receivables`
  parcelados mostram a **tabela de parcelas** (read-only) num sheet
  (`widgets/installments_sheet.dart`).
- **Planejamento** (`screens/planning/`): dashboard (gamificação, tarefas e
  metas do dia), checklist diário + rotinas + metas (abas), treino (sessões,
  planos, catálogo de exercícios), nutrição (refeições do dia, tipos de
  refeição, catálogo de alimentos), **Bem-estar** (Wellness Center).
  - **Checklist**: toque cicla o status (pendente → em andamento → concluída);
    **toque longo** abre um seletor com os 4 status (inclui "pulada"). Um
    toggle Lista/Quadro no topo agrupa as tarefas em colunas por status
    (equivalente ao kanban do web — mover é pelo seletor de status, não por
    arrastar).
  - **Bem-estar** (`WellnessScreen`, 5 abas): painel (autoestima Rosenberg +
    médias emocionais 7d), check-in emocional (6 escalas 0–10), **modo crise**
    (registra estado + impulso e recebe validação/plano de ação/afirmação da
    IA via `wellness/crisis/`), biblioteca de intervenções (marcar concluída)
    e relatório semanal gerado por IA (`wellness/weekly-reports/generate/`).
  - **Consistência**: a aba "Rotinas" mostra um **heatmap anual de hábitos**
    (`routine-tasks/heatmap/`), estilo GitHub, com scroll horizontal.
  - **Pomodoro**: timer local (foco 25' / pausa 5') no ícone de cronômetro do
    cabeçalho de Tarefas & Metas — não persiste nada, é só um apoio de foco.
  - **Geração via IA**: FAB secundário (✨) em "Planos" (treino) e "Tipos de
    Refeição" (nutrição) chama `ai-workout-plan/` / `ai-menu-plan/`, que
    geram e **persistem** o plano/cardápio no backend (timeout de 180s no
    cliente).
  - **Edição aninhada**: tocar num plano de treino abre
    `WorkoutPlanDetailScreen` (dias → exercícios, CRUD completo); tocar num
    tipo de refeição abre `MealTypeDetailScreen` (opções → ingredientes, com
    picker de alimento).
- **Segurança** (`screens/security/`): porta de entrada do cofre
  (configurar/desbloquear conforme `vault/status/`) e, uma vez desbloqueado,
  **3 abas** — senhas, cartões guardados (`stored-cards`) e contas guardadas
  (`stored-accounts`) — cada uma com revelar/copiar (contagem regressiva de
  30s de auto-ocultar), favoritos e busca. Cartões revelam número + CVV;
  contas revelam número + agência + senha + senha digital.
- **Agente IA** (`screens/agents/`): seletor entre 4 assistentes
  (pessoal/financeiro/segurança/intelecto) e chat com streaming via SSE
  (`agents/stream/`), Markdown renderizado com `flutter_markdown_plus`,
  sessão por agente persistida em `shared_preferences`.
- **Identidade do app**: nome "Axiom" (label do Android, `CFBundleName`/
  `CFBundleDisplayName` do iOS, título de janela do Linux/Windows, manifest/
  título da Web) e ícone gerado a partir de `assets/icon/icon.png` — a
  marca "A" branca de `apps/frontend/public/icon-light.png` sobre um fundo
  preto sólido (`#000000`, sem o degradê sutil do arquivo original; rode
  `dart run flutter_launcher_icons` de novo se esse arquivo for trocado). O
  identificador interno do pacote Dart (`pubspec.yaml: name`,
  `package:axiom_mobile/...`) e o `applicationId`/`APPLICATION_ID` nativos
  continuam `axiom_mobile`/`com.axiom.axiom_mobile` — só o nome exibido ao
  usuário mudou.
  - Android/iOS/Web: ícone gerado pelo pacote `flutter_launcher_icons`
    (config no final de `pubspec.yaml`), que também cobre o Windows
    (`windows/runner/resources/app_icon.ico`, referenciado por
    `Runner.rc`/`IDI_APP_ICON` e aplicado à janela em `win32_window.cpp`).
  - Linux: `flutter_launcher_icons` não tem gerador para essa plataforma —
    `linux/runner/my_application.cc` carrega `assets/icon/icon_linux.png`
    direto do bundle (`<diretório do executável>/data/flutter_assets/...`,
    resolvido via `/proc/self/exe`) com `gtk_window_set_icon_from_file`, o
    que funciona tanto em `flutter run -d linux` quanto num bundle
    empacotado, já que o layout relativo é o mesmo nos dois casos.
    **Usa um PNG de 128×128 dedicado, não o `icon.png` de 512×512** — em
    pelo menos um ambiente X11/Cinnamon testado, `_NET_WM_ICON` (a
    propriedade que a barra de tarefas/dock lê) fica corrompida em 256px e
    não é definida de jeito nenhum acima disso, mesmo quando
    `gtk_window_set_icon_from_file` reporta sucesso — confirmado com uma
    reprodução mínima em GTK3 puro, fora do Flutter. Se `icon_linux.png`
    for regenerado a partir de `icon.png`, mantenha o redimensionamento
    para 128×128 (ex.: `gdk_pixbuf_new_from_file_at_scale` a 128×128 antes
    de salvar).
- **Logout**: `widgets/logout_button.dart` — botão reutilizado como
  `trailing` do `AppPageHeader` nas 4 telas-raiz das abas (mirror do item
  "Sair" do menu de usuário na sidebar web,
  `components/layout/Sidebar.tsx`). Chama `AuthService.logout()` e depois
  `SessionController.markLoggedOut()`, que é o `refreshListenable` do
  `GoRouter` — o redirect para `/login` acontece automaticamente. Fica nas
  telas-raiz em vez de um `AppBar` único no shell porque algumas sub-rotas
  (detalhe de cartão/fatura, chat do agente) já têm seu próprio `AppBar`
  contextual com botão de voltar, e um `AppBar` de shell empilharia uma
  segunda barra de título acima dessas.

Simplificações ainda assumidas em relação ao web:
- **Checklist**: o "kanban" é um quadro de colunas por status (toggle
  Lista/Quadro) + seletor de status por toque longo — não há arrastar-e-soltar
  (má ergonomia numa tela de celular) nem reordenação de tarefas dentro do dia
  (o endpoint `instances/bulk-update/` não suporta ordem).
- **Compras de cartão**: sem alternância lista/agrupado.
- **`payables`/`receivables`/`loans`**: a tabela de parcelas é read-only;
  amortização, renegociação, plano de pagamento e recálculo/redistribuição de
  parcelas continuam exclusivos do web (são ferramentas de *preview* pesadas).
- **Membros**: cadastro completo, mas o **upload de foto** de perfil segue no
  web (precisa de picker de imagem nativo — dependência fora de proporção);
  o mobile só exibe a foto quando ela já existe. Permissões de membro (acesso
  ao sistema) também seguem no web.
- **Geração via IA**: o mobile só dispara a geração e mostra um resumo —
  revisar/editar o plano gerado é feito na edição aninhada normal.
- **Wellness**: a avaliação de autoestima (questionário Rosenberg de 10
  perguntas) só é *exibida* no painel; preenchê-la segue no web.

### Design system

- **Superfície única**: `widgets/app_card.dart` (`AppCard`) é a primitiva de
  card — `cardColor` + borda hairline (`outlineVariant`) + raio `lg`, com
  faixa de acento opcional (`accentColor`). Substituiu ~15 `Container`/
  `BoxDecoration` copiados pelas telas que tinham divergido em peso de borda,
  raio e padding. `AccentCard` e `StatCard` são construídos sobre ela.
- **Ações de linha**: `widgets/row_actions.dart` (`RowActionsMenu`) — menu
  overflow (⋮) com Editar/Excluir para as listas, no lugar do par de
  `IconButton` de 18 px. Toda exclusão passa por `widgets/confirm.dart`
  (`confirmDelete`), então nenhum delete acontece com um toque perdido.
- **Tokens**: `app_spacing.dart` ganhou `smd` (12); `app_radius.dart` foi
  arredondado um passo (`sm 6 / md 10 / lg 14 / xl 20`) para um acabamento
  mais tátil que o `--radius` de 8 px do web.

Lint/test estão validados localmente (`flutter analyze`, `flutter test`) —
não há job de CI para mobile hoje (veja seção CI/CD abaixo).

## Stack

- **Flutter** ≥ 3.27 / **Dart** `^3.6.0` (`pubspec.yaml`); testado com Flutter
  3.47.x
- Material 3, plataformas alvo Android e iOS
- `go_router` (navegação) + `flutter_riverpod` (DI/cache de dados)
- `fl_chart` (gráficos), `flutter_markdown_plus` (Markdown do chat), `intl`
  (formatação de moeda/data pt-BR)
- `flutter_lints` para análise estática

### Toolchain Android

O Flutter 3.47 exige, para o build Android, versões mínimas mais novas do que
o template original do projeto trazia:

| Ferramenta | Versão | Onde |
|---|---|---|
| Gradle | 8.14.3 | `android/gradle/wrapper/gradle-wrapper.properties` |
| Android Gradle Plugin | 8.11.1 | `android/settings.gradle` |
| Kotlin Gradle Plugin | 2.2.20 | `android/settings.gradle` |
| JDK (para o Gradle) | 17–21 | `flutter config --jdk-dir=<jdk>` |

O JDK 25 que o Android Studio mais recente embute **não** é compatível com
Gradle 8.x — aponte o Flutter para um JDK 17–21 com
`flutter config --jdk-dir=…` (o valor fica em `~/.config/flutter/settings`,
fora do repositório). O build ainda emite avisos "*Flutter support … will
soon be dropped*" para essas versões; são apenas avisos (o piso de erro do
Flutter 3.47 é Gradle 8.14 / AGP 8.11.1 / Kotlin 2.2.20).

Ver a justificativa completa da escolha (vs. React Native / nativo) em
[Decisões Arquiteturais — 16. Flutter vs. React Native vs. Nativo](../architecture/architectural_decisions.md#16-flutter-vs-react-native-vs-nativo).

## Estrutura de Diretórios

```
apps/mobile/
├── android/                       # Projeto nativo Android (gerado pelo Flutter)
├── ios/                           # Projeto nativo iOS (gerado pelo Flutter)
├── lib/
│   ├── main.dart                  # Entry point — bootstrap + ProviderScope + MaterialApp.router
│   ├── config/
│   │   └── api_environment.dart   # Dev (Docker local) vs. Produção (VPS), persistido
│   ├── models/                    # 1 classe por recurso da API, fromJson/toJson manuais
│   ├── services/
│   │   ├── api_client.dart        # dio + cookie_jar + interceptor de refresh/423
│   │   ├── auth_service.dart      # Login, 2FA, confirmação de sessão (/me/)
│   │   ├── session_controller.dart# Estado de autenticação (ChangeNotifier + refreshListenable)
│   │   ├── base_service.dart      # CRUD genérico (mirror de services/base-service.ts do web)
│   │   └── ...                    # 1 serviço por recurso (accounts, expenses, workout, etc.)
│   ├── providers/                 # Riverpod: core + 1 arquivo por domínio
│   ├── router/
│   │   └── app_router.dart        # GoRouter: /login + shell de abas autenticado
│   ├── theme/
│   │   ├── app_theme_variant.dart # Variante de tema + AppSemanticColors (ThemeExtension)
│   │   ├── app_themes.dart        # As 16 variantes (mesmos tokens do frontend web)
│   │   ├── app_spacing.dart       # Escala de espaçamento (--spacing-* do index.css)
│   │   ├── app_radius.dart        # Escala de border-radius (--radius do index.css)
│   │   ├── theme_controller.dart  # Persistência da escolha de tema
│   │   └── theme_picker_sheet.dart# Bottom sheet de seleção de tema
│   ├── widgets/                   # AppCard (base surface), StatCard, EmptyState, LoadingState,
│   │                             # PageHeader, AccentCard, RowActionsMenu (⋮ edit/excluir),
│   │                             # confirm.dart, module_tile.dart, habit_heatmap.dart,
│   │                             # pomodoro_sheet.dart, installments_sheet.dart, ...
│   ├── utils/                     # formatters.dart (moeda/data), choice_labels.dart (enums do backend)
│   └── screens/
│       ├── login_screen.dart
│       ├── shell/app_shell.dart   # Bottom navigation bar das 4 abas
│       ├── finance/               # Dashboard, Contas, Transações, Cartões/Faturas, Transferências,
│       │                          # A pagar/receber, Empréstimos, Calendário, Cofres, Metas, Membros
│       ├── planning/               # Dashboard, Tarefas&Metas, Treino, Nutrição, Bem-estar,
│       │                          # workout_plan_detail (dias/exercícios), meal_type_detail
│       │                          # (opções/ingredientes), ai_generate_sheets
│       ├── security/               # Vault gate + abas Senhas / Cartões / Contas
│       └── agents/                 # Seletor + chat
├── test/
│   ├── widget_test.dart           # Smoke tests da tela de login, tema e ambiente
│   ├── utils/                     # Testes de formatters/choice_labels
│   ├── widgets/                   # Testes de componentes compartilhados
│   ├── screens/                   # Testes de tela com API fake (test/support/fake_dio_adapter.dart)
│   └── support/                   # Helpers de teste (fake HttpClientAdapter)
├── analysis_options.yaml          # flutter_lints
└── pubspec.yaml                   # Dependências (versões exatas, sem `^`)
```

## Comandos de Desenvolvimento

```bash
cd apps/mobile

flutter pub get                        # Instalar dependências
flutter run                            # Rodar em device/emulador conectado
dart format --set-exit-if-changed .    # Checar formatação
flutter analyze                        # Lint / análise estática
flutter test --coverage                # Testes com cobertura
flutter build apk --debug              # Build de verificação (Android)
```

## CI/CD

O módulo mobile **não tem jobs de CI** — foram removidos e `ci-check.sh` só
cobre backend/frontend. Rode a verificação localmente antes de fazer push:

```bash
cd apps/mobile
dart format --set-exit-if-changed .
flutter analyze            # sai com código 1 se houver infos; hoje há ~43
                           # infos de `DropdownButtonFormField.value` (deprecado
                           # em favor de `initialValue` no Flutter 3.35+) — o
                           # padrão em todos os `*_form_sheet.dart`; migração
                           # pendente como um sweep único (troca comportamento)
flutter test
flutter build apk --debug  # verificação de build Android (iOS exige macOS/Xcode)
```

## Próximos Passos

- **Distribuição** (Play Store / TestFlight ou build interno) — pendente:
  precisa de contas de desenvolvedor e assinatura. Único item ainda não
  atacado por decisão de escopo.
- Itens deixados como *web-only* de propósito (ver "Simplificações"): upload de
  foto de membro, permissões de membro, ferramentas de renegociação/
  amortização de dívidas, questionário Rosenberg, arrastar-e-soltar do kanban.
- Migração `DropdownButtonFormField.value` → `initialValue` em massa.

---

[Voltar ao índice da documentação](../README.md)
