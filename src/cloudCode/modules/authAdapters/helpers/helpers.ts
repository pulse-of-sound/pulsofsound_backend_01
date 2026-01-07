export function isMobileNumberValid(mobileNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{9,14}$/;
  return (
    !!mobileNumber &&
    e164Regex.test(mobileNumber) &&
    !mobileNumber.includes('Deleted')
  );
}

export function isOtpValid(otp: string): boolean {
  return !!otp && otp.length === 6;
}
export function isEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
