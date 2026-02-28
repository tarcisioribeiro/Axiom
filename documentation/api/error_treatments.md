# Tratamento de Erros

## Visão Geral

A API do MindLedger segue padrões REST para códigos de status HTTP e retorna erros em formato JSON estruturado, compatível com Django REST Framework.

## Códigos de Status HTTP

| Código | Nome | Quando Ocorre |
|--------|------|---------------|
| 200 | OK | Requisição bem-sucedida (GET, PUT, PATCH) |
| 201 | Created | Recurso criado com sucesso (POST) |
| 204 | No Content | Recurso deletado (DELETE) |
| 400 | Bad Request | Dados inválidos ou faltando |
| 401 | Unauthorized | Token ausente, inválido ou expirado |
| 403 | Forbidden | Token válido mas sem permissão |
| 404 | Not Found | Recurso não encontrado |
| 500 | Internal Server Error | Erro no servidor |

## Formato de Erros

### Erro de Validação (400)

**Múltiplos campos com erro:**
```json
{
  "name": ["Este campo é obrigatório."],
  "email": ["Insira um endereço de email válido."],
  "account_type": ["'XX' não é um escolha válido."]
}
```

**Erro não-field (geral):**
```json
{
  "non_field_errors": ["A conta de origem deve ser diferente da conta de destino."]
}
```

### Erro de Autenticação (401)

```json
{
  "detail": "Token inválido ou expirado",
  "code": "token_not_valid",
  "messages": [
    {
      "token_class": "AccessToken",
      "token_type": "access",
      "message": "Token is invalid or expired"
    }
  ]
}
```

### Erro de Permissão (403)

```json
{
  "detail": "Você não tem permissão para realizar esta ação."
}
```

### Recurso Não Encontrado (404)

```json
{
  "detail": "Não encontrado."
}
```

### Erro Interno do Servidor (500)

```json
{
  "detail": "Erro interno do servidor. Por favor, tente novamente mais tarde."
}
```

## Tratamento no Frontend

### Classe ApiClient

O `api-client.ts` converte erros HTTP em classes JavaScript customizadas:

```typescript
// api-client.ts
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}
```

### handleError Method

```typescript
private handleError(error: AxiosError): Error {
  const response = error.response;

  if (!response) {
    return new Error('Erro de rede. Verifique sua conexão.');
  }

  const data = response.data as any;

  const formatErrorMessage = (data: any): string => {
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;

    // Django REST Framework validation errors
    if (data && typeof data === 'object') {
      const errorMessages: string[] = [];
      for (const [field, errors] of Object.entries(data)) {
        if (Array.isArray(errors)) {
          errorMessages.push(`${field}: ${errors.join(', ')}`);
        }
      }
      if (errorMessages.length > 0) {
        return errorMessages.join('\n');
      }
    }

    return 'Ocorreu um erro desconhecido';
  };

  switch (response.status) {
    case 400:
      return new ValidationError(
        formatErrorMessage(data) || 'Erro de validação',
        data.errors || data
      );
    case 401:
      return new AuthenticationError(
        formatErrorMessage(data) || 'Falha na autenticação'
      );
    case 403:
      return new PermissionError(
        formatErrorMessage(data) || 'Sem permissão'
      );
    case 404:
      return new NotFoundError(
        formatErrorMessage(data) || 'Recurso não encontrado'
      );
    case 500:
      return new Error('Erro interno do servidor');
    default:
      return new Error(formatErrorMessage(data));
  }
}
```

## Uso em Componentes

### Tratamento Básico

```typescript
import { accountsService } from '@/services/accounts-service';
import { useToast } from '@/components/ui/use-toast';

function AccountsList() {
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    try {
      await accountsService.delete(id);
      toast({ title: 'Conta excluída com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
}
```

### Tratamento Específico por Tipo

```typescript
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  PermissionError,
} from '@/services/api-client';

const handleSave = async () => {
  try {
    await accountsService.create(formData);
    toast({ title: 'Salvo com sucesso' });
  } catch (err: any) {
    if (err instanceof AuthenticationError) {
      // Token expirado - redireciona para login
      navigate('/login');
    } else if (err instanceof ValidationError) {
      // Mostra erros nos campos do formulário
      Object.entries(err.errors).forEach(([field, messages]) => {
        form.setError(field, { message: messages.join(', ') });
      });
    } else if (err instanceof NotFoundError) {
      toast({
        title: 'Não encontrado',
        description: 'O recurso solicitado não existe.',
        variant: 'destructive',
      });
    } else if (err instanceof PermissionError) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem permissão para realizar esta ação.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      });
    }
  }
};
```

### Integração com React Hook Form

```typescript
import { useForm } from 'react-hook-form';
import { ValidationError } from '@/services/api-client';

function AccountForm() {
  const form = useForm<AccountFormData>();

  const onSubmit = async (data: AccountFormData) => {
    try {
      await accountsService.create(data);
      toast({ title: 'Conta criada com sucesso' });
    } catch (err: any) {
      if (err instanceof ValidationError) {
        // Define erros nos campos do formulário
        Object.entries(err.errors).forEach(([field, messages]) => {
          form.setError(field as any, {
            type: 'manual',
            message: messages.join(', '),
          });
        });
      } else {
        toast({
          title: 'Erro',
          description: err.message,
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('name')} />
      {form.formState.errors.name && (
        <span className="text-destructive">
          {form.formState.errors.name.message}
        </span>
      )}
      <Button type="submit">Salvar</Button>
    </form>
  );
}
```

## Erros Comuns e Soluções

### 400 - Bad Request

**Causas:**
- Campos obrigatórios ausentes
- Formato de dados inválido
- Validação de negócio falhou

**Exemplo:**
```json
{
  "name": ["Este campo é obrigatório."],
  "email": ["Insira um endereço de email válido."]
}
```

**Solução:** Verifique os dados enviados e corrija os campos indicados.

### 401 - Unauthorized

**Causas:**
- Token ausente
- Token expirado
- Token inválido

**Solução:** O `api-client` tenta refresh automático. Se falhar, redireciona para login.

### 403 - Forbidden

**Causas:**
- Usuário sem permissão para a ação
- Tentativa de acesso a recurso de outro usuário

**Solução:** Verifique as permissões do usuário. Mostre mensagem apropriada.

### 404 - Not Found

**Causas:**
- ID inválido
- Recurso foi deletado
- URL incorreta

**Solução:** Verifique se o ID existe. Trate gracefully no frontend.

### 500 - Internal Server Error

**Causas:**
- Bug no backend
- Erro de banco de dados
- Configuração incorreta

**Solução:** Veja logs do backend. Mostre mensagem genérica ao usuário.

## Logging de Erros

### Backend (Django)

```python
import logging

logger = logging.getLogger(__name__)

class AccountViewSet(viewsets.ModelViewSet):
    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            logger.error(f'Error creating account: {str(e)}', exc_info=True)
            raise
```

### Frontend

```typescript
// Em desenvolvimento
if (import.meta.env.DEV) {
  console.error('[API Error]', error);
}

// Em produção - enviar para serviço de monitoramento
if (import.meta.env.PROD) {
  // Sentry, LogRocket, etc.
  captureException(error);
}
```

## Toast Notifications

Use o componente Toast para feedback visual:

```typescript
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

// Sucesso
toast({
  title: 'Sucesso!',
  description: 'Operação realizada com sucesso.',
});

// Erro
toast({
  title: 'Erro',
  description: 'Algo deu errado.',
  variant: 'destructive',
});

// Aviso
toast({
  title: 'Atenção',
  description: 'Verifique os dados.',
  variant: 'warning',
});
```

## Error Boundary

Para capturar erros não tratados em componentes:

```typescript
// components/common/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Algo deu errado</h1>
            <p className="text-muted-foreground mb-4">
              {this.state.error?.message}
            </p>
            <Button onClick={() => window.location.reload()}>
              Recarregar Página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Uso:**
```typescript
// App.tsx
<ErrorBoundary>
  <Router>
    <Routes />
  </Router>
</ErrorBoundary>
```

## Validação no Backend

### Serializers

```python
from rest_framework import serializers

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Nome é obrigatório")
        return value

    def validate(self, attrs):
        # Validação que envolve múltiplos campos
        if attrs['current_balance'] < attrs['minimum_balance']:
            raise serializers.ValidationError({
                'current_balance': 'Saldo atual não pode ser menor que o mínimo'
            })
        return attrs
```

## Boas Práticas

### 1. Sempre trate erros

```typescript
// ✅ Bom
try {
  await apiCall();
} catch (error) {
  handleError(error);
}

// ❌ Ruim
await apiCall(); // Sem tratamento
```

### 2. Mensagens amigáveis ao usuário

```typescript
// ✅ Bom
toast({
  title: 'Erro ao salvar',
  description: 'Verifique os campos e tente novamente.',
});

// ❌ Ruim
toast({
  title: 'Error 400',
  description: JSON.stringify(error),
});
```

### 3. Use tipos específicos de erro

```typescript
// ✅ Bom
if (err instanceof ValidationError) {
  // Trata validação
} else if (err instanceof NotFoundError) {
  // Trata não encontrado
}

// ❌ Ruim
if (err.message.includes('validation')) {
  // Frágil
}
```

### 4. Log erros apropriadamente

```typescript
// ✅ Bom
console.error('[AccountService] Failed to delete:', error);

// ❌ Ruim
console.log(error); // Usa log ao invés de error
```

## Próximos Passos

- **Endpoints:** Veja [endpoints.md](./endpoints.md)
- **Autenticação:** Veja [autenticacao-tokens.md](./autenticacao-tokens.md)
- **Filtros:** Veja [filtros-ordenacao.md](./filtros-ordenacao.md)
