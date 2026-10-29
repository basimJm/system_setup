const SAFE_PROTOCOLS: readonly string[] = ['https:', 'http:', 'mailto:', 'tel:'];

/** True for links that are safe to render as `<a href>`: absolute http(s), mailto or tel (never `javascript:`). */
export function isSafeExternalHref(href: string): boolean {
  try {
    return SAFE_PROTOCOLS.includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

const FILE_PROTOCOLS: readonly string[] = ['https:', 'blob:'];

/** Private files (licenses, IDs) are only shown from signed https URLs, or from a local `blob:` preview. */
export function isPrivateFileUrl(url: string): boolean {
  try {
    return FILE_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
