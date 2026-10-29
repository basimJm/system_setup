/** Tags the sanitizer keeps. Everything else is unwrapped (text kept) or dropped with its content. */
export const ALLOWED_TAGS = ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'] as const;
/** Tags removed together with everything inside them. */
export const DROPPED_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'noscript',
  'svg',
  'math',
] as const;
export const ALLOWED_LINK_PROTOCOLS = ['https:', 'http:', 'mailto:'] as const;
export const LINK_REL = 'noopener noreferrer';
export const LINK_TARGET = '_blank';
export const LINK_PLACEHOLDER = 'https://';
/** Sample legal page shown by the gallery, per language (already sanitized HTML, as the server stores it). */
export const GALLERY_SAMPLE_PAGES = {
  ar: '<h2>الشروط والأحكام</h2><p>اقرأ <strong>الشروط</strong> بعناية.</p>',
  en: '<h2>Terms</h2><p>Please read the <strong>terms</strong> carefully.</p>',
} as const;
