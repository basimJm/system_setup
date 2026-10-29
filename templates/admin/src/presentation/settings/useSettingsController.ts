import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '@/app/ContainerContext';
import { SETTINGS_QUERY_KEY } from '@/constants/settings';
import type { SettingChange } from './useSettingsDraft';

/** Loads the settings and saves a set of changed keys with one reason (one audited PUT per key). */
export function useSettingsController() {
  const { repositories } = useContainer();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => repositories.settings.list(),
  });
  const save = useMutation({
    mutationFn: async ({
      changes,
      reason,
    }: {
      changes: readonly SettingChange[];
      reason: string;
    }) => {
      for (const change of changes)
        await repositories.settings.update(change.key, change.value, reason);
    },
    // Even a partly failed save changed something on the server: always reload.
    onSettled: () => queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
  });
  return { query, save };
}
