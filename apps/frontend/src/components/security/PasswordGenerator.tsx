/* eslint-disable max-lines */
import {
  Asterisk,
  CaseLower,
  CaseUpper,
  Check,
  Copy,
  EyeOff,
  Hash,
  Loader2,
  RefreshCw,
  Ruler,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Slider } from '@/components/ui/slider';
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
        title: t('common.passwordStrength.selectCharType'),
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
        title: t('pages.passwords.generator.generateError', {
          reason: getErrorMessage(error),
        }),
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
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const strengthInfo = strength
    ? strengthConfig[strength as keyof typeof strengthConfig]
    : null;

  return (
    <div className={cn('space-y-md', compact && 'space-y-3')}>
      {/* Length */}
      <div className="space-y-sm">
        <Label className="gap-xs flex items-center" htmlFor="gen-length">
          <Ruler className="text-muted-foreground h-3.5 w-3.5" />
          {t('pages.passwords.generator.length', { count: length })}
        </Label>
        <div className="flex items-center gap-3">
          <Slider
            id="gen-length"
            min={8}
            max={128}
            value={length}
            onChange={setLength}
            className="flex-1"
          />
          <NumberStepper
            min={8}
            max={128}
            aria-label={t('pages.passwords.generator.length', { count: length })}
            value={length}
            onChange={(v) => v !== null && setLength(v)}
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
        <div className="space-x-sm flex items-center">
          <Checkbox
            id="gen-upper"
            checked={uppercase}
            onCheckedChange={(checked) => setUppercase(checked === true)}
          />
          <Label
            htmlFor="gen-upper"
            className="gap-xs flex cursor-pointer items-center text-sm"
          >
            <CaseUpper className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.passwords.generator.uppercase')}
          </Label>
        </div>
        <div className="space-x-sm flex items-center">
          <Checkbox
            id="gen-lower"
            checked={lowercase}
            onCheckedChange={(checked) => setLowercase(checked === true)}
          />
          <Label
            htmlFor="gen-lower"
            className="gap-xs flex cursor-pointer items-center text-sm"
          >
            <CaseLower className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.passwords.generator.lowercase')}
          </Label>
        </div>
        <div className="space-x-sm flex items-center">
          <Checkbox
            id="gen-numbers"
            checked={numbers}
            onCheckedChange={(checked) => setNumbers(checked === true)}
          />
          <Label
            htmlFor="gen-numbers"
            className="gap-xs flex cursor-pointer items-center text-sm"
          >
            <Hash className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.passwords.generator.numbers')}
          </Label>
        </div>
        <div className="space-x-sm flex items-center">
          <Checkbox
            id="gen-special"
            checked={specialCharacters}
            onCheckedChange={(checked) => setSpecialCharacters(checked === true)}
          />
          <Label
            htmlFor="gen-special"
            className="gap-xs flex cursor-pointer items-center text-sm"
          >
            <Asterisk className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.passwords.generator.special')}
          </Label>
        </div>
        <div className="space-x-sm flex items-center">
          <Checkbox
            id="gen-ambiguous"
            checked={excludeAmbiguous}
            onCheckedChange={(checked) => setExcludeAmbiguous(checked === true)}
          />
          <Label
            htmlFor="gen-ambiguous"
            className="gap-xs flex cursor-pointer items-center text-sm"
          >
            <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.passwords.generator.excludeAmbiguous')}
          </Label>
        </div>
      </div>

      {/* Generate Button */}
      <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('pages.passwords.generator.generating')}
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            {t('pages.passwords.generatePassword')}
          </>
        )}
      </Button>

      {/* Result */}
      {generatedPassword && (
        <div className="space-y-3">
          <div className="gap-sm bg-muted flex items-center rounded-lg p-3">
            <code className="flex-1 text-sm break-all select-all">
              {generatedPassword}
            </code>
            <Button
              aria-label={t('common.actions.copy')}
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="shrink-0"
            >
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
                <span className="text-muted-foreground text-sm">
                  {t('pages.passwords.generator.strengthLabel')}
                </span>
                <Badge variant={strengthInfo.badgeVariant}>
                  {t(strengthInfo.labelKey)}
                </Badge>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    'duration-medium h-full rounded-full transition-[width,background-color]',
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
