import { isAllowedLink, sanitizeHtml } from './sanitize';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** Inline grammar: links, **bold**, *italic* / _italic_. Everything else is escaped text. */
function inline(raw: string): string {
  const links: string[] = [];
  const withTokens = escapeHtml(raw).replace(LINK, (whole, text: string, href: string) => {
    const url = href.replace(/&amp;/g, '&');
    if (!isAllowedLink(url)) return whole;
    links.push(`<a href="${escapeHtml(url)}">${text}</a>`);
    return `\u0000${String(links.length - 1)}\u0000`;
  });
  const formatted = withTokens
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![*\w])\*(?=\S)(.+?)(?<=\S)\*(?![*\w])/g, '<em>$1</em>')
    .replace(/(?<![_\w])_(?=\S)(.+?)(?<=\S)_(?![_\w])/g, '<em>$1</em>');
  // eslint-disable-next-line no-control-regex -- the placeholders are NUL-delimited on purpose (text cannot contain them after escaping)
  return formatted.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => links[Number(i)] ?? '');
}

type Block = { kind: 'p' | 'h2' | 'h3'; lines: string[] } | { kind: 'ul' | 'ol'; lines: string[] };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const push = (kind: Block['kind'], line: string, joinPrevious: boolean) => {
    const last = blocks[blocks.length - 1];
    if (joinPrevious && last?.kind === kind) last.lines.push(line);
    else blocks.push({ kind, lines: [line] });
  };
  let paragraphOpen = false;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const text = line.trimEnd();
    const heading = /^(#{2,3})\s+(.*)$/.exec(text);
    const bullet = /^[-*]\s+(.*)$/.exec(text);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(text);
    if (text.trim() === '') paragraphOpen = false;
    else if (heading) {
      push(heading[1] === '##' ? 'h2' : 'h3', heading[2] ?? '', false);
      paragraphOpen = false;
    } else if (bullet) {
      push('ul', bullet[1] ?? '', true);
      paragraphOpen = false;
    } else if (numbered) {
      push('ol', numbered[1] ?? '', true);
      paragraphOpen = false;
    } else {
      push('p', text, paragraphOpen);
      paragraphOpen = true;
    }
  }
  return blocks;
}

/** Markdown subset -> sanitized HTML. Headings `##`/`###`, lists, **bold**, *italic*, [links](https://...). */
export function markdownToHtml(markdown: string): string {
  const html = parseBlocks(markdown)
    .map((block) => {
      if (block.kind === 'ul' || block.kind === 'ol')
        return `<${block.kind}>${block.lines.map((l) => `<li>${inline(l)}</li>`).join('')}</${block.kind}>`;
      const body = block.lines.map(inline).join('<br>');
      return `<${block.kind}>${body}</${block.kind}>`;
    })
    .join('');
  return sanitizeHtml(html);
}

function toMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element)) return '';
  const inner = () => [...node.childNodes].map(toMarkdown).join('');
  switch (node.tagName.toLowerCase()) {
    case 'h2':
      return `## ${inner()}\n\n`;
    case 'h3':
      return `### ${inner()}\n\n`;
    case 'p':
      return `${inner()}\n\n`;
    case 'br':
      return '\n';
    case 'strong':
      return `**${inner()}**`;
    case 'em':
      return `*${inner()}*`;
    case 'a':
      return `[${inner()}](${node.getAttribute('href') ?? ''})`;
    case 'ul':
      return `${[...node.children].map((li) => `- ${toMarkdown(li).trim()}`).join('\n')}\n\n`;
    case 'ol':
      return `${[...node.children].map((li, i) => `${String(i + 1)}. ${toMarkdown(li).trim()}`).join('\n')}\n\n`;
    default:
      return inner();
  }
}

/** Server HTML -> the Markdown subset the editor edits (sanitized first; unknown markup is flattened to text). */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${sanitizeHtml(html)}</body>`, 'text/html');
  return toMarkdown(doc.body)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
