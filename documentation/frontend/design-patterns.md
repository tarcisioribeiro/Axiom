# Padrões de design do frontend web

**Documento oficial** · versão 1.1 · 13/10/2026

Padrões de UI/UX definidos pelo product owner desde 25/08/2026. Toda mudança visual no frontend web segue este documento. Quando um pedido contradiz uma regra, a regra é atualizada aqui primeiro.

## 1. Escopo e convenções

- **Escopo:** todas as regras valem **apenas para o app web, usado em navegadores** (`apps/frontend`). O app mobile (Flutter, `apps/mobile`) não segue este documento.
- **Resolução de referência:** monitor 1920×1080 (ou maior) com a barra de tarefas do sistema e o navegador **não maximizado**, com abas, barra de endereço e barra de favoritos. Isso deixa uma **viewport útil de ~1920×900 px**. As regras marcadas com **[desktop]** são medidas com a viewport em **880 px de altura** (margem de segurança). Em viewports menores, modais e listas podem ter barra de rolagem.
- **Legenda:**
  - **[regra]**: padrão global, vale para todas as telas e módulos.
  - **[desktop]**: regra global obrigatória com viewport ≥ 880 px de altura.
  - **[pontual]**: pedido isolado, aplicar onde couber.
  - **Status**: situação no código na data da versão.

## 2. Modais e diálogos

Há três tipos de modal:

- **Formulário**: inclusão ou edição de um registro.
- **Detalhe**: visualização somente leitura, aberta ao clicar no card ou na linha.
- **Ação**: modal aberto por um botão do card ou da linha (pagar, depositar, parcelas, histórico etc.).

### 2.1 Estrutura comum (todos os tipos)

- **[regra]** O header fica fixo no topo do modal e tem **ícone + texto**, sem subtítulo nem descrição visível. O `DialogHeader` já é sempre fixo, e o `DialogDescription` é sempre só para leitores de tela (`sr-only`). Informação útil que estava no subtítulo, como "pergunta 2 de 10" ou um aviso, vai para o corpo do modal.
  - Formulário: `<DialogTitle mode="create" | "edit">` (ícone + ou lápis).
  - Detalhe e ação: `<DialogTitle icon={Icone}>`, ou um ícone dentro do título.
- **[regra]** O rodapé de botões fica fixo na base (`DialogFooter` ou `.dialog-footer`).
- **[regra]** Nenhum modal tem altura ou largura fixas. O conteúdo define o tamanho, e o limite é a viewport (`max-h: 100dvh − 2rem`, já no `DialogContent`). Não sobrescrever com `max-h-[NNvh]`, `h-[NNvh]` nem `overflow-hidden`.
- **[regra]** Sem botão X de fechar em nenhum modal.
- **[regra]** Sem textos de apoio em modais, campos ou botões (descrições, dicas, textos abaixo de campos e botões).
- **[regra]** Todo botão do rodapé tem ícone à esquerda do texto.
- **[pontual]** Modal pode abrir por cima de outro modal.
- **[regra]** Ao fechar, o modal sai inteiro, com o conteúdo e a largura que estavam na tela. O `DialogContent` congela o último conteúdo e a `className` durante a animação de saída, então pode limpar o item selecionado no mesmo `onOpenChange` (`open={!!item}` + `setItem(undefined)`), inclusive quando a largura depende dele (`max-w-5xl` vs `max-w-xl`), sem sobrar um modal "vazio" ou mais estreito.
- **[regra]** O modal abre já completo: dado de que um campo depende (ex.: membro atual para "Empréstimo Relacionado") vem de query em cache pré-carregada na página (`useCurrentMember()`), não de `useEffect` no formulário — senão o campo surge depois e o modal "cresce" na abertura.

### 2.2 Modal de formulário (inclusão/edição)

- **[regra]** Botões **Cancelar** (`variant="outline"`, ícone `X`) e **Salvar** (cor padrão do sistema, sem cor de categoria, ícone `Save`), alinhados à direita.
- **[regra]** O ícone de editar do card e o botão de inclusão da tela abrem o mesmo modal (reutilizar o formulário), cada um no seu modo: campos preenchidos ao editar, vazios ou padrão ao incluir.
- **[regra]** Campos preenchidos carregam os valores ao editar, em todos os módulos.
- **[regra]** Erros de validação não aparecem abaixo do campo. Ver [Validação de formulários](#3-validação-de-formulários).
- **[regra]** Seção condicional não aparece quando não se aplica (em vez de aparecer vazia).
- **[regra]** Campos de data não têm opção de limpar. A data atual é o valor padrão. Status: `clearable` removido do `DatePicker`.
- **[regra]** Campos de observação/notas usam `Textarea` com `rows={1}` e ocupam a linha inteira, para o texto não quebrar em coluna estreita.
- **[pontual]** Campos relacionados alinhados lado a lado.
- **[pontual]** Ação que revela campos (ex.: alterar senha) abre um modal em vez de expandir a tela.
- **[pontual]** Exclusão sensível em etapas, com confirmação.
- **[pontual]** Campos de quantidade usam `number-stepper`.
- **[regra]** Em modal, campo com `NumberStepper` ou `DecimalInput` com `step` (botões − / +) tem label e componente centralizados, e o `DecimalInput` fica compacto (largura do conteúdo). Status: automático via `data-stepper` + CSS em `index.css` escopado a `[role='dialog']`, quando o stepper tem label irmão (direto ou do `FormField`). Ficam de fora grades sem label (séries do treino) e stepper em linha com botão (recalcular parcelas).

### 2.3 Modal de detalhe

- **[regra]** Clicar no card ou na linha (fora dos botões de ação) abre o modal de detalhe, somente leitura. Substitui o toggle "Ver detalhes".
- **[regra]** No rodapé, o botão **Fechar** com ícone (`X`) fica **à esquerda**. Outras ações (Editar, Excluir, Conversar com o agente) ficam à direita. Usar `<DialogCloseFooter>{ações}</DialogCloseFooter>`.

### 2.4 Modal de ação (aberto por botão do card)

- **[regra]** Segue a estrutura comum (header fixo com ícone + texto, sem subtítulo).
- **[regra]** Botões **Cancelar** e **Salvar** (ou o verbo da ação: Registrar, Confirmar, Depositar…) com ícones. Fluxos em etapas mantêm Cancelar em todas as etapas. Na tela final de resultado, o rodapé vira o de detalhe (Fechar à esquerda).
- **[regra]** Configuração e desbloqueio do cofre (módulo Segurança, `VaultGuard`) são modais de ação abertos sobre a página vazia, não cards no lugar da página. Rodapé com Cancelar + ação (Configurar / Desbloquear). Cancelar, Esc ou clique fora voltam à página anterior (ou ao Dashboard em acesso direto). A chave de recuperação abre um modal por cima do de desbloqueio.
- **[regra]** Onboarding em etapas (ex.: boas-vindas do Planejamento Pessoal) é um `Dialog` padrão: título da etapa no header com ícone, sem X, rodapé com Cancelar, Voltar (a partir da 2ª etapa) e Próximo/Começar, troca de etapa com `slideVariants`. Na tela de sucesso, o rodapé vira `DialogCloseFooter`.
- **[regra]** Fluxo de perguntas em etapas (ex.: avaliação de autoestima): rodapé com Cancelar, **Voltar** (`ChevronLeft`, a partir da 2ª etapa, mantendo as respostas) e Confirmar/Enviar. A troca de etapa usa deslize lateral (`slideVariants` de `lib/animations`, `custom` = direção: avança para a esquerda, volta para a direita), a mesma animação do `PaginatedSlide`.

### 2.5 Sem rolagem em desktop

- **[desktop]** Nenhum modal (formulário, detalhe ou ação) pode ter barra de rolagem, nem vertical nem horizontal. Isso inclui áreas roláveis internas (`overflow-y-auto`, `max-h-*`).
- **[desktop]** Quando o conteúdo não cabe:
  - **Formulário longo:** distribuir em colunas e alargar o modal (ex.: "Novo Livro" com duas colunas em `max-w-6xl`).
  - **Grupo fixo de opções** (checkboxes de eventos etc.): mais colunas.
  - **Lista de tamanho variável dentro do modal:** paginar com `PaginatedSlide` e `pinNav={false}`, com no máximo 5 itens por página (`LIST_PAGE_SIZE`). Itens de texto longo (resumos, destaques, opções de refeição com ingredientes) usam 3 por página. Lista editável em que o usuário adiciona itens (ingredientes da opção de cardápio, 3 por página por terem vários campos por linha) usa `PageSlide` controlado e pula para a última página ao adicionar. Grades de imagens usam até 8 (4 × 2).
  - **Fluxo longo:** etapas (um passo por vez), como no formulário de sessão de treino.
- **Exceções** (conteúdo que por natureza rola): transcrição de chat (aba Chat do livro), visualizador de documento/PDF (certificado de curso, pré-visualização de arquivo) e a paleta de comandos.
- **Status:** medido em 1024 px de altura (mais rigoroso que 1080) nos formulários de inclusão, detalhes de card/linha e modais de ação dos módulos Controle Financeiro, Intelecto e Planejamento Pessoal, todos sem rolagem. As telas do módulo Segurança não foram medidas (dependem do cofre desbloqueado).

## 3. Validação de formulários

- **[regra]** Mensagens de validação não aparecem abaixo do campo. Cada erro vai para um toast destrutivo.
- **[regra]** Campo com erro fica com borda vermelha, via `aria-invalid`. Os primitivos `Input`, `Textarea`, `Select`, `CurrencyInput`, `DatePicker`, `TimePicker`, `NumberStepper`, `DecimalInput`, `IconPicker` e `StarRating` já aceitam a prop e mostram a borda.
- **[regra]** Como aplicar:
  - `handleSubmit(onSubmit, notifyFormErrors)`, com `import { notifyFormErrors } from '@/lib/form-errors'`.
  - No campo: `aria-invalid={!!errors.campo}`. Em `FormField`, passar `error={errors.campo?.message}` basta para a borda.
  - Não renderizar `errors.campo.message` inline.
- **[regra]** Mensagens de erro de API (ex.: senha atual incorreta) continuam como texto no formulário. Não são validação de campo.
- **[regra]** Erro do servidor ligado a um campo: `setError` para a borda e toast com a mensagem.
- **[regra]** Formulário com validação manual (sem react-hook-form) mostra um toast por mensagem no submit.
- **[regra]** O botão Salvar não fica desabilitado por erro de validação. O clique mostra os toasts. Status: vale para dados pessoais e para o módulo Planejamento Pessoal; demais formulários a verificar.
- **[regra]** Campo de nova senha (perfil e cadastro): `PasswordField` + `FieldRow` de `components/user-profile/PasswordSection.tsx`. À direita ficam a força (`PasswordStrength`) e as regras (mín. 8, não só números, senhas iguais). No cadastro, o botão não é desabilitado: as regras viram `rules` do `Controller` e falhas vão para toast no envio (§3), e `warnCapsLock` mostra o aviso de Caps Lock do login (`hooks/use-caps-lock.ts`). O aviso de Caps Lock (login, cadastro, perfil, cofre) sempre reserva sua linha (`h-5` + `invisible` quando desligado) para não alterar a altura da tela.
- **[regra]** Campo obrigatório sem schema Zod usa `required`/`validate` com mensagem `t('common.fieldRequired', { field })` ("Nome: campo obrigatório"), para o toast dizer qual campo falta. Campo controlado fora do `register` (Select, DatePicker) é registrado com `register('campo', { validate })`.
- **Status:** aplicado nos 23 arquivos de formulário que tinham mensagem inline e em todo o módulo Planejamento Pessoal (Treino, Nutrição, Métricas Corporais, Blocos de Foco, Hidratação, Metas). A verificar: `Register.tsx` (usa `FormField` com `error` dentro de `Controller`, borda via `aria-invalid` direto no `Input`) e `PersonalDataSection.tsx` (validação manual).

## 4. Botões e ícones

- **[regra]** Todo botão com texto tem ícone **à esquerda** do texto, em todas as telas (inclusive login, cadastro e fluxos públicos). Setas de avanço ("Próximo", "Começar", "Confirmar") também ficam à esquerda. Botão com carregamento usa a prop `loading` do `Button` e esconde o ícone enquanto carrega (`{!isLoading && <Icone />}`), para o spinner ocupar o lugar dele. Exceções: gatilhos com cara de select (chevron à direita indica o dropdown), seletores segmentados de opção (ex.: Price/SAC) e itens de lista com avatar. Glifos de texto (✓ ✗ —) não servem de ícone: use o ícone do lucide com `aria-label`.
- **[regra]** Botão principal usa a variante padrão do `Button`, sem degradê nem cor de texto própria (`gradient-primary`, `text-white`, `font-semibold`). Vale também para as telas públicas (login, cadastro, esqueci/redefinir senha, verificação de e-mail).
- **[regra]** Botão só com ícone tem tooltip do app (`tooltipSide`) e `aria-label`.
- **[regra]** Botões de um mesmo grupo têm o mesmo estilo, tamanho e largura.
- **[regra]** Botões de ação ficam visíveis sem depender de hover.
- **[regra]** A ação do cabeçalho muda conforme a aba ativa e fica na linha do header, acima das abas (ex.: "Nova Tarefa" / "Novo Bloco"). O mesmo vale para outros controles de contexto (cards de progresso, calendário, toggle de visualização): ficam na linha do título da página, não numa linha própria entre o título e as abas. Status: aplicado em Checklist Diário.
- **[regra]** Títulos de abas, páginas e modais têm ícone à esquerda.
- **[regra]** Em cards de grade (mais de um por linha), os botões de ação ficam num rodapé próprio (`border-t`), agrupados e alinhados à direita (`justify-end`), sem dividir a linha com badge de status ou outro conteúdo. Com mais de ~3 ações, as secundárias vão para um menu "...", para o rodapé manter a mesma altura em todo card. Não vale para listas de uma linha por registro. Status: aplicado em Empréstimos, Contas a Pagar, Contas a Receber, Livros, Metas e Planos de Treino (badge ao lado do título; em Metas, Editar/Excluir no rodapé e Recalcular, Registrar falha e Reiniciar no menu "..."). A aplicar em Cursos.
- **[pontual]** Sem ícone duplicado no botão. Botão de salvar só com ícone quando indicado. Sem botões "Gerar com IA".
- **[pontual]** Botão de revelar senha ou documento é só ícone, com tooltip.

## 5. Cards, listas e empty states

- **[regra]** Empty state: sem botão, sem texto abaixo do ícone e do rótulo, centralizado na horizontal e na vertical. Usar o componente `EmptyState`.
- **[regra]** Cards de registro não têm contorno colorido (faixa lateral/superior por status, categoria, tipo ou prioridade, nem borda colorida de "ativo") e não têm efeito de hover (movimento, escala, sombra, troca de fundo ou borda). Borda sempre neutra (`border-border`). Cor por status fica só dentro do card (badge, barra de progresso, valores). Vale também para o `StatCard` (`accentColor` colore só o ícone e o valor) e para seções como as do Planejador Mensal. Destaques de leitura mantêm só o fundo na cor escolhida. Cards de refeição (Nutrição) são neutros: o período colore só o ícone e o rótulo, e o status (registrada/atrasada) fica no ícone e no ponto da timeline. O card do dia no Planejamento Semanal é neutro: "Hoje" é um badge no header. Colunas do Kanban são neutras (`bg-muted/30`, borda `border-border`), com a cor do status só na bolinha do header. O fundo do card e das linhas de tarefa não muda com o progresso ou a conclusão (sempre `bg-card`). Status: ainda há sombras em alguns arquivos.
- **[regra]** Telas de registros e listas não têm cards de resumo (StatCard ou faixa de totais). Começam direto em filtro + lista. Resumos ficam só em dashboards e análises (Dashboard, Painel de Segurança, Intelecto Hoje, Jornada, Patrimônio, Quitação de Dívidas, Planejador Mensal). Em Compras do Cartão, o seletor Faturas/Lista é o primeiro campo do filtro; no modo Faturas cada fatura é só o `DataTable`; o select de fatura tem "Parcelas sem fatura" (só quando há parcelas órfãs) em vez de "Todas as faturas".
- **[regra]** Conteúdo do card de grade: ícone/avatar + título (+ no máximo 1 linha secundária) + no máximo 1 métrica em destaque + 1 badge de status. O resto vai para o modal de detalhe. Todo card de grade com conteúdo além disso tem modal de detalhe (ver [2.3](#23-modal-de-detalhe)). Status: aplicado em Empréstimos, Contas a Pagar, Contas a Receber, Metas (anel de progresso como métrica; valores e dias ativos no detalhe), Planos de Treino (dias · exercícios como métrica; descrição no modal do plano) e Reflexões (texto em 3 linhas; texto completo no detalhe). A aplicar em Cofres, Editoras, Arquivos, Autores, Membros, Contas, Metas Financeiras, Orçamentos, Cartões Guardados e Contas Guardadas.
- **[regra]** Texto nunca encosta na borda do card. Conteúdo centralizado na vertical.
- **[regra]** Cards alinhados em linha e com o mesmo tamanho. Rótulos não mudam de posição.
- **[regra]** Toggles em accordion: o primeiro aberto por padrão, os demais recolhidos, só um aberto por vez. Toggles de detalhe começam recolhidos (`Collapse`).
- **[pontual]** Cards redundantes ou que só funcionam como hiperlink são removidos.
- **[regra]** Data em card de registro é texto dd/mm/aaaa (`formatDate`), não bloco com dia em cima e mês embaixo. Ex.: card de sessão de treino, com a data num chip `bg-primary/10` à esquerda.
- **[pontual]** Linha de métricas/chips abaixo do título do card de sessão de treino fica centralizada na horizontal. O card usa `p-sm` e `mt-xs` entre título e chips, para 5 sessões caberem em 880 px de altura.
- **[pontual]** Card de intervenção (Bem-Estar Emocional): linha 1 com categoria, duração, dificuldade e título à esquerda, benefício esperado centralizado no card e botão de ação à direita (`grid-cols-[1fr_auto_1fr]` a partir de `sm`); linha 2 só com a descrição. Assim 5 cards cabem na página sem rolagem. Sem rodapé com borda.

## 6. Paginação e filtros

- **[regra]** Um único componente de paginação (`PaginatedSlide` / `PageSlide`), com mesma posição, ícones e animação em todas as telas.
- **[regra]** Registros por página:
  - **Lista vertical de cards** (um card por linha) e **`DataTable`**: **no máximo 5** (`LIST_PAGE_SIZE`). É o padrão do `DataTable`.
  - **Grade de cards** (mais de um por linha): `GRID_PAGE_SIZE = 12`, em 2/3/4 colunas para as linhas fecharem (ex.: Alimentos em `lg:grid-cols-4`).
  - Listas de uma linha por registro (Tags, Webhooks etc.) ainda não têm regra própria.
- **[desktop]** Telas com lista vertical de cards (um por linha) ou com `DataTable` não têm barra de rolagem: 5 registros por página cabem na viewport. Status: Reflexões, Sessões de Treino, Planejamento Semanal, Checklist Diário, Jornada e Diário Alimentar medidos em 880 px em 13/10/2026; os demais medidos em 1024 px de altura em Reflexões, Sessões de Treino, Regras de Automação, Check-in, Autoestima, Tarefas Rotineiras, Checklist Diário, Despesas, Receitas, Compras do Cartão, Transferências, Gastos/Receitas Fixas, Faturas, Livros e Flashcards, todas sem rolagem.
- **[regra]** Nenhuma tela tem rolagem de página.
- **[regra]** `PaginatedSlide` dentro de gráficos (cards de dashboard e análise) e dentro de modais usa `pinNav={false}`. Com o padrão `pinNav`, a classe `page-fill` estica os ancestrais até o `<main>`.
- **[regra]** Telas com filtro e busca usam `FilterBar` + `SearchInput`, como no Controle Financeiro.
- **[regra]** Filtros ocupam toda a largura, com rótulo acima de cada um: cada campo do `FilterBar` vai dentro de `<FilterField label=...>` (rótulo `text-xs` centralizado, campos alinhados pela base; botões como "Favoritos" sem rótulo). Rótulos genéricos em `common.filterLabels.*` / `common.fields.*`.

## 7. Tabelas

- **[regra]** Coluna de ações usa a prop `actions` do `DataTable`, nunca uma coluna customizada (colunas sem largura fixa esticam e deixam os botões soltos).
- **[regra]** O cabeçalho "Ações" e os botões de cada linha ficam centralizados.
- **[regra]** Tabelas dentro de telas com mais de um nível de abas usam `density="compact"`, para não passar da viewport. Status: aplicado em Tarefas Rotineiras.

## 8. Animação

- **[regra]** Animações visíveis mas leves, usando só `opacity` e `transform`: abas, páginas, toggles, modais, troca de filtros e carregamentos. Usar os tokens `duration-*`. Status: ainda há ~11 durações fixas no Framer Motion e 6 usos de `transition-all`.
- **[regra]** A transição de paginação é a da tela de Tarefas Rotineiras (referência).
- **[regra]** Animações indesejadas são removidas (ex.: giro de número em contador, tela piscando).
- **[pontual]** Animação na troca entre senha e 2FA, ao abrir campos de data e horário e ao ocultar o widget do agente.

## 9. Tema, cores e tipografia

- **[regra]** Nenhuma cor fixa. Usar variáveis de cor do tema, em claro e escuro. Status: ainda há `slate`, `black` e `white` em cerca de 14 arquivos.
- **[regra]** Cores de ícones são globais, não exclusivas de um módulo. Mapeamentos: chama/calorias `text-warning`; hidratação `text-info`; período da refeição: manhã `text-warning`, almoço/tarde `text-category-nutrition`, noite `text-info`.
- **[regra]** Medalhas (Jornada) usam os tokens `--medal-bronze`, `--medal-silver` e `--medal-gold` (`bg-medal-*/15 text-medal-* border-medal-*/40`), definidos em `index.css` para claro (`:root`) e escuro (`.dark`).
- **[regra]** A scrollbar (onde permitida) segue o estilo do app e as variáveis de cor do tema.
- **[pontual]** Cards parecidos usam a mesma espessura de fonte.

## 10. Tooltips

- **[regra]** Tooltip só em botões de ícone. Botões com texto não têm tooltip.
- **[regra]** Tooltip não fica oculto nem sai da tela, inclusive nos gráficos Recharts.
- **[regra]** Gráficos de pizza não escrevem o percentual sobre as fatias; o valor aparece só no tooltip.
- **[pontual]** O mapa de consistência de hábitos (`HabitHeatmap`) não tem botão de expandir.
- **[regra]** Tooltips do menu superior aparecem abaixo do botão.

## 11. Textos, formatação e tradução

- **[regra]** Títulos de tela sem subtítulo (`PageHeader` sem `subtitle`).
- **[regra]** Todo texto passa pelo sistema de tradução. Status: parcial (ex.: "Command Palette").
- **[regra]** Toasts padronizados, sem linha técnica. Status: parcial.
- **[regra]** Moeda em BRL com vírgula e duas casas: `R$ 0,00`.
- **[regra]** Datas em dd/mm/aaaa. Intervalos no formato "28/09 - 04/10/2026".
- **[regra]** Telefone no formato "+DDD (DDI) número". Documento formatado do mesmo jeito.
- **[regra]** Todo rótulo de campo tem ícone à esquerda (formulários, filtros, checkbox/radio): `<Label className="gap-xs flex items-center">` + ícone `text-muted-foreground h-3.5 w-3.5`. `FormField` e `FilterField` exigem a prop `icon`. Mesmo campo, mesmo ícone: valor/conta `Wallet`, data `CalendarDays`, hora `Clock`, categoria `Tag`, descrição/observações `FileText`, vínculo `Link2`, status `CheckCircle2`, número `Hash`, taxa `Percent`, senha `Lock`, usuário `AtSign`, e-mail `Mail`, telefone `Phone`, documento `IdCard`, busca `Search`. Ficam de fora itens de lista selecionáveis (linhas com checkbox, chips de dia da semana), onde o conteúdo da linha é o rótulo.
- **[regra]** Todo campo tem placeholder curto (até 3 palavras, sem reticências): texto livre como exemplo `Ex.: Netflix` (`e.g.` em inglês); máscara/formato quando houver (`000.000.000-00`, `nome@email.com`, `https://exemplo.com`, `••••••••`); select `Selecione`; data `dd/mm/aaaa`; hora `hh:mm`; número `0`; moeda `0,00`; busca `Buscar <coisa>`. Defaults já vêm dos primitivos (`SelectValue`, `DatePicker`, `TimePicker`, `NumberStepper`, `DecimalInput`, `CurrencyInput`, `SearchInput`, `PasswordField`). Placeholders genéricos ficam em `common.placeholders.*`. Filtros de "todos" (`Todas as categorias`) continuam como estão.
- **[pontual]** Decimais pt-BR com uma casa. Plural correto de unidades de medida. Hora sem segundos. "Todo o período" vira "Tudo".

## 12. Layout

- **[regra]** Calendário e seletor de horário abrem por cima da tela, sem expandi-la.
- **[regra]** Datas futuras desabilitadas no próprio calendário.
- **[regra]** Conteúdo centralizado na vertical entre componentes (filtro e paginação, abas e paginação, dentro de cards).
- **[pontual]** Tour guiado no estilo do tour do módulo Segurança, em todas as telas: exibido no primeiro acesso, ocultável por checkbox, com botão na sidebar.

## 13. Navegação

- **[regra]** O breadcrumb nunca fica vazio nem parcial: toda rota resolve módulo > submódulo > página, e cada nível (exceto a página atual) é clicável. `use-breadcrumb.ts` deriva os níveis do `nav-config.ts` (mesma fonte da Sidebar).
- **[regra]** Toda tela com abas tem uma rota por aba, refletida na URL (ex.: `/transactions/expenses`), nunca só em estado local ou `localStorage`. Nomes de rota em inglês. A rota "pai" redireciona para a aba padrão (hook `useTabRoute`). Alternâncias que só filtram a mesma lista (ex.: Flashcards "Todos / Vencem hoje") são filtro, não aba.
- **[regra]** Cada tela e cada aba tem `PageHeader` próprio com ícone e título da aba (o mesmo do gatilho da aba e do breadcrumb). Vale também para Agents e Meu Perfil.
- **[regra]** O painel admin usa o mesmo `Breadcrumb` na barra superior (`Painel admin › Página`), com os itens por prop.
- **[regra]** Rota sem link na interface é removida, não mantida órfã.
