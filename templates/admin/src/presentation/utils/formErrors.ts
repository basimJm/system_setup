import type { TFunction } from 'i18next';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { AppError } from '@/infrastructure/errors/AppError';
import { fieldErrorsFrom } from '@/infrastructure/errors/fieldErrors';

/** Translates a schema message key; unknown text (e.g. a server message) is shown as it is. */
export function errorText(t: TFunction, message: string | undefined): string | undefined {
  if (message === undefined || message === '') return undefined;
  return t(message, { defaultValue: message });
}

/** Puts the server's per-field `details[]` onto the form. Returns true when at least one field was marked. */
export function applyServerFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: AppError,
): boolean {
  const byField = fieldErrorsFrom(error);
  for (const [field, issue] of byField) {
    setError(field as Path<T>, { type: 'server', message: issue.message });
  }
  return byField.size > 0;
}

/** Message of a react-hook-form error entry (nested entries have none of their own). */
export const messageOf = (error: { message?: unknown } | undefined): string | undefined =>
  typeof error?.message === 'string' ? error.message : undefined;
