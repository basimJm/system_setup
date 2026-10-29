import { amzDate, encodeRfc3986, presignUrl, signHeaders } from '../src/adapters/s3/sigv4';

/** The AWS documentation examples (examplebucket, us-east-1, 2013-05-24). */
const scope = {
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  },
  now: () => new Date('2013-05-24T00:00:00Z'),
};

describe('sigv4', () => {
  it('formats dates and encodes as RFC 3986', () => {
    expect(amzDate(new Date('2026-10-28T10:15:00.123Z'))).toBe('20261028T101500Z');
    expect(encodeRfc3986("a b!'()*~")).toBe('a%20b%21%27%28%29%2A~');
  });

  it('reproduces the documented presigned GET signature', () => {
    const url = presignUrl(scope, {
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      expiresInSec: 86_400,
    });
    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('adds the session token to presigned URLs and signed headers', () => {
    const temporary = { ...scope, credentials: { ...scope.credentials, sessionToken: 'tok/en' } };
    const url = presignUrl(temporary, {
      method: 'PUT',
      url: new URL('https://b.s3.us-east-1.amazonaws.com/k'),
      expiresInSec: 60,
    });
    expect(url).toContain('X-Amz-Security-Token=tok%2Fen');
    const headers = signHeaders(temporary, {
      method: 'GET',
      url: new URL('https://b.s3.us-east-1.amazonaws.com/k'),
      headers: {},
    });
    expect(headers['x-amz-security-token']).toBe('tok/en');
    expect(headers.Authorization).toContain('x-amz-security-token');
  });

  it('reproduces the documented header-signed GET signature', () => {
    const headers = signHeaders(scope, {
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      headers: { Range: 'bytes=0-9' },
    });
    expect(headers).toEqual({
      range: 'bytes=0-9',
      host: 'examplebucket.s3.amazonaws.com',
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'x-amz-date': '20130524T000000Z',
      Authorization:
        'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    });
  });

  it('hashes the payload of a PUT and signs query strings', () => {
    const headers = signHeaders(scope, {
      method: 'PUT',
      url: new URL('https://examplebucket.s3.amazonaws.com/a%20b?prefix=x&prefix=a&list-type=2'),
      headers: { 'Content-Type': 'text/plain' },
      body: Buffer.from('Welcome to Amazon S3.'),
    });
    expect(headers['x-amz-content-sha256']).toBe(
      '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
    );
    expect(headers['content-type']).toBe('text/plain');
    expect(headers.Authorization).toMatch(/Signature=[0-9a-f]{64}$/);
  });
});
