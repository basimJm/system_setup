import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LINK_PLACEHOLDER } from '@/constants/richText';
import type { Language } from '@/constants/i18n';
import { htmlToMarkdown, markdownToHtml } from '@/infrastructure/richText/markdown';
import { directionOf } from '@/infrastructure/i18n/i18n';
import { htmlToReact } from '../../utils/htmlToReact';
import { applyFormat, type FormatKind } from '../../utils/textFormat';
import { Button } from '../core/Button';
import { Field } from './Field';

const TOOLS: readonly FormatKind[] = ['bold', 'italic', 'h2', 'h3', 'ul', 'ol', 'link'];

export interface RichTextEditorProps {
  label: string;
  /** Sanitized HTML (what the server stores). */
  value: string;
  onChange: (html: string) => void;
  /** Language of the text being written: sets the editing and preview direction. */
  language: Language;
  error?: string | undefined;
  hint?: string | undefined;
  rows?: number;
}

/** Markdown-subset editor with a toolbar and a live preview; emits sanitized HTML (ADR-0006). */
export function RichTextEditor({
  label,
  value,
  onChange,
  language,
  error,
  hint,
  rows = 8,
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const area = useRef<HTMLTextAreaElement>(null);
  const [markdown, setMarkdown] = useState(() => htmlToMarkdown(value));
  const [emitted, setEmitted] = useState(value);
  const [selection, setSelection] = useState<{ start: number; end: number; tick: number } | null>(
    null,
  );

  // The parent replaced the value (a reset, a loaded record): show it. Our own edits come back equal and skip this.
  if (value !== emitted) {
    setEmitted(value);
    setMarkdown(htmlToMarkdown(value));
  }

  useLayoutEffect(() => {
    if (!selection || !area.current) return;
    area.current.focus();
    area.current.setSelectionRange(selection.start, selection.end);
  }, [selection]);

  const edit = (next: string) => {
    const html = markdownToHtml(next);
    setMarkdown(next);
    setEmitted(html);
    onChange(html);
  };
  const format = (kind: FormatKind) => {
    const el = area.current;
    if (!el) return;
    const result = applyFormat(
      { text: markdown, start: el.selectionStart, end: el.selectionEnd },
      kind,
      LINK_PLACEHOLDER,
    );
    edit(result.text);
    setSelection({ start: result.start, end: result.end, tick: (selection?.tick ?? 0) + 1 });
  };
  const direction = directionOf(language);

  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <div className="app-richtext">
          <div className="app-row" role="toolbar" aria-label={t('richText.toolbar')}>
            {TOOLS.map((tool) => (
              <Button key={tool} size="sm" variant="secondary" onClick={() => format(tool)}>
                {t(`richText.tool.${tool}`)}
              </Button>
            ))}
          </div>
          <textarea
            {...control}
            ref={area}
            className="app-field__control app-field__control--area"
            lang={language}
            dir={direction}
            rows={rows}
            value={markdown}
            onChange={(event) => edit(event.target.value)}
          />
          <div className="app-richtext__preview-label">{t('richText.preview')}</div>
          <div
            className="app-richtext__preview"
            lang={language}
            dir={direction}
            aria-label={t('richText.preview')}
            role="region"
          >
            {htmlToReact(markdownToHtml(markdown))}
          </div>
        </div>
      )}
    </Field>
  );
}
