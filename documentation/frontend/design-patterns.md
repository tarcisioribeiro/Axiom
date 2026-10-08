# Padrões de design do frontend

Padrões de UI/UX definidos pelo product owner durante o desenvolvimento do app, levantados a partir das conversas e dos commits desde 25/08/2026.

Legenda: **[regra]** = padrão global, aplica-se a todas as telas e módulos. **[pontual]** = pedido isolado, aplicar onde couber. **Status** = situação no código, a verificar.

## Modais e diálogos

- **[regra]** Nenhum modal tem altura ou largura fixas. O conteúdo define o tamanho, com limite máximo para não estourar a tela.
- **[regra]** Título e botões Salvar/Cancelar ficam fixos no modal, fora da área rolável. Status: `DialogHeader sticky` em 42 arquivos.
- **[regra]** Ícone ao lado do título: "+" na inclusão e lápis na edição. Status: `DialogTitle mode` em 44 usos; 49 ainda sem `mode`.
- **[regra]** Sem subtítulo nem descrição abaixo do título. Status: `DialogDescription` ainda visível em vários diálogos de formulário.
- **[regra]** Sem botão X de fechar em nenhum modal.
- **[regra]** Sem textos de apoio em modais, campos ou botões (descrições, dicas, textos abaixo de campos e botões). Status: a verificar.
- **[regra]** Erros de validação não aparecem abaixo do campo. Ver [Validação de formulários](#validação-de-formulários).
- **[regra]** Cancelar com `variant="outline"`; Salvar com a cor padrão do sistema, sem cor fixa.
- **[regra]** Botão "Fechar" à esquerda do botão principal, no rodapé.
- **[regra]** Clicar no card abre o modal de detalhes, que também serve para edição. Ações do rodapé do card não disparam a abertura. Substitui o toggle "Ver detalhes".
- **[regra]** Modal de edição é o mesmo que abre ao clicar no card. Reutilizar modais existentes.
- **[pontual]** Modal pode abrir por cima de outro modal.
- **[regra]** Campos preenchidos carregam os valores ao editar, em todos os módulos.
- **[regra]** Seção condicional não aparece quando não se aplica (em vez de aparecer vazia).
- **[regra]** Campos de data não têm opção de limpar; a data atual é o valor padrão. Status: `clearable` removido do `DatePicker`.
- **[pontual]** Campos relacionados alinhados lado a lado.
- **[pontual]** Ação que revela campos (ex.: alterar senha) abre um modal em vez de expandir a tela.
- **[pontual]** Exclusão sensível em etapas, com confirmação.
- **[pontual]** Campos de quantidade usam `number-stepper`.

## Validação de formulários

- **[regra]** Mensagens de validação não aparecem abaixo do campo. Cada erro vai para um toast destrutivo.
- **[regra]** Campo com erro fica com borda vermelha, via `aria-invalid`. Os primitivos `Input`, `Textarea`, `Select`, `CurrencyInput`, `DatePicker`, `TimePicker`, `NumberStepper`, `DecimalInput`, `IconPicker` e `StarRating` já aceitam a prop e mostram a borda.
- **[regra]** Como aplicar:
  - `handleSubmit(onSubmit, notifyFormErrors)`, com `import { notifyFormErrors } from '@/lib/form-errors'`.
  - No campo: `aria-invalid={!!errors.campo}`. Em `FormField`, passar `error={errors.campo?.message}` basta para a borda.
  - Não renderizar `errors.campo.message` inline.
- **[regra]** Mensagens de erro de API (ex.: senha atual incorreta) continuam como texto no formulário. Não são validação de campo.
- **[regra]** Erro do servidor ligado a um campo: `setError` para a borda e toast com a mensagem.
- **[regra]** Formulário com validação manual (sem react-hook-form) mostra um toast por mensagem no submit.
- **[regra]** O botão Salvar não fica desabilitado por erro de validação. O clique mostra os toasts. Hoje isso vale para dados pessoais; para os demais formulários, a verificar.
- **Status:** aplicado nos 23 arquivos de formulário que tinham mensagem inline. Pontos a verificar: `Register.tsx` (usa `FormField` com `error` dentro de `Controller`, borda via `aria-invalid` direto no `Input`); `PersonalDataSection.tsx` (validação manual). Não há teste direto para a maioria desses formulários; conferir no navegador.

## Botões e ícones

- **[regra]** Todo botão de ação tem ícone à esquerda do texto. Status: Lucide em 259 arquivos; ainda há botões sem ícone.
- **[regra]** Botão só com ícone tem tooltip do app. Status: `tooltipSide` aplicado.
- **[regra]** Botões de um mesmo grupo têm o mesmo estilo, tamanho e largura.
- **[regra]** Botões de ação ficam visíveis sem depender de hover.
- **[regra]** A ação do cabeçalho muda conforme a aba ativa e fica na linha do header, acima das abas (ex.: "Nova Tarefa" / "Novo Bloco"). Vale também para outros controles de contexto (cards de progresso, calendário, toggle de visualização): todos ficam na mesma linha do título da página, não numa linha própria entre o título e as abas. Status: aplicado em Checklist Diário (`DailyChecklist.tsx`, cards de Modo Foco/progresso/nível + calendário movidos para dentro do `PageHeader`).
- **[regra]** Títulos de abas e páginas têm ícone à esquerda.
- **[pontual]** Sem ícone duplicado no botão. Botão de salvar só com ícone quando indicado. Sem botões "Gerar com IA".
- **[pontual]** Botão de revelar senha ou documento é só ícone, com tooltip.

## Empty states, cards e listas

- **[regra]** Empty state: sem botão, sem texto abaixo do ícone e do rótulo, centralizado na horizontal e na vertical, sem texto colado no topo. Usar o componente `EmptyState` em vez de listas vazias feitas à mão. Status: 127 usos.
- **[regra]** Cards sem sombra e sem contorno colorido por categoria. Cor e contorno vêm de token global. Status: parcial, ainda há sombras em 28 arquivos; aplicado em `KanbanCard.tsx` (Checklist Diário) — removida a borda esquerda colorida por categoria e o hover com scale/sombra.
- **[regra]** Texto nunca encosta na borda do card. Conteúdo centralizado na vertical.
- **[regra]** Cards alinhados em linha e com o mesmo tamanho. Rótulos não mudam de posição.
- **[regra]** Toggles em accordion: o primeiro aberto por padrão, os demais recolhidos, e só um aberto por vez. Toggles de detalhes começam recolhidos. Status: `Collapse` em 6 arquivos.
- **[pontual]** Cards redundantes ou que só funcionam como hiperlink são removidos.

## Paginação e filtros

- **[regra]** Um único componente de paginação, com mesma posição, ícones e animação em todas as telas. Status: `PaginatedSlide` em 33 arquivos.
- **[regra]** A quantidade de linhas por página é definida por tela. Não há valor único.
- **[regra]** Nenhuma tela tem rolagem de página.
- **[regra]** Telas com filtro e busca usam o mesmo componente do módulo Controle Financeiro. Status: `SearchInput` em 30 arquivos.
- **[regra]** Filtros ocupam toda a largura disponível, com rótulo acima de cada um.

## Tabelas

- **[regra]** Coluna de ações de uma linha de tabela usa a prop nativa `actions` do `DataTable` (botões alinhados à direita), nunca uma coluna customizada com `align: 'center'`/`justify-center` — isso deixa os botões soltos no meio de um espaço maior do que precisam, já que colunas sem largura fixa esticam para preencher a tabela. Status: aplicado em Tarefas Rotineiras (`RoutineTasks.tsx`).
- **[regra]** O label do cabeçalho dessa coluna ("Ações") fica centralizado, mesmo com os botões da linha alinhados à direita. Status: `DataTable.tsx`, `<th>` de ações.
- **[regra]** Tabelas dentro de telas com mais de um nível de abas usam `density="compact"` no `DataTable`, para não empurrar a página para além da viewport (ver "Nenhuma tela tem rolagem de página" em Paginação e filtros). Status: aplicado em Tarefas Rotineiras.

## Animação

- **[regra]** Animações visíveis mas leves, usando só `opacity` e `transform`. Valem para abas, páginas, toggles, modais, troca de filtros e carregamentos. Usar os tokens `duration-*`. Status: tokens aplicados; ainda há ~11 durações fixas no Framer Motion e 6 usos de `transition-all`.
- **[regra]** A transição de paginação é a mesma da tela de Tarefas Rotineiras (referência).
- **[regra]** Animações indesejadas são removidas (ex.: giro de número em contador, tela piscando).
- **[pontual]** Animação na troca entre senha e 2FA. Animação ao abrir campos de data e horário. Animação ao ocultar o widget do agente.

## Tema, cores e tipografia

- **[regra]** Nenhuma cor fixa. Usar variáveis de cor do tema, em claro e escuro. Status: ainda há `slate`, `black` e `white` em cerca de 14 arquivos.
- **[regra]** Cores de ícones são globais, não exclusivas de um módulo.
- **[regra]** A scrollbar segue o estilo do app e as variáveis de cor do tema.
- **[pontual]** Cards parecidos usam a mesma espessura de fonte.

## Tooltips

- **[regra]** Tooltip só em botões de ícone. Botões com texto não têm tooltip.
- **[regra]** Tooltip não fica oculto nem sai da tela, inclusive nos gráficos Recharts.
- **[regra]** Tooltips do menu superior aparecem abaixo do botão.

## Textos, formatação e tradução

- **[regra]** Títulos de tela sem subtítulo. Status: `PageHeader` sem `subtitle` aplicado.
- **[regra]** Todo texto passa pelo sistema de tradução. Status: parcial, há textos fixos (ex.: "Command Palette").
- **[regra]** Toasts padronizados, sem linha técnica. Status: parcial.
- **[regra]** Moeda em BRL com vírgula e duas casas decimais: `R$ 0,00`.
- **[regra]** Datas em dd/mm/aaaa. Intervalos no formato "28/09 - 04/10/2026".
- **[regra]** Telefone no formato "+DDD (DDI) número". Documento formatado do mesmo jeito.
- **[pontual]** Decimais pt-BR com uma casa. Plural correto de unidades de medida. Hora sem segundos. "Todo o período" vira "Tudo".

## Layout

- **[regra]** Calendário e seletor de horário abrem por cima da tela, sem expandi-la.
- **[regra]** Datas futuras desabilitadas no próprio calendário.
- **[regra]** Conteúdo centralizado na vertical entre componentes (filtro e paginação, abas e paginação, dentro de cards).
- **[pontual]** Tour guiado no estilo do tour do módulo Segurança, em todas as telas. Exibido no primeiro acesso, ocultável por checkbox, com botão na sidebar.

## Navegação

- **[regra]** O indicador de localização (breadcrumb) nunca fica vazio nem é parcial: toda rota resolve módulo > submódulo > página, e cada nível — exceto a página atual — é clicável. Status: `use-breadcrumb.ts` deriva módulo/submódulo/página a partir do `nav-config.ts` (mesma fonte da Sidebar), em vez de um dicionário próprio mantido à mão.
- **[regra]** Toda tela com abas tem uma rota própria por aba, refletida na URL (ex.: `/transactions/expenses`), nunca só em estado local/`localStorage`. Nomes de rota em inglês. Acessar a rota "pai" sem aba redireciona para a aba padrão. Status: aplicado via hook `useTabRoute` em Transações, Recorrentes, Regras & Etiquetas, Contas a Pagar/Receber, Cartões de Crédito, Agenda Financeira, Análises, Saúde Financeira e Tarefas e Objetivos (com sub-abas de Rotina Diária).

## Fora de escopo

- **Mobile:** fica de fora por enquanto. Os padrões serão aplicados depois.
