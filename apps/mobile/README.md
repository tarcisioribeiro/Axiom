# Axiom Mobile

App mobile do Axiom, construído em **Flutter** (Dart). Este módulo está em
estágio de **scaffolding**: o projeto roda, tem uma tela de login estática
(sem chamadas de API) e lint/test/build já estão validados localmente e no
CI. A integração real com a API (`/api/v1/authentication/`, JWT, etc.) é
escopo de um card futuro.

Ver a decisão de stack completa em
[`documentation/architecture/architectural_decisions.md`](../../documentation/architecture/architectural_decisions.md)
e a visão geral do módulo em
[`documentation/mobile/README.md`](../../documentation/mobile/README.md).

## Stack

- **Flutter** 3.27.x / **Dart** 3.6.x
- Material 3 (`useMaterial3: true`)
- Plataformas alvo: Android e iOS (`--platforms=android,ios`)
- `flutter_lints` para análise estática

## Estrutura

```
apps/mobile/
├── android/            # Projeto nativo Android (gerado pelo Flutter)
├── ios/                # Projeto nativo iOS (gerado pelo Flutter)
├── lib/
│   ├── main.dart        # Entry point — AxiomMobileApp (MaterialApp)
│   └── screens/
│       └── login_screen.dart  # Tela de login (placeholder, sem API)
├── test/
│   └── widget_test.dart # Smoke tests da tela de login
├── analysis_options.yaml
└── pubspec.yaml
```

## Comandos

```bash
cd apps/mobile

flutter pub get                  # Instalar dependências
flutter run                      # Rodar em um device/emulador conectado
dart format --set-exit-if-changed .   # Checar formatação
flutter analyze                  # Lint / análise estática
flutter test --coverage          # Rodar testes com cobertura
flutter build apk --debug        # Build de verificação (Android)
```

Pré-requisitos: [Flutter SDK](https://docs.flutter.dev/get-started/install)
instalado e `flutter doctor` sem erros (toolchain Android e/ou Xcode,
conforme a plataforma que for testar).

## Testando em emulador/dispositivo

```bash
flutter emulators                        # Listar emuladores disponíveis
flutter emulators --launch <emulator-id> # Subir um emulador
flutter run                              # Instala e roda com hot reload
```

Ou, usando o APK já buildado (`flutter build apk --debug`), sem precisar do
`flutter run`:

```bash
adb install -r build/app/outputs/flutter-apk/app-debug.apk
adb shell monkey -p com.axiom.axiom_mobile -c android.intent.category.LAUNCHER 1
```

**Tela em branco no emulador?** Alguns emuladores Android (ex.: a imagem
padrão x86_64 Google Play) não têm suporte completo a Vulkan/virtio-gpu, e o
Impeller (engine de renderização padrão do Flutter) renderiza uma tela em
branco nesse caso — sem erro nenhum no `logcat`. `AndroidManifest.xml` já
desabilita o Impeller (`EnableImpeller=false`, cai para o Skia) por esse
motivo; remova essa meta-data se for testar só em devices/emuladores com
Vulkan funcional.

## CI

Os jobs `lint:mobile`, `test:mobile` e `build:mobile` no `.gitlab-ci.yml`
rodam automaticamente quando arquivos em `apps/mobile/**` mudam (mesmo padrão
de `lint:frontend`/`test:frontend`). Esses checks ainda não estão integrados
ao `ci-check.sh` (que hoje só cobre backend/frontend) — fica como follow-up.
