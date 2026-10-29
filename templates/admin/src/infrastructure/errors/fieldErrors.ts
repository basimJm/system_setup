import type { AppError, FieldIssue } from './AppError';

/** What a form shows under one field: the server's own text when present, else a code to translate. */
export interface FieldError {
  readonly message: string | undefined;
  readonly code: string | undefined;
}

/**
 * Maps the server's `details[]` (one entry per invalid field, nested names like `name.ar`) to a lookup
 * by field. The first issue of a field wins; issues without a field are not form errors and are skipped.
 */
export function fieldErrorsFrom(source: AppError | readonly FieldIssue[]): Map<string, FieldError> {
  const issues = 'details' in source ? source.details : source;
  const result = new Map<string, FieldError>();
  for (const issue of issues) {
    if (issue.field === '' || result.has(issue.field)) continue;
    result.set(issue.field, { message: issue.message, code: issue.code });
  }
  return result;
}
