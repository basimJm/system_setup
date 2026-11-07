import { ERROR_CODES } from '../src/constants/storage';
import {
  assertConfirmRequest,
  assertKey,
  assertSignedRequest,
  assertTtl,
  assertUploadRequest,
  assertWriteRequest,
  encodeKey,
  run,
} from '../src/validation';

const upload = {
  key: 'shops/1/photo.jpg',
  visibility: 'PUBLIC' as const,
  contentType: 'image/jpeg',
  maxBytes: 10,
  expiresInSec: 60,
};

const codeOf = (work: () => unknown): string | undefined => {
  try {
    work();
  } catch (error) {
    return (error as { code: string }).code;
  }
  return undefined;
};

describe('validation', () => {
  it('accepts server-generated keys and refuses the rest', () => {
    expect(() => {
      assertKey('a/b-c/d_e.f');
    }).not.toThrow();
    for (const bad of ['', '/a', 'a//b', 'a/../b', '.hidden/x', 'a b', 'x'.repeat(1_025)])
      expect(
        codeOf(() => {
          assertKey(bad);
        }),
      ).toBe(ERROR_CODES.KEY_INVALID);
    expect(
      codeOf(() => {
        assertKey(5 as unknown as string);
      }),
    ).toBe(ERROR_CODES.KEY_INVALID);
  });

  it('checks every field of an upload request', () => {
    expect(() => {
      assertUploadRequest(upload, 300);
    }).not.toThrow();
    const failing = [
      { ...upload, visibility: 'SECRET' as 'PUBLIC' },
      { ...upload, contentType: 'jpeg' },
      { ...upload, contentType: 7 as unknown as string },
      { ...upload, maxBytes: 0 },
      { ...upload, maxBytes: 1.5 },
      { ...upload, expiresInSec: 301 },
      { ...upload, expiresInSec: -1 },
    ];
    for (const request of failing)
      expect(
        codeOf(() => {
          assertUploadRequest(request, 300);
        }),
      ).toBe(ERROR_CODES.VALIDATION_FAILED);
  });

  it('caps the TTL at the smaller of the configured and the SigV4 maximum', () => {
    expect(() => {
      assertTtl(604_800, 999_999_999);
    }).not.toThrow();
    expect(
      codeOf(() => {
        assertTtl(604_801, 999_999_999);
      }),
    ).toBe(ERROR_CODES.VALIDATION_FAILED);
  });

  it('checks confirm, signed and write requests', () => {
    expect(() => {
      assertConfirmRequest(upload);
      assertSignedRequest({ key: upload.key, expiresInSec: 5 }, 600);
      assertWriteRequest({ ...upload, body: Buffer.from('x') });
    }).not.toThrow();
    expect(
      codeOf(() => {
        assertConfirmRequest({ ...upload, maxBytes: -1 });
      }),
    ).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(
      codeOf(() => {
        assertSignedRequest({ key: upload.key, expiresInSec: 601 }, 600);
      }),
    ).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(
      codeOf(() => {
        assertWriteRequest({ ...upload, body: 'text' as unknown as Buffer });
      }),
    ).toBe(ERROR_CODES.VALIDATION_FAILED);
  });

  it('encodes key segments and turns sync throws into rejections', async () => {
    expect(encodeKey('a b/c#d')).toBe('a%20b/c%23d');
    await expect(run(() => 1)).resolves.toBe(1);
    await expect(
      run(() => {
        throw new Error('sync');
      }),
    ).rejects.toThrow('sync');
    await expect(
      run(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'text';
      }),
    ).rejects.toThrow('text');
  });
});
