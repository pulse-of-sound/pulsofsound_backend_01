import Wallet from '../../models/Wallet';
import { CloudFunction } from '../../utils/Registry/decorators';

class WalletFunctions {
//جلب الرصيد الحالي
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async getWalletBalance(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];

      if (!sessionToken) {
        throw { codeStatus: 101, message: 'Session token is required' };
      }
      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({ useMasterKey: true });

      if (!session) {
        throw { codeStatus: 101, message: 'Invalid session token' };
      }

      const user = session.get('user');
      if (!user) {
        throw { codeStatus: 103, message: 'User context is missing' };
      }

      const walletQuery = new Parse.Query(Wallet);
      walletQuery.equalTo('user_id', user);
      const wallet = await walletQuery.first({ useMasterKey: true });

      if (!wallet) {
        const newWallet = new Wallet();
        newWallet.set('user_id', user);
        newWallet.set('balance', 0);
        await newWallet.save(null, { useMasterKey: true });

        return {
          message: 'Wallet created successfully',
          balance: 0,
          wallet_id: newWallet.id,
        };
      }

      return {
        message: 'Wallet balance retrieved successfully',
        balance: wallet.get('balance'),
        wallet_id: wallet.id,
      };
    } catch (error: any) {
      console.error('Error in getWalletBalance:', error);
      throw {
        codeStatus: error.codeStatus || 1011,
        message: error.message || 'Failed to retrieve wallet balance',
      };
    }
  }
}

export default new WalletFunctions();
