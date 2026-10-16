import { useNavigate, useParams } from 'react-router';

/**
 * Aba ativa refletida na URL (`${basePath}/${tab}`) em vez de estado local —
 * assim a aba é compartilhável/navegável pelo histórico do navegador. Troca
 * de aba usa `replace` para não poluir o histórico a cada clique.
 */
export function useTabRoute<T extends string>(
  basePath: string,
  tabs: readonly T[],
  defaultTab: T,
  paramName: string = 'tab'
) {
  const params = useParams();
  const navigate = useNavigate();
  const raw = params[paramName];
  const activeTab = (tabs as readonly string[]).includes(raw ?? '')
    ? (raw as T)
    : defaultTab;

  const setActiveTab = (next: T) => {
    void navigate(`${basePath}/${next}`, { replace: true });
  };

  return [activeTab, setActiveTab] as const;
}
