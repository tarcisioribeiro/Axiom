import { useState } from 'react';
import { Copy, RefreshCw, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { passwordsService } from '@/services/passwords-service';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/error-utils';
import { cn } from '@/lib/utils';

interface PasswordGeneratorProps {
  onPasswordGenerated?: (password: string) => void;
  compact?: boolean;
}

const strengthConfig = {
  weak: { label: 'Fraca', color: 'bg-red-500', badgeVariant: 'destructive' as const, width: 'w-1/3' },
  medium: { label: 'Média', color: 'bg-yellow-500', badgeVariant: 'secondary' as const, width: 'w-2/3' },
  strong: { label: 'Forte', color: 'bg-green-500', badgeVariant: 'default' as const, width: 'w-full' },
};

export function PasswordGenerator({ onPasswordGenerated, compact = false }: PasswordGeneratorProps) {
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [specialCharacters, setSpecialCharacters] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [strength, setStrength] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!uppercase && !lowercase && !numbers && !specialCharacters) {
      toast({
        title: 'Configuração inválida',
        description: 'Selecione pelo menos um tipo de caractere.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsGenerating(true);
      const result = await passwordsService.generate({
        length,
        uppercase,
        lowercase,
        numbers,
        special_characters: specialCharacters,
        exclude_ambiguous: excludeAmbiguous,
      });
      setGeneratedPassword(result.password);
      setStrength(result.strength);
      onPasswordGenerated?.(result.password);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao gerar senha',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    toast({
      title: 'Copiado!',
      description: 'Senha copiada para a área de transferência.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLengthChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setLength(Math.min(128, Math.max(8, num)));
    }
  };

  const strengthInfo = strength ? strengthConfig[strength as keyof typeof strengthConfig] : null;

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {/* Length */}
      <div className="space-y-2">
        <Label htmlFor="gen-length">Comprimento: {length}</Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            id="gen-length"
            min={8}
            max={128}
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value, 10))}
            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <Input
            type="number"
            value={length}
            onChange={(e) => handleLengthChange(e.target.value)}
            className="w-20"
            min={8}
            max={128}
          />
        </div>
      </div>

      {/* Character Options */}
      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="gen-upper"
            checked={uppercase}
            onCheckedChange={(checked) => setUppercase(checked === true)}
          />
          <Label htmlFor="gen-upper" className="text-sm cursor-pointer">
            Maiúsculas (A-Z)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="gen-lower"
            checked={lowercase}
            onCheckedChange={(checked) => setLowercase(checked === true)}
          />
          <Label htmlFor="gen-lower" className="text-sm cursor-pointer">
            Minúsculas (a-z)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="gen-numbers"
            checked={numbers}
            onCheckedChange={(checked) => setNumbers(checked === true)}
          />
          <Label htmlFor="gen-numbers" className="text-sm cursor-pointer">
            Números (0-9)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="gen-special"
            checked={specialCharacters}
            onCheckedChange={(checked) => setSpecialCharacters(checked === true)}
          />
          <Label htmlFor="gen-special" className="text-sm cursor-pointer">
            Especiais (!@#$...)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="gen-ambiguous"
            checked={excludeAmbiguous}
            onCheckedChange={(checked) => setExcludeAmbiguous(checked === true)}
          />
          <Label htmlFor="gen-ambiguous" className="text-sm cursor-pointer">
            Excluir ambíguos
          </Label>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Gerar Senha
          </>
        )}
      </Button>

      {/* Result */}
      {generatedPassword && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-sm break-all font-mono select-all">
              {generatedPassword}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Strength Bar */}
          {strengthInfo && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Força da senha</span>
                <Badge variant={strengthInfo.badgeVariant}>
                  {strengthInfo.label}
                </Badge>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    strengthInfo.color,
                    strengthInfo.width
                  )}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
