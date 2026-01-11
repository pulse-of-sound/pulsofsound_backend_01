//تأكد ان رقم الموبايل طوله بين 10 لل 15 و مع +
export function isMobileNumberValid(mobileNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{9,14}$/;
  return (
    !!mobileNumber &&
    e164Regex.test(mobileNumber) &&
    !mobileNumber.includes('Deleted')
  );
}
//يتحقق انه موجود ومكون من 6 خانات
export function isOtpValid(otp: string): boolean {
  return !!otp && otp.length === 6;
}
//يتحقق من صيغة الايميل الاساس ويمنع الفراغات
export function isEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
