declare const brand: unique symbol;

/** Nominal typing: an `ItemId` cannot be passed where an `AdminId` is expected. */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };

/** Server ids are opaque non-empty strings (Mongo ObjectIds today). */
export type Id<Name extends string> = Brand<string, Name>;

export type AdminId = Id<'Admin'>;
export type ItemId = Id<'Item'>;

/** Marks a string from the server as an id of kind `Name`; empty strings are a programmer error. */
export function toId<Name extends string>(value: string): Id<Name> {
  if (value.trim() === '') throw new RangeError('id must be a non-empty string');
  return value as Id<Name>;
}
