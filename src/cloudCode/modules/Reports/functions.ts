import {CloudFunction} from '../../utils/Registry/decorators';
import Reports from '../../models/Reports';
import Appointment from '../../models/Appointment';
import ChatGroup from '../../models/ChatGroup';

async function _getUser(req: Parse.Cloud.FunctionRequest) {
  if (req.user) return req.user;

  const sessionToken = (req as any).headers?.['x-parse-session-token'];
  if (!sessionToken) return null;

  const sessionQuery = new Parse.Query(Parse.Session);
  sessionQuery.equalTo('sessionToken', sessionToken);
  sessionQuery.include('user');
  const session = await sessionQuery.first({useMasterKey: true});
  return session?.get('user') || null;
}

class ReportsFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        appointment_id: {type: String, required: true},
        content: {type: String, required: true},
        summary: {type: String, required: false},
      },
    },
  })
  async submitReport(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {appointment_id, content, summary, child_id} = req.params;

      const appointment = await new Parse.Query(Appointment)
        .include(['provider_id', 'child_id'])
        .get(appointment_id, {useMasterKey: true});

      if (!appointment) {
        throw {codeStatus: 104, message: 'Appointment not found'};
      }

      if (appointment.get('provider_id')?.id !== user.id) {
        throw {
          codeStatus: 403,
          message:
            'Unauthorized: Only the assigned provider can submit a report',
        };
      }

      const report = new Reports();
      report.set('appointment_id', appointment);
      report.set('author_id', user);
      report.set('provider_id', user);
      report.set('doctor_id', user);

      const parentUser = appointment.get('user_id');
      if (parentUser) {
        report.set('parent_id', parentUser);
      }

      let finalChild = appointment.get('child_id');

      if (!finalChild && child_id && child_id.trim() !== '') {
        finalChild = new Parse.Object('ChildProfile', {id: child_id});
      }

      if (!finalChild) {
        try {
          const chatGroupQuery = new Parse.Query(ChatGroup);
          chatGroupQuery.equalTo('appointment_id', appointment);
          chatGroupQuery.include('child_id');
          const chatGroup = await chatGroupQuery.first({useMasterKey: true});

          if (chatGroup) {
            finalChild = chatGroup.get('child_id');
          }
        } catch (e) {
          console.log('Could not fetch child from ChatGroup:', e);
        }
      }

      if (!finalChild) {
        console.warn(
          ` Submitting report for appointment ${appointment_id} without child_id`
        );
        console.warn(
          `  This appointment has no child information in Appointment, ChatGroup, or params`
        );
      } else {
        report.set('child_id', finalChild);
      }

      report.set('content', content);
      report.set('report_content', content);
      if (summary) report.set('summary', summary);

      await report.save(null, {useMasterKey: true});

      appointment.set('status', 'completed');
      if (!appointment.get('provider_id')) {
        appointment.set('provider_id', user);
      }
      await appointment.save(null, {useMasterKey: true});

      return {
        message: 'Report submitted successfully',
        report_id: report.id,
      };
    } catch (error: any) {
      console.error('Error in submitReport:', error);
      throw {
        codeStatus: error.codeStatus || 1026,
        message: error.message || 'Failed to submit report',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        child_id: {type: String, required: true},
      },
    },
  })
  async getReportsForChild(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const {child_id} = req.params;

      const query = new Parse.Query(Reports);
      query.equalTo(
        'child_id',
        new Parse.Object('ChildProfile', {id: child_id})
      );
      query.include([
        'author_id',
        'appointment_id',
        'appointment_id.appointment_plan_id',
      ]);
      query.descending('createdAt');

      const results = await query.find({useMasterKey: true});

      const reports = results.map(report => ({
        report_id: report.id,
        content: report.get('report_content'),
        summary: report.get('summary') || null,
        created_at: report.createdAt,
        author: {
          id: report.get('author_id')?.id,
          username: report.get('author_id')?.get('username'),
          fullName: report.get('author_id')?.get('fullName'),
        },
        appointment: {
          id: report.get('appointment_id')?.id,
          plan_title: report
            .get('appointment_id')
            ?.get('appointment_plan_id')
            ?.get('title'),
        },
      }));

      return reports;
    } catch (error: any) {
      console.error('Error in getReportsForChild:', error);
      throw {
        codeStatus: error.codeStatus || 1027,
        message: error.message || 'Failed to fetch reports',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {},
    },
  })
  async getReportsForParent(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const query = new Parse.Query(Reports);
      query.equalTo('parent_id', user);
      query.include([
        'author_id',
        'appointment_id',
        'appointment_id.appointment_plan_id',
        'child_id',
      ]);
      query.descending('createdAt');

      const results = await query.find({useMasterKey: true});

      const reports = results.map(report => ({
        report_id: report.id,
        content: report.get('report_content') || report.get('content'),
        summary: report.get('summary') || null,
        created_at: report.createdAt,
        author: {
          id: report.get('author_id')?.id,
          username: report.get('author_id')?.get('username'),
          fullName: report.get('author_id')?.get('fullName'),
        },
        appointment: {
          id: report.get('appointment_id')?.id,
          plan_title: report
            .get('appointment_id')
            ?.get('appointment_plan_id')
            ?.get('title'),
        },
        child: report.get('child_id')
          ? {
              id: report.get('child_id').id,
              fullName: report.get('child_id').get('fullName'),
            }
          : null,
      }));

      return {reports, count: reports.length};
    } catch (error: any) {
      console.error('Error in getReportsForParent:', error);
      throw {
        codeStatus: error.codeStatus || 1028,
        message: error.message || 'Failed to fetch reports for parent',
      };
    }
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {},
    },
  })
  async getReportsForDoctor(req: Parse.Cloud.FunctionRequest) {
    try {
      const user = await _getUser(req);
      if (!user) {
        throw {codeStatus: 103, message: 'User context is missing'};
      }

      const query = new Parse.Query(Reports);
      query.equalTo('author_id', user);
      query.include([
        'parent_id',
        'appointment_id',
        'appointment_id.appointment_plan_id',
        'child_id',
      ]);
      query.descending('createdAt');

      const results = await query.find({useMasterKey: true});

      const reports = results.map(report => ({
        report_id: report.id,
        content: report.get('report_content') || report.get('content'),
        summary: report.get('summary') || null,
        created_at: report.createdAt,
        parent: report.get('parent_id')
          ? {
              id: report.get('parent_id').id,
              username: report.get('parent_id').get('username'),
              fullName: report.get('parent_id').get('fullName'),
              mobileNumber: report.get('parent_id').get('mobileNumber'),
            }
          : null,
        appointment: report.get('appointment_id')
          ? {
              id: report.get('appointment_id').id,
              plan_title: report
                .get('appointment_id')
                .get('appointment_plan_id')
                ?.get('title'),
            }
          : null,
        child: report.get('child_id')
          ? {
              id: report.get('child_id').id,
              fullName: report.get('child_id').get('fullName'),
            }
          : null,
      }));

      return {reports, count: reports.length};
    } catch (error: any) {
      console.error('Error in getReportsForDoctor:', error);
      throw {
        codeStatus: error.codeStatus || 1029,
        message: error.message || 'Failed to fetch reports for doctor',
      };
    }
  }
}

export default new ReportsFunctions();
