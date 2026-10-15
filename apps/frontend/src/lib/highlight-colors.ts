/**
 * Fundo dos destaques de leitura na cor escolhida (§5: destaques mantêm só o
 * fundo colorido, borda neutra). Tokens `--highlight-*` em `index.css`.
 */
export const HIGHLIGHT_BG: Record<string, string> = {
  yellow: 'bg-highlight-yellow/15',
  green: 'bg-highlight-green/15',
  blue: 'bg-highlight-blue/15',
  pink: 'bg-highlight-pink/15',
  orange: 'bg-highlight-orange/15',
};

export const highlightBg = (color: string): string =>
  HIGHLIGHT_BG[color] ?? HIGHLIGHT_BG.yellow;

/** Chave i18n do tipo de destaque (o backend manda o código). */
export const HIGHLIGHT_TYPE_KEY: Record<string, string> = {
  quote: 'pages.highlights.form.typeQuote',
  note: 'pages.highlights.form.typeNote',
  idea: 'pages.highlights.form.typeIdea',
};

/** Bolinha da cor no seletor de cor do destaque. */
export const HIGHLIGHT_DOT: Record<string, string> = {
  yellow: 'bg-highlight-yellow',
  green: 'bg-highlight-green',
  blue: 'bg-highlight-blue',
  pink: 'bg-highlight-pink',
  orange: 'bg-highlight-orange',
};
