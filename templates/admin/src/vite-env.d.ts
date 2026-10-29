/// <reference types="vite/client" />

/** Public env values (`VITE_*`) resolved at build time by vite.config.ts. */
declare const __APP_ENV__: Readonly<Record<string, string | undefined>>;
/** Build variant name: dev-debug | dev-release | prod-debug | prod-release. */
declare const __BUILD_VARIANT__: string;
/** False in prod builds so the mock data source is tree-shaken out. */
declare const __ALLOW_MOCK__: boolean;
/** package.json version, injected at build time. */
declare const __APP_VERSION__: string;
/** Short git sha (or BUILD_ID override), injected at build time. */
declare const __BUILD_ID__: string;
/** True only in dev builds; false lets the bundler drop the DEV ribbon from prod builds. */
declare const __SHOW_ENV_RIBBON__: boolean;
/** True only in dev builds; false lets the bundler drop the design-system gallery (route, page and its strings) from prod builds. */
declare const __SHOW_DESIGN_SYSTEM__: boolean;
