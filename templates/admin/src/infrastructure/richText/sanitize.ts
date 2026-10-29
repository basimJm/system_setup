import {
  ALLOWED_LINK_PROTOCOLS,
  ALLOWED_TAGS,
  DROPPED_TAGS,
  LINK_REL,
  LINK_TARGET,
} from '@/constants/richText';

const isAllowedTag = (tag: string): boolean => (ALLOWED_TAGS as readonly string[]).includes(tag);
const isDroppedTag = (tag: string): boolean => (DROPPED_TAGS as readonly string[]).includes(tag);

/** True for absolute https/http/mailto links only (never `javascript:`, `data:` or relative ones). */
export function isAllowedLink(href: string): boolean {
  try {
    return (ALLOWED_LINK_PROTOCOLS as readonly string[]).includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

function copyInto(source: Node, target: Node, doc: Document): void {
  source.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      target.appendChild(doc.createTextNode(child.textContent ?? ''));
      return;
    }
    if (!(child instanceof Element)) return;
    const tag = child.tagName.toLowerCase();
    if (isDroppedTag(tag)) return;
    if (!isAllowedTag(tag)) {
      copyInto(child, target, doc);
      return;
    }
    const clean = doc.createElement(tag);
    if (tag === 'a') {
      const href = child.getAttribute('href') ?? '';
      if (!isAllowedLink(href)) {
        copyInto(child, target, doc);
        return;
      }
      clean.setAttribute('href', href);
      clean.setAttribute('rel', LINK_REL);
      clean.setAttribute('target', LINK_TARGET);
    }
    copyInto(child, clean, doc);
    target.appendChild(clean);
  });
}

/**
 * Rebuilds `html` from an allow-list: only known tags survive, with no attributes except a safe `href` on links.
 * Unknown tags keep their text; scripts, styles, frames and the like disappear with their content.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = doc.createElement('div');
  copyInto(doc.body, out, doc);
  return out.innerHTML;
}
