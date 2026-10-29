import type { Router } from 'express';
import type { PhoneOtpService } from '../../../domain/otp/phoneOtp.service';
import { unavailable, type ApiServices } from '../../services';
import { createOtpRouteLimiter } from '../rateLimits';
import { createOtpRouter } from './otp.routes';
import { CUSTOMER_OTP_SCHEMAS, MERCHANT_OTP_SCHEMAS, type OtpSchemas } from './otp.validation';

const build = (
  services: ApiServices,
  namespace: 'customer' | 'merchant',
  schemas: OtpSchemas,
): Router =>
  createOtpRouter({
    service: services.phoneOtp ?? unavailable<PhoneOtpService>(),
    schemas,
    limiter: createOtpRouteLimiter(services, namespace),
  });

export const createCustomerOtpRouter = (services: ApiServices): Router =>
  build(services, 'customer', CUSTOMER_OTP_SCHEMAS);
export const createMerchantOtpRouter = (services: ApiServices): Router =>
  build(services, 'merchant', MERCHANT_OTP_SCHEMAS);
