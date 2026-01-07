import OTPcode from '../../models/OTPcode';
import {CloudFunction} from '../../utils/Registry/decorators';
import generateRandomInteger from '../../utils/generateRandom';

import {
  sharedGetFields,
  WithSharedGetParams,
} from '../../utils/sharedGetFields';

const OTP_EXPIRY_MS = parseInt(process.env.OTP_EXPIRY_MIN || '5') * 60 * 1000;

class OTP_ {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        ...sharedGetFields,
        mobileNumber: {required: true, type: String},
      },
    },
  })
  async generateOTP(req: Parse.Cloud.FunctionRequest) {
    const {mobileNumber}: WithSharedGetParams<{mobileNumber?: string}> =
      req.params;

    try {
      const dateNow = new Date().getTime();
      const otp = generateRandomInteger(6);

      // Check for existing OTP
      const check_old_verificationCode = await new Parse.Query(OTPcode)
        .equalTo('mobileNumber', mobileNumber)
        .first({useMasterKey: true});

      if (check_old_verificationCode) {
        if (
          dateNow - check_old_verificationCode.createdAt.getTime() <
          OTP_EXPIRY_MS
        ) {
          throw {
            codeStatus: 1000,
            message: 'Try again in few seconds!',
          };
        } else {
          await check_old_verificationCode.destroy({useMasterKey: true});
        }
      }

      // Create new OTP record
      const verificationCode = new OTPcode();
      verificationCode.mobileNumber = mobileNumber!;
      verificationCode.code = otp;

      const acl = new Parse.ACL();
      acl.setPublicReadAccess(false);
      acl.setPublicWriteAccess(false);
      verificationCode.setACL(acl);

      const generatedOTP = await verificationCode.save(null, {
        useMasterKey: true,
      });

      return OTPcode.map(generatedOTP);
    } catch (error: any) {
      console.error('Error in generateOTP:', error);
      if (error.codeStatus) {
        throw error;
      }
      throw {
        codeStatus: 1000,
        message: error.message || 'Failed to generate OTP',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        mobileNumber: {required: true, type: String},
      },
    },
  })
  async resendOTP(req: Parse.Cloud.FunctionRequest) {
    const {mobileNumber} = req.params;

    try {
      const existingOTP = await new Parse.Query(OTPcode)
        .equalTo('mobileNumber', mobileNumber)
        .first({useMasterKey: true});

      if (existingOTP) {
        await existingOTP.destroy({useMasterKey: true});
      }

      return await OTP_.prototype.generateOTP.call(this, req);
    } catch (error: any) {
      console.error('Error in resendOTP:', error);
      throw {
        codeStatus: 1000,
        message: error.message || 'Failed to resend OTP',
      };
    }
  }
  // Add a function to verify OTP
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        mobileNumber: {required: true, type: String},
        OTP: {required: true, type: String},
      },
    },
  })
  async verifyOTP(req: Parse.Cloud.FunctionRequest) {
    const {mobileNumber, OTP} = req.params;

    try {
      const otpRecord = await new Parse.Query(OTPcode)
        .equalTo('mobileNumber', mobileNumber)
        .equalTo('code', OTP)
        .first({useMasterKey: true});

      if (!otpRecord) {
        throw {
          codeStatus: 1000,
          message: 'Invalid OTP code',
        };
      }

      const now = Date.now();
      const createdAt = otpRecord.createdAt!.getTime();
      const isExpired = now - createdAt >= OTP_EXPIRY_MS;

      if (isExpired) {
        await otpRecord.destroy({useMasterKey: true});
        throw {
          codeStatus: 1000,
          message: 'OTP code expired',
        };
      }

      await otpRecord.destroy({useMasterKey: true});

      return {
        verified: true,
        mobileNumber,
        allowLogin: true,
      };
    } catch (error: any) {
      console.error('Error in verifyOTP:', error);
      if (error.codeStatus) {
        throw error;
      }
      throw {
        codeStatus: 1000,
        message: error.message || 'Failed to verify OTP',
      };
    }
  }
}
