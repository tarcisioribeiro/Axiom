import type { Options as FlatpickrOptions } from 'flatpickr/dist/types/options';

/**
 * Opções do flatpickr para um calendário/time picker flutuante: anexado ao
 * dialog (ou ao body) e posicionado de forma absoluta, sem entrar no fluxo
 * do layout — o modo `static` do flatpickr empurra/estica o container ao
 * abrir.
 */
export function floatingOptions(input: HTMLInputElement): Partial<FlatpickrOptions> {
  const dialog = input.closest<HTMLElement>('[role="dialog"]');
  const host = dialog ?? document.body;
  return {
    static: false,
    appendTo: host,
    // O dialog tem `transform`, então é ele (e não a página) o referencial
    // das coordenadas absolutas do calendário.
    position: (self, node) => {
      const cal = self.calendarContainer;
      const el = node ?? input;
      const hostRect = host.getBoundingClientRect();
      const inRect = el.getBoundingClientRect();
      const fitsBelow = window.innerHeight - inRect.bottom >= cal.offsetHeight + 8;
      const top = fitsBelow ? inRect.bottom + 4 : inRect.top - cal.offsetHeight - 4;
      const maxLeft = host.clientWidth - cal.offsetWidth - 8;
      const left = Math.max(8, Math.min(inRect.left - hostRect.left, maxLeft));
      cal.style.top = `${top - hostRect.top + host.scrollTop}px`;
      cal.style.left = `${left}px`;
      cal.style.right = 'auto';
    },
  };
}
