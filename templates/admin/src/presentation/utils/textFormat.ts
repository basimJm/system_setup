export type FormatKind = 'bold' | 'italic' | 'link' | 'h2' | 'h3' | 'ul' | 'ol';

export interface TextState {
  readonly text: string;
  /** Selection start/end (caret when equal). */
  readonly start: number;
  readonly end: number;
}

const INLINE_MARKERS: Readonly<Record<'bold' | 'italic', string>> = { bold: '**', italic: '*' };

function toggleInline(state: TextState, marker: string): TextState {
  const { text, start, end } = state;
  const before = text.slice(start - marker.length, start);
  const after = text.slice(end, end + marker.length);
  if (start >= marker.length && before === marker && after === marker) {
    return {
      text:
        text.slice(0, start - marker.length) +
        text.slice(start, end) +
        text.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }
  return {
    text: `${text.slice(0, start)}${marker}${text.slice(start, end)}${marker}${text.slice(end)}`,
    start: start + marker.length,
    end: end + marker.length,
  };
}

function makeLink(state: TextState, placeholder: string): TextState {
  const { text, start, end } = state;
  const label = text.slice(start, end);
  const inserted = `[${label}](${placeholder})`;
  const urlStart = start + label.length + 3;
  return {
    text: text.slice(0, start) + inserted + text.slice(end),
    start: label === '' ? start + 1 : urlStart,
    end: label === '' ? start + 1 : urlStart + placeholder.length,
  };
}

const PREFIXES: Readonly<Record<'h2' | 'h3' | 'ul' | 'ol', RegExp>> = {
  h2: /^## /,
  h3: /^### /,
  ul: /^[-*] /,
  ol: /^\d+[.)] /,
};
const ANY_BLOCK_PREFIX = /^(#{2,3} |[-*] |\d+[.)] )/;

function prefixLines(state: TextState, kind: 'h2' | 'h3' | 'ul' | 'ol'): TextState {
  const { text, start, end } = state;
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const to = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(from, to).split('\n');
  const allSet = lines.every((l) => PREFIXES[kind].test(l));
  const changed = lines.map((line, i) => {
    const bare = line.replace(ANY_BLOCK_PREFIX, '');
    if (allSet) return bare;
    return kind === 'h2'
      ? `## ${bare}`
      : kind === 'h3'
        ? `### ${bare}`
        : kind === 'ul'
          ? `- ${bare}`
          : `${String(i + 1)}. ${bare}`;
  });
  const block = changed.join('\n');
  return {
    text: text.slice(0, from) + block + text.slice(to),
    start: from,
    end: from + block.length,
  };
}

/** What a toolbar button does to the text and selection of the editor's textarea. Pure, so it is testable. */
export function applyFormat(
  state: TextState,
  kind: FormatKind,
  linkPlaceholder: string,
): TextState {
  if (kind === 'bold' || kind === 'italic') return toggleInline(state, INLINE_MARKERS[kind]);
  if (kind === 'link') return makeLink(state, linkPlaceholder);
  return prefixLines(state, kind);
}
