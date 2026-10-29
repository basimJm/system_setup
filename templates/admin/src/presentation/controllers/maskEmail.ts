import { MASK_CHAR } from '@/constants/auth';

const MASK_LENGTH = 3;
const SHORT_LOCAL_PART = 2;

/** `admin@example.test` -> `a•••n@example.test`: shows enough to recognise the mailbox, not enough to reuse it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return email;
  const local = email.slice(0, at);
  const mask = MASK_CHAR.repeat(MASK_LENGTH);
  const tail = local.length > SHORT_LOCAL_PART ? local.slice(-1) : '';
  return `${local.slice(0, 1)}${mask}${tail}${email.slice(at)}`;
}
