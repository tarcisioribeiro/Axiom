# Mobile

App mobile do Axiom (`apps/mobile/`), construído em Flutter/Dart.

## Estado Atual

Este módulo está em estágio de **scaffolding**: projeto Flutter rodando, com
uma tela de login estática (sem integração com a API) e lint/test/build
validados no CI. A integração real com `/api/v1/authentication/` (JWT,
refresh, etc.) é escopo de um card futuro.

## Stack

- **Flutter** 3.27.x / **Dart** 3.6.x
- Material 3, plataformas alvo Android e iOS
- `flutter_lints` para análise estática

Ver a justificativa completa da escolha (vs. React Native / nativo) em
[Decisões Arquiteturais — 16. Flutter vs. React Native vs. Nativo](../architecture/architectural_decisions.md#16-flutter-vs-react-native-vs-nativo).

## Estrutura de Diretórios

```
apps/mobile/
├── android/                    # Projeto nativo Android (gerado pelo Flutter)
├── ios/                        # Projeto nativo iOS (gerado pelo Flutter)
├── lib/
│   ├── main.dart                # Entry point — AxiomMobileApp (MaterialApp)
│   └── screens/
│       └── login_screen.dart    # Tela de login (placeholder, sem API)
├── test/
│   └── widget_test.dart         # Smoke tests da tela de login
├── analysis_options.yaml        # flutter_lints
└── pubspec.yaml                 # Dependências (versões exatas, sem `^`)
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

- Integração real de autenticação com `/api/v1/authentication/` (JWT)
- Camada de serviços consumindo os demais endpoints da API
- Distribuição (Play Store / TestFlight ou build interno)

---

[Voltar ao índice da documentação](../README.md)
