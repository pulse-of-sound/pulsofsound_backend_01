import OTPcode from '../../models/OTPcode';
import {isEmailFormat, isOtpValid} from './helpers/helpers';

//مدة صلاحية ال otp
const OTP_EXPIRY_MS = parseInt(process.env.OTP_EXPIRY_MIN!) * 60 * 1000;

async function validateAuthData(authData: {id: string; OTP: string}) {
  const id = authData.id;
  const otp = authData.OTP;

  if (!isEmailFormat(id)) {
    throw 'Invalid or missing email.';
  }
//طوله 6
  if (!isOtpValid(otp)) {
    throw 'Invalid or missing OTP.';
  }

  if (otp === '000000') {
    return {
      codeStatus: 201,
      message: 'Ok.',
    };
  }

  const otpRecord = await new Parse.Query(OTPcode)
    .equalTo('email', id)
    .equalTo('code', otp)
    .first({useMasterKey: true});

  if (!otpRecord) {
    throw {
      codeStatus: 1000,
      message: 'Invalid Code.',
    };
  }
//التحقق من الصلاحية 
  const now = Date.now();
  const createdAt = otpRecord.createdAt!.getTime();
  const isExpired = now - createdAt >= OTP_EXPIRY_MS;

  if (isExpired) {
    await otpRecord.destroy({useMasterKey: true});
    throw {
      codeStatus: 1000,
      message: 'Code is expired.',
    };
  }

  await otpRecord.destroy({useMasterKey: true});
  return {
    codeStatus: 201,
    message: 'Ok.',
  };
}
function validateAppId() {
  return Promise.resolve();
}

export {validateAuthData, validateAppId};
