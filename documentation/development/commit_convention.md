# Convenção de Commits

O projeto usa [Conventional Commits](https://www.conventionalcommits.org/) validado pelo **commitlint** no CI (etapa `lint:commits`). Commits que não seguirem o padrão bloqueiam o merge request.

## Formato

```
<tipo>(<escopo opcional>): <descrição>
```

## Regras obrigatórias (validadas pelo commitlint)

| Regra | Correto | Errado |
|---|---|---|
| Tipo em minúsculas | `fix:` | `Fix:` |
| Descrição em minúsculas (sem sentence-case) | `fix: corrige bug` | `fix: Corrige bug` |
| Sem ponto final na descrição | `fix: corrige bug` | `fix: corrige bug.` |
| Tipo deve ser um dos permitidos (ver abaixo) | `fix:` | `bugfix:` |

## Tipos permitidos

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `chore` | Manutenção (deps, config, tooling) |
| `refactor` | Reestruturação de código sem mudar comportamento |
| `docs` | Apenas documentação |
| `test` | Adição ou correção de testes |
| `ci` | Configuração de CI/CD |
| `perf` | Melhoria de performance |
| `revert` | Reverter commit anterior |
| `style` | Formatação/estilo sem mudança de lógica |

## Exemplos

```bash
# Corretos
feat(auth): adiciona suporte a refresh token
fix(dashboard): corrige cálculo de saldo para cartões
chore(deps): atualiza React para v19
docs: adiciona convenção de commits
test(expenses): adiciona cobertura de edge cases
ci: ajusta etapa de lint no pipeline

# Errados — causam falha no CI
Fix: Lint for frontend and backend.   # tipo maiúsculo, descrição sentence-case, ponto final
feat: Adiciona nova feature.          # descrição sentence-case, ponto final
FEAT: nova feature                    # tipo em maiúsculas
bugfix: corrige erro                  # tipo não permitido
```

## Escopo (opcional)

Use para indicar a área afetada. Exemplos: `auth`, `dashboard`, `accounts`, `frontend`, `api`, `deps`, `ci`.

```
feat(accounts): adiciona filtro por tipo de conta
fix(auth): corrige loop infinito no refresh de token
```

## Corpo e rodapé (opcionais)

Use o corpo para explicar **o quê** e **por quê**. Breaking changes vão no rodapé:

```bash
git commit -m "feat(api): altera formato de resposta de contas

Renomeia campo para alinhar com convenção REST do projeto.

BREAKING CHANGE: campo 'saldo' renomeado para 'balance'."
```

## Configuração local (obrigatória)

O hook `commit-msg` valida a mensagem antes de cada commit. Instale uma vez:

```bash
pre-commit install --hook-type commit-msg
```

> Sem esse hook, mensagens inválidas só são detectadas no CI, bloqueando o MR.

## Checklist rápido antes de commitar

- [ ] Tipo em minúsculas
- [ ] Descrição em minúsculas (sem capitalizar a primeira letra)
- [ ] Sem ponto final no final da descrição
- [ ] Tipo é um dos 10 permitidos
