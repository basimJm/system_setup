import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles, SRC } from './helpers/files';

const COMPONENTS = join(SRC, 'presentation', 'components');
const GALLERY = join(SRC, 'presentation', 'pages');

/** Internal parts: shown through the component that owns them, never used on their own by a page. */
const SHOWN_THROUGH_PARENT: Readonly<Record<string, string>> = {
  Axes: 'LineChart / BarChart',
  ChartFrame: 'every chart',
  Legend: 'LineChart / BarChart / DonutChart',
  SelectBox: 'DataTable',
  TableHead: 'DataTable',
  TableRow: 'DataTable',
  OptionList: 'Combobox / MultiSelect',
  Field: 'every form field',
  LiveIndicator: 'PageHeader',
  ResourceDrawer: 'Drawer (gallery) + every admin form panel',
  RichTextEditor: 'LocalizedRichTextEditor',
  Popover: 'Menu / ExportMenu / ColumnPicker',
  Modal: 'ConfirmDialog / ReasonDialog / Drawer behaviour',
};

const read = (files: string[]) => files.map((f) => readFileSync(f, 'utf8')).join('\n');

describe('design-system gallery', () => {
  const gallerySource = read(
    listFiles(GALLERY, /(DesignSystemPage|design[\\/][A-Za-z]+Section)\.tsx$/),
  );
  const components = listFiles(COMPONENTS, /\.tsx$/).map((f) =>
    f.split(/[\\/]/).pop()!.replace('.tsx', ''),
  );

  it('has a component file list to check', () => {
    expect(components.length).toBeGreaterThan(40);
  });

  it('shows every shared component, or names the component that shows it', () => {
    const missing = components.filter(
      (name) => !new RegExp(`\\b${name}\\b`).test(gallerySource) && !(name in SHOWN_THROUGH_PARENT),
    );
    expect(missing).toEqual([]);
  });

  it('an exemption still names a real component that the gallery shows', () => {
    for (const [name, parent] of Object.entries(SHOWN_THROUGH_PARENT)) {
      expect(components, name).toContain(name);
      const shown = parent
        .split(/ \/ |, | and /)
        .some(
          (p) =>
            new RegExp(`\\b${p.trim()}\\b`).test(gallerySource) ||
            p.includes('every') ||
            p.includes('behaviour'),
        );
      expect(shown, `${name} via ${parent}`).toBe(true);
    }
  });

  it('every section file is mounted in the gallery page', () => {
    const sections = readdirSync(join(GALLERY, 'design')).filter((f) => f.endsWith('Section.tsx'));
    const page = readFileSync(join(GALLERY, 'DesignSystemPage.tsx'), 'utf8');
    const notMounted = sections
      .map((f) => f.replace('.tsx', ''))
      .filter((name) => !page.includes(`<${name} />`));
    expect(notMounted).toEqual([]);
  });
});
