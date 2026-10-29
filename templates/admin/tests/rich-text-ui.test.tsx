import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Language } from '@/constants/i18n';
import {
  LocalizedRichTextEditor,
  type LocalizedHtml,
} from '@/presentation/components/form/LocalizedRichTextEditor';
import { RichTextEditor } from '@/presentation/components/form/RichTextEditor';
import { SchedulePicker, type Schedule } from '@/presentation/components/form/SchedulePicker';
import { RichTextSection } from '@/presentation/pages/design/RichTextSection';
import { htmlToReact } from '@/presentation/utils/htmlToReact';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';

function Editor({ initial = '', language = 'en' }: { initial?: string; language?: Language }) {
  const [html, setHtml] = useState(initial);
  return (
    <>
      <RichTextEditor label="Body" language={language} value={html} onChange={setHtml} />
      <output>{html}</output>
      <button type="button" onClick={() => setHtml('<p>reset</p>')}>
        reset
      </button>
    </>
  );
}
const box = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Body' });

describe('RichTextEditor', () => {
  it('typing Markdown emits sanitized HTML and draws the preview', async () => {
    renderWithApp(<Editor />);
    await userEvent.type(box(), '## Hello{enter}{enter}**bold** text');
    expect(screen.getByRole('status')).toHaveTextContent(
      '<h2>Hello</h2><p><strong>bold</strong> text</p>',
    );
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(preview.querySelector('h2')).toHaveTextContent('Hello');
    expect(preview.querySelector('strong')).toHaveTextContent('bold');
  });

  it('loads existing HTML as editable Markdown and flattens unsafe markup', () => {
    renderWithApp(<Editor initial={'<h2>T</h2><p>a <em>b</em><script>bad()</script></p>'} />);
    expect(box()).toHaveValue('## T\n\na *b*');
  });

  it('never puts scripts or event handlers in the preview or the output', () => {
    renderWithApp(<Editor />);
    fireEvent.change(box(), {
      target: { value: '<img src=x onerror=alert(1)> [x](javascript:alert(1))' },
    });
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(preview.querySelector('img, script, a')).toBeNull();
    expect(screen.getByRole('status').textContent).not.toMatch(/<img|<script|href="javascript/);
  });

  it('toolbar buttons format the selection and keep it selected', async () => {
    renderWithApp(<Editor />);
    await userEvent.type(box(), 'say hello now');
    box().setSelectionRange(4, 9);
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box()).toHaveValue('say **hello** now');
    expect([box().selectionStart, box().selectionEnd]).toEqual([6, 11]);
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box()).toHaveValue('say hello now');
  });

  it('list, heading and link buttons work', async () => {
    renderWithApp(<Editor />);
    await userEvent.type(box(), 'one');
    await userEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    expect(box()).toHaveValue('- one');
    await userEvent.click(screen.getByRole('button', { name: 'Numbered list' }));
    expect(box()).toHaveValue('1. one');
    await userEvent.click(screen.getByRole('button', { name: 'Heading' }));
    expect(box()).toHaveValue('## one');
    await userEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(box().value).toContain('](https://)');
  });

  it('shows a value replaced from outside without losing typing in between', async () => {
    renderWithApp(<Editor initial="<p>first</p>" />);
    expect(box()).toHaveValue('first');
    await userEvent.type(box(), ' more');
    expect(box()).toHaveValue('first more');
    await userEvent.click(screen.getByRole('button', { name: 'reset' }));
    expect(box()).toHaveValue('reset');
  });

  it('writes Arabic right-to-left inside an English page', () => {
    renderWithApp(<Editor language="ar" />);
    expect(box()).toHaveAttribute('dir', 'rtl');
    expect(box()).toHaveAttribute('lang', 'ar');
    expect(screen.getByRole('region', { name: 'Preview' })).toHaveAttribute('dir', 'rtl');
  });
});

describe('LocalizedRichTextEditor', () => {
  it('has an Arabic and an English tab that edit their own text', async () => {
    const seen = vi.fn();
    function Pair() {
      const [value, setValue] = useState<LocalizedHtml>({ ar: '', en: '' });
      seen(value);
      return (
        <LocalizedRichTextEditor
          label="Page"
          value={value}
          onChange={setValue}
          errors={{ en: 'English is required' }}
        />
      );
    }
    renderWithApp(<Pair />);
    expect(screen.getByRole('tab', { name: 'Arabic' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.type(screen.getByRole('textbox', { name: 'Page · Arabic' }), 'مرحبا');
    await userEvent.click(screen.getByRole('tab', { name: 'English' }));
    expect(screen.getByRole('alert')).toHaveTextContent('English is required');
    await userEvent.type(screen.getByRole('textbox', { name: 'Page · English' }), 'Hello');
    expect(seen).toHaveBeenLastCalledWith({ ar: '<p>مرحبا</p>', en: '<p>Hello</p>' });
  });
});

describe('SchedulePicker', () => {
  function Harness({ initial = { start: '', end: '' } as Schedule }) {
    const [value, setValue] = useState<Schedule>(initial);
    return (
      <>
        <SchedulePicker startLabel="Starts" endLabel="Ends" value={value} onChange={setValue} />
        <output>{`${value.start}|${value.end}`}</output>
      </>
    );
  }

  it('limits each date by the other so the end is always after the start', () => {
    renderWithApp(<Harness initial={{ start: '2026-10-10', end: '2026-10-20' }} />);
    expect(screen.getByLabelText('Starts')).toHaveAttribute('max', '2026-10-19');
    expect(screen.getByLabelText('Ends')).toHaveAttribute('min', '2026-10-11');
  });

  it('shows the order error when the end is not after the start', () => {
    renderWithApp(<Harness />);
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-10-10' } });
    expect(screen.getByRole('alert')).toHaveTextContent('The end must be after the start');
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-10-11' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('2026-10-10|2026-10-11');
  });

  it('shows errors passed by the form', () => {
    renderWithApp(
      <SchedulePicker
        startLabel="Starts"
        endLabel="Ends"
        value={{ start: '', end: '' }}
        onChange={() => undefined}
        startError="Required"
        endError="Also required"
      />,
    );
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Required',
      'Also required',
    ]);
  });
});

describe('htmlToReact', () => {
  it('rebuilds only allowed elements and drops everything else', () => {
    renderWithApp(
      <div>
        {htmlToReact(
          '<h2>T</h2><p onclick="x()">a<script>bad()</script> <a href="javascript:x()">no</a> <a href="https://x.test">yes</a></p>',
        )}
      </div>,
    );
    expect(screen.getByRole('heading', { name: 'T' })).toBeVisible();
    expect(document.querySelector('script, [onclick]')).toBeNull();
    expect(screen.getByRole('link', { name: 'yes' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'no' })).toBeNull();
    expect(screen.getByText(/no/)).toBeInTheDocument();
  });
});

describe('RichTextSection (gallery)', () => {
  it('is accessible', async () => {
    renderWithApp(
      <main>
        <RichTextSection />
      </main>,
    );
    expect(await axeViolations()).toEqual([]);
  });
});
