import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { useAuthStore } from '@/stores/auth-store';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();
  const { logo } = useThemeAssets();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login({ username, password });
      void navigate('/');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      {/* Theme Toggle Button */}
      <ThemeToggle className="absolute right-4 top-4" />

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex items-center justify-center">
            <img src={logo} alt="MindLedger" className="h-auto w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="gradient-primary w-full font-semibold text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span>Não tem uma conta? </span>
            <Link to="/register" className="font-medium text-primary hover:underline">
              Cadastre-se
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
