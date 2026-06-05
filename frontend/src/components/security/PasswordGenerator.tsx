import { Copy, RefreshCw, Loader2, Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn, copyToClipboard } from '@/lib/utils';
import { passwordsService } from '@/services/passwords-service';
import { getErrorMessage } from '@/utils/error-utils';

interface PasswordGeneratorProps {
  onPasswordGenerated?: (password: string) => void;
  compact?: boolean;
}

const strengthConfig = {
  weak: {
    labelKey: 'common.passwordStrength.weak',
    color: 'bg-destructive',
    badgeVariant: 'destructive' as const,
    width: 'w-1/3',
  },
  medium: {
    labelKey: 'common.passwordStrength.medium',
    color: 'bg-warning',
    badgeVariant: 'secondary' as const,
    width: 'w-2/3',
  },
  strong: {
    labelKey: 'common.passwordStrength.strong',
    color: 'bg-success',
    badgeVariant: 'default' as const,
    width: 'w-full',
  },
};

export function PasswordGenerator({
  onPasswordGenerated,
  compact = false,
}: PasswordGeneratorProps) {
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
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!uppercase && !lowercase && !numbers && !specialCharacters) {
      toast({
        title: t('common.passwordStrength.invalidConfig'),
        description: t('common.passwordStrength.selectCharType'),
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
        title: t('pages.passwords.generator.generateError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedPassword) return;
    await copyToClipboard(generatedPassword);
    setCopied(true);
    toast({
      title: t('common.messages.copied'),
      description: t('pages.passwords.copiedDesc'),
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLengthChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setLength(Math.min(128, Math.max(8, num)));
    }
  };

  const strengthInfo = strength
    ? strengthConfig[strength as keyof typeof strengthConfig]
    : null;

  return (
    <div className={cn('space-y-md', compact && 'space-y-3')}>
      {/* Length */}
      <div className="space-y-sm">
        <Label htmlFor="gen-length">
          {t('pages.passwords.generator.length', { count: length })}
        </Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            id="gen-length"
            min={8}
            max={128}
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value, 10))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
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
      <div
        className={cn(
          'grid gap-3',
          compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
        )}
      >
        <div className="flex items-center space-x-sm">
          <Checkbox
            id="gen-upper"
            checked={uppercase}
            onCheckedChange={(checked) => setUppercase(checked === true)}
          />
          <Label htmlFor="gen-upper" className="cursor-pointer text-sm">
            {t('pages.passwords.generator.uppercase')}
          </Label>
        </div>
        <div className="flex items-center space-x-sm">
          <Checkbox
            id="gen-lower"
            checked={lowercase}
            onCheckedChange={(checked) => setLowercase(checked === true)}
          />
          <Label htmlFor="gen-lower" className="cursor-pointer text-sm">
            {t('pages.passwords.generator.lowercase')}
          </Label>
        </div>
        <div className="flex items-center space-x-sm">
          <Checkbox
            id="gen-numbers"
            checked={numbers}
            onCheckedChange={(checked) => setNumbers(checked === true)}
          />
          <Label htmlFor="gen-numbers" className="cursor-pointer text-sm">
            {t('pages.passwords.generator.numbers')}
          </Label>
        </div>
        <div className="flex items-center space-x-sm">
          <Checkbox
            id="gen-special"
            checked={specialCharacters}
            onCheckedChange={(checked) => setSpecialCharacters(checked === true)}
          />
          <Label htmlFor="gen-special" className="cursor-pointer text-sm">
            {t('pages.passwords.generator.special')}
          </Label>
        </div>
        <div className="flex items-center space-x-sm">
          <Checkbox
            id="gen-ambiguous"
            checked={excludeAmbiguous}
            onCheckedChange={(checked) => setExcludeAmbiguous(checked === true)}
          />
          <Label htmlFor="gen-ambiguous" className="cursor-pointer text-sm">
            {t('pages.passwords.generator.excludeAmbiguous')}
          </Label>
        </div>
      </div>

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
        {isGenerating ? (
          <>
            <Loader2 className="mr-sm h-4 w-4 animate-spin" />
            {t('pages.passwords.generator.generating')}
          </>
        ) : (
          <>
            <RefreshCw className="mr-sm h-4 w-4" />
            {t('pages.passwords.generatePassword')}
          </>
        )}
      </Button>

      {/* Result */}
      {generatedPassword && (
        <div className="space-y-3">
          <div className="flex items-center gap-sm rounded-lg bg-muted p-3">
            <code className="flex-1 select-all break-all font-mono text-sm">
              {generatedPassword}
            </code>
            <Button size="sm" variant="ghost" onClick={handleCopy} className="shrink-0">
              {copied ? (
                <Check className="h-4 w-4 text-[hsl(var(--success))]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Strength Bar */}
          {strengthInfo && (
            <div className="space-y-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('pages.passwords.generator.strengthLabel')}
                </span>
                <Badge variant={strengthInfo.badgeVariant}>
                  {t(strengthInfo.labelKey)}
                </Badge>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
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
