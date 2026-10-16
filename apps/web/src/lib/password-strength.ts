import { useEffect, useState } from 'react';

export type StrengthScorer = (password: string) => number;

// zxcvbn (~800KB) carregado sob demanda: mesmo algoritmo do backend (score 0-4)
export function useStrengthScorer(): StrengthScorer | null {
  const [scorer, setScorer] = useState<StrengthScorer | null>(null);
  useEffect(() => {
    let active = true;
    void import('zxcvbn').then(({ default: zxcvbn }) => {
      // zxcvbn rejeita entradas acima de 72 caracteres no backend; mantém paridade
      if (active) setScorer(() => (pw: string) => zxcvbn(pw.slice(0, 72)).score);
    });
    return () => {
      active = false;
    };
  }, []);
  return scorer;
}

// Escala 1-5 da UI = score zxcvbn + 1 (1 enquanto o zxcvbn carrega); 0 = vazio
export function getPasswordScore(password: string, scorer: StrengthScorer | null) {
  if (!password) return 0;
  return scorer ? scorer(password) + 1 : 1;
}
