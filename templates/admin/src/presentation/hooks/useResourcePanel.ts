import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Page } from '@/domain/shared/page';
import type { ListState } from '@/domain/shared/listState';

export interface ResourcePanelOptions<T, V> {
  /** First element of the query key (the operation id of the list endpoint). */
  queryName: string;
  load: (state: ListState) => Promise<Page<T>>;
  /** Saves the form: creates when `editing` is null, patches otherwise. */
  save: (editing: T | null, values: V, reason: string) => Promise<unknown>;
}

/** List loading, and the open/edit/save life cycle of the side panel, shared by every admin resource page (locations, app config...). */
export function useResourcePanel<T, V>(
  state: ListState,
  { queryName, load, save }: ResourcePanelOptions<T, V>,
) {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<{ editing: T | null } | null>(null);
  const query = useQuery({ queryKey: [queryName, state], queryFn: () => load(state) });
  const mutation = useMutation({
    mutationFn: ({ editing, values, reason }: { editing: T | null; values: V; reason: string }) =>
      save(editing, values, reason),
    onSuccess: () => {
      setPanel(null);
      return queryClient.invalidateQueries({ queryKey: [queryName] });
    },
  });
  return {
    query,
    panel,
    saving: mutation.isPending,
    saveError: mutation.error,
    openCreate: () => {
      mutation.reset();
      setPanel({ editing: null });
    },
    openEdit: (item: T) => {
      mutation.reset();
      setPanel({ editing: item });
    },
    close: () => setPanel(null),
    submit: (values: V, reason: string) =>
      mutation.mutate({ editing: panel?.editing ?? null, values, reason }),
  };
}
