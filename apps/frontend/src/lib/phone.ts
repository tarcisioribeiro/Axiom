import { AsYouType } from 'libphonenumber-js';

/**
 * Formata enquanto o usuário digita, no padrão "+DDI (DDD) número" do país do
 * DDI informado (ex.: +55 (35) 99949-0239). Países cujo formato nacional não
 * usa parênteses ficam no formato internacional da libphonenumber.
 */
export function formatPhone(value: string, previous = ''): string {
  let digits = value.replace(/\D/g, '');
  // Backspace sobre um separador ("+55 (35)" → "+55 (35"): apaga o dígito anterior,
  // senão a máscara recoloca o separador e o campo trava.
  if (value.length < previous.length && digits === previous.replace(/\D/g, '')) {
    digits = digits.slice(0, -1);
  }
  const hasDdi = value.trimStart().startsWith('+');
  if (!digits) return hasDdi ? '+' : '';

  // ponytail: sem "+", assume Brasil (cadastros antigos salvam só DDD + número).
  const typed = new AsYouType();
  const international = typed.input(hasDdi ? `+${digits}` : `+55${digits}`);
  const country = typed.getCountry();
  const national = country
    ? new AsYouType(country).input(typed.getNationalNumber())
    : '';

  return national.includes('(')
    ? `+${typed.getCallingCode()} ${national}`
    : international;
}
