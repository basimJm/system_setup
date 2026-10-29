import type { NotificationRecipientType } from '../../constants/enums';
import type {
  CustomersRepository,
  MembersRepository,
} from '../../repositories/identity.repository';
import type { Recipient, RecipientSource } from './notifications.service';

/** Recipients come from the customers and members collections (language + push token). */
export const createRecipientSource = (deps: {
  readonly customers: Pick<CustomersRepository, 'findById'>;
  readonly members: Pick<MembersRepository, 'findById'>;
}): RecipientSource => ({
  async findRecipient(type: NotificationRecipientType, id: string): Promise<Recipient | null> {
    if (type === 'CUSTOMER') {
      const customer = await deps.customers.findById(id);
      if (customer === null || customer.status !== 'ACTIVE') return null;
      return {
        type,
        id: customer.id,
        language: customer.language,
        ...(customer.pushToken === undefined ? {} : { pushToken: customer.pushToken }),
      };
    }
    const member = await deps.members.findById(id);
    if (member === null || !member.active) return null;
    return {
      type,
      id: member.id,
      language: member.language,
      ...(member.pushToken === undefined ? {} : { pushToken: member.pushToken }),
    };
  },
});
