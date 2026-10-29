export interface Finding {
  file: string;
  line: number;
  rule: string;
  text: string;
}

interface Rule {
  name: string;
  pattern: RegExp;
  /** File kinds the rule applies to. */
  kinds: ReadonlyArray<'code' | 'jsx' | 'css'>;
}

const ALLOW_MARKER = 'hardcoded-ok';

const RULES: readonly Rule[] = [
  { name: 'url', pattern: /https?:\/\/[^\s'"`)]+/, kinds: ['code', 'jsx', 'css'] },
  { name: 'ip-address', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b/, kinds: ['code', 'jsx'] },
  {
    name: 'hex-color',
    pattern: /(?:['"`]|:\s*)#[0-9a-fA-F]{3,8}\b/,
    kinds: ['code', 'jsx', 'css'],
  },
  { name: 'color-function', pattern: /\b(?:rgba?|hsla?)\(/, kinds: ['code', 'jsx', 'css'] },
  {
    name: 'secret',
    pattern: /(?:api[_-]?key|secret|passw(?:or)?d|token)\s*[:=]\s*['"][A-Za-z0-9+/_=-]{8,}['"]/i,
    kinds: ['code', 'jsx'],
  },
  { name: 'jsx-text', pattern: /[\w"'}/)]>([^<>{}\n]*\p{L}[^<>{}\n]*)</u, kinds: ['jsx'] },
  {
    name: 'jsx-attribute-text',
    pattern: /\s(?:aria-label|title|placeholder|alt)="[^"{]*\p{L}[^"]*"/u,
    kinds: ['jsx'],
  },
  {
    name: 'timer-literal',
    pattern: /set(?:Timeout|Interval)\([^,]+,\s*\d{3,}/,
    kinds: ['code', 'jsx'],
  },
  {
    name: 'css-length',
    pattern: /(?<![\w.-])(?:\d+\.\d+|[1-9]\d*)(?:px|rem|em|ms|s)\b/,
    kinds: ['css'],
  },
];

const kindOf = (file: string): 'code' | 'jsx' | 'css' | null => {
  if (file.endsWith('.tsx')) return 'jsx';
  if (file.endsWith('.ts')) return 'code';
  if (file.endsWith('.css')) return 'css';
  return null;
};

/** Paths where literals are the point: tokens, constants, locale/test data and ambient types. */
export const EXEMPT = [
  /(^|\/)src\/constants\//,
  /(^|\/)src\/design\/tokens\//,
  /\.d\.ts$/,
  /(^|\/)src\/locales\//,
];

const isComment = (line: string): boolean => /^\s*(?:\/\/|\/?\*)/.test(line);

export function scanSource(file: string, content: string): Finding[] {
  const kind = kindOf(file);
  if (!kind || EXEMPT.some((e) => e.test(file))) return [];
  const findings: Finding[] = [];
  content.split('\n').forEach((text, index) => {
    if (isComment(text) || text.includes(ALLOW_MARKER)) return;
    for (const rule of RULES) {
      if (rule.kinds.includes(kind) && rule.pattern.test(text)) {
        findings.push({ file, line: index + 1, rule: rule.name, text: text.trim() });
      }
    }
  });
  return findings;
}

export const lineCount = (content: string): number =>
  content.split('\n').length - (content.endsWith('\n') ? 1 : 0);

export function overLimit(files: ReadonlyArray<{ file: string; content: string }>, max: number) {
  return files
    .filter((f) => lineCount(f.content) > max)
    .map((f) => ({ file: f.file, lines: lineCount(f.content) }));
}
