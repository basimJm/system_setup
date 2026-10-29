import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { read, SRC } from './helpers/files';

const css = read(join(SRC, 'design', 'styles', 'overlay.css'));
const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
};

// e2e finding (real stack, catalog "Add a service" after an image upload): the drawer grew to 979 px in an
// 822 px window and Save could not be reached. jsdom has no layout, so the rules that bound it are locked here;
// the browser check measures the result.
describe('drawer stays inside the viewport', () => {
  it('the drawer overlay has one row exactly the overlay tall', () => {
    expect(rule('.app-overlay--drawer')).toContain('grid-template-rows: minmax(0, 1fr)');
  });

  it('the drawer fills that row and its body is the scrolling middle row', () => {
    expect(rule('.app-drawer')).toContain('height: 100%');
    expect(rule('.app-drawer')).toContain('grid-template-rows: auto minmax(0, 1fr) auto');
    expect(rule('.app-modal__body')).toContain('overflow-y: auto');
  });
});
