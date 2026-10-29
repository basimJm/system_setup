import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type Language } from '@/constants/i18n';
import { Tabs } from '../data/Tabs';
import { RichTextEditor } from './RichTextEditor';

export type LocalizedHtml = Readonly<Record<Language, string>>;

export interface LocalizedRichTextEditorProps {
  label: string;
  value: LocalizedHtml;
  onChange: (value: LocalizedHtml) => void;
  /** Errors per language (shown inside that language's tab). */
  errors?: Partial<Record<Language, string>>;
}

/** The Arabic and English versions of one text (legal pages): one tab per language. */
export function LocalizedRichTextEditor({
  label,
  value,
  onChange,
  errors = {},
}: LocalizedRichTextEditorProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Language>(LANGUAGES[0]);
  return (
    <Tabs
      ariaLabel={label}
      activeId={active}
      onChange={(id) => setActive(LANGUAGES.find((l) => l === id) ?? LANGUAGES[0])}
      items={LANGUAGES.map((language) => ({
        id: language,
        label: t(`richText.language.${language}`),
        content: (
          <RichTextEditor
            label={`${label} · ${t(`richText.language.${language}`)}`}
            language={language}
            value={value[language]}
            error={errors[language]}
            onChange={(html) => onChange({ ...value, [language]: html })}
          />
        ),
      }))}
    />
  );
}
