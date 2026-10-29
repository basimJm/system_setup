import axe, { type AxeResults, type RunOptions } from 'axe-core';

/** jsdom has no layout engine, so rules that need rendering (contrast, visibility geometry) cannot run here. */
const JSDOM_UNSUPPORTED_RULES = ['color-contrast', 'scrollable-region-focusable'];

const OPTIONS: RunOptions = {
  rules: Object.fromEntries(JSDOM_UNSUPPORTED_RULES.map((id) => [id, { enabled: false }])),
};

/** Runs axe-core on `root` and returns "rule: target" lines, so a failure names what to fix. */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const results: AxeResults = await axe.run(root, OPTIONS);
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`),
  );
}
