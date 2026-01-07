import WalletTransaction from '../../models/WalletTransaction';
import Wallet from '../../models/Wallet';
import Appointment from '../../models/Appointment';
import {CloudFunction} from '../../utils/Registry/decorators';

class WalletTransactionFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        from_wallet_id: {type: String, required: true},
        to_wallet_id: {type: String, required: true},
        amount: {type: Number, required: true},
        type: {type: String, required: true},
        appointment_id: {type: String, required: false},
      },
    },
  })
  async createWalletTransaction(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];
      if (!sessionToken) {
        throw {codeStatus: 101, message: 'Session token is required'};
      }
      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});
      if (!session) {
        throw {codeStatus: 101, message: 'Invalid session token'};
      }
      const user = session.get('user');
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {from_wallet_id, to_wallet_id, amount, type, appointment_id} =
        req.params;

      if (amount <= 0) {
        throw {codeStatus: 400, message: 'Amount must be greater than zero'};
      }

      const walletQuery = new Parse.Query(Wallet);
      const fromWallet = await walletQuery.get(from_wallet_id, {
        useMasterKey: true,
      });
      const toWallet = await walletQuery.get(to_wallet_id, {
        useMasterKey: true,
      });

      if (!fromWallet || !toWallet) {
        throw {codeStatus: 404, message: 'One or both wallets not found'};
      }

      const fromBalance = fromWallet.get('balance') || 0;
      if (fromBalance < amount) {
        throw {
          codeStatus: 402,
          message: 'Insufficient balance in source wallet',
        };
      }

      fromWallet.set('balance', fromBalance - amount);
      const toBalance = toWallet.get('balance') || 0;
      toWallet.set('balance', toBalance + amount);

      await Promise.all([
        fromWallet.save(null, {useMasterKey: true}),
        toWallet.save(null, {useMasterKey: true}),
      ]);

      const transaction = new WalletTransaction();
      transaction.set('from_wallet', fromWallet);
      transaction.set('to_wallet', toWallet);
      transaction.set('amount', amount);
      transaction.set('type', type);

      if (appointment_id) {
        const appointmentQuery = new Parse.Query(Appointment);
        const appointment = await appointmentQuery.get(appointment_id, {
          useMasterKey: true,
        });
        transaction.set('appointment_id', appointment);
      }

      await transaction.save(null, {useMasterKey: true});

      return {
        message: 'Wallet transaction created successfully',
        transaction_id: transaction.id,
        from_wallet_id,
        to_wallet_id,
        amount,
        type,
      };
    } catch (error: any) {
      console.error('Error in createWalletTransaction:', error);
      throw {
        codeStatus: error.codeStatus || 1016,
        message: error.message || 'Failed to create wallet transaction',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        wallet_id: {type: String, required: true},
        type: {type: String, required: false},
        appointment_id: {type: String, required: false},
      },
    },
  })
  async getWalletTransactions(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];
      if (!sessionToken) {
        throw {codeStatus: 101, message: 'Session token is required'};
      }
      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});
      if (!session) {
        throw {codeStatus: 101, message: 'Invalid session token'};
      }
      const user = session.get('user');
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {wallet_id, type, appointment_id} = req.params;

      const query = new Parse.Query(WalletTransaction);
      query.include(['from_wallet', 'to_wallet', 'appointment_id']);
      query.descending('createdAt');

      const walletPointer = new Parse.Object('Wallet');
      walletPointer.id = wallet_id;

      const fromQuery = new Parse.Query(WalletTransaction);
      fromQuery.equalTo('from_wallet', walletPointer);

      const toQuery = new Parse.Query(WalletTransaction);
      toQuery.equalTo('to_wallet', walletPointer);

      const combinedQuery = Parse.Query.or(fromQuery, toQuery);

      if (type) {
        combinedQuery.equalTo('type', type);
      }

      if (appointment_id) {
        const appointmentPointer = new Parse.Object('Appointment');
        appointmentPointer.id = appointment_id;
        combinedQuery.equalTo('appointment_id', appointmentPointer);
      }

      combinedQuery.include(['from_wallet', 'to_wallet', 'appointment_id']);
      combinedQuery.descending('createdAt');

      const results = await combinedQuery.find({useMasterKey: true});

      const formatted = results.map(tx => ({
        transaction_id: tx.id,
        from_wallet_id: tx.get('from_wallet')?.id,
        to_wallet_id: tx.get('to_wallet')?.id,
        amount: tx.get('amount'),
        type: tx.get('type'),
        appointment_id: tx.get('appointment_id')?.id || null,
        createdAt: tx.get('createdAt'),
      }));

      return {
        message: 'Wallet transactions retrieved successfully',
        count: formatted.length,
        transactions: formatted,
      };
    } catch (error: any) {
      console.error('Error in getWalletTransactions:', error);
      throw {
        codeStatus: error.codeStatus || 1017,
        message: error.message || 'Failed to retrieve wallet transactions',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        appointment_id: {type: String, required: true},
      },
    },
  })
  async getTransactionsByAppointment(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];
      if (!sessionToken) {
        throw {codeStatus: 101, message: 'Session token is required'};
      }
      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});
      if (!session) {
        throw {codeStatus: 101, message: 'Invalid session token'};
      }
      const user = session.get('user');
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {appointment_id} = req.params;

      const appointmentPointer = new Parse.Object('Appointment');
      appointmentPointer.id = appointment_id;

      const query = new Parse.Query(WalletTransaction);
      query.equalTo('appointment_id', appointmentPointer);
      query.include(['from_wallet', 'to_wallet']);
      query.descending('createdAt');

      const results = await query.find({useMasterKey: true});

      const formatted = results.map(tx => ({
        transaction_id: tx.id,
        from_wallet_id: tx.get('from_wallet')?.id,
        to_wallet_id: tx.get('to_wallet')?.id,
        amount: tx.get('amount'),
        type: tx.get('type'),
        createdAt: tx.get('createdAt'),
      }));

      return {
        message: 'Transactions for appointment retrieved successfully',
        count: formatted.length,
        transactions: formatted,
      };
    } catch (error: any) {
      console.error('Error in getTransactionsByAppointment:', error);
      throw {
        codeStatus: error.codeStatus || 1018,
        message:
          error.message || 'Failed to retrieve transactions for appointment',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        transaction_id: {type: String, required: true},
        reason: {type: String, required: false},
      },
    },
  })
  async reverseTransaction(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];
      if (!sessionToken) {
        throw {codeStatus: 101, message: 'Session token is required'};
      }
      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});
      if (!session) {
        throw {codeStatus: 101, message: 'Invalid session token'};
      }
      const user = session.get('user');
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const rolePointer = user.get('role');
      if (!rolePointer) {
        throw {codeStatus: 403, message: 'User has no role assigned'};
      }

      const roleQuery = new Parse.Query('_Role');
      const role = await roleQuery.get(rolePointer.id, {useMasterKey: true});
      const roleName = role.get('name')?.toLowerCase().trim();
      const isAdmin = roleName === 'admin';

      if (!isAdmin) {
        throw {
          codeStatus: 403,
          message: 'Only admins can reverse transactions',
        };
      }

      const {transaction_id, reason} = req.params;

      const txQuery = new Parse.Query(WalletTransaction);
      txQuery.include(['from_wallet', 'to_wallet', 'appointment_id']);
      const originalTx = await txQuery.get(transaction_id, {
        useMasterKey: true,
      });

      if (!originalTx) {
        throw {codeStatus: 404, message: 'Original transaction not found'};
      }

      const fromWallet = originalTx.get('from_wallet');
      const toWallet = originalTx.get('to_wallet');
      const amount = originalTx.get('amount');
      const appointment = originalTx.get('appointment_id');

      const fromBalance = toWallet.get('balance') || 0;
      if (fromBalance < amount) {
        throw {
          codeStatus: 402,
          message: 'Insufficient balance in target wallet to reverse',
        };
      }

      toWallet.set('balance', fromBalance - amount);
      const toBalance = fromWallet.get('balance') || 0;
      fromWallet.set('balance', toBalance + amount);

      await Promise.all([
        fromWallet.save(null, {useMasterKey: true}),
        toWallet.save(null, {useMasterKey: true}),
      ]);

      const reversalTx = new WalletTransaction();
      reversalTx.set('from_wallet', toWallet);
      reversalTx.set('to_wallet', fromWallet);
      reversalTx.set('amount', amount);
      reversalTx.set('type', 'reversal');
      if (appointment) reversalTx.set('appointment_id', appointment);
      if (reason) reversalTx.set('note', reason);

      await reversalTx.save(null, {useMasterKey: true});

      return {
        message: 'Transaction reversed successfully',
        original_transaction_id: transaction_id,
        reversal_transaction_id: reversalTx.id,
        amount,
        from_wallet_id: toWallet.id,
        to_wallet_id: fromWallet.id,
        type: 'reversal',
      };
    } catch (error: any) {
      console.error('Error in reverseTransaction:', error);
      throw {
        codeStatus: error.codeStatus || 1019,
        message: error.message || 'Failed to reverse transaction',
      };
    }
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        transaction_id: {type: String, required: true},
      },
    },
  })
  async getTransactionById(req: Parse.Cloud.FunctionRequest) {
    try {
      const sessionToken = (req as any).headers?.['x-parse-session-token'];
      if (!sessionToken) {
        throw {codeStatus: 101, message: 'Session token is required'};
      }
      const sessionQuery = new Parse.Query(Parse.Session);
      sessionQuery.equalTo('sessionToken', sessionToken);
      sessionQuery.include('user');
      const session = await sessionQuery.first({useMasterKey: true});
      if (!session) {
        throw {codeStatus: 101, message: 'Invalid session token'};
      }
      const user = session.get('user');
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {transaction_id} = req.params;

      const query = new Parse.Query(WalletTransaction);
      query.include(['from_wallet', 'to_wallet', 'appointment_id']);
      const tx = await query.get(transaction_id, {useMasterKey: true});

      if (!tx) {
        throw {codeStatus: 404, message: 'Transaction not found'};
      }

      return {
        message: 'Transaction details retrieved successfully',
        transaction_id: tx.id,
        from_wallet_id: tx.get('from_wallet')?.id,
        to_wallet_id: tx.get('to_wallet')?.id,
        amount: tx.get('amount'),
        type: tx.get('type'),
        appointment_id: tx.get('appointment_id')?.id || null,
        note: tx.get('note') || null,
        createdAt: tx.get('createdAt'),
      };
    } catch (error: any) {
      console.error('Error in getTransactionById:', error);
      throw {
        codeStatus: error.codeStatus || 1020,
        message: error.message || 'Failed to retrieve transaction details',
      };
    }
  }
}

export default new WalletTransactionFunctions();
