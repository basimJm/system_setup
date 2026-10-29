export interface BuildFile {
  name: string;
  /** Gzip size in bytes. */
  gzip: number;
  content?: string;
}

export interface Budget {
  entryJsGzipKb: number;
  chunkJsGzipKb: number;
  totalJsGzipKb: number;
  cssGzipKb: number;
}

const KB = 1024;
const GALLERY_CHUNK = 'DesignSystemPage';
/** Chunks that exist only in dev builds (mock data source and fake realtime): excluded from the budget, banned from prod. */
const MOCK_CHUNKS = [
  'mockTransport',
  'fixtures',
  'scenarios',
  'FakeRealtimeClient',
  'MockAuthRepository',
];
const DEV_ONLY_CHUNKS = [GALLERY_CHUNK, ...MOCK_CHUNKS];
const isDevOnlyChunk = (name: string): boolean => DEV_ONLY_CHUNKS.some((c) => name.includes(c));
/** Strings that must never reach a production bundle, with what each one gives away. */
export const PROD_FORBIDDEN_MARKERS: ReadonlyArray<{
  marker: string;
  what: string;
  /** Only release builds are minified and tree-shaken, so debug builds may still hold dead code. */
  releaseOnly?: boolean;
}> = [
  { marker: 'MockAuthRepository', what: 'mock code' },
  { marker: 'mock-access-token', what: 'mock code' },
  { marker: 'app-env-ribbon', what: 'the DEV ribbon' },
  { marker: 'designKits', what: 'design-system gallery strings', releaseOnly: true },
];

export interface BuildCheckInput {
  files: readonly BuildFile[];
  indexHtml: string;
  variant: string;
  budget: Budget;
}

const kb = (n: number) => (n / KB).toFixed(1);
const gzipSum = (files: readonly BuildFile[]) => files.reduce((sum, f) => sum + f.gzip, 0);

/** What users download: dev-only chunks are excluded (prod builds are proven not to contain them). */
const shipped = (js: readonly BuildFile[]): BuildFile[] =>
  js.filter((f) => !isDevOnlyChunk(f.name));

/** Size budgets (release builds only: debug builds are unminified on purpose). */
function sizeProblems(
  js: readonly BuildFile[],
  css: readonly BuildFile[],
  entry: BuildFile | undefined,
  budget: Budget & { checkTotal: boolean },
): string[] {
  const problems: string[] = [];
  if (entry && entry.gzip > budget.entryJsGzipKb * KB) {
    problems.push(
      `entry ${entry.name} is ${kb(entry.gzip)} KB gzip (budget ${budget.entryJsGzipKb})`,
    );
  }
  for (const f of js) {
    if (f !== entry && f.gzip > budget.chunkJsGzipKb * KB) {
      problems.push(`chunk ${f.name} is ${kb(f.gzip)} KB gzip (budget ${budget.chunkJsGzipKb})`);
    }
  }
  const totalJs = gzipSum(js);
  if (budget.checkTotal && totalJs > budget.totalJsGzipKb * KB)
    problems.push(`total JS ${kb(totalJs)} KB gzip (budget ${budget.totalJsGzipKb})`);
  const totalCss = gzipSum(css);
  if (totalCss > budget.cssGzipKb * KB)
    problems.push(`total CSS ${kb(totalCss)} KB gzip (budget ${budget.cssGzipKb})`);
  return problems;
}

/** Strings that must never reach a production bundle. */
function prodMarkerProblems(js: readonly BuildFile[], isRelease: boolean): string[] {
  return js.flatMap((f) => {
    const hit = PROD_FORBIDDEN_MARKERS.find(
      ({ marker, releaseOnly }) => (isRelease || !releaseOnly) && f.content?.includes(marker),
    );
    return hit ? [`prod build contains ${hit.what} ("${hit.marker}" in ${f.name})`] : [];
  });
}

/** The gallery and the mock data source are dev tools: no emitted file of a prod build may be one of their chunks. */
function prodGalleryProblems(js: readonly BuildFile[]): string[] {
  return js
    .filter((f) => isDevOnlyChunk(f.name))
    .map((f) => `prod build ships a dev-only chunk (${f.name})`);
}

/** Performance + security gate for one built variant. Returns human-readable problems. */
export function checkBuild({ files, indexHtml, variant, budget }: BuildCheckInput): string[] {
  const js = files.filter((f) => f.name.endsWith('.js'));
  const css = files.filter((f) => f.name.endsWith('.css'));
  const isRelease = variant.endsWith('-release');
  const entry = js.find((f) => indexHtml.includes(f.name));

  return [
    ...(entry ? [] : ['no entry script referenced by index.html']),
    ...(isRelease
      ? sizeProblems(shipped(js), css, entry, { ...budget, checkTotal: variant.startsWith('prod') })
      : []),
    ...(isRelease && files.some((f) => f.name.endsWith('.map'))
      ? ['release build ships source maps']
      : []),
    ...(variant.startsWith('prod') ? prodMarkerProblems(js, isRelease) : []),
    ...(variant.startsWith('prod') ? prodGalleryProblems(js) : []),
  ];
}
