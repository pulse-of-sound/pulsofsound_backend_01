import ChargeRequest from '../../models/ChargeRequest';
import Wallet from '../../models/Wallet';
import WalletTransaction from '../../models/WalletTransaction';
import {CloudFunction} from '../../utils/Registry/decorators';
import {SystemRoles} from '../../utils/rols';

class ChargeRequestFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        amount: {type: Number, required: true},
        note: {type: String, required: false},
        receipt_image: {type: Object, required: false},
      },
    },
  })
  async createChargeRequest(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];
      if (!sessionToken)
        throw {codeStatus: 101, message: 'Session token is required'};

      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});
      if (!session) throw {codeStatus: 101, message: 'Invalid session token'};

      const user = session.get('user');
      const {amount, note, receipt_image} = req.params;

      const walletQuery = new Parse.Query(Wallet);
      walletQuery.equalTo('user_id', user);
      let wallet = await walletQuery.first({useMasterKey: true});

      if (!wallet) {
        wallet = new Wallet();
        wallet.set('user_id', user);
        wallet.set('balance', 0);
        await wallet.save(null, {useMasterKey: true});
      }

      const request = new ChargeRequest();
      request.set('wallet_id', wallet);
      request.set('amount', amount);
      request.set('note', note || '');
      request.set('status', 'pending');

      if (receipt_image) {
        request.set('receipt_image', receipt_image);
      }

      await request.save(null, {useMasterKey: true});

      return {
        message: 'تم إرسال طلب الشحن بنجاح',
        charge_request_id: request.id,
      };
    } catch (error: any) {
      console.error('Error in createChargeRequest:', error);
      throw {codeStatus: 500, message: error.message || 'فشل إرسال طلب الشحن'};
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        status: {type: String, required: false},
      },
    },
  })
  async getChargeRequests(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];
      const {status} = req.params;

      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      sessionQuery.include('user.role');
      const session = await sessionQuery.first({useMasterKey: true});
      if (!session) throw {codeStatus: 101, message: 'Invalid session context'};

      const user = session.get('user');
      const role = user.get('role');
      const roleName = role ? role.get('name') : '';
      const isAdmin =
        roleName === SystemRoles.ADMIN || roleName === SystemRoles.SUPER_ADMIN;

      console.log('Get Charge Requests - User:', user.id, 'IsAdmin:', isAdmin);

      const query = new Parse.Query(ChargeRequest);

      if (status && status !== 'all') {
        query.equalTo('status', status);
      }

      if (!isAdmin) {
        const walletQuery = new Parse.Query(Wallet);
        walletQuery.equalTo('user_id', user);
        query.matchesQuery('wallet_id', walletQuery);
      }

      query.include(['wallet_id', 'wallet_id.user_id']);
      query.descending('createdAt');

      const results = await query.find({useMasterKey: true});
      console.log(`Found ${results.length} charge requests`);

      const formatted = results.map(tx => {
        const wallet = tx.get('wallet_id');
        const walletUser = wallet?.get('user_id');

        const displayName =
          walletUser?.get('fullName') ||
          walletUser?.get('mobileNumber') ||
          walletUser?.get('username') ||
          walletUser?.id ||
          'مستخدم غير معروف';

        return {
          charge_request_id: tx.id,
          username: displayName,
          amount: tx.get('amount'),
          status: tx.get('status'),
          note: tx.get('note'),
          rejection_note: tx.get('rejection_note'),
          receipt_image: tx.get('receipt_image'),
          createdAt: tx.createdAt,
        };
      });

      return {requests: formatted};
    } catch (error: any) {
      console.error('Error in getChargeRequests:', error);
      throw {codeStatus: 500, message: error.message};
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        charge_request_id: {type: String, required: true},
      },
    },
  })
  async approveChargeRequest(req: Parse.Cloud.FunctionRequest) {
    try {
      const {charge_request_id} = req.params;
      const query = new Parse.Query(ChargeRequest);
      query.include('wallet_id');
      const request = await query.get(charge_request_id, {useMasterKey: true});

      if (!request) throw {message: 'الطلب غير موجود'};
      if (request.get('status') !== 'pending')
        throw {message: 'تم معالجة هذا الطلب مسبقاً'};

      const wallet = request.get('wallet_id');
      const amount = request.get('amount');
      const currentBalance = wallet.get('balance') || 0;

      wallet.set('balance', currentBalance + amount);
      await wallet.save(null, {useMasterKey: true});

      // إضافة حركة مالية للسجل
      const transaction = new WalletTransaction();
      transaction.set('to_wallet', wallet);
      transaction.set('amount', amount);
      transaction.set('type', 'charge');
      transaction.set('note', 'شحن رصيد - موافقة الإدارة');
      await transaction.save(null, {useMasterKey: true});

      request.set('status', 'approved');
      await request.save(null, {useMasterKey: true});

      return {message: 'تمت الموافقة على طلب الشحن بنجاح'};
    } catch (error: any) {
      console.error('Error in approveChargeRequest:', error);
      throw {message: error.message};
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        charge_request_id: {type: String, required: true},
        rejection_note: {type: String, required: true},
      },
    },
  })
  async rejectChargeRequest(req: Parse.Cloud.FunctionRequest) {
    try {
      const {charge_request_id, rejection_note} = req.params;
      const request = await new Parse.Query(ChargeRequest).get(
        charge_request_id,
        {useMasterKey: true}
      );
      if (!request) throw {message: 'الطلب غير موجود'};

      request.set('status', 'rejected');
      request.set('rejection_note', rejection_note);
      await request.save(null, {useMasterKey: true});
      return {message: 'تم رفض طلب الشحن'};
    } catch (error: any) {
      console.error('Error in rejectChargeRequest:', error);
      throw {message: error.message};
    }
  }
}

export default new ChargeRequestFunctions();
