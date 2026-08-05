# Mobile

App mobile do Axiom (`apps/mobile/`), construído em Flutter/Dart.

## Estado Atual

O app tem login real (2FA incluso) e, a partir dele, 4 módulos autenticados
que cobrem o "Tier 1" identificado a partir do frontend web — as telas de
uso diário (registro/consulta rápida), deixando de fora relatórios,
configuração e administração, que continuam exclusivos do web.

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
  crédito, previsão de fluxo de caixa via `fl_chart`), contas, despesas e
  receitas (abas), cartões de crédito com faturas e lançamento de compras
  (parcelas geradas pelo backend), transferências.
- **Planejamento** (`screens/planning/`): dashboard (gamificação, tarefas e
  metas do dia), checklist diário + rotinas + metas (abas), treino (sessões,
  planos, catálogo de exercícios), nutrição (refeições do dia, tipos de
  refeição, catálogo de alimentos).
- **Segurança** (`screens/security/`): porta de entrada do cofre
  (configurar/desbloquear conforme `vault/status/`) e, uma vez desbloqueado,
  lista de senhas com revelar/copiar (contagem regressiva de 30s de
  auto-ocultar), favoritos e busca.
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

Simplificações assumidas nesta entrega em relação ao web (documentadas para
uma eventual próxima iteração): sem kanban de arrastar-e-soltar no checklist
diário, sem timer Pomodoro, sem geração de plano de treino/cardápio via IA,
sem alternância lista/agrupado nas compras de cartão, sem edição aninhada de
dias/exercícios dentro de um plano de treino, sem edição de opções/
ingredientes dentro de um tipo de refeição, sem heatmap de hábitos — todos os
endpoints já existem no backend, só não têm UI mobile ainda.

Lint/test estão validados localmente (`flutter analyze`, `flutter test`) —
não há job de CI para mobile hoje (veja seção CI/CD abaixo).

## Stack

- **Flutter** 3.27.x / **Dart** 3.6.x
- Material 3, plataformas alvo Android e iOS
- `go_router` (navegação) + `flutter_riverpod` (DI/cache de dados)
- `fl_chart` (gráficos), `flutter_markdown_plus` (Markdown do chat), `intl`
  (formatação de moeda/data pt-BR)
- `flutter_lints` para análise estática

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
│   ├── widgets/                   # StatCard, EmptyState, LoadingState, PageHeader, AccentCard, ...
│   ├── utils/                     # formatters.dart (moeda/data), choice_labels.dart (enums do backend)
│   └── screens/
│       ├── login_screen.dart
│       ├── shell/app_shell.dart   # Bottom navigation bar das 4 abas
│       ├── finance/               # Dashboard, Contas, Transações, Cartões/Faturas, Transferências
│       ├── planning/               # Dashboard, Tarefas&Metas, Treino, Nutrição
│       ├── security/               # Vault gate + Senhas
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

Três jobs em `.gitlab-ci.yml`, seguindo o mesmo padrão de
`lint:frontend`/`test:frontend` (template `.node_base` + `.rules_verify_frontend`),
aqui com `.flutter_base` + `.rules_verify_mobile`:

| Job | Stage | O que faz |
|---|---|---|
| `lint:mobile` | `lint` | `dart format --set-exit-if-changed .` + `flutter analyze` |
| `test:mobile` | `test` | `flutter test --coverage` |
| `build:mobile` | `build` | `flutter build apk --debug` (verificação de build Android) |

Todos rodam apenas quando arquivos em `apps/mobile/**` (ou o próprio
`.gitlab-ci.yml`) mudam, em MRs ou branches de feature — mesma lógica de
`.rules_verify_backend`/`_frontend`.

`build:mobile` difere de `build:api`/`build:frontend`: não há imagem Docker
nem alvo de deploy para o mobile ainda, então o job é só uma checagem de "o
app ainda builda", não uma etapa de release. iOS não é validado no CI (exige
macOS/Xcode, indisponível no runner Linux atual).

**Nota**: esses checks ainda não estão integrados ao `ci-check.sh` (que hoje
só cobre backend/frontend) — rodar `flutter analyze`/`flutter test` localmente
via CLI direta até que isso seja adicionado como follow-up.

## Próximos Passos (fora do escopo desta entrega)

- Simplificações listadas em "Estado Atual" (kanban do checklist, Pomodoro,
  geração via IA, edição aninhada de planos de treino e tipos de refeição,
  heatmap de hábitos).
- Telas "Tier 2" do web ainda não avaliadas para o mobile (metas
  financeiras, empréstimos, pagáveis/recebíveis, cartões/contas guardados no
  cofre, calendário financeiro).
- Distribuição (Play Store / TestFlight ou build interno).

---

[Voltar ao índice da documentação](../README.md)
