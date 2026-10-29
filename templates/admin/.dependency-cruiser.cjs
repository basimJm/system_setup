/** Layer rules mirror CLAUDE.md §2, ESLint `no-restricted-imports` and tests/architecture.test.ts. */
const LAYER_RULES = {
  domain: ['data', 'presentation', 'infrastructure', 'app', 'design'],
  infrastructure: ['data', 'presentation', 'app', 'design'],
  data: ['presentation', 'app', 'design'],
  design: ['data', 'presentation', 'app', 'domain'],
  presentation: ['data'],
};

/**
 * Feature slices (ADM-007): `domain/<feature>`, `data/<feature>`, `presentation/<feature>`.
 * A feature may import its own slice and the shared directories of its layer, never another feature.
 * `$1` is the feature name captured from the importing file's path.
 */
const SHARED = {
  domain: ['shared'],
  data: ['shared', 'contract', 'mock', 'api', 'realtime'],
  presentation: ['shared', 'components', 'layout', 'hooks', 'controllers', 'pages', 'utils'],
};

const featureRule = (layer) => ({
  name: `feature-isolation-${layer}`,
  severity: 'error',
  comment: `A ${layer} feature must not import another ${layer} feature (shared: ${SHARED[layer].join(', ')}).`,
  from: { path: `^src/${layer}/([^/]+)/`, pathNot: `^src/${layer}/(${SHARED[layer].join('|')})/` },
  to: {
    path: `^src/${layer}/[^/]+/`,
    pathNot: `^src/${layer}/($1|${SHARED[layer].join('|')})/`,
  },
});

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports hide layering mistakes.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    ...Object.keys(SHARED).map(featureRule),
    ...Object.entries(LAYER_RULES).map(([layer, forbidden]) => ({
      name: `layer-${layer}`,
      severity: 'error',
      comment: `"${layer}" must not depend on: ${forbidden.join(', ')}.`,
      from: { path: `^src/${layer}/` },
      to: { path: `^src/(${forbidden.join('|')})/` },
    })),
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.d\\.ts$' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
