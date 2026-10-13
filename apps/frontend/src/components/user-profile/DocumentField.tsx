import { Eye, EyeOff, IdCard } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlainButton } from '@/components/ui/plain-button';
import { formatDocument } from '@/lib/formatters';

/** CPF mascarado na leitura (com botão de revelar) e editável em modo de edição. */
export function DocumentField({
  value,
  onChange,
  editing,
  error,
}: {
  /** Somente dígitos. */
  value: string;
  onChange: (digits: string) => void;
  editing: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  const formatted = formatDocument(value);
  // Mascarado: só os dois últimos caracteres ficam visíveis.
  const masked = formatted.slice(0, -2).replace(/[^.\-/]/g, '*') + formatted.slice(-2);

  return (
    <div className="space-y-sm">
      <Label className="gap-xs flex items-center" htmlFor="document">
        <IdCard className="text-muted-foreground h-3.5 w-3.5" />
        {t('userProfile.personalData.document')}
      </Label>
      <div className="relative">
        <Input
          id="document"
          placeholder={t('common.placeholders.cpf')}
          inputMode="numeric"
          disabled={!editing}
          aria-invalid={error ? true : undefined}
          value={editing || show ? formatted : masked}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 11))}
          className="pr-9"
        />
        {!editing && (
          <PlainButton
            aria-label={t(
              show
                ? 'userProfile.personalData.hideDocument'
                : 'userProfile.personalData.showDocument'
            )}
            type="button"
            onClick={() => setShow((v) => !v)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </PlainButton>
        )}
      </div>
    </div>
  );
}
