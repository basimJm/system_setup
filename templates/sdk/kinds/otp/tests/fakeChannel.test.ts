import { FakeOtpChannel } from '../src/adapters/fake-channel';

const message = {
  to: '+991791234567',
  code: '123456',
  language: 'ar',
  purpose: 'LOGIN',
  ttlSec: 300,
};

describe('FakeOtpChannel', () => {
  it('records codes, numbers deliveries and injects failures', async () => {
    const channel = new FakeOtpChannel();
    expect(channel.isFake).toBe(true);
    expect(channel.lastCode(message.to)).toBeUndefined();
    await expect(channel.send(message)).resolves.toEqual({ id: 'fake-1' });
    await expect(channel.send({ ...message, code: '654321' })).resolves.toEqual({ id: 'fake-2' });
    await channel.send({ ...message, to: '+991790000000', code: '000000' });
    expect(channel.lastCode(message.to)).toBe('654321');
    channel.failWith = new Error('down');
    await expect(channel.send(message)).rejects.toThrow('down');
    expect(channel.sent).toHaveLength(3);
  });
});
