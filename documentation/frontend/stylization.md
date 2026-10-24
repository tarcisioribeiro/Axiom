# Estilização

## Visão Geral

O Axiom utiliza **TailwindCSS** como framework CSS principal, com um sistema de temas via **variáveis CSS**: um tema **escuro** e um **claro**, cada um com múltiplas variantes de cor selecionáveis pelo usuário (`ThemeToggle`).

## Stack de Estilização

- **TailwindCSS 4** - Utility-first CSS framework
- **Sistema de temas (claro/escuro + variantes)** - ver seção "Temas" abaixo
- **CSS Variables** - Tema dinâmico e customizável
- **PostCSS** - Processamento CSS
- **Autoprefixer** - Compatibilidade cross-browser

## Estrutura de Estilos

```
apps/web/
├── src/
│   ├── styles/
│   │   └── globals.css        # Estilos globais + variáveis CSS
│   ├── index.css               # Entry point de estilos
│   └── components/
│       └── ui/                 # Componentes estilizados
├── tailwind.config.js          # Configuração do Tailwind
└── postcss.config.js           # Configuração do PostCSS
```

## Temas

O tema base é controlado por `hooks/use-theme.ts` (`isDark`/`theme: 'dark' | 'light'`), e cada modo tem múltiplas **variantes de cor** selecionadas via atributo no `<html>`:

- **Escuro** (`.dark[data-dark-theme='...']`): `dracula` (padrão), `catppuccin-mocha`, `tokyo-night`, `gruvbox-dark`, `everforest`, `ubuntu`, `mint-dark`.
- **Claro** (`:root[data-light-theme='...']`): `alucard` (padrão), `catppuccin-latte`, `everforest-light`, `gruvbox-light`, `tokyo-day`, `ubuntu-light`, `mint-light`.

O `ThemeToggle` (`components/common/ThemeToggle.tsx`) alterna claro/escuro e permite escolher a variante; as opções/labels ficam em `components/common/theme-options.ts`. Cada variante define o mesmo conjunto de variáveis CSS (`--background`, `--primary`, etc.) em `index.css`, então componentes nunca hardcodeiam cor — sempre usam as variáveis via classes Tailwind (`bg-primary`, `text-foreground`...).

A paleta abaixo (Dracula) é só a variante escura padrão — não hardcode esses hex em componentes.

### Paleta de Cores (variante padrão — Dracula)

```css
/* Dracula Official Color Palette */
:root {
  /* Background colors */
  --background: 282a36;           /* #282a36 - Background */
  --foreground: 248 248 242;      /* #f8f8f2 - Foreground */

  /* Dracula colors */
  --primary: 189 147 249;         /* #bd93f9 - Purple */
  --secondary: 98 114 164;        /* #6272a4 - Comment */
  --accent: 255 121 198;          /* #ff79c6 - Pink */

  /* Status colors */
  --success: 80 250 123;          /* #50fa7b - Green */
  --warning: 241 250 140;         /* #f1fa8c - Yellow */
  --destructive: 255 85 85;       /* #ff5555 - Red */
  --info: 139 233 253;            /* #8be9fd - Cyan */

  /* Additional colors */
  --orange: 255 184 108;          /* #ffb86c - Orange */

  /* UI colors */
  --card: 68 71 90;               /* #44475a - Current Line */
  --border: 98 114 164;           /* #6272a4 - Comment */
  --input: 68 71 90;              /* #44475a */
  --ring: 189 147 249;            /* #bd93f9 - Purple */

  /* Text colors */
  --muted: 98 114 164;            /* #6272a4 - Comment */
  --muted-foreground: 248 248 242; /* #f8f8f2 */

  /* Specific UI elements */
  --popover: 40 42 54;            /* #282a36 */
  --popover-foreground: 248 248 242; /* #f8f8f2 */
}
```

### Cores em Uso

| Cor | Hex | RGB (HSL) | Uso |
|-----|-----|-----------|-----|
| Purple | `#bd93f9` | `189 147 249` | Primária, links, botões principais |
| Pink | `#ff79c6` | `255 121 198` | Accent, highlights |
| Green | `#50fa7b` | `80 250 123` | Sucesso, positivo |
| Red | `#ff5555` | `255 85 85` | Erro, destrutivo |
| Yellow | `#f1fa8c` | `241 250 140` | Avisos, alertas |
| Cyan | `#8be9fd` | `139 233 253` | Info, links secundários |
| Orange | `#ffb86c` | `255 184 108` | Destaque secundário |
| Comment | `#6272a4` | `98 114 164` | Texto secundário, bordas |

## globals.css

### Estrutura

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* CSS Variables */
@layer base {
  :root {
    /* Variáveis de cor (formato HSL sem hsl()) */
    --background: 282a36;
    --foreground: 248 248 242;
    --primary: 189 147 249;
    /* ... */

    /* Border radius */
    --radius: 0.5rem;
  }
}

/* Estilos base */
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}

/* Scrollbar customizada */
@layer utilities {
  /* Webkit browsers (Chrome, Safari) */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    @apply bg-background;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-muted rounded-full;
  }

  ::-webkit-scrollbar-thumb:hover {
    @apply bg-primary;
  }
}
```

## tailwind.config.js

### Configuração Completa

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Fonte
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      // Cores usando variáveis CSS
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        // ... outras cores
      },

      // Border radius
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // Tokens de espaçamento semântico (ver seção "Espaçamento Semântico")
      spacing: {
        xs: 'var(--spacing-xs)',  // 4px
        sm: 'var(--spacing-sm)',  // 8px
        md: 'var(--spacing-md)',  // 16px
        lg: 'var(--spacing-lg)',  // 24px
        xl: 'var(--spacing-xl)',  // 32px
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    // variante customizada `hoverable:` — @media (hover: hover) and (pointer: fine),
    // para gatear hover:scale/translate/etc. em telas de toque
    function ({ addVariant }) {
      addVariant('hoverable', '@media (hover: hover) and (pointer: fine)');
    },
  ],
}
```

As keyframes/animations (`animate-fade-in/out`, `animate-pop-in/out`, etc.) são definidas em `index.css` usando só os tokens de duração/easing — ver "Animações" abaixo.

## Usando TailwindCSS

### Utility Classes Básicas

```tsx
// Layout
<div className="flex items-center justify-between">
<div className="grid grid-cols-3 gap-4">
<div className="container mx-auto px-4">

// Spacing
<div className="p-4">      {/* padding: 1rem */}
<div className="mt-6">     {/* margin-top: 1.5rem */}
<div className="space-y-4"> {/* gap vertical entre filhos */}

// Typography
<h1 className="text-2xl font-bold">
<p className="text-muted-foreground text-sm">

// Colors
<div className="bg-primary text-primary-foreground">
<div className="border border-border">
<div className="text-destructive">

// Effects
<button className="hover:bg-accent transition-colors">
<div className="shadow-lg rounded-lg">
```

### Responsive Design

```tsx
// Mobile-first approach
<div className="
  w-full           // 100% width em mobile
  md:w-1/2         // 50% width em tablet (≥768px)
  lg:w-1/3         // 33.33% width em desktop (≥1024px)
">

// Grid responsivo
<div className="
  grid
  grid-cols-1      // 1 coluna em mobile
  md:grid-cols-2   // 2 colunas em tablet
  lg:grid-cols-3   // 3 colunas em desktop
  gap-4
">
```

### Estados Interativos

```tsx
// Hover, focus, active
<button className="
  bg-primary
  hover:bg-primary/90
  focus:ring-2 focus:ring-ring
  active:scale-95
  transition-all
">

// Claro/escuro: a classe `dark` no <html> já troca as variáveis CSS —
// normalmente não é preciso usar o variant dark: do Tailwind
<div className="bg-background">
```

### Composição com clsx/cn

Use a função `cn` para composição condicional:

```tsx
import { cn } from '@/lib/utils';

function Button({ variant, className, ...props }) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-lg transition-colors",
        variant === "primary" && "bg-primary text-white",
        variant === "secondary" && "bg-secondary text-foreground",
        className
      )}
      {...props}
    />
  );
}

// Uso
<Button variant="primary" className="mt-4">Salvar</Button>
```

## Componentes Estilizados

### Card Pattern

```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Conteúdo */}
  </CardContent>
  <CardFooter>
    <Button>Ação</Button>
  </CardFooter>
</Card>
```

**Renderiza:**
```html
<div class="rounded-lg border bg-card text-card-foreground shadow-sm">
  <div class="flex flex-col space-y-1.5 p-6">
    <h3 class="text-2xl font-semibold">Título</h3>
    <p class="text-sm text-muted-foreground">Descrição</p>
  </div>
  <div class="p-6 pt-0">
    <!-- Conteúdo -->
  </div>
  <div class="flex items-center p-6 pt-0">
    <button>Ação</button>
  </div>
</div>
```

### Button Variants

```tsx
// Primary (padrão)
<Button>Salvar</Button>

// Destructive
<Button variant="destructive">Excluir</Button>

// Outline
<Button variant="outline">Cancelar</Button>

// Ghost (transparente)
<Button variant="ghost">
  <Settings className="h-4 w-4" />
</Button>
```

## Animações

**Regra do projeto:** apenas `opacity`/`transform`, e só os tokens de duração/easing abaixo — nunca uma duração ou curva ad-hoc.

| Token | Valor | Uso |
|---|---|---|
| `fast` | 150ms | hover, clique, saídas |
| `normal` | 220ms | modal, popover, página, aba, expandir |
| `medium` | 350ms | layout (ex.: largura da sidebar) |
| `slow` | 600ms | decorativo (ex.: barra de progresso) |

Easing: `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) para a maioria; `--ease-in-out` para casos simétricos.

### Transições CSS

```tsx
// transition-* "cru" já usa fast + ease-out
<div className="transition-colors hover:bg-accent">

// Para outro token, use duration-{normal|medium|slow}
<div className="transition-all duration-normal">

// Entradas/saídas: classes prontas (ver index.css)
<div className="animate-fade-in" />           // ou animate-fade-out
<div className="animate-pop-in" />             // ou animate-pop-out
// Radix: data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out
```

### Framer Motion

`MotionConfig` em `App.tsx` já define `transitions.normal` como padrão global — um `motion.*` sem a prop `transition` já sai com 220ms + ease-out:

```tsx
import { motion } from 'framer-motion';
import { transitions } from '@/lib/animations/transitions';

// ✅ usa o default global (normal) — omita `transition`
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
  {/* Conteúdo */}
</motion.div>

// Micro-interação: use transitions.fast explicitamente
<motion.button whileTap={{ scale: 0.96 }} transition={transitions.fast} />
```

Toggle de "ver detalhes" (`<Collapse open={x}>`, de `components/ui/collapsible-section.tsx`) em vez de `{x && <div>...</div>}` cru.

## Ícones (Lucide React)

```tsx
import {
  Home,
  Settings,
  User,
  Trash2,
  Edit,
  Plus,
  X,
} from 'lucide-react';

// Uso básico
<Home className="h-5 w-5" />

// Com cor
<Settings className="h-5 w-5 text-primary" />

// Em botão
<Button size="icon">
  <Plus className="h-4 w-4" />
</Button>

// Com animação
<Loader2 className="h-6 w-6 animate-spin" />
```

## Layout Patterns

### Container Centralizado

```tsx
<div className="container mx-auto px-4 py-8">
  {/* Conteúdo centralizado com max-width */}
</div>
```

### Flex Layout

```tsx
// Horizontal
<div className="flex items-center justify-between gap-4">
  <span>Esquerda</span>
  <span>Direita</span>
</div>

// Vertical
<div className="flex flex-col space-y-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Grid Layout

```tsx
// Grid automático
<div className="grid grid-cols-auto-fit gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>

// Grid fixo
<div className="grid grid-cols-3 gap-6">
  <div>Col 1</div>
  <div>Col 2</div>
  <div>Col 3</div>
</div>
```

### Sidebar Layout

```tsx
<div className="flex h-screen">
  {/* Sidebar */}
  <aside className="w-64 bg-card border-r">
    <nav>...</nav>
  </aside>

  {/* Main content */}
  <main className="flex-1 overflow-y-auto p-6">
    {children}
  </main>
</div>
```

## Formulários

```tsx
<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input
      id="email"
      type="email"
      placeholder="seu@email.com"
      className="w-full"
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="password">Senha</Label>
    <Input
      id="password"
      type="password"
      className="w-full"
    />
  </div>

  <Button type="submit" className="w-full">
    Entrar
  </Button>
</div>
```

## Estilos Customizados

### Quando usar CSS tradicional

Use CSS/SCSS apenas quando:
- Animações muito complexas que Tailwind não suporta
- Estilos específicos de terceiros que precisam ser sobrescritos
- Pseudo-elementos complexos

```css
/* styles/custom.css */
.custom-animation {
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
```

## Boas Práticas

### 1. Use variáveis CSS para cores

```tsx
// ✅ Bom - usa variável do tema
<div className="bg-primary text-primary-foreground">

// ❌ Ruim - hardcoded
<div className="bg-purple-500 text-white">
```

### 2. Componha classes com cn()

```tsx
// ✅ Bom
className={cn("base-classes", condition && "conditional-classes", className)}

// ❌ Ruim - string concatenation
className={`base-classes ${condition ? 'conditional' : ''} ${className}`}
```

### 3. Espaçamento semântico, não numérico

`index.css` define `--spacing-{xs,sm,md,lg,xl}`, mapeados em `tailwind.config.js` — prefira essas classes à escala numérica do Tailwind:

```tsx
// ✅ Bom - espaçamento semântico
<div className="space-y-md">  {/* 16px */}
<div className="p-lg">        {/* 24px */}

// ❌ Ruim - escala numérica ou valores arbitrários
<div className="space-y-4">
<div className="space-y-[17px]">
```

### 4. Mobile-first

```tsx
// ✅ Bom - mobile first
<div className="text-sm md:text-base lg:text-lg">

// ❌ Ruim - desktop first
<div className="text-lg md:text-base sm:text-sm">
```

### 5. Reutilize componentes estilizados

```tsx
// ✅ Bom - cria componente reutilizável
function PageHeader({ title, children }) {
  return (
    <header className="flex items-center justify-between mb-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      {children}
    </header>
  );
}

// ❌ Ruim - repete estilos
<div className="flex items-center justify-between mb-8">
  <h1 className="text-3xl font-bold">Título</h1>
</div>
```

## Recursos

- **TailwindCSS Docs:** https://tailwindcss.com/docs
- **Dracula Theme:** https://draculatheme.com/
- **Lucide Icons:** https://lucide.dev/
- **Framer Motion:** https://www.framer.com/motion/

## Próximos Passos

- **Componentes UI:** Veja [componentes-ui.md](./ui_components.md) para componentes prontos
- **Layout:** Veja [estrutura-projeto.md](./project_structure.md) para organização geral
