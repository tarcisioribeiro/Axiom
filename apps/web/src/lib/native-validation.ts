import { toast } from '@/hooks/use-toast';
import i18n from '@/i18n';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const MARK = 'data-native-invalid';

function fieldLabel(el: Field): string {
  return (
    el.labels?.[0]?.textContent?.trim() ||
    el.getAttribute('aria-label') ||
    el.getAttribute('placeholder') ||
    el.name
  );
}

function message(el: Field): string {
  const field = fieldLabel(el);
  const { validity } = el;
  if (validity.valueMissing) return i18n.t('common.fieldRequired', { field });
  if (validity.tooShort && 'minLength' in el)
    return i18n.t('common.fieldMinLength', { field, count: el.minLength });
  if (validity.typeMismatch || validity.patternMismatch)
    return i18n.t('common.fieldInvalidFormat', { field });
  return `${field}: ${el.validationMessage}`;
}

/**
 * Valida as constraints nativas (`required`, `minLength`, `type="email"`...) de
 * todos os formulários no padrão do app: toast + borda vermelha (`aria-invalid`).
 * Os `<form>` usam `noValidate` para o navegador não mostrar o balão/tooltip
 * próprio; este listener (captura, antes do `onSubmit` do React) bloqueia o envio.
 */
export function installNativeValidation() {
  window.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement;
      const invalid = Array.from(form.elements).filter(
        (el): el is Field =>
          'validity' in el &&
          (el as Field).willValidate &&
          !(el as Field).validity.valid
      );
      if (invalid.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      invalid.forEach((el) => {
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute(MARK, '');
        toast({ title: message(el), variant: 'destructive' });
      });
      invalid[0].focus();
    },
    true
  );

  window.addEventListener(
    'input',
    (e) => {
      const el = e.target as Element;
      if (el.hasAttribute?.(MARK)) {
        el.removeAttribute(MARK);
        el.removeAttribute('aria-invalid');
      }
    },
    true
  );
}
