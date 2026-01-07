import {CloudFunction} from '../../utils/Registry/decorators';
import Appointment from '../../models/Appointment';
import Invoice from '../../models/Invoice';
import Notifications from '../../models/Notifications';

class InvoiceFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        appointment_id: {type: String, required: true},
      },
    },
  })
  async createInvoiceForAppointment(req: Parse.Cloud.FunctionRequest) {
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

      const appointment = await new Parse.Query(Appointment)
        .include('appointment_plan_id')
        .get(appointment_id, {useMasterKey: true});

      if (!appointment) {
        throw {codeStatus: 104, message: 'Appointment not found'};
      }

      const plan = appointment.get('appointment_plan_id');
      if (!plan) {
        throw {codeStatus: 105, message: 'Appointment plan not found'};
      }

      const invoice = new Invoice();
      invoice.set('appointment_id', appointment);
      invoice.set('amount', plan.get('price'));
      invoice.set('status', 'pending');
      invoice.set('created_at', new Date());
      invoice.set('updated_at', new Date());

      await invoice.save(null, {useMasterKey: true});

      return {
        message: 'Invoice created successfully',
        invoice: invoice.toJSON(),
      };
    } catch (error: any) {
      console.error('Error in createInvoiceForAppointment:', error);
      throw {
        codeStatus: error.codeStatus || 1008,
        message: error.message || 'Failed to create invoice',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        invoice_id: {type: String, required: true},
      },
    },
  })
  async confirmInvoicePayment(req: Parse.Cloud.FunctionRequest) {
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

      const {invoice_id} = req.params;

      const invoice = await new Parse.Query(Invoice)
        .include('appointment_id')
        .get(invoice_id, {useMasterKey: true});

      if (!invoice) {
        throw {codeStatus: 104, message: 'Invoice not found'};
      }

      const appointment = invoice.get('appointment_id');
      if (!appointment) {
        throw {codeStatus: 105, message: 'Appointment not linked to invoice'};
      }

      const provider = appointment.get('provider_id');
      if (!provider) {
        throw {codeStatus: 106, message: 'Appointment missing provider'};
      }

      invoice.set('status', 'paid');
      invoice.set('updated_at', new Date());
      await invoice.save(null, {useMasterKey: true});

      appointment.set('status', 'pending_provider_approval');
      appointment.set('updated_at', new Date());
      await appointment.save(null, {useMasterKey: true});

      const notification = new Notifications();
      notification.set('user_id', provider);
      notification.set('type', 'appointment_request');
      notification.set('title', 'طلب موعد جديد');
      notification.set('body', 'لديك طلب موعد جديد بانتظار الموافقة');
      notification.set('appointment_id', appointment);
      notification.set('is_read', false);
      notification.set('created_at', new Date());
      await notification.save(null, {useMasterKey: true});

      return {
        message:
          'Invoice confirmed, appointment updated, and provider notified',
        invoice: invoice.toJSON(),
        appointment_status: appointment.get('status'),
      };
    } catch (error: any) {
      console.error('Error in confirmInvoicePayment:', error);
      throw {
        codeStatus: error.codeStatus || 1009,
        message: error.message || 'Failed to confirm invoice payment',
      };
    }
  }
}

export default new InvoiceFunctions();
