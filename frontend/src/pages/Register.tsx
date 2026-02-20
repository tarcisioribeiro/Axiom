import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth-service';
import { Loader2 } from 'lucide-react';

interface RegisterFormData {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  document: string;
  phone: string;
  email?: string;
}

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      await authService.register({
        username: data.username,
        password: data.password,
        name: data.name,
        document: data.document,
        phone: data.phone,
        email: data.email,
      });

      toast({
        title: 'Cadastro realizado!',
        description: 'Você já pode fazer login com suas credenciais.',
      });

      void navigate('/login');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro ao tentar cadastrar. Tente novamente.';
      toast({
        title: 'Erro ao cadastrar',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="gradient-primary bg-clip-text text-3xl font-bold text-transparent">
              MindLedger
            </h1>
            <p className="mt-2">Crie sua conta</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              id="name"
              label="Nome Completo"
              error={errors.name?.message}
              required
            >
              <Input
                type="text"
                {...register('name', { required: 'Nome é obrigatório' })}
                placeholder="Seu nome completo"
                disabled={isLoading}
              />
            </FormField>

            <FormField
              id="document"
              label="CPF"
              error={errors.document?.message}
              required
            >
              <Input
                type="text"
                {...register('document', {
                  required: 'CPF é obrigatório',
                  pattern: {
                    value: /^\d{11}$/,
                    message: 'CPF deve conter 11 dígitos',
                  },
                })}
                placeholder="00000000000"
                maxLength={11}
                disabled={isLoading}
              />
            </FormField>

            <FormField
              id="phone"
              label="Telefone"
              error={errors.phone?.message}
              required
            >
              <Input
                type="tel"
                {...register('phone', { required: 'Telefone é obrigatório' })}
                placeholder="(00) 00000-0000"
                disabled={isLoading}
              />
            </FormField>

            <FormField
              id="email"
              label="Email"
              error={errors.email?.message}
              description="Opcional, mas recomendado para recuperação de conta"
            >
              <Input
                type="email"
                {...register('email', {
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Email inválido',
                  },
                })}
                placeholder="seu@email.com"
                disabled={isLoading}
              />
            </FormField>

            <FormField
              id="username"
              label="Nome de Usuário"
              error={errors.username?.message}
              required
            >
              <Input
                type="text"
                {...register('username', {
                  required: 'Nome de usuário é obrigatório',
                  minLength: {
                    value: 3,
                    message: 'Mínimo de 3 caracteres',
                  },
                })}
                placeholder="usuario"
                disabled={isLoading}
              />
            </FormField>

            <FormField
              id="password"
              label="Senha"
              error={errors.password?.message}
              required
            >
              <Input
                type="password"
                {...register('password', {
                  required: 'Senha é obrigatória',
                  minLength: {
                    value: 6,
                    message: 'Mínimo de 6 caracteres',
                  },
                })}
                placeholder="••••••••"
                disabled={isLoading}
              />
            </FormField>

            <FormField
              id="confirmPassword"
              label="Confirmar Senha"
              error={errors.confirmPassword?.message}
              required
            >
              <Input
                type="password"
                {...register('confirmPassword', {
                  required: 'Confirmação de senha é obrigatória',
                  validate: (value) => value === password || 'As senhas não coincidem',
                })}
                placeholder="••••••••"
                disabled={isLoading}
              />
            </FormField>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Cadastrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span>Já tem uma conta? </span>
            <Link to="/login" className="font-medium text-primary hover:underline">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
