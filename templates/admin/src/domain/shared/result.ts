export type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function mapResult<T, U, E>(result: Result<T, E>, map: (value: T) => U): Result<U, E> {
  return result.ok ? ok(map(result.value)) : result;
}

/** Runs `task`, turning a throw or rejection into `err`. */
export async function attempt<T>(task: () => Promise<T>): Promise<Result<T, unknown>> {
  try {
    return ok(await task());
  } catch (error) {
    return err(error);
  }
}
