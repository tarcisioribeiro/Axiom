import { useQuery } from '@tanstack/react-query';

import { STALE_TIMES } from '@/lib/query-client';
import { membersService } from '@/services/members-service';

/** Membro do usuário logado, em cache: chamar também na página faz o modal
 * do formulário já abrir com os campos que dependem dele. */
export const useCurrentMember = () =>
  useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
