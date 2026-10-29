import type { DocName } from '../constants/docs';

/**
 * Published contract per namespace: `openapi.info.version`, the fingerprint of the generated
 * document it belongs to, and the client impact of the last change. Edited only by
 * `npm run contract:bump -- <name> "<client impact>"`; `tests/contractGuard.test.ts` fails when
 * a generated document no longer matches its fingerprint.
 */
export const CONTRACT_VERSIONS: Readonly<
  Record<DocName, { readonly version: string; readonly sha256: string; readonly note: string }>
> = {
  common: {
    version: '1.0.0',
    sha256: '1f26c33d4e3e618758eb78b17de16ea36c3839d7c0ecca4bb55e552172f71656',
    note: 'Initial contract',
  },
  customer: {
    version: '1.0.0',
    sha256: '5e47bbc95c1874e4e21e32a0b1ad244da420023006d5bcb2e8655e6acc7c2faf',
    note: 'Initial contract',
  },
  merchant: {
    version: '1.0.0',
    sha256: '088c3768c6f6a2e0ca9ef3e8bc5f7ff64794811001525c59e8bc10bd19b9e49c',
    note: 'Initial contract',
  },
  admin: {
    version: '1.0.0',
    sha256: '917db869f5db7df87aedb9669f5f6bc4bd96c622091246f2021966195ba37c11',
    note: 'Initial contract',
  },
};
