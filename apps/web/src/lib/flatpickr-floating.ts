import type { Options as FlatpickrOptions } from 'flatpickr/dist/types/options';

/**
 * Opções do flatpickr para um calendário/time picker flutuante: anexado ao
 * body e posicionado com `position: fixed` nas coordenadas da viewport, por
 * cima de tudo. Dentro de um dialog ele não entra no fluxo (não estica o
 * modal) nem é cortado pelo `overflow-y-auto` dele — o `DialogContent` já
 * ignora cliques em `.flatpickr-calendar` como "clique fora".
 */
export function floatingOptions(input: HTMLInputElement): Partial<FlatpickrOptions> {
  return {
    static: false,
    appendTo: document.body,
    position: (self, node) => {
      const cal = self.calendarContainer;
      const inRect = (node ?? input).getBoundingClientRect();
      const fitsBelow = window.innerHeight - inRect.bottom >= cal.offsetHeight + 8;
      const top = fitsBelow ? inRect.bottom + 4 : inRect.top - cal.offsetHeight - 4;
      const maxLeft = window.innerWidth - cal.offsetWidth - 8;
      cal.style.position = 'fixed';
      cal.style.top = `${Math.max(8, top)}px`;
      cal.style.left = `${Math.max(8, Math.min(inRect.left, maxLeft))}px`;
      cal.style.right = 'auto';
      cal.style.marginTop = '0';
      cal.style.transformOrigin = fitsBelow ? 'top left' : 'bottom left';
    },
  };
}
