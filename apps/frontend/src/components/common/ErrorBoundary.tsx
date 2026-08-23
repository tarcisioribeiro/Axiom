import {
  ExclamationTriangleIcon as AlertTriangle,
  ArrowPathIcon as RefreshCw,
} from '@heroicons/react/24/solid';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary para capturar erros em componentes React.
 * Previne que erros em um componente quebrem toda a aplicacao.
 *
 * Uso:
 * ```tsx
 * <ErrorBoundary>
 *   <ComponenteQuePodeFalhar />
 * </ErrorBoundary>
 * ```
 *
 * Com fallback customizado:
 * ```tsx
 * <ErrorBoundary fallback={<MeuComponenteDeErro />}>
 *   <ComponenteQuePodeFalhar />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log do erro para debugging
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    // Callback opcional para logging externo (ex: Sentry)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Fallback customizado se fornecido
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Fallback padrao
      return (
        <div className="p-md flex min-h-[400px] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mb-md bg-destructive/10 mx-auto w-fit rounded-full p-3">
                <AlertTriangle className="text-destructive h-8 w-8" />
              </div>
              <CardTitle className="text-xl">Algo deu errado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-md text-center">
              <p className="text-muted-foreground">
                Ocorreu um erro inesperado ao carregar este componente.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="bg-muted rounded-lg p-3 text-left text-sm">
                  <summary className="mb-sm cursor-pointer font-medium">
                    Detalhes do erro (desenvolvimento)
                  </summary>
                  <pre className="text-destructive overflow-auto text-xs whitespace-pre-wrap">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              <div className="gap-sm flex justify-center">
                <Button onClick={this.handleRetry} variant="default">
                  <RefreshCw className="mr-sm h-4 w-4" />
                  Tentar novamente
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Recarregar pagina
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
