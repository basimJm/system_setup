import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useContainer } from '@/app/ContainerContext';
import { transitionOf, type Item, type ItemTransition } from '@/domain/items/items';
import { normalizeError } from '@/infrastructure/errors/normalize';
import { ReasonDialog } from '../components/overlay/ReasonDialog';
import { useToast } from '../components/overlay/Toast';

interface Pending {
  item: Item;
  transition: ItemTransition;
}

/**
 * Archive / restore an item with the mandatory reason: `open(item)` asks for the reason in a dialog, the
 * transition the item accepts is applied, every item query and the audit log are refreshed, a toast confirms.
 */
export function useItemTransition() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { repositories } = useContainer();
  const [pending, setPending] = useState<Pending | null>(null);
  const mutation = useMutation({
    mutationFn: ({ item, transition, reason }: Pending & { reason: string }) =>
      repositories.items[transition](item.id, reason),
    onSuccess: async (_item, { transition }) => {
      setPending(null);
      toast.show(t(transition === 'archive' ? 'items.archived' : 'items.restored'), 'success');
      await queryClient.invalidateQueries({ queryKey: ['getItems'] });
      await queryClient.invalidateQueries({ queryKey: ['getItemsById'] });
      await queryClient.invalidateQueries({ queryKey: ['getAuditLogs'] });
    },
    onError: (error) => {
      const appError = normalizeError(error);
      toast.show(appError.serverMessage ?? t(appError.messageKey), 'error');
    },
  });
  const open = (item: Item) => {
    mutation.reset();
    setPending({ item, transition: transitionOf(item) });
  };
  const key = pending?.transition ?? 'archive';
  const dialog = (
    <ReasonDialog
      open={pending !== null}
      title={t(`items.${key}Title`)}
      description={t(`items.${key}Description`)}
      destructive={key === 'archive'}
      confirmLabel={t(`items.${key}`)}
      loading={mutation.isPending}
      onConfirm={(reason) => {
        if (pending) mutation.mutate({ ...pending, reason });
      }}
      onClose={() => setPending(null)}
    />
  );
  return { open, dialog };
}
