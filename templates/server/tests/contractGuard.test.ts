import { DOC_NAMES } from '../src/constants/docs';
import { contractFingerprint, nextMinor, replaceContractEntry } from '../src/docs/contract';
import { CONTRACT_VERSIONS } from '../src/docs/contractVersions';
import { buildOpenApiDocuments } from '../src/docs/index';

const SEMVER = /^\d+\.\d+\.\d+$/;

describe('contract snapshot guard (SRV-111)', () => {
  const documents = buildOpenApiDocuments();

  it.each(DOC_NAMES)(
    '%s: the generated contract matches its recorded fingerprint (else run contract:bump with the client impact)',
    (name) => {
      const recorded = CONTRACT_VERSIONS[name];
      // On failure: `npm run contract:bump -- <name> "<client tasks to re-sync>"`, then `npm run docs`.
      expect({ name, sha256: contractFingerprint(documents[name]) }).toEqual({
        name,
        sha256: recorded.sha256,
      });
    },
  );

  it.each(DOC_NAMES)('%s: publishes its version and a client-impact note', (name) => {
    const recorded = CONTRACT_VERSIONS[name];
    expect(recorded.version).toMatch(SEMVER);
    expect(recorded.note.trim().length).toBeGreaterThan(0);
    expect((documents[name] as { info: { version: string } }).info.version).toBe(recorded.version);
  });

  it('the fingerprint ignores the version and sees any other change', () => {
    const doc = { openapi: '3.1.0', info: { title: 'x', version: '1.0.0' }, paths: {} };
    const sameButVersion = { ...doc, info: { ...doc.info, version: '9.9.9' } };
    const changed = { ...doc, paths: { '/a': {} } };
    expect(contractFingerprint(sameButVersion)).toBe(contractFingerprint(doc));
    expect(contractFingerprint(changed)).not.toBe(contractFingerprint(doc));
    expect(nextMinor('1.4.2')).toBe('1.5.0');
  });

  it('contract:bump replaces a whole entry even when its note has braces', () => {
    const source = [
      '  merchant: {',
      "    version: '1.2.0',",
      "    sha256: 'old',",
      "    note: 'GET /items/{id}/history',",
      '  },',
      '  admin: {',
      "    version: '1.0.0',",
      "    sha256: 'keep',",
      "    note: 'x',",
      '  },',
    ].join('\n');
    const next = replaceContractEntry(source, 'merchant', {
      version: '1.3.0',
      sha256: 'new',
      note: "it's {id}",
    });
    expect(next).toContain("version: '1.3.0'");
    expect(next).toContain("note: 'it\\'s {id}'");
    expect(next).toContain("sha256: 'keep'");
    expect(next).not.toContain("sha256: 'old'");
    const unknown = { version: '9.0.0', sha256: 'z', note: 'n' };
    expect(replaceContractEntry(source, 'customer', unknown)).toBe(source);
  });
});
