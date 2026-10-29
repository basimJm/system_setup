import { defineConfig } from 'tsup';

/**
 * Vendor SDKs (when a real adapter adds one) stay external: list them here, let the consumer
 * install them and load them lazily inside the adapter.
 */
const external: string[] = [];

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node22',
    external,
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    target: 'node22',
    external,
    // CommonJS consumers (Jest, ts-node) cannot run a native `import()`: turn lazy vendor loads
    // into `require()` calls. The ESM build keeps the native `import()`.
    esbuildOptions(options) {
      options.supported = { ...options.supported, 'dynamic-import': false };
    },
  },
]);
