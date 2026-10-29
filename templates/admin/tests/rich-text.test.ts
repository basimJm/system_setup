import { describe, expect, it } from 'vitest';
import { LINK_PLACEHOLDER } from '@/constants/richText';
import { htmlToMarkdown, markdownToHtml } from '@/infrastructure/richText/markdown';
import { isAllowedLink, sanitizeHtml } from '@/infrastructure/richText/sanitize';
import { applyFormat } from '@/presentation/utils/textFormat';

describe('sanitizeHtml', () => {
  it('keeps the allowed tags and text', () => {
    const html =
      '<h2>T</h2><p>a <strong>b</strong> <em>c</em></p><ul><li>x</li></ul><ol><li>y</li></ol>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it.each([
    ['<script>alert(1)</script>ok', 'ok'],
    ['<style>p{color:red}</style>ok', 'ok'],
    ['<iframe src="https://x.test"></iframe>ok', 'ok'],
    ['<object data="x"></object><embed src="x">ok', 'ok'],
    ['<svg onload="alert(1)"><circle/></svg>ok', 'ok'],
    ['<img src=x onerror="alert(1)">ok', 'ok'],
    ['<p onclick="alert(1)" style="color:red" class="x">hi</p>', '<p>hi</p>'],
    ['<div><span>plain</span></div>', 'plain'],
    ['<b>old</b><i>style</i>', 'oldstyle'],
  ])('removes dangerous or unknown markup: %s', (input, expected) => {
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('keeps safe links with forced rel and target, strips every other attribute', () => {
    const out = sanitizeHtml(
      '<a href="https://x.test/a?b=1" onclick="x()" style="y" title="t">go</a>',
    );
    expect(out).toBe(
      '<a href="https://x.test/a?b=1" rel="noopener noreferrer" target="_blank">go</a>',
    );
    expect(sanitizeHtml('<a href="mailto:a@b.co">m</a>')).toContain('mailto:a@b.co');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
    '/relative/path',
    '//evil.test',
    '',
  ])('turns a link with the unsafe address %j into plain text', (href) => {
    expect(sanitizeHtml(`<a href="${href}">click</a>`)).toBe('click');
  });

  it('escapes text so it cannot become markup', () => {
    expect(sanitizeHtml('&lt;script&gt;x&lt;/script&gt;')).toBe('&lt;script&gt;x&lt;/script&gt;');
    expect(sanitizeHtml('a < b & c')).toBe('a &lt; b &amp; c');
  });

  it('survives empty, broken and deeply nested input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml('<p><strong>open')).toBe('<p><strong>open</strong></p>');
    expect(sanitizeHtml(`${'<ul><li>'.repeat(50)}deep`)).toContain('deep');
  });

  it('isAllowedLink', () => {
    expect(isAllowedLink('https://a.test')).toBe(true);
    expect(isAllowedLink('http://a.test')).toBe(true);
    expect(isAllowedLink('ftp://a.test')).toBe(false);
    expect(isAllowedLink('nope')).toBe(false);
  });
});

describe('markdownToHtml', () => {
  it.each([
    ['Hello', '<p>Hello</p>'],
    ['## Title', '<h2>Title</h2>'],
    ['### Sub', '<h3>Sub</h3>'],
    [
      '**bold** and *it* and _it2_',
      '<p><strong>bold</strong> and <em>it</em> and <em>it2</em></p>',
    ],
    ['- a\n- b', '<ul><li>a</li><li>b</li></ul>'],
    ['* a\n* b', '<ul><li>a</li><li>b</li></ul>'],
    ['1. a\n2. b', '<ol><li>a</li><li>b</li></ol>'],
    ['line one\nline two', '<p>line one<br>line two</p>'],
    ['para one\n\npara two', '<p>para one</p><p>para two</p>'],
    ['', ''],
    ['\n\n  \n', ''],
  ])('%j -> %s', (md, html) => expect(markdownToHtml(md)).toBe(html));

  it('turns a link into a safe anchor', () => {
    expect(markdownToHtml('[site](https://x.test/p?a=1&b=2)')).toBe(
      '<p><a href="https://x.test/p?a=1&amp;b=2" rel="noopener noreferrer" target="_blank">site</a></p>',
    );
  });

  it('never creates an unsafe link or active HTML from what the user types', () => {
    const out = markdownToHtml(
      '[x](javascript:alert(1)) <script>alert(1)</script> <img src=x onerror=alert(1)>',
    );
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('href="javascript');
    expect(out).toContain('&lt;script&gt;');
  });

  it('keeps underscores inside words and asterisks around spaces as text', () => {
    expect(markdownToHtml('snake_case_name')).toBe('<p>snake_case_name</p>');
    expect(markdownToHtml('2 * 3 * 4')).toBe('<p>2 * 3 * 4</p>');
  });

  it('handles Arabic text and mixed direction', () => {
    expect(markdownToHtml('## الشروط\n\n**مهم**: اقرأ')).toBe(
      '<h2>الشروط</h2><p><strong>مهم</strong>: اقرأ</p>',
    );
  });

  it('a heading or list ends the paragraph before it', () => {
    expect(markdownToHtml('intro\n## Head\n- a')).toBe(
      '<p>intro</p><h2>Head</h2><ul><li>a</li></ul>',
    );
  });
});

describe('htmlToMarkdown', () => {
  it('converts the allowed tags back to the subset', () => {
    const html =
      '<h2>T</h2><p>a <strong>b</strong> <em>c</em> <a href="https://x.test">l</a></p><ul><li>x</li><li>y</li></ul><ol><li>1st</li></ol>';
    expect(htmlToMarkdown(html)).toBe(
      '## T\n\na **b** *c* [l](https://x.test)\n\n- x\n- y\n\n1. 1st',
    );
  });

  it('flattens unknown and dangerous markup to text', () => {
    expect(htmlToMarkdown('<div>hi <script>bad()</script><span>there</span></div>')).toBe(
      'hi there',
    );
  });

  it('round trips an edited document', () => {
    const md =
      '## Terms\n\nPay **now** or *later*.\n\n- one\n- two\n\n1. first\n2. second\n\nSee [site](https://x.test).';
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });
});

describe('applyFormat', () => {
  const at = (text: string, start: number, end = start) => ({ text, start, end });

  it('bold wraps the selection and selects the same words', () => {
    expect(applyFormat(at('say hello now', 4, 9), 'bold', LINK_PLACEHOLDER)).toEqual(
      at('say **hello** now', 6, 11),
    );
  });

  it('bold on an already bold selection removes the markers', () => {
    expect(applyFormat(at('say **hello** now', 6, 11), 'bold', LINK_PLACEHOLDER)).toEqual(
      at('say hello now', 4, 9),
    );
  });

  it('with no selection the markers go around the caret', () => {
    expect(applyFormat(at('ab', 1), 'italic', LINK_PLACEHOLDER)).toEqual(at('a**b', 2));
  });

  it('link wraps the selection and selects the address placeholder', () => {
    const result = applyFormat(at('go here', 3, 7), 'link', LINK_PLACEHOLDER);
    expect(result.text).toBe('go [here](https://)');
    expect(result.text.slice(result.start, result.end)).toBe(LINK_PLACEHOLDER);
  });

  it('link with no selection puts the caret inside the brackets', () => {
    const result = applyFormat(at('x', 1), 'link', LINK_PLACEHOLDER);
    expect(result.text).toBe('x[](https://)');
    expect(result.start).toBe(2);
  });

  it('headings and lists act on every selected line and toggle off', () => {
    const two = at('a\nb\nc', 0, 3);
    const heading = applyFormat(two, 'h2', LINK_PLACEHOLDER);
    expect(heading.text).toBe('## a\n## b\nc');
    expect(applyFormat(heading, 'h2', LINK_PLACEHOLDER).text).toBe('a\nb\nc');
    const bullets = applyFormat(two, 'ul', LINK_PLACEHOLDER);
    expect(bullets.text).toBe('- a\n- b\nc');
    expect(applyFormat(bullets, 'ol', LINK_PLACEHOLDER).text).toBe('1. a\n2. b\nc');
    expect(applyFormat(at('## x', 2), 'h3', LINK_PLACEHOLDER).text).toBe('### x');
  });

  it('works on the line of the caret in the middle of a document', () => {
    expect(applyFormat(at('one\ntwo\nthree', 5), 'ul', LINK_PLACEHOLDER).text).toBe(
      'one\n- two\nthree',
    );
  });
});
