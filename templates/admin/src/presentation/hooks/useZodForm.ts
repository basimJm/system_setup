import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';

/**
 * The one way to build a form: react-hook-form validated by a zod schema (ADR 0004).
 * Messages in the schema are i18n keys; show them with `errorText`.
 */
export function useZodForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  defaultValues: DefaultValues<z.input<S>>,
): UseFormReturn<z.input<S>, unknown, z.output<S>> {
  return useForm<z.input<S>, unknown, z.output<S>>({
    // The resolver's generics cannot follow a schema type parameter; its input/output are exactly the schema's.
    resolver: zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>,
    defaultValues,
    mode: 'onTouched',
  });
}
