import {CloudFunction} from '../../utils/Registry/decorators';
import Appointment from '../../models/Appointment';
import AppointmentPlan from '../../models/AppointmentPlan';
import Invoice from '../../models/Invoice';
import Notifications from '../../models/Notifications';
import ChatGroup from '../../models/ChatGroup';
import ChatGroupParticipant from '../../models/ChatGroupParticipant';
import WalletTransaction from '../../models/WalletTransaction';
import Wallet from '../../models/Wallet';

class AppointmentFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {type: String, required: true},
        provider_id: {type: String, required: true},
        appointment_plan_id: {type: String, required: true},
        note: {type: String, required: false},
      },
    },
  })
  async requestPsychologistAppointment(req: Parse.Cloud.FunctionRequest) {
    try {
      // التحقق من Session Token
      const sessionToken = (req as any).headers?.['x-parse-session-token'];
//يتحقق من وجود رمز الجلسة
      if (!sessionToken) {
        throw {codeStatus: 101, message: 'Session token is required'};
      }
//ينشأ استعلام على كل الجلسات ويضمن المستخدم المناسب
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
//يرمي خطأ إن لم يكون الدور مناسب 
      const rolePointer = user.get('role');
      const role = await new Parse.Query(Parse.Role)
        .equalTo('objectId', rolePointer?.id)
        .first({useMasterKey: true});
      const roleName = role?.get('name');
      if (roleName !== 'Parent' && roleName !== 'Child') {
        throw {
          codeStatus: 102,
          message: 'Only parents or children can request appointments',
        };
      }

      const {child_id, provider_id, appointment_plan_id, note} = req.params;

      const plan = await new Parse.Query(AppointmentPlan)
        .equalTo('objectId', appointment_plan_id)
        .first({useMasterKey: true});
      if (!plan) {
        throw {codeStatus: 104, message: 'Appointment plan not found'};
      }
//إنشاء موعد
      const appointment = new Appointment();
      appointment.set('user_id', user);
      appointment.set('provider_id', new Parse.User({id: provider_id}));
      appointment.set(
        'child_id',
        new Parse.Object('ChildProfile', {id: child_id})
      );
      appointment.set('appointment_plan_id', plan);
      appointment.set('note', note || '');
      appointment.set('status', 'pending');
      appointment.set('created_at', new Date());
      appointment.set('updated_at', new Date());
      await appointment.save(null, {useMasterKey: true});
//إنشاء فاتورة
      const invoice = new Invoice();
      invoice.set('appointment_id', appointment);
      invoice.set('amount', plan.get('price'));
      invoice.set('status', 'pending');
      invoice.set('created_at', new Date());
      invoice.set('updated_at', new Date());
      await invoice.save(null, {useMasterKey: true});

      return {
        message: 'Appointment request submitted successfully',
        appointment: appointment.toJSON(),
        invoice: invoice.toJSON(),
      };
    } catch (error: any) {
      console.error('Error in requestPsychologistAppointment:', error);
      throw {
        codeStatus: error.codeStatus || 1003,
        message: error.message || 'Failed to request appointment',
      };
    }
  }
  //جلب كل المواعيد المرتبطة بطفل معين
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {type: String, required: true},
      },
    },
  })
  async getChildAppointments(req: Parse.Cloud.FunctionRequest) {
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

      const {child_id} = req.params;

      const query = new Parse.Query(Appointment);
      query.equalTo(
        'child_id',
        new Parse.Object('ChildProfile', {id: child_id})
      );
      query.include(['appointment_plan_id', 'provider_id']);
      query.descending('createdAt');

      const results = await query.find({useMasterKey: true});

      const formatted = results.map(app => ({
        id: app.id,
        status: app.get('status'),
        note: app.get('note'),
        created_at: app.get('created_at'),
        appointment_plan: {
          id: app.get('appointment_plan_id')?.id,
          title: app.get('appointment_plan_id')?.get('title'),
          duration_minutes: app
            .get('appointment_plan_id')
            ?.get('duration_minutes'),
          price: app.get('appointment_plan_id')?.get('price'),
        },
        provider: {
          id: app.get('provider_id')?.id,
          name:
            app.get('provider_id')?.get('fullName') ||
            app.get('provider_id')?.get('username'),
        },
      }));

      return formatted;
    } catch (error: any) {
      console.error('Error in getChildAppointments:', error);
      throw {
        codeStatus: error.codeStatus || 1004,
        message: error.message || 'Failed to retrieve child appointments',
      };
    }
  }
//أخذ تفاصيل طلب ما
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        appointment_id: {type: String, required: true},
      },
    },
  })
  async getAppointmentDetails(req: Parse.Cloud.FunctionRequest) {
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

      const query = new Parse.Query(Appointment);
      query.equalTo('objectId', appointment_id);
      query.include([
        'appointment_plan_id',
        'provider_id',
        'child_id',
        'user_id',
      ]);
      const appointment = await query.first({useMasterKey: true});

      if (!appointment) {
        throw {codeStatus: 104, message: 'Appointment not found'};
      }

      return {
        id: appointment.id,
        status: appointment.get('status'),
        note: appointment.get('note'),
        created_at: appointment.get('created_at'),
        appointment_plan: {
          id: appointment.get('appointment_plan_id')?.id,
          title: appointment.get('appointment_plan_id')?.get('title'),
          duration_minutes: appointment
            .get('appointment_plan_id')
            ?.get('duration_minutes'),
          price: appointment.get('appointment_plan_id')?.get('price'),
        },
        provider: {
          id: appointment.get('provider_id')?.id,
          name: appointment.get('provider_id')?.get('username'),
        },
        child: {
          id: appointment.get('child_id')?.id,
          name: appointment.get('child_id')?.get('fullName'),
        },
        requested_by: {
          id: appointment.get('user_id')?.id,
          name: appointment.get('user_id')?.get('username'),
        },
      };
    } catch (error: any) {
      console.error('Error in getAppointmentDetails:', error);
      throw {
        codeStatus: error.codeStatus || 1005,
        message: error.message || 'Failed to retrieve appointment details',
      };
    }
  }
//جلب كل المواعيد المعلقة 
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async getPendingAppointmentsForProvider(req: Parse.Cloud.FunctionRequest) {
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

      const query = new Parse.Query(Appointment);
      query.equalTo('provider_id', user);
      query.include(['appointment_plan_id', 'child_id', 'user_id']);
      query.descending('createdAt');

      const results = await query.find({useMasterKey: true});

      const formatted = await Promise.all(
        results.map(async app => {
          const plan = app.get('appointment_plan_id');
          const child = app.get('child_id');
          const requestedBy = app.get('user_id');

          const chatGroup = await new Parse.Query(ChatGroup)
            .equalTo('appointment_id', app)
            .equalTo('chat_status', 'active')
            .first({useMasterKey: true});

          console.log(
            'App Item - Child:',
            child?.id,
            'requestedBy:',
            requestedBy?.id
          );

          return {
            id: app.id,
            status: app.get('status'),
            note: app.get('note'),
            created_at: app.createdAt,
            appointment_plan: plan
              ? {
                  id: plan.id,
                  title: plan.get('title'),
                  duration_minutes: plan.get('duration_minutes'),
                  price: plan.get('price'),
                }
              : {},
            child: child
              ? {
                  id: child.id,
                  name:
                    child.get('fullName') ||
                    child.get('name') ||
                    child.get('mobileNumber') ||
                    child.get('username') ||
                    (requestedBy
                      ? requestedBy.get('fullName') ||
                        requestedBy.get('mobileNumber')
                      : null) ||
                    child.id,
                }
              : {
                  name: requestedBy
                    ? requestedBy.get('fullName') ||
                      requestedBy.get('mobileNumber') ||
                      'طفل'
                    : 'طفل',
                },
            requestedBy: requestedBy
              ? {
                  id: requestedBy.id,
                  name:
                    requestedBy.get('fullName') ||
                    requestedBy.get('mobileNumber') ||
                    requestedBy.get('username') ||
                    requestedBy.id,
                }
              : null,
            chat_group_id: chatGroup?.id || null,
          };
        })
      );

      return formatted;
    } catch (error: any) {
      console.error('Error in getPendingAppointmentsForProvider:', error);
      throw {
        codeStatus: error.codeStatus || 1007,
        message: error.message || 'Failed to retrieve pending appointments',
      };
    }
  }
//سماحية وصول لبيانات طفل معين في حال وجود موعد فعال بينهم
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: true,
      fields: {
        child_id: {type: String, required: true},
      },
    },
  })
  async canAccessChildEvaluation(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = req.user;
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const rolePointer = user.get('role');
      const role = await new Parse.Query(Parse.Role)
        .equalTo('objectId', rolePointer?.id)
        .first({useMasterKey: true});
      const roleName = role?.get('name');

      const allowedRoles = ['Psychologist', 'Doctor'];
      if (!allowedRoles.includes(roleName)) {
        throw {
          codeStatus: 102,
          message:
            'Unauthorized: Only providers with valid roles can access evaluations',
        };
      }

      const {child_id} = req.params;

      const query = new Parse.Query(Appointment);
      query.equalTo(
        'child_id',
        new Parse.Object('ChildProfile', {id: child_id})
      );
      query.equalTo('provider_id', user);
      query.containedIn('status', [
        'confirmed',
        'completed',
        'paid',
        'pending_provider_approval',
      ]);
      const result = await query.first({useMasterKey: true});

      if (result) {
        return {
          canAccess: true,
          message:
            'Access granted: Provider has a valid appointment with this child',
        };
      } else {
        return {
          canAccess: false,
          message: 'Access denied: No valid appointment found for this child',
        };
      }
    } catch (error: any) {
      console.error('Error in canAccessChildEvaluation:', error);
      throw {
        codeStatus: error.codeStatus || 1006,
        message: error.message || 'Failed to verify access to child evaluation',
      };
    }
  }
//طلب موافقة او رفض موعد 
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        appointment_id: {type: String, required: true},
        decision: {type: String, required: true},
      },
    },
  })
  async handleAppointmentDecision(req: Parse.Cloud.FunctionRequest) {
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
      if (!user) throw {codeStatus: 103, message: 'User context is missing'};

      const {appointment_id, decision} = req.params;
//حصرا الطلب إما رفض أو موافقة
      if (!['approve', 'reject'].includes(decision)) {
        throw {codeStatus: 105, message: 'Invalid decision value'};
      }

      const appointment = await new Parse.Query(Appointment)
        .include(['provider_id', 'user_id', 'child_id', 'appointment_plan_id'])
        .get(appointment_id, {useMasterKey: true});

      if (!appointment)
        throw {codeStatus: 104, message: 'Appointment not found'};

      const provider = appointment.get('provider_id');
      const requester = appointment.get('user_id');

      if (provider?.id !== user.id) {
        throw {
          codeStatus: 102,
          message:
            'Unauthorized: Only the assigned provider can make this decision',
        };
      }

      const status = decision === 'approve' ? 'confirmed' : 'rejected';
      appointment.set('status', status);
      appointment.set('updated_at', new Date());
      await appointment.save(null, {useMasterKey: true});

      let chatGroup: Parse.Object | undefined;
//إذا طلب موافقة نشوف الخطة والسعر
      if (decision === 'approve') {
        const plan = appointment.get('appointment_plan_id');
        if (!plan)
          throw {codeStatus: 106, message: 'Appointment has no plan assigned'};

        const price = plan.get('price');
        if (!price || price <= 0)
          throw {codeStatus: 107, message: 'Invalid plan price'};

        const requesterWalletQuery = new Parse.Query(Wallet);
        let requesterWallet = await requesterWalletQuery
          .equalTo('user_id', requester)
          .first({useMasterKey: true});

        if (!requesterWallet) {
          requesterWallet = new Wallet();
          requesterWallet.set('user_id', requester);
          requesterWallet.set('balance', 0);
          await requesterWallet.save(null, {useMasterKey: true});
        }

        const providerWalletQuery = new Parse.Query(Wallet);
        let providerWallet = await providerWalletQuery
          .equalTo('user_id', provider)
          .first({useMasterKey: true});

        if (!providerWallet) {
          providerWallet = new Wallet();
          providerWallet.set('user_id', provider);
          providerWallet.set('balance', 0);
          await providerWallet.save(null, {useMasterKey: true});
        }

        if (!requesterWallet || !providerWallet) {
          throw {
            codeStatus: 108,
            message: 'Failed to retrieve or create wallets',
          };
        }

        const requesterBalance = requesterWallet.get('balance') || 0;
        if (requesterBalance < price) {
          throw {
            codeStatus: 402,
            message: 'Insufficient balance in requester wallet',
          };
        }
//خصم سعر الخطة من المستخدم الى الاخصائي
        requesterWallet.set('balance', requesterBalance - price);
        const providerBalance = providerWallet.get('balance') || 0;
        providerWallet.set('balance', providerBalance + price);
//حفظ حالة المحفظتين
        await Promise.all([
          requesterWallet.save(null, {useMasterKey: true}),
          providerWallet.save(null, {useMasterKey: true}),
        ]);
//إنشلء عملية الدفع
        const paymentTx = new WalletTransaction();
        paymentTx.set('from_wallet', requesterWallet);
        paymentTx.set('to_wallet', providerWallet);
        paymentTx.set('amount', price);
        paymentTx.set('type', 'payment');
        paymentTx.set('appointment_id', appointment);
        await paymentTx.save(null, {useMasterKey: true});
//إنشاء شات
        chatGroup = new ChatGroup();
        chatGroup.set('appointment_id', appointment);

        const childId = appointment.get('child_id');
        console.log(
          `Creating ChatGroup for appointment ${appointment.id}: child_id = ${
            childId?.id || 'NULL'
          }`
        );

        if (childId) {
          chatGroup.set('child_id', childId);
        } else {
          console.warn(`Appointment ${appointment.id} has no child_id!`);
        }

        chatGroup.set('chat_type', 'private');
        chatGroup.set('chat_status', 'active');
        await chatGroup.save(null, {useMasterKey: true});

        const participants = [provider, requester].filter(Boolean);
        for (const participant of participants) {
          const chatParticipant = new ChatGroupParticipant();
          chatParticipant.set('chat_group_id', chatGroup);
          chatParticipant.set('user_id', participant);
          await chatParticipant.save(null, {useMasterKey: true});
        }
      }
//في حالة الرفض
      if (decision === 'reject') {
        const txQuery = new Parse.Query(WalletTransaction);
        txQuery.equalTo('appointment_id', appointment);
        txQuery.equalTo('type', 'payment');
        txQuery.include(['from_wallet', 'to_wallet']);
        const paymentTx = await txQuery.first({useMasterKey: true});
//إرجاع الملبغ للمستخدم وخصمه من الطبيب
        if (paymentTx) {
          const fromWallet = paymentTx.get('from_wallet');
          const toWallet = paymentTx.get('to_wallet');
          const amount = paymentTx.get('amount');

          const fromBalance = toWallet.get('balance') || 0;
          if (fromBalance >= amount) {
            toWallet.set('balance', fromBalance - amount);
            const toBalance = fromWallet.get('balance') || 0;
            fromWallet.set('balance', toBalance + amount);
//حفظ العمليتين
            await Promise.all([
              fromWallet.save(null, {useMasterKey: true}),
              toWallet.save(null, {useMasterKey: true}),
            ]);

            const reversalTx = new WalletTransaction();
            reversalTx.set('from_wallet', toWallet);
            reversalTx.set('to_wallet', fromWallet);
            reversalTx.set('amount', amount);
            reversalTx.set('type', 'reversal');
            reversalTx.set('appointment_id', appointment);
            reversalTx.set('note', 'تم استرجاع المبلغ بعد رفض الموعد');
            await reversalTx.save(null, {useMasterKey: true});
          }
        }
      }

      const notification = new Notifications();
      notification.set('user_id', requester);
      notification.set(
        'type',
        decision === 'approve' ? 'appointment_approved' : 'appointment_rejected'
      );
      notification.set(
        'title',
        decision === 'approve' ? 'تمت الموافقة على الموعد' : 'تم رفض الموعد'
      );
      notification.set(
        'body',
        decision === 'approve'
          ? 'يمكنك الآن بدء المحادثة مع الطبيب'
          : 'نعتذر، لم يتم قبول طلب الموعد من قبل الطبيب'
      );
      notification.set('appointment_id', appointment);
      if (chatGroup) notification.set('chat_group_id', chatGroup);
      notification.set('is_read', false);
      notification.set('created_at', new Date());
      await notification.save(null, {useMasterKey: true});

      return {
        message:
          decision === 'approve'
            ? 'Appointment approved, payment processed, chat group created, and notification sent'
            : 'Appointment rejected, payment reversed, and notification sent',
        appointment_status: status,
        ...(chatGroup && {chat_group_id: chatGroup.id}),
      };
    } catch (error: any) {
      console.error('Error in handleAppointmentDecision:', error);
      throw {
        codeStatus: error.codeStatus || 1012,
        message: error.message || 'Failed to handle appointment decision',
      };
    }
  }
//إلغاء طلب مازال معلق
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        appointment_id: {type: String, required: true},
      },
    },
  })
  async cancelAppointment(req: Parse.Cloud.FunctionRequest) {
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
      if (!user) throw {codeStatus: 103, message: 'User context is missing'};

      const {appointment_id} = req.params;

      const appointment = await new Parse.Query(Appointment)
        .include(['user_id'])
        .get(appointment_id, {useMasterKey: true});

      if (!appointment)
        throw {codeStatus: 104, message: 'Appointment not found'};

      const requester = appointment.get('user_id');
      if (requester?.id !== user.id) {
        throw {
          codeStatus: 102,
          message: 'Unauthorized: You can only cancel your own appointments',
        };
      }
//يلغى في حالة قيد الانتظار او بانتظار موافقة
      const status = appointment.get('status');
      if (status !== 'pending' && status !== 'pending_provider_approval') {
        throw {
          codeStatus: 105,
          message:
            'Cannot cancel appointment because it is already processed or completed',
        };
      }

      appointment.set('status', 'cancelled');
      appointment.set('updated_at', new Date());
      await appointment.save(null, {useMasterKey: true});

      return {message: 'Appointment cancelled successfully'};
    } catch (error: any) {
      console.error('Error in cancelAppointment:', error);
      throw {
        codeStatus: error.codeStatus || 1013,
        message: error.message || 'Failed to cancel appointment',
      };
    }
  }
}

export default new AppointmentFunctions();
