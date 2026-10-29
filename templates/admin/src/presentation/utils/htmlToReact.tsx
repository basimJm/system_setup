import { createElement, type ReactNode } from 'react';
import { ALLOWED_TAGS, LINK_REL, LINK_TARGET } from '@/constants/richText';
import { isAllowedLink, sanitizeHtml } from '@/infrastructure/richText/sanitize';

const isAllowed = (tag: string): boolean => (ALLOWED_TAGS as readonly string[]).includes(tag);

function convert(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof Element)) return null;
  const tag = node.tagName.toLowerCase();
  const children = [...node.childNodes].map(convert);
  if (!isAllowed(tag)) return children;
  if (tag === 'br') return createElement('br', { key });
  if (tag === 'a') {
    const href = node.getAttribute('href') ?? '';
    return isAllowedLink(href)
      ? createElement('a', { key, href, rel: LINK_REL, target: LINK_TARGET }, ...children)
      : children;
  }
  return createElement(tag, { key }, ...children);
}

/**
 * Draws rich-text HTML as React elements instead of injecting it. The HTML is sanitized first and every
 * element is rebuilt from the allow-list, so there is no raw-HTML injection anywhere (project XSS rule).
 */
export function htmlToReact(html: string): ReactNode[] {
  const doc = new DOMParser().parseFromString(`<body>${sanitizeHtml(html)}</body>`, 'text/html');
  return [...doc.body.childNodes].map(convert);
}
