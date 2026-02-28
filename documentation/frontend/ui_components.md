# Componentes UI

## Visão Geral

O MindLedger utiliza **shadcn/ui** como base para seus componentes de interface, construídos sobre **Radix UI** (componentes headless acessíveis) e estilizados com **TailwindCSS**.

## Filosofia

- **Composição sobre configuração:** Componentes são altamente compostos
- **Acessibilidade primeiro:** Radix UI garante ARIA, keyboard navigation, focus management
- **Customizável:** Você possui o código dos componentes (não é uma biblioteca npm)
- **Consistente:** Tema centralizado com variáveis CSS

## Estrutura dos Componentes UI

```
src/components/ui/
├── alert-dialog.tsx      # Diálogos de confirmação
├── badge.tsx             # Badges de status
├── button.tsx            # Botões com variantes
├── card.tsx              # Cards de conteúdo
├── checkbox.tsx          # Checkboxes
├── date-picker.tsx       # Seletor de datas
├── dialog.tsx            # Modais
├── input.tsx             # Campos de texto
├── label.tsx             # Labels de formulário
├── popover.tsx           # Popovers
├── progress.tsx          # Barras de progresso
├── radio-group.tsx       # Radio buttons
├── scroll-area.tsx       # Área com scroll customizado
├── select.tsx            # Dropdowns/selects
├── skeleton.tsx          # Loading skeletons
├── table.tsx             # Tabelas
├── textarea.tsx          # Campos de texto multi-linha
├── toast.tsx             # Notificações toast
└── toaster.tsx           # Container de toasts
```

## Componentes Principais

### 1. Button

Botão versátil com múltiplas variantes e tamanhos.

**Variantes disponíveis:**
- `default` - Botão primário (roxo)
- `destructive` - Ações destrutivas (vermelho)
- `outline` - Botão com borda
- `secondary` - Botão secundário (cinza)
- `ghost` - Botão transparente
- `link` - Botão estilo link

**Tamanhos:**
- `default` - Tamanho padrão
- `sm` - Pequeno
- `lg` - Grande
- `icon` - Botão quadrado para ícones

**Exemplos:**

```tsx
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

// Botão primário
<Button>Salvar</Button>

// Botão com ícone
<Button size="icon" variant="ghost">
  <Plus className="h-4 w-4" />
</Button>

// Botão destrutivo
<Button variant="destructive">
  <Trash2 className="mr-2 h-4 w-4" />
  Excluir
</Button>

// Botão outline pequeno
<Button variant="outline" size="sm">
  Cancelar
</Button>

// Botão desabilitado
<Button disabled>
  Processando...
</Button>
```

### 2. Input

Campo de entrada de texto com suporte a ícones e estados.

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="seu@email.com"
  />
</div>
```

### 3. Select

Dropdown customizado acessível.

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

<Select onValueChange={setValue}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Selecione..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Opção 1</SelectItem>
    <SelectItem value="option2">Opção 2</SelectItem>
    <SelectItem value="option3">Opção 3</SelectItem>
  </SelectContent>
</Select>
```

### 4. Dialog (Modal)

Modal acessível com animações suaves.

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Abrir Modal</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título do Modal</DialogTitle>
      <DialogDescription>
        Descrição do conteúdo do modal
      </DialogDescription>
    </DialogHeader>
    {/* Conteúdo do modal */}
  </DialogContent>
</Dialog>
```

### 5. Alert Dialog

Dialog de confirmação para ações críticas.

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Excluir</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta ação não pode ser desfeita. O registro será permanentemente excluído.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>
        Confirmar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 6. Card

Container para conteúdo agrupado.

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Título do Card</CardTitle>
    <CardDescription>Descrição opcional</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Conteúdo principal */}
  </CardContent>
  <CardFooter>
    {/* Rodapé com ações */}
  </CardFooter>
</Card>
```

### 7. Table

Tabela estilizada e responsiva.

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nome</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.email}</TableCell>
        <TableCell>
          <Badge>{item.status}</Badge>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### 8. Toast (Notificações)

Sistema de notificações temporárias.

```tsx
import { useToast } from '@/components/ui/use-toast';

function MyComponent() {
  const { toast } = useToast();

  const showNotification = () => {
    toast({
      title: 'Sucesso!',
      description: 'Operação realizada com sucesso.',
      variant: 'default', // ou 'destructive'
    });
  };

  return <Button onClick={showNotification}>Mostrar Toast</Button>;
}
```

**No App.tsx:**
```tsx
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <>
      {/* Seu app */}
      <Toaster />
    </>
  );
}
```

### 9. Badge

Pequenos indicadores de status.

```tsx
import { Badge } from '@/components/ui/badge';

<Badge>Novo</Badge>
<Badge variant="secondary">Processando</Badge>
<Badge variant="destructive">Erro</Badge>
<Badge variant="outline">Rascunho</Badge>
```

### 10. Date Picker

Seletor de datas baseado no react-day-picker.

```tsx
import { DatePicker } from '@/components/ui/date-picker';

<DatePicker
  date={selectedDate}
  onDateChange={setSelectedDate}
  placeholder="Selecione uma data"
/>
```

### 11. Checkbox

Checkbox acessível.

```tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

<div className="flex items-center space-x-2">
  <Checkbox
    id="terms"
    checked={accepted}
    onCheckedChange={setAccepted}
  />
  <Label htmlFor="terms">
    Aceito os termos e condições
  </Label>
</div>
```

### 12. Radio Group

Grupo de radio buttons.

```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

<RadioGroup value={value} onValueChange={setValue}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="option1" />
    <Label htmlFor="option1">Opção 1</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option2" id="option2" />
    <Label htmlFor="option2">Opção 2</Label>
  </div>
</RadioGroup>
```

### 13. Skeleton

Loading placeholder animado.

```tsx
import { Skeleton } from '@/components/ui/skeleton';

<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
  <Skeleton className="h-4 w-[150px]" />
</div>
```

### 14. Progress

Barra de progresso.

```tsx
import { Progress } from '@/components/ui/progress';

<Progress value={60} className="w-full" />
```

### 15. Popover

Tooltip ou popover com conteúdo rico.

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Abrir</Button>
  </PopoverTrigger>
  <PopoverContent>
    <div className="space-y-2">
      <h4 className="font-medium">Título</h4>
      <p className="text-sm text-muted-foreground">
        Conteúdo do popover
      </p>
    </div>
  </PopoverContent>
</Popover>
```

## Radix UI Primitives

Todos os componentes são construídos sobre Radix UI primitives, garantindo:

### Acessibilidade (a11y)
- ✅ **ARIA attributes** corretos
- ✅ **Keyboard navigation** (Tab, Enter, Escape, Arrow keys)
- ✅ **Focus management** inteligente
- ✅ **Screen reader** friendly

### Composição
```tsx
// Radix permite composição flexível
<Dialog>
  <DialogTrigger />
  <DialogContent>
    <DialogHeader>
      <DialogTitle />
      <DialogDescription />
    </DialogHeader>
    {/* Seu conteúdo customizado */}
  </DialogContent>
</Dialog>
```

### Portal
Componentes como Dialog, Popover e Toast usam **Portals** do React para renderizar fora da hierarquia DOM, evitando problemas de z-index e overflow.

## Tema e Customização

### Variáveis CSS

O tema é definido em `src/styles/globals.css` usando CSS variables:

```css
:root {
  --background: 282a36;           /* Dracula background */
  --foreground: 248 248 242;      /* Dracula foreground */
  --primary: 189 147 249;         /* Dracula purple */
  --secondary: 98 114 164;        /* Dracula comment */
  --destructive: 255 85 85;       /* Dracula red */
  --success: 80 250 123;          /* Dracula green */
  /* ... */
}
```

### Personalizando Componentes

Você pode sobrescrever estilos usando TailwindCSS:

```tsx
// Usando className
<Button className="bg-gradient-to-r from-purple-500 to-pink-500">
  Botão Gradient
</Button>

// Combinando variantes
<Card className="border-2 border-primary shadow-xl">
  {/* Conteúdo */}
</Card>
```

### Criando Variantes Customizadas

Use `class-variance-authority` (CVA) para criar novas variantes:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "bg-primary text-white",
        outline: "border border-input",
        ghost: "hover:bg-accent",
        // Adicione sua variante
        custom: "bg-gradient-to-r from-purple-500 to-pink-500",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
  }
);
```

## Animações

Componentes incluem animações suaves definidas no `tailwind.config.js`:

```javascript
animation: {
  'dialog-overlay-show': 'dialog-overlay-show 150ms cubic-bezier(0.16, 1, 0.3, 1)',
  'dialog-content-show': 'dialog-content-show 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  'slide-up-fade': 'slide-up-fade 300ms cubic-bezier(0.16, 1, 0.3, 1)',
  'bounce-in': 'bounce-in 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}
```

## Boas Práticas

### 1. Use asChild para Composição

```tsx
// ✅ Bom - preserva semântica HTML
<Button asChild>
  <Link to="/dashboard">Dashboard</Link>
</Button>

// ❌ Ruim - cria wrapper desnecessário
<Button>
  <Link to="/dashboard">Dashboard</Link>
</Button>
```

### 2. Extraia Lógica Complexa

```tsx
// ✅ Bom - componente customizado reutilizável
function DeleteButton({ onDelete, itemName }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Excluir</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Deseja excluir "{itemName}"?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 3. Consistência Visual

```tsx
// ✅ Bom - use as mesmas classes para consistência
<Card className="hover:shadow-lg transition-shadow">
  {/* ... */}
</Card>

<Card className="hover:shadow-lg transition-shadow">
  {/* ... */}
</Card>
```

### 4. Acessibilidade

```tsx
// ✅ Sempre associe Label com Input
<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</div>

// ✅ Use aria-label quando não há Label visível
<Button aria-label="Fechar modal">
  <X className="h-4 w-4" />
</Button>
```

## Recursos Adicionais

- **shadcn/ui Docs:** https://ui.shadcn.com/
- **Radix UI Docs:** https://www.radix-ui.com/
- **TailwindCSS Docs:** https://tailwindcss.com/
- **Lucide Icons:** https://lucide.dev/

## Próximos Passos

- **Estilização:** Veja [estilizacao.md](./estilizacao.md) para detalhes sobre o tema Dracula
- **Roteamento:** Veja [roteamento.md](./roteamento.md) para integração com rotas
