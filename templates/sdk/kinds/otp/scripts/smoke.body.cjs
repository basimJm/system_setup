/* Consumer scenario run by scripts/package-smoke.cjs through CJS and ESM: the fake provider end to end. */
module.exports = async (lib) => {
  const phone = '+962791234567';
  const otp = lib.createOtp({ environment: 'dev', provider: 'fake', resendAfterSec: 0 });
  const sent = await otp.request({ phone, purpose: 'LOGIN', language: 'ar' });
  const code = otp.channel.lastCode(phone);
  const verified = await otp.verify({ phone, purpose: 'LOGIN', code });
  const consumed = await otp.consumeToken({ otpToken: verified.otpToken, phone, purpose: 'LOGIN' });
  const replay = await otp.consumeToken({ otpToken: verified.otpToken, phone, purpose: 'LOGIN' });
  let refused = false;
  try {
    lib.createOtp({ environment: 'prod', provider: 'fake' });
  } catch (error) {
    refused = lib.isSdkError(error) && error.code === lib.ERROR_CODES.CONFIG_INVALID;
  }
  await otp.close();
  if (
    sent.outcome !== 'SENT' ||
    sent.otpLength !== 6 ||
    verified.outcome !== 'VERIFIED' ||
    consumed.valid !== true ||
    replay.valid !== false ||
    !refused ||
    typeof lib.MemoryCodeStore !== 'function'
  )
    throw new Error('smoke failed');
};
