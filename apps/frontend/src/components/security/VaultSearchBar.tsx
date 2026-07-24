import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  CreditCard,
  Key,
  Landmark,
  Loader2,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { securityDashboardService } from '@/services/security-dashboard-service';
import type {
  SecuritySearchArchiveResult,
  SecuritySearchCardResult,
  SecuritySearchAccountResult,
  SecuritySearchPasswordResult,
} from '@/types/security';

const DEBOUNCE_MS = 300;

type ResultItem =
  | { type: 'password'; data: SecuritySearchPasswordResult }
  | { type: 'card'; data: SecuritySearchCardResult }
  | { type: 'account'; data: SecuritySearchAccountResult }
  | { type: 'archive'; data: SecuritySearchArchiveResult };

export function VaultSearchBar() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(value);
      if (value.length >= 2) setIsOpen(true);
      else setIsOpen(false);
    }, DEBOUNCE_MS);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['security', 'search', debouncedQuery],
    queryFn: () => securityDashboardService.globalSearch(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 15_000,
  });

  const handleSelect = (item: ResultItem) => {
    setQuery('');
    setDebouncedQuery('');
    setIsOpen(false);
    switch (item.type) {
      case 'password':
        void navigate('/security/passwords');
        break;
      case 'card':
        void navigate('/security/cards');
        break;
      case 'account':
        void navigate('/security/accounts');
        break;
      case 'archive':
        void navigate('/security/archives');
        break;
    }
  };

  const clear = () => {
    setQuery('');
    setDebouncedQuery('');
    setIsOpen(false);
  };

  const allItems: ResultItem[] = [
    ...(data?.passwords ?? []).map((d): ResultItem => ({ type: 'password', data: d })),
    ...(data?.stored_cards ?? []).map((d): ResultItem => ({ type: 'card', data: d })),
    ...(data?.stored_accounts ?? []).map(
      (d): ResultItem => ({ type: 'account', data: d })
    ),
    ...(data?.archives ?? []).map((d): ResultItem => ({ type: 'archive', data: d })),
  ];

  return (
    <div className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar no cofre..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (debouncedQuery.length >= 2) setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 150);
          }}
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[340px] rounded-lg border bg-popover shadow-xl">
          {allItems.length === 0 && !isFetching ? (
            <div className="flex items-center justify-center gap-sm p-lg text-sm text-muted-foreground">
              <Search className="h-4 w-4 opacity-50" />
              Nenhum resultado para "{debouncedQuery}"
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-xs">
              {allItems.map((item, idx) => (
                <ResultRow key={idx} item={item} onSelect={handleSelect} />
              ))}
            </ul>
          )}
          {data && data.total > allItems.length && (
            <div className="border-t px-md py-sm text-xs text-muted-foreground">
              Mostrando {allItems.length} de {data.total} resultados
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  item,
  onSelect,
}: {
  item: ResultItem;
  onSelect: (item: ResultItem) => void;
}) {
  const { icon, title, subtitle, badge } = getResultMeta(item);
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-sm px-md py-sm text-left hover:bg-accent/50"
        onMouseDown={() => onSelect(item)}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          {badge}
        </Badge>
      </button>
    </li>
  );
}

function getResultMeta(item: ResultItem): {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge: string;
} {
  switch (item.type) {
    case 'password':
      return {
        icon: item.data.totp_enabled ? (
          <Shield className="h-4 w-4 text-success" />
        ) : (
          <Key className="h-4 w-4" />
        ),
        title: item.data.title,
        subtitle: item.data.site ?? item.data.username,
        badge: 'Senha',
      };
    case 'card':
      return {
        icon: <CreditCard className="h-4 w-4" />,
        title: item.data.name,
        subtitle: item.data.card_number_masked,
        badge: 'Cartão',
      };
    case 'account':
      return {
        icon: <Landmark className="h-4 w-4" />,
        title: item.data.name,
        subtitle: item.data.institution_name,
        badge: 'Conta',
      };
    case 'archive':
      return {
        icon: <Archive className="h-4 w-4" />,
        title: item.data.title,
        subtitle: item.data.file_name,
        badge: 'Arquivo',
      };
  }
}
