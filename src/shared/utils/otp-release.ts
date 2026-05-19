/**
 * Controls whether OTP values are included in API responses.
 *
 * When OTP_RELEASE=production the otp field is stripped from every response
 * so one-time codes are never exposed over the wire (they are delivered only
 * via email / SMS). In all other environments the otp is returned for easier
 * development / QA testing.
 */
export function exposeOtp(otp: string | undefined): string | undefined {
  return process.env.OTP_RELEASE === 'production' ? undefined : otp;
}
